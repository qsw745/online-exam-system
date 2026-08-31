import { createFixedTableHandler, defaultLifecycleHandlerDatabase, type LifecycleHandlerDatabase } from './handler-support'

const FACE_TABLES = [{ table: 'face_credentials', subjectColumn: 'user_id' }] as const

export const createDeleteFaceCredentialsHandler = (database: LifecycleHandlerDatabase = defaultLifecycleHandlerDatabase) =>
  createFixedTableHandler({ stepCode: 'delete_face_credentials', category: 'FACE_CREDENTIALS', database, specs: FACE_TABLES })
