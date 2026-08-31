import type { LifecycleHandler } from '../services/lifecycle-worker.service'
import { createAnonymizeExamArchiveHandler } from './anonymize-exam-archive.handler'
import { createAnonymizeUserContentHandler } from './anonymize-user-content.handler'
import { createDeleteAccountHandler, failClosedManifestStager, type DeletionManifestStager } from './delete-account.handler'
import { createDeleteAuthCredentialsHandler } from './delete-auth-credentials.handler'
import { createDeleteFaceCredentialsHandler } from './delete-face-credentials.handler'
import { createDeletePersonalDataHandler } from './delete-personal-data.handler'
import { createDeletePrivateMessagesHandler } from './delete-private-messages.handler'
import { createDetachMembershipsHandler } from './detach-memberships.handler'
import { defaultLifecycleHandlerDatabase, type LifecycleHandlerDatabase } from './handler-support'
import { createRedactAuditActorsHandler } from './redact-audit-actors.handler'
import { createRedactSecurityLogsHandler } from './redact-security-logs.handler'
import { createRestrictGuardianConsentsHandler } from './restrict-guardian-consents.handler'
import { createRestrictProctoringDataHandler } from './restrict-proctoring-data.handler'

export function createLifecycleHandlerMap(input: {
  database?: LifecycleHandlerDatabase
  manifest?: DeletionManifestStager
} = {}): ReadonlyMap<string, LifecycleHandler> {
  const database = input.database ?? defaultLifecycleHandlerDatabase
  const handlers: LifecycleHandler[] = [
    createDeleteAuthCredentialsHandler(database),
    createDeleteFaceCredentialsHandler(database),
    createDeletePersonalDataHandler(database),
    createDeletePrivateMessagesHandler(database),
    createAnonymizeUserContentHandler(database),
    createAnonymizeExamArchiveHandler({ database }),
    createRestrictProctoringDataHandler({ database }),
    createRestrictGuardianConsentsHandler(database),
    createDetachMembershipsHandler(database),
    createRedactAuditActorsHandler(database),
    createRedactSecurityLogsHandler(database),
    createDeleteAccountHandler({ database, manifest: input.manifest ?? failClosedManifestStager }),
    {
      stepCode: 'sync_deletion_manifest',
      category: 'RECEIPT_AND_TOMBSTONE',
      async planCount() { return 0 },
      async executeBatch() {
        throw Object.assign(new Error('删除墓碑同步处理器尚未配置'), {
          code: 'LIFECYCLE_MANIFEST_NOT_CONFIGURED',
          recoverable: false,
        })
      },
    },
  ]
  const map = new Map<string, LifecycleHandler>()
  for (const handler of handlers) {
    if (map.has(handler.stepCode)) throw new Error(`重复生命周期处理器：${handler.stepCode}`)
    map.set(handler.stepCode, handler)
  }
  return map
}

export type { DeletionManifestStager } from './delete-account.handler'
export type { LifecycleHandlerDatabase } from './handler-support'
