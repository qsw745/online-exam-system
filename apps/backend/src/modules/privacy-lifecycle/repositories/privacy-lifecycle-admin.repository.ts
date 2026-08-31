import { pool } from '@/config/database'
import HttpError from '@/common/errors/http-error'
import type { DataRegion } from '../domain/lifecycle.model'
import type { PrivacyLifecycleAdminRepositoryContract } from '../services/privacy-lifecycle-admin.service'

const db = pool as any

export const PrivacyLifecycleAdminRepository: PrivacyLifecycleAdminRepositoryContract = {
  async createHold(input) {
    try {
      await db.query(
        `INSERT INTO data_retention_holds
          (hold_id,data_region,category_code,scope_type,scope_id,reason_code,
           legal_basis_reference,request_digest,expires_at,created_by,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [input.holdId,input.dataRegion,input.category,input.scopeType,input.scopeId,input.reasonCode,input.legalBasisReference,input.requestDigest,input.expiresAt,input.createdBy,input.createdAt],
      )
    } catch (error: any) {
      if (error?.code !== 'ER_DUP_ENTRY') throw error
      const [existing] = await db.query('SELECT hold_id,request_digest FROM data_retention_holds WHERE hold_id=? AND data_region=? LIMIT 1',[input.holdId,input.dataRegion])
      if (String(existing[0]?.request_digest) !== input.requestDigest) throw new HttpError('冻结编号已用于不同请求',409,{code:'LIFECYCLE_REQUEST_CONFLICT'})
    }
    return { holdId: input.holdId, dataRegion: input.dataRegion, category: input.category, scopeType: input.scopeType, scopeId: input.scopeId, reasonCode: input.reasonCode, expiresAt: new Date(input.expiresAt).toISOString(), releasedAt: null }
  },
  async releaseHold(dataRegion,holdId,actorId,now) {
    const [result] = await db.query(`UPDATE data_retention_holds SET released_by=?,released_at=?,updated_at=? WHERE hold_id=? AND data_region=? AND released_at IS NULL`,[actorId,now,now,holdId,dataRegion])
    return result.affectedRows ? {holdId,releasedAt:now.toISOString()} : null
  },
  async extendHold(dataRegion,holdId,expiresAt,_actorId,now) {
    const [result] = await db.query(`UPDATE data_retention_holds SET expires_at=?,updated_at=? WHERE hold_id=? AND data_region=? AND released_at IS NULL`,[expiresAt,now,holdId,dataRegion])
    return result.affectedRows ? {holdId,expiresAt:expiresAt.toISOString()} : null
  },
  async pauseRegion(dataRegion,reason,reviewAt,actorId) { await db.query(`INSERT INTO data_lifecycle_controls(data_region,paused,pause_reason,review_at,updated_by) VALUES (?,1,?,?,?) ON DUPLICATE KEY UPDATE paused=1,pause_reason=VALUES(pause_reason),review_at=VALUES(review_at),updated_by=VALUES(updated_by),updated_at=NOW()`,[dataRegion,reason,reviewAt,actorId]) },
  async resumeRegion(dataRegion,actorId) { await db.query(`INSERT INTO data_lifecycle_controls(data_region,paused,updated_by) VALUES (?,0,?) ON DUPLICATE KEY UPDATE paused=0,pause_reason=NULL,review_at=NULL,updated_by=VALUES(updated_by),updated_at=NOW()`,[dataRegion,actorId]) },
  async retryStep(dataRegion,stepId,now) {
    const [result] = await db.query(`UPDATE data_lifecycle_steps s LEFT JOIN account_deletion_requests r ON r.request_id=s.request_id LEFT JOIN data_retention_scan_runs q ON q.scan_run_id=s.scan_run_id SET s.status='PENDING',s.attempt_count=0,s.next_attempt_at=?,s.last_error_code=NULL,s.lease_owner=NULL,s.lease_expires_at=NULL WHERE s.step_id=? AND COALESCE(r.data_region,q.data_region)=? AND s.status IN ('ATTENTION_REQUIRED','RETRYING')`,[now,stepId,dataRegion])
    return Number(result.affectedRows)>0
  },
  async listRequests(dataRegion,input={}) {
    const limit=Math.max(1,Math.min(100,Number(input.limit)||20)), offset=Math.max(0,Number(input.offset)||0)
    const [rows]=await db.query(`SELECT request_id,deletion_mode,execution_status,requested_at,scheduled_for,started_at,completed_at FROM account_deletion_requests WHERE data_region=? ORDER BY requested_at DESC LIMIT ? OFFSET ?`,[dataRegion,limit,offset])
    return {items:rows,limit,offset}
  },
  async getRequest(dataRegion,requestId) {
    const [rows]=await db.query(`SELECT request_id,deletion_mode,execution_status,requested_at,scheduled_for,started_at,completed_at FROM account_deletion_requests WHERE request_id=? AND data_region=? LIMIT 1`,[requestId,dataRegion])
    if(!rows[0]) return null
    const [steps]=await db.query(`SELECT step_id,step_code,category_code,action,status,planned_count,processed_count,attempt_count,last_error_code,lease_expires_at FROM data_lifecycle_steps WHERE request_id=? ORDER BY id`,[requestId])
    return {...rows[0],steps}
  },
  async getDryRunContext(dataRegion,requestId) {
    const [rows]=await db.query(`SELECT user_id,policy_snapshot_json FROM account_deletion_requests WHERE request_id=? AND data_region=? LIMIT 1`,[requestId,dataRegion])
    if(!rows[0]||rows[0].user_id==null) return null
    let policySnapshot=null
    try{policySnapshot=typeof rows[0].policy_snapshot_json==='string'?JSON.parse(rows[0].policy_snapshot_json):rows[0].policy_snapshot_json}catch{}
    return {userId:Number(rows[0].user_id),policySnapshot}
  },
}
