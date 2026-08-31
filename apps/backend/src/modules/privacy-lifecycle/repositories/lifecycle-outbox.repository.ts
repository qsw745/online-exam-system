import { pool } from '@/config/database'
import type {
  LifecycleOutboxMessage,
  LifecycleOutboxQueueStats,
  LifecycleOutboxRepositoryContract,
} from '../services/lifecycle-notification.service'

const database = pool as any

const parseEnvelope = (value: unknown) => typeof value === 'string' ? JSON.parse(value) : value

const assertAffected = (result: any): void => {
  if (Number(result.affectedRows) !== 1) {
    throw Object.assign(new Error('消息箱租约冲突'), { code: 'LIFECYCLE_LEASE_CONFLICT' })
  }
}

export class LifecycleOutboxRepository implements LifecycleOutboxRepositoryContract {
  async purgeExpired(now: Date): Promise<number> {
    const [result] = await database.query(
      `UPDATE transactional_outbox
          SET status='EXPIRED', recipient_envelope_json=NULL, payload_envelope_json=NULL,
              lease_owner=NULL, lease_expires_at=NULL, updated_at=?
        WHERE expires_at<=?
          AND status NOT IN ('SENT', 'EXPIRED')`,
      [now, now],
    )
    return Number(result.affectedRows || 0)
  }

  async readQueueStats(now: Date): Promise<LifecycleOutboxQueueStats> {
    const [rows] = await database.query(
      `SELECT COUNT(*) AS queue_depth,
              COALESCE(MAX(TIMESTAMPDIFF(MICROSECOND, created_at, ?)) / 1000, 0) AS oldest_age_ms
         FROM transactional_outbox
        WHERE status IN ('PENDING', 'RETRYING', 'RUNNING')
          AND expires_at>?`,
      [now, now],
    )
    return {
      depth: Number(rows?.[0]?.queue_depth || 0),
      oldestAgeMs: Math.max(0, Number(rows?.[0]?.oldest_age_ms || 0)),
    }
  }

  async claimDue(workerId: string, now: Date, leaseMs: number): Promise<LifecycleOutboxMessage | null> {
    const connection = await database.getConnection()
    try {
      await connection.beginTransaction()
      const [rows] = await connection.query(
        `SELECT *
           FROM transactional_outbox
          WHERE (
                  status IN ('PENDING', 'RETRYING')
                  OR (status='RUNNING' AND lease_expires_at<=?)
                )
            AND expires_at>?
            AND (next_attempt_at IS NULL OR next_attempt_at<=?)
          ORDER BY id
          LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [now, now, now],
      )
      const row = rows?.[0]
      if (!row) {
        await connection.commit()
        return null
      }
      await connection.query(
        `UPDATE transactional_outbox
            SET status='RUNNING', lease_owner=?, lease_expires_at=?, updated_at=?
          WHERE message_id=?`,
        [workerId, new Date(now.getTime() + leaseMs), now, row.message_id],
      )
      await connection.commit()
      return {
        messageId: String(row.message_id),
        requestId: row.request_id ? String(row.request_id) : null,
        dataRegion: row.data_region,
        messageType: String(row.message_type),
        recipientEnvelope: parseEnvelope(row.recipient_envelope_json),
        payloadEnvelope: parseEnvelope(row.payload_envelope_json),
        attemptCount: Number(row.attempt_count || 0),
        expiresAt: new Date(row.expires_at),
      }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async markSent(workerId: string, messageId: string, now: Date): Promise<void> {
    const [result] = await database.query(
      `UPDATE transactional_outbox
          SET status='SENT', recipient_envelope_json=NULL, payload_envelope_json=NULL,
              sent_at=?, lease_owner=NULL, lease_expires_at=NULL, updated_at=?
        WHERE message_id=? AND lease_owner=? AND status='RUNNING'`,
      [now, now, messageId, workerId],
    )
    assertAffected(result)
  }

  async markRetry(
    workerId: string,
    messageId: string,
    errorCode: string,
    now: Date,
  ): Promise<void> {
    const [result] = await database.query(
      `UPDATE transactional_outbox
          SET status='RETRYING', attempt_count=attempt_count+1,
              next_attempt_at=DATE_ADD(?, INTERVAL LEAST(3600, POW(2, attempt_count)) SECOND),
              last_error_code=?, lease_owner=NULL, lease_expires_at=NULL, updated_at=?
        WHERE message_id=? AND lease_owner=? AND status='RUNNING'`,
      [now, errorCode, now, messageId, workerId],
    )
    assertAffected(result)
  }
}
