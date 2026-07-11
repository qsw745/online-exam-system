import { Router } from 'express'
import { authenticateToken, requireRole } from '@/common/middleware/auth'
import { rateLimit } from '@/common/middleware/rate-limit'
import { AiController } from '../controllers/ai.controller'
import { named } from '@/common/async-handler'

const router = Router()
router.use(authenticateToken)

const aiLimit = rateLimit({ keyBuilder: r => `rl:ip:${(r as any).ip || r.ip}:ai`, limit: 30, windowSec: 60 })
const sessionLimit = rateLimit({ keyBuilder: r => `rl:ip:${(r as any).ip || r.ip}:ai:session`, limit: 120, windowSec: 60 })

router.post('/chat', aiLimit, named('ai.chat', AiController.chat as any))
router.post('/questions/generate', aiLimit, named('ai.questions.generate', AiController.generateQuestions as any))
router.post('/questions/generate/async', aiLimit, named('ai.questions.generate.async', AiController.generateQuestionsAsync as any))
router.get('/questions/generate/jobs/:id', aiLimit, named('ai.questions.generate.job', AiController.getGenerateJob as any))
router.post('/questions/preview/persist/async', aiLimit, named('ai.questions.preview.persist', AiController.persistPreviewAsync as any))
router.post('/questions/explain', aiLimit, named('ai.questions.explain', AiController.explainQuestion as any))
router.post('/answers/grade', aiLimit, named('ai.answers.grade', AiController.gradeShortAnswer as any))
router.post('/exams/summary', aiLimit, named('ai.exams.summary', AiController.summarizeExam as any))
router.post('/study/plan', aiLimit, named('ai.study.plan', AiController.studyPlan as any))
router.post('/papers/suggest', aiLimit, named('ai.papers.suggest', AiController.suggestPaper as any))
router.post('/agent', aiLimit, named('ai.agent', AiController.agent as any))
router.post('/agent/stream', aiLimit, named('ai.agent.stream', AiController.agentStream as any))
router.get('/sessions', sessionLimit, named('ai.sessions.list', AiController.listSessions as any))
router.put('/sessions/:id', sessionLimit, named('ai.sessions.upsert', AiController.upsertSession as any))
router.delete('/sessions/:id', sessionLimit, named('ai.sessions.delete', AiController.deleteSession as any))
router.post(
  '/knowledge',
  sessionLimit,
  requireRole(['admin', 'teacher']),
  named('ai.knowledge.add', AiController.addKnowledge as any)
)
router.get(
  '/knowledge',
  sessionLimit,
  requireRole(['admin', 'teacher']),
  named('ai.knowledge.list', AiController.listKnowledge as any)
)
router.post('/knowledge/search', sessionLimit, named('ai.knowledge.search', AiController.searchKnowledge as any))
router.get('/logs', sessionLimit, named('ai.logs.list', AiController.listLogs as any))
router.get('/logs/export', sessionLimit, named('ai.logs.export', AiController.exportLogs as any))

export { router as aiRoutes }
export default router
