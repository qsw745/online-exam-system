import { randomUUID } from 'node:crypto'
import { emailService } from '@/infrastructure/email/email.service'
import { log } from '@/infrastructure/logging/logger'
import { parseOutboxKeyring } from '../domain/outbox-crypto'
import { LifecycleOutboxRepository } from '../repositories/lifecycle-outbox.repository'
import {
  assertLifecycleMailerConfigured,
  dispatchLifecycleOutboxOnce,
} from '../services/lifecycle-notification.service'
import { NoopLifecycleMetrics } from '../services/lifecycle-observability'

export async function startLifecycleOutboxWorker(once = process.argv.includes('--once')): Promise<void> {
  assertLifecycleMailerConfigured(process.env)
  const keyring = parseOutboxKeyring(process.env)
  const repository = new LifecycleOutboxRepository()
  const metrics = new NoopLifecycleMetrics()
  const workerId = `outbox-${process.pid}-${randomUUID()}`

  do {
    const summary = await dispatchLifecycleOutboxOnce({
      repository,
      keyring,
      mailer: emailService,
      metrics,
      workerId,
      now: new Date(),
      leaseMs: 30_000,
    })
    log.info('lifecycle outbox run completed', summary)
    if (!once) await new Promise(resolve => setTimeout(resolve, 1_000))
  } while (!once)
}

if (require.main === module) {
  startLifecycleOutboxWorker().catch(error => {
    log.error('lifecycle outbox stopped', {
      code: String(error?.code || 'LIFECYCLE_OUTBOX_START_FAILED'),
    })
    process.exitCode = 1
  })
}
