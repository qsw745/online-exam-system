// apps/backend/src/modules/tasks/routes/task.routes.ts
import { Router, type RequestHandler } from 'express'
import { authenticateToken } from '@/common/middleware/auth'
import { requireRoleByIds } from '@/common/middleware/role-auth'
import { ROLE_IDS } from '@/config/roles'
import { TaskController } from '../controllers/task.controller.js'

type AsyncCtrl = (req: any, res: any) => any | Promise<any>
const wrap =
    (fn: AsyncCtrl): RequestHandler =>
        (req, res, next) => Promise.resolve(fn(req, res)).catch(next)

const router = Router()
router.use(authenticateToken)

/** 我的任务 */
router.get('/mine', wrap(TaskController.listMine))

/** 管理列表（仅老师/管理员/超管） */
router.get('/', requireRoleByIds([ROLE_IDS.TEACHER, ROLE_IDS.ADMIN, ROLE_IDS.SUPER_ADMIN]), wrap(TaskController.list))

/** 开始/继续考试（支持 taskId 或 examId） */
router.get('/:id/exam', wrap(TaskController.getExam))

router.get('/:id', wrap(TaskController.get))
router.post('/', requireRoleByIds([ROLE_IDS.TEACHER, ROLE_IDS.ADMIN, ROLE_IDS.SUPER_ADMIN]), wrap(TaskController.create))
router.put('/:id', wrap(TaskController.update))
router.delete('/:id', wrap(TaskController.delete))

router.post('/:id/submit', wrap(TaskController.submit))
router.post('/:id/publish', requireRoleByIds([ROLE_IDS.TEACHER, ROLE_IDS.ADMIN, ROLE_IDS.SUPER_ADMIN]), wrap(TaskController.publish))
router.post('/:id/unpublish', requireRoleByIds([ROLE_IDS.TEACHER, ROLE_IDS.ADMIN, ROLE_IDS.SUPER_ADMIN]), wrap(TaskController.unpublish))

router.post('/batch/publish', requireRoleByIds([ROLE_IDS.TEACHER, ROLE_IDS.ADMIN, ROLE_IDS.SUPER_ADMIN]), wrap(TaskController.batchPublish))
router.post('/batch/unpublish', requireRoleByIds([ROLE_IDS.TEACHER, ROLE_IDS.ADMIN, ROLE_IDS.SUPER_ADMIN]), wrap(TaskController.batchUnpublish))

export { router as taskRoutes }
export default router
