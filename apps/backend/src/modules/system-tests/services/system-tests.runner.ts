import { UserService } from '@/modules/users/services/user.service'
import { QuestionService } from '@/modules/questions/services/question.service'
import { ExamService } from '@/modules/exams/services/exam.service'
import { NotificationService } from '@/modules/notifications/services/notification.service'
import { MailService } from '@/modules/mail/services/mail.service'

type TestResult = {
  name: string
  ok: boolean
  durationMs: number
  detail?: any
}

type TestRunResult = {
  summary: { total: number; passed: number; failed: number; durationMs: number }
  results: TestResult[]
  report: string
}

const userSvc = new UserService()
const questionSvc = new QuestionService()
const examSvc = new ExamService()

const nowStamp = () => new Date().toISOString().replace(/[:.TZ-]/g, '')

const timed = async <T>(name: string, fn: () => Promise<T>): Promise<{ result?: T; meta: TestResult }> => {
  const start = Date.now()
  try {
    const result = await fn()
    return { result, meta: { name, ok: true, durationMs: Date.now() - start } }
  } catch (e: any) {
    return {
      meta: {
        name,
        ok: false,
        durationMs: Date.now() - start,
        detail: e?.message || e,
      },
    }
  }
}

const pickModules = (mods?: string[]) => {
  const all = ['users', 'questions', 'exams', 'notifications', 'mail']
  if (!mods?.length) return all
  const set = new Set(mods.map(m => String(m || '').toLowerCase()))
  return all.filter(m => set.has(m))
}

export async function runSystemTests(input: {
  modules?: string[]
  iterations?: number
  user: { id: number; email?: string }
}): Promise<TestRunResult> {
  const modules = pickModules(input.modules)
  const iterations = Math.max(1, Number(input.iterations || 1))
  const results: TestResult[] = []
  const startedAt = Date.now()

  for (let round = 1; round <= iterations; round++) {
    const suffix = `${nowStamp()}_${round}`

    if (modules.includes('users')) {
      const email = `test-${suffix}@local.test`
      const userCreate = await timed(`users:create#${round}`, async () => {
        return await userSvc.adminCreate(
          {
            nickname: `测试用户${round}`,
            email,
            password: `Tt${suffix}!`,
            status: 'active',
            role: 'student',
          },
          { id: input.user.id, email: input.user.email }
        )
      })
      results.push(userCreate.meta)
      const created = userCreate.result as any
      if (created?.id) {
        const updateRes = await timed(`users:update#${round}`, async () => {
          return await userSvc.adminUpdate(
            created.id,
            { nickname: `测试用户${round}-更新` },
            { id: input.user.id, email: input.user.email }
          )
        })
        results.push(updateRes.meta)
        const listRes = await timed(`users:list#${round}`, async () => {
          return await userSvc.list({ page: 1, limit: 5, search: email })
        })
        results.push(listRes.meta)
        const delRes = await timed(`users:delete#${round}`, async () => {
          await userSvc.deleteUser(created.id, 'student', { id: input.user.id, email: input.user.email })
        })
        results.push(delRes.meta)
      }
    }

    if (modules.includes('questions')) {
      const qCreate = await timed(`questions:create#${round}`, async () => {
        return await questionSvc.create(
          { id: input.user.id, email: input.user.email },
          {
            content: `测试题目内容-${suffix}`,
            question_type: 'single_choice',
            options: [
              { content: 'A', is_correct: true },
              { content: 'B', is_correct: false },
            ],
            correct_answer: 'A',
            explanation: '测试解析',
            difficulty: 'easy',
          }
        )
      })
      results.push(qCreate.meta)
      const created = qCreate.result as any
      if (created?.question?.id) {
        const qid = created.question.id
        const qUpdate = await timed(`questions:update#${round}`, async () => {
          return await questionSvc.update(
            { id: input.user.id, email: input.user.email },
            qid,
            { title: `测试题目标题-${suffix}` }
          )
        })
        results.push(qUpdate.meta)
        const qDelete = await timed(`questions:delete#${round}`, async () => {
          await questionSvc.remove({ id: input.user.id, email: input.user.email }, qid)
        })
        results.push(qDelete.meta)
      }
    }

    if (modules.includes('exams')) {
      const qCreate = await timed(`exams:prep_question#${round}`, async () => {
        return await questionSvc.create(
          { id: input.user.id, email: input.user.email },
          {
            content: `考试题目内容-${suffix}`,
            question_type: 'single_choice',
            options: [
              { content: 'A', is_correct: true },
              { content: 'B', is_correct: false },
            ],
            correct_answer: 'A',
            explanation: '考试题解析',
            difficulty: 'easy',
          }
        )
      })
      results.push(qCreate.meta)
      const qid = (qCreate.result as any)?.question?.id
      if (qid) {
        const now = new Date()
        const later = new Date(now.getTime() + 60 * 60 * 1000)
        const examCreate = await timed(`exams:create#${round}`, async () => {
          return await examSvc.create(input.user.id, {
            title: `测试考试-${suffix}`,
            description: '系统测速创建',
            duration: 30,
            start_time: now,
            end_time: later,
            total_score: 10,
            passing_score: 6,
            questions: [{ question_id: qid }],
          })
        })
        results.push(examCreate.meta)
        const examId = (examCreate.result as any)?.id
        if (examId) {
          const examUpdate = await timed(`exams:update#${round}`, async () => {
            return await examSvc.update(input.user.id, examId, {
              title: `测试考试更新-${suffix}`,
            })
          })
          results.push(examUpdate.meta)
          const examDelete = await timed(`exams:delete#${round}`, async () => {
            await examSvc.remove(input.user.id, examId)
          })
          results.push(examDelete.meta)
        }
        const qDelete = await timed(`exams:cleanup_question#${round}`, async () => {
          await questionSvc.remove({ id: input.user.id, email: input.user.email }, qid)
        })
        results.push(qDelete.meta)
      }
    }

    if (modules.includes('notifications')) {
      const notifyCreate = await timed(`notifications:create#${round}`, async () => {
        return await NotificationService.create(input.user.id, {
          user_id: input.user.id,
          title: `测试通知-${suffix}`,
          content: '系统测速通知',
          type: 'info',
        })
      })
      results.push(notifyCreate.meta)
      const nid = (notifyCreate.result as any)?.id
      const listRes = await timed(`notifications:list#${round}`, async () => {
        return await NotificationService.list(input.user.id)
      })
      results.push(listRes.meta)
      if (nid) {
        const readRes = await timed(`notifications:read#${round}`, async () => {
          return await NotificationService.markAsRead(input.user.id, nid)
        })
        results.push(readRes.meta)
        const delRes = await timed(`notifications:delete#${round}`, async () => {
          return await NotificationService.remove(input.user.id, nid)
        })
        results.push(delRes.meta)
      }
    }

    if (modules.includes('mail')) {
      const mailSend = await timed(`mail:send#${round}`, async () => {
        return await MailService.send(input.user.id, {
          subject: `测速邮件-${suffix}`,
          content: '系统测速邮件内容',
          recipients: [input.user.id],
        })
      })
      results.push(mailSend.meta)
      const mailId = (mailSend.result as any)?.id
      const inboxRes = await timed(`mail:inbox#${round}`, async () => {
        return await MailService.getInbox(input.user.id)
      })
      results.push(inboxRes.meta)
      const sentRes = await timed(`mail:sent#${round}`, async () => {
        return await MailService.getSent(input.user.id)
      })
      results.push(sentRes.meta)
      if (mailId) {
        const delInbox = await timed(`mail:delete_inbox#${round}`, async () => {
          return await MailService.deleteInbox(input.user.id, mailId)
        })
        results.push(delInbox.meta)
        const delSent = await timed(`mail:delete_sent#${round}`, async () => {
          return await MailService.deleteSent(input.user.id, mailId)
        })
        results.push(delSent.meta)
      }
    }
  }

  const passed = results.filter(r => r.ok).length
  const failed = results.length - passed
  const reportLines: string[] = []
  reportLines.push('系统测速报告')
  reportLines.push(`时间: ${new Date().toISOString()}`)
  reportLines.push(`模块: ${modules.join(', ')}`)
  reportLines.push(`迭代: ${iterations}`)
  reportLines.push(`总计: ${results.length} | 通过: ${passed} | 失败: ${failed} | 耗时: ${Date.now() - startedAt}ms`)
  reportLines.push('')
  reportLines.push('结果明细:')
  for (const r of results) {
    const status = r.ok ? 'OK' : 'FAIL'
    const detail = r.detail ? ` | ${String(r.detail)}` : ''
    reportLines.push(`- [${status}] ${r.name} (${r.durationMs}ms)${detail}`)
  }
  return {
    summary: { total: results.length, passed, failed, durationMs: Date.now() - startedAt },
    results,
    report: reportLines.join('\n'),
  }
}
