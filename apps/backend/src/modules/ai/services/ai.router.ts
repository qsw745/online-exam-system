import { ResultService } from '@/modules/exams/services/result.service'
import { get as cacheGet, set as cacheSet } from '@/common/redis/cache'

const resultSvc = new ResultService()

type PendingSummaryItem = { id: number; title: string; score?: number; total?: number; end_time?: string | null }

const PENDING_TTL_SEC = 600
const pendingKey = (userId: number) => `ai:pending:summary:${userId}`

const setPending = async (userId: number, items: PendingSummaryItem[]) =>
  cacheSet(pendingKey(userId), JSON.stringify(items), PENDING_TTL_SEC)

const getPending = async (userId: number): Promise<PendingSummaryItem[] | null> => {
  const raw = await cacheGet(pendingKey(userId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as PendingSummaryItem[]) : null
  } catch {
    return null
  }
}

const extractExplicitId = (text: string): number | null => {
  const m = text.match(/(?:^|\b)(?:id|ID)?\s*(\d{1,8})\b/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

const isPureNumber = (text: string): number | null => {
  const s = text.trim()
  if (!/^\d{1,8}$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const fmtTime = (v?: string | null) => {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const summarizeIntent = (text: string) => /总结|分析|报告|复盘|成绩|表现/.test(text)

const wantLatest = (text: string) => /最近|最新|上一场|上次/.test(text)

const parseZhNumber = (raw: string): number | null => {
  const text = String(raw || '').trim()
  if (!text) return null
  if (/^\d+$/.test(text)) return Number(text)
  const digit: Record<string, number> = {
    零: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  }
  if (text === '十') return 10
  const ten = text.match(/^([一二两三四五六七八九])?十([一二三四五六七八九])?$/)
  if (ten) return (ten[1] ? digit[ten[1]] : 1) * 10 + (ten[2] ? digit[ten[2]] : 0)
  return digit[text] ?? null
}

const firstNumber = (text: string, unit: string, fallback: number) => {
  const match = text.match(new RegExp(`([0-9一二两三四五六七八九十]+)\\s*${unit}`))
  const n = match?.[1] ? parseZhNumber(match[1]) : null
  return Number.isFinite(n) && (n as number) > 0 ? (n as number) : fallback
}

const pickDifficulty = (text: string) => {
  if (/困难|较难|高难|hard/i.test(text)) return 'hard'
  if (/简单|容易|基础|easy/i.test(text)) return 'easy'
  return 'medium'
}

const pickQuestionType = (text: string) => {
  if (/多选/.test(text)) return 'multiple_choice'
  if (/判断|是非/.test(text)) return 'true_false'
  if (/简答|问答|主观/.test(text)) return 'short_answer'
  return 'single_choice'
}

const extractAfter = (text: string, markers: string[]) => {
  for (const marker of markers) {
    const idx = text.indexOf(marker)
    if (idx >= 0) {
      return text
        .slice(idx + marker.length)
        .split(/[，。,.；;]/)[0]
        .replace(/[“”"']/g, '')
        .trim()
    }
  }
  return ''
}

const questionIntent = (text: string) => /生成|出题|题目|试题/.test(text) && !/试卷|组卷/.test(text)

const paperIntent = (text: string) => /组卷|试卷|套卷/.test(text) && /生成|创建|推荐|建议|智能|自动/.test(text)

const studyPlanIntent = (text: string) => /学习计划|复习计划|训练计划|薄弱|提分/.test(text)

const workflowIntent = (text: string) => /审批|流程|待处理/.test(text)

const runTestIntent = (text: string) => /系统测速|测速|健康检查|自检|回归测试|测试系统/.test(text)

const buildQuestionAction = (text: string) => {
  const count = Math.min(firstNumber(text, '(?:道|题|个)', 5), 50)
  const subject = extractAfter(text, ['主题是', '主题为', '关于', '围绕']) || '课程重点'
  const persist = /入库|保存|写入题库|创建到题库/.test(text) && !/不入库|不要入库|先给预览|预览/.test(text)
  return {
    reply: persist
      ? `我会先生成 ${count} 道题，并在你确认后写入题库。`
      : `我会生成 ${count} 道题目预览，确认后再决定是否入库。`,
    action: {
      type: 'generate_questions',
      payload: {
        subject,
        difficulty: pickDifficulty(text),
        question_type: pickQuestionType(text),
        count,
        persist,
      },
    },
  }
}

const buildPaperAction = (text: string) => {
  const totalQuestions = Math.min(firstNumber(text, '(?:道|题|个)', 20), 200)
  const totalScore = Math.min(firstNumber(text, '(?:分)', 100), 500)
  const duration = Math.min(firstNumber(text, '(?:分钟|分种|分钟考试)', 60), 360)
  const target = extractAfter(text, ['主题是', '主题为', '关于', '围绕', '面向']) || '课程综合测评'
  const title = extractAfter(text, ['标题为', '名称为', '叫做']) || `${target}智能试卷`
  const suggestOnly = /建议|推荐|方案/.test(text) && !/创建|生成|落库|保存/.test(text)
  const payload = {
    target,
    totalQuestions,
    totalScore,
    difficulty: pickDifficulty(text),
    duration,
  }
  if (suggestOnly) {
    return {
      reply: `我会生成一份 ${totalQuestions} 题、${totalScore} 分、${duration} 分钟的组卷建议。`,
      action: { type: 'suggest_paper', payload },
    }
  }
  return {
    reply: `我会创建一份 ${totalQuestions} 题、${totalScore} 分、${duration} 分钟的试卷，执行前会先让你确认。`,
    action: {
      type: 'create_paper',
      payload: {
        ...payload,
        title,
        enable_review: /审批|审核|流程/.test(text),
      },
    },
  }
}

const buildStudyPlanAction = (text: string) => {
  const timeRange = extractAfter(text, ['生成', '制定']) || `${firstNumber(text, '(?:周)', 4)} 周`
  return {
    reply: '我会基于你的目标和薄弱点生成可执行学习计划。',
    action: {
      type: 'study_plan',
      payload: {
        goals: text,
        time_range: timeRange,
      },
    },
  }
}

const buildRunTestAction = (text: string) => {
  const modules = [
    ['users', /用户|users/i],
    ['questions', /题目|questions/i],
    ['exams', /考试|试卷|exams|papers/i],
    ['notifications', /通知|notifications/i],
    ['mail', /邮件|mail/i],
  ]
    .filter(([, pattern]) => (pattern as RegExp).test(text))
    .map(([name]) => name as string)
  return {
    reply: '我会发起一次系统测速任务，完成后把通过率、耗时和失败项汇总给你。',
    action: {
      type: 'run_test',
      payload: {
        modules: modules.length ? modules : ['users', 'questions', 'exams', 'notifications', 'mail'],
        iterations: firstNumber(text, '(?:次|轮)', 1),
      },
    },
  }
}

export async function routeAgent(input: {
  user?: { id?: number; role?: string }
  message: string
}): Promise<{ reply: string; action?: { type: string; payload?: any } } | null> {
  const text = String(input.message || '').trim()
  if (!text) return null

  if (/你好|您好|哈喽|嗨|在吗/.test(text)) {
    return {
      reply:
        '你好！我可以帮你查找功能、生成题目、总结考试、制定学习计划等。你也可以直接说“帮我总结最近一次考试”。',
    }
  }

  if (/你是谁|你是啥|你是什么|模型|大模型|能做什么|功能|怎么用/.test(text)) {
    return {
      reply:
        '我是在线考试系统内置的 AI 助手，可帮你生成题目、智能组卷、发起审批、总结考试、制定学习计划和执行系统测速。你可以直接描述目标，我会优先给出可执行操作。',
    }
  }

  if (runTestIntent(text)) return buildRunTestAction(text)

  if (workflowIntent(text) && /模板|配置|设计|发布/.test(text)) {
    return {
      reply: '我会带你进入流程模板页面，那里可以配置并发布 Flowable 审批流程。',
      action: { type: 'navigate', payload: { path: '/admin/workflows/templates' } },
    }
  }

  if (workflowIntent(text)) {
    return {
      reply: '我会打开我的审批页面，你可以在那里查看并处理待办流程任务。',
      action: { type: 'navigate', payload: { path: '/admin/workflows/tasks' } },
    }
  }

  if (questionIntent(text)) return buildQuestionAction(text)

  if (paperIntent(text)) return buildPaperAction(text)

  if (studyPlanIntent(text)) return buildStudyPlanAction(text)

  if (!summarizeIntent(text)) return null
  const userId = input.user?.id
  if (!userId) return { reply: '请先登录后再查看考试总结。' }

  const explicitId = extractExplicitId(text)
  if (explicitId) {
    return {
      reply: `好的，正在生成考试总结（结果ID ${explicitId}）。`,
      action: { type: 'summarize_exam', payload: { exam_result_id: explicitId } },
    }
  }

  const pureId = isPureNumber(text)
  if (pureId) {
    const pending = await getPending(userId)
    if (pending?.length) {
      const hit = pending.find(p => p.id === pureId) || pending[pureId - 1]
      if (hit) {
        return {
          reply: `好的，正在生成考试总结（结果ID ${hit.id}）。`,
          action: { type: 'summarize_exam', payload: { exam_result_id: hit.id } },
        }
      }
    }
  }

  const data = await resultSvc.list(input.user, { page: 1, limit: 3, sort: 'end_time', status: 'submitted' })
  const list = (data?.results || []).map((r: any) => ({
    id: Number(r.id),
    title: String(r.paper_title || `考试${r.exam_id || r.id}`),
    score: Number(r.score || 0),
    total: Number(r.total_score || 0),
    end_time: r.end_time || null,
  }))

  if (!list.length) return { reply: '暂无已提交的考试结果，完成考试后我可以帮你总结。' }

  if (wantLatest(text)) {
    const pick = list[0]
    return {
      reply: `好的，正在生成最近一次考试总结（结果ID ${pick.id}）。`,
      action: { type: 'summarize_exam', payload: { exam_result_id: pick.id } },
    }
  }

  await setPending(userId, list)
  const lines = list
    .map(
      (r, idx) =>
        `${idx + 1}) [ID ${r.id}] ${r.title}  ${r.score}/${r.total}  ${fmtTime(r.end_time)}`
    )
    .join('\n')
  return {
    reply: `我找到了你最近的考试结果，请回复序号或ID（如：1 或 ID ${list[0].id}）：\n${lines}`,
  }
}
