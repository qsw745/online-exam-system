# 问衡严格监考人工复核与申诉实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立严格监考人工复核、考生补充说明、一次限期申诉、审计导出和手机端案件入口的完整本地产品闭环。

**Architecture:** 在现有 `proctoring` 模块内新增独立复核领域，使用案件当前投影加追加式决定、消息和申诉记录。服务端通过纯状态机、考试所有权、事务、UUID 幂等和乐观版本控制保证证据不可篡改；前端分别提供考务响应式队列和考生结果页/手机详情入口，不复用考试发布审批工作流。

**Tech Stack:** Node.js、TypeScript、Express、MySQL/Knex、React 19、Ant Design、Vitest、Node test runner、Playwright、Capacitor iOS。

**Spec:** `docs/superpowers/specs/2026-08-30-wenheng-proctoring-review-design.md`

## Global Constraints

- 原始 `proctoring_events`、身份核验结果和监考会话证据不得由复核操作更新或删除。
- 教师只能处理 `exams.created_by = currentUserId` 的案件；管理员受当前服务数据区域限制；考生只能操作本人案件。
- “确认违规”只改变复核案件，不更新 `exam_results` 或 `users`。
- 每案最多一次申诉，只有 `decided/violation_confirmed` 且首次决定后 7 个自然日内允许提交。
- 所有写操作必须携带 UUID 和 `expectedVersion`，支持相同内容幂等重放并拒绝冲突内容或过期版本。
- 自由文本只进入复核决定、消息和申诉，去除控制字符并限制为 1–1000 字符。
- 不新增音频、连续视频、人脸特征或身份核验原图存储。
- iOS/手机界面必须适配 393×852、安全区、键盘滚动和中英文文案。
- 本计划不执行 Git 提交/推送、生产数据库迁移、生产部署、通知发送、TestFlight 或 App Store 操作。

---

### Task 1: 复核状态机、输入规范化与 CSV 安全策略

**Files:**
- Create: `apps/backend/src/modules/proctoring/domain/proctoring-review.policy.ts`
- Create: `apps/backend/src/modules/proctoring/domain/proctoring-review.policy.test.ts`

**Interfaces:**
- Produces: `ReviewCaseProjection`、`ReviewAction`、`ReviewReasonCode`、`AppealReasonCode`。
- Produces: `transitionReviewCase(current, command, now)`，返回下一案件投影或抛出稳定策略错误。
- Produces: `normalizeReviewText(value)`、`normalizeReviewUuid(value, label)`、`reviewRequestDigest(payload)`、`escapeCsvCell(value)`。
- Consumed by: Tasks 2–6 的服务、API、CSV 导出和前端动作映射。

- [x] **Step 1: 写失败的状态转换测试**

```ts
test('确认违规只改变复核投影并生成七天申诉期限', () => {
  const now = new Date('2026-08-30T10:00:00.000Z')
  const next = transitionReviewCase(pendingCase, {
    action: 'confirm_violation',
    expectedVersion: 1,
  }, now)
  assert.equal(next.status, 'decided')
  assert.equal(next.outcome, 'violation_confirmed')
  assert.equal(next.version, 2)
  assert.equal(next.appealDeadlineAt, '2026-09-06T10:00:00.000Z')
})
```

再覆盖：请求补充、考生回复、排除异常、申诉提交、申诉成立、申诉驳回、已排除异常不可申诉、过期不可申诉、已结束案件不可继续写入和版本冲突。

- [x] **Step 2: 运行测试并确认因模块不存在而失败**

Run: `pnpm -C apps/backend test -- src/modules/proctoring/domain/proctoring-review.policy.test.ts`

Expected: FAIL，错误指向 `proctoring-review.policy.ts` 或缺少导出，而不是测试语法错误。

- [x] **Step 3: 实现最小状态机与稳定错误码**

```ts
export type ReviewCaseStatus =
  | 'pending_review'
  | 'information_requested'
  | 'decided'
  | 'appeal_pending'
  | 'appeal_resolved'

export type ReviewOutcome = 'pending' | 'cleared' | 'violation_confirmed'

export function transitionReviewCase(
  current: ReviewCaseProjection,
  command: ReviewTransitionCommand,
  now = new Date(),
): ReviewCaseProjection {
  if (current.version !== command.expectedVersion) {
    throw new ProctoringReviewPolicyError('案件已被其他考务人员更新', 'PROCTORING_REVIEW_VERSION_CONFLICT', 409)
  }
  const nowIso = now.toISOString()
  const next = { ...current, version: current.version + 1, updatedAt: nowIso }
  switch (command.action) {
    case 'request_information':
      if (current.status !== 'pending_review') break
      return { ...next, status: 'information_requested' }
    case 'candidate_response':
      if (current.status !== 'information_requested') break
      return { ...next, status: 'pending_review' }
    case 'clear':
      if (current.status !== 'pending_review') break
      return {
        ...next,
        status: 'decided',
        outcome: 'cleared',
        firstDecidedAt: current.firstDecidedAt ?? nowIso,
        closedAt: nowIso,
      }
    case 'confirm_violation': {
      if (current.status !== 'pending_review') break
      const appealDeadlineAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      return {
        ...next,
        status: 'decided',
        outcome: 'violation_confirmed',
        firstDecidedAt: current.firstDecidedAt ?? nowIso,
        appealDeadlineAt,
        closedAt: null,
      }
    }
    case 'submit_appeal':
      if (
        current.status !== 'decided' ||
        current.outcome !== 'violation_confirmed' ||
        !current.appealDeadlineAt ||
        now.getTime() > new Date(current.appealDeadlineAt).getTime()
      ) break
      return { ...next, status: 'appeal_pending' }
    case 'resolve_appeal_upheld':
      if (current.status !== 'appeal_pending') break
      return { ...next, status: 'appeal_resolved', outcome: 'cleared', closedAt: nowIso }
    case 'resolve_appeal_rejected':
      if (current.status !== 'appeal_pending') break
      return { ...next, status: 'appeal_resolved', outcome: 'violation_confirmed', closedAt: nowIso }
  }
  throw new ProctoringReviewPolicyError('当前案件状态不允许此操作', 'PROCTORING_REVIEW_STATE_CONFLICT', 409)
}
```

- [x] **Step 4: 写失败的文本、原因代码、UUID 与 CSV 测试**

```ts
test('CSV 单元格以公式前缀开头时加入单引号', () => {
  assert.equal(
    escapeCsvCell('=HYPERLINK("https://example.com")'),
    '"\'=HYPERLINK(""https://example.com"")"',
  )
})
```

覆盖 C0/C1 控制字符移除、空文本、1001 字符、未知原因代码、无效 UUID，以及同一语义对象键顺序不同生成相同摘要。

- [x] **Step 5: 运行测试确认失败后实现规范化函数**

Run: `pnpm -C apps/backend test -- src/modules/proctoring/domain/proctoring-review.policy.test.ts`

Expected before implementation: FAIL at the new assertions。实现后再次运行，Expected: PASS。

- [x] **Step 6: 重构并复跑任务测试**

Run: `pnpm -C apps/backend test -- src/modules/proctoring/domain/proctoring-review.policy.test.ts`

Expected: 所有复核纯策略测试通过；不提交 Git，仅保留本地检查点。

---

### Task 2: 复核服务契约、权限、幂等和成绩隔离

**Files:**
- Create: `apps/backend/src/modules/proctoring/domain/proctoring-review.model.ts`
- Create: `apps/backend/src/modules/proctoring/services/proctoring-review.service.ts`
- Create: `apps/backend/src/modules/proctoring/services/proctoring-review.service.test.ts`
- Modify: `apps/backend/src/modules/proctoring/domain/proctoring.model.ts`

**Interfaces:**
- Consumes: Task 1 的纯策略与摘要函数。
- Produces: `ProctoringReviewRepositoryContract`，供测试内存仓储和 Task 3 MySQL 仓储共同实现。
- Produces: `listStaffCases`、`getStaffCase`、`decideCase`、`listMyCases`、`getMyCase`、`respondToInformationRequest`、`submitAppeal`、`exportCaseCsv`。

- [x] **Step 1: 定义完整仓储契约和真实响应类型**

```ts
export interface ProctoringReviewRepositoryContract {
  listStaffCases(input: StaffCaseQuery): Promise<ReviewCasePage>
  findCaseForStaff(caseId: string, actor: ReviewActor): Promise<ReviewCaseDetail | null>
  findCaseForCandidate(caseId: string, userId: number): Promise<CandidateReviewCaseDetail | null>
  applyDecision(input: ApplyDecisionInput): Promise<ReviewWriteResult>
  addCandidateResponse(input: AddCandidateResponseInput): Promise<ReviewWriteResult>
  addAppeal(input: AddAppealInput): Promise<ReviewWriteResult>
}
```

响应必须包含前端实际需要的所有字段，不允许测试使用不完整对象。

- [x] **Step 2: 写失败的教师所有权与考生本人权限测试**

```ts
test('教师不能读取其他教师创建考试的复核案件', async () => {
  const service = new ProctoringReviewService(memoryRepository({ examCreatedBy: 22 }))
  await assert.rejects(
    service.getStaffCase(teacherUser(11), CASE_ID),
    error => error.status === 404,
  )
})
```

覆盖管理员、教师本人、其他教师、案件本人和其他学生。无权查看与不存在均对外返回 404。

- [x] **Step 3: 运行测试确认权限服务尚未实现而失败**

Run: `pnpm -C apps/backend test -- src/modules/proctoring/services/proctoring-review.service.test.ts`

Expected: FAIL，原因是服务或方法缺失。

- [x] **Step 4: 实现只依赖仓储契约的最小服务**

服务从 `AuthUser` 提取全部角色代码，管理员使用当前服务区域，教师查询强制携带 `createdByUserId`；候选人接口只传认证用户 ID，不接受外部 `userId`。

- [x] **Step 5: 写失败的决定、补充说明、申诉与幂等测试**

覆盖以下可观察行为：

- `decisionId/messageId/appealId` 相同且摘要相同返回 `replayed: true`。
- 相同 UUID 携带不同内容返回 `PROCTORING_REVIEW_IDEMPOTENCY_CONFLICT`。
- 旧 `expectedVersion` 返回 `PROCTORING_REVIEW_VERSION_CONFLICT`。
- `request_information` 同时写决定与考生可见消息。
- 同一信息请求只能回复一次。
- 每案只能申诉一次，过期返回冲突。
- 处理申诉只允许 `appeal_pending` 状态。

- [x] **Step 6: 运行失败测试后实现写服务与审计调用**

Run: `pnpm -C apps/backend test -- src/modules/proctoring/services/proctoring-review.service.test.ts`

Expected before implementation: 新增用例 FAIL。实现时通过依赖注入记录 `LogService.log` 请求，但测试断言案件/决定的真实输出，不断言模拟对象是否存在。

- [x] **Step 7: 写并通过成绩隔离测试**

```ts
test('确认违规不会调用成绩或用户状态写接口', async () => {
  const repository = memoryRepository({ examScore: 88, accountStatus: 'active' })
  const service = new ProctoringReviewService(repository)
  const result = await service.decideCase(teacherUser(11), CASE_ID, confirmViolationCommand)
  assert.equal(result.case.outcome, 'violation_confirmed')
  assert.equal(repository.readExamScore(), 88)
  assert.equal(repository.readAccountStatus(), 'active')
})
```

内存仓储保存真实案件、成绩和账号状态投影，测试断言领域操作后的可观察状态；服务契约不暴露 `exam_results/users` 写方法，因此生产服务无法从该契约自动修改成绩或账号。

- [x] **Step 8: 运行任务测试和后端类型检查**

Run: `pnpm -C apps/backend test -- src/modules/proctoring/services/proctoring-review.service.test.ts`

Run: `pnpm -C apps/backend typecheck`

Expected: PASS；不提交 Git，仅保留本地检查点。

---

### Task 3: 数据库迁移、事务仓储和会话转复核原子性

**Files:**
- Create: `apps/backend/db/migrations/20260830_000004_add_proctoring_review_workflow.ts`
- Create: `apps/backend/src/modules/proctoring/repositories/proctoring-review.repository.ts`
- Modify: `apps/backend/src/modules/proctoring/repositories/proctoring.repository.ts`
- Modify: `apps/backend/src/modules/proctoring/services/proctoring.service.ts`
- Modify: `apps/backend/src/modules/proctoring/domain/proctoring.model.ts`
- Create: `apps/backend/src/modules/proctoring/services/proctoring-review-case-creation.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `ProctoringReviewRepositoryContract`。
- Produces: `ProctoringReviewRepository` 的 MySQL 实现。
- Produces: `ensureReviewCaseInTransaction(connection, session)`，由监考事件、心跳和身份核验路径调用。

- [x] **Step 1: 添加失败测试证明三种 review_required 路径都要求创建案件**

在测试仓储中使用真实的内存案件集合，分别触发：严重事实事件、持续心跳/传感器超时、身份核验失败。断言每条路径的案件集合只有一项，重复触发集合数量仍为一。

Run: `pnpm -C apps/backend test -- src/modules/proctoring/services/proctoring-review-case-creation.test.ts src/modules/proctoring/domain/proctoring.policy.test.ts`

Expected: FAIL，因为当前监考服务尚未确保复核案件。

- [x] **Step 2: 新增四张表和已有会话回填迁移**

迁移创建：

```ts
export const REVIEW_TABLES = {
  cases: 'proctoring_review_cases',
  decisions: 'proctoring_review_decisions',
  messages: 'proctoring_review_messages',
  appeals: 'proctoring_review_appeals',
} as const
```

按规格添加唯一键和索引：`session_id` 唯一、`decision_id/message_id/appeal_id` 唯一、`appeals.case_id` 唯一、队列状态/更新时间索引、教师考试查询索引。`up` 必须检查阶段四表存在，再回填已有 `review_required` 会话；`down` 只删除第四阶段新增表，不修改原始监考证据。

- [x] **Step 3: 实现 MySQL 读模型和事务写方法**

所有列表查询参数化；只有 `LIMIT/OFFSET` 使用经过整数钳制后的数值。教师查询必须联接 `exams` 并强制 `e.created_by = ?`。详情拆分查询案件、会话、最新身份核验摘要、事件、决定、消息和申诉，不选择人脸特征或媒体列。

- [x] **Step 4: 把案件创建加入三条已有事务路径**

在 `recordEvent`、`heartbeat`、`insertIdentityCheck` 把会话转成 `review_required` 的同一事务中执行案件幂等插入。`trigger_reason_code` 取服务端 `review_reason_code`，`retain_until` 使用考试事件留存天数计算。

- [x] **Step 5: 复跑失败测试并使其通过**

Run: `pnpm -C apps/backend test -- src/modules/proctoring/services/proctoring-review-case-creation.test.ts src/modules/proctoring/domain/proctoring.policy.test.ts`

Expected: 三种触发路径均 PASS，重复触发不重复创建。

- [x] **Step 6: 只导入迁移做语法验证**

Run:

```bash
pnpm -C apps/backend exec tsx -e "import('./db/migrations/20260830_000004_add_proctoring_review_workflow.ts').then(module => { if (typeof module.up !== 'function' || typeof module.down !== 'function') process.exit(1); console.log('phase5 migration import ok') })"
```

Expected: `phase5 migration import ok`。不得创建数据库连接或执行 `up/down`。

- [x] **Step 7: 后端类型检查**

Run: `pnpm -C apps/backend typecheck`

Expected: PASS；不提交 Git，仅保留本地检查点。

---

### Task 4: 考务与考生 API、审计导出和稳定错误响应

**Files:**
- Create: `apps/backend/src/modules/proctoring/controllers/proctoring-review.controller.ts`
- Modify: `apps/backend/src/modules/proctoring/routes/proctoring.routes.ts`
- Create: `apps/backend/src/modules/proctoring/domain/proctoring-review.csv.test.ts`
- Modify: `apps/backend/src/modules/proctoring/services/proctoring-review.service.ts`

**Interfaces:**
- Consumes: Tasks 1–3 的服务和仓储。
- Produces: 规格第 8 节所有 `/api/proctoring/review-cases` 和 `/my-review-cases` 接口。
- Produces: UTF-8 BOM CSV 响应，文件名只使用安全 ASCII 并提供 RFC 5987 中文名。

- [x] **Step 1: 写失败的 CSV 行为测试**

测试真实 `buildReviewCaseCsv(detail)` 输出：包含案件、事件、决定、消息和申诉时间线；以 `= + - @` 开头的单元格被保护；换行和双引号正确转义；不包含 `embedding`、`image`、`audio` 或密码字段。

Run: `pnpm -C apps/backend test -- src/modules/proctoring/domain/proctoring-review.csv.test.ts`

Expected: FAIL，因为 CSV 构建器尚不存在。

- [x] **Step 2: 实现最小 CSV 构建器并通过测试**

```ts
export function buildReviewCaseCsv(detail: ReviewCaseDetail): string {
  const rows = [['类型', '时间', '操作者', '动作或事件', '原因', '说明']]
  for (const event of detail.events) {
    rows.push(['客观事件', event.occurredAt, String(detail.candidatePublicId), event.type, event.severity, JSON.stringify(event.state)])
  }
  for (const decision of detail.decisions) {
    rows.push(['人工决定', decision.createdAt, String(decision.actorPublicId), decision.action, decision.reasonCode, decision.comment])
  }
  for (const message of detail.messages) {
    rows.push(['复核沟通', message.createdAt, String(message.actorPublicId), message.messageType, '', message.body])
  }
  if (detail.appeal) {
    rows.push(['申诉', detail.appeal.submittedAt, String(detail.candidatePublicId), detail.appeal.status, detail.appeal.reasonCode, detail.appeal.statement])
  }
  return `\uFEFF${rows.map(row => row.map(escapeCsvCell).join(',')).join('\r\n')}`
}
```

- [x] **Step 3: 实现路由层角色保护**

```ts
router.get('/review-cases', requireRoleStr(['admin', 'teacher']), wrap(ProctoringReviewController.listStaffCases))
router.get('/review-cases/:caseId', requireRoleStr(['admin', 'teacher']), wrap(ProctoringReviewController.getStaffCase))
router.post('/review-cases/:caseId/decisions', requireRoleStr(['admin', 'teacher']), wrap(ProctoringReviewController.decideCase))
router.get('/review-cases/:caseId/export.csv', requireRoleStr(['admin', 'teacher']), wrap(ProctoringReviewController.exportCaseCsv))
router.get('/my-review-cases', wrap(ProctoringReviewController.listMyCases))
router.get('/my-review-cases/:caseId', wrap(ProctoringReviewController.getMyCase))
router.post('/my-review-cases/:caseId/responses', wrap(ProctoringReviewController.respond))
router.post('/my-review-cases/:caseId/appeals', wrap(ProctoringReviewController.appeal))
```

路由顺序必须让固定 `review-cases` 与 `my-review-cases` 在任何泛化参数路由之前注册。

- [x] **Step 4: 实现控制器输入白名单和错误映射**

控制器不透传任意请求体；只选取规格字段。400/403/404/409 使用稳定错误码，500 才写错误日志。CSV 导出调用服务层重新做所有权校验并记录 `audit` 日志。

- [x] **Step 5: 运行后端任务测试、类型检查和构建**

Run: `pnpm -C apps/backend test -- src/modules/proctoring/domain/proctoring-review.policy.test.ts src/modules/proctoring/domain/proctoring-review.csv.test.ts src/modules/proctoring/services/proctoring-review.service.test.ts`

Run: `pnpm -C apps/backend typecheck`

Run: `pnpm -C apps/backend build`

Expected: 全部 PASS；不提交 Git，仅保留本地检查点。

---

### Task 5: 前端 API、考务响应式复核队列与处理详情

**Files:**
- Create: `apps/web/src/shared/api/endpoints/proctoringReview.ts`
- Modify: `apps/web/src/shared/api/endpoints/index.ts`
- Create: `apps/web/src/features/proctoring-review/domain/reviewPresentation.ts`
- Create: `apps/web/src/features/proctoring-review/domain/reviewPresentation.test.ts`
- Create: `apps/web/src/features/proctoring-review/hooks/useProctoringReviewQueue.ts`
- Create: `apps/web/src/features/proctoring-review/components/ProctoringReviewDetailDrawer.tsx`
- Create: `apps/web/src/features/proctoring-review/components/ProctoringReviewDecisionModal.tsx`
- Create: `apps/web/src/features/proctoring-review/pages/ProctoringReviewQueuePage.tsx`
- Modify: `apps/web/src/app/routing/pageRegistry.ts`
- Modify: `apps/web/src/app/i18n/zh-CN.ts`
- Modify: `apps/web/src/app/i18n/en-US.ts`

**Interfaces:**
- Consumes: Task 4 API。
- Produces: `proctoring-review-queue` 页面注册键。
- Produces: 响应式队列、案件详情、合法动作弹窗、申诉处理和 CSV 下载。

- [x] **Step 1: 写失败的前端展示策略测试**

```ts
test('申诉中只允许申诉成立或驳回，不显示普通复核动作', () => {
  expect(actionsForCase({ status: 'appeal_pending', outcome: 'violation_confirmed' }))
    .toEqual(['resolve_appeal_upheld', 'resolve_appeal_rejected'])
})
```

覆盖所有状态的颜色、中文/英文键、考生可见原因映射、内部原因不直出和版本冲突提示。

- [x] **Step 2: 运行测试确认模块缺失而失败**

Run: `pnpm -C apps/web test -- src/features/proctoring-review/domain/reviewPresentation.test.ts`

Expected: FAIL，原因是展示策略未实现。

- [x] **Step 3: 实现强类型 API 和展示策略并通过测试**

`proctoringReviewApi` 提供 `listStaffCases/getStaffCase/decideCase/exportCaseCsv`。接口解包复用现有 HTTP 客户端，但不得把未知状态强制转为合法状态；未知值显示安全“未知状态”且禁止操作。

- [x] **Step 4: 实现队列 Hook 和页面**

队列保留服务端分页、筛选和统计；窄屏切换为卡片列表，桌面使用表格。详情抽屉按“案件摘要、身份核验摘要、客观事件、人工时间线、申诉”分区；不显示原图或音频入口。

- [x] **Step 5: 实现决定弹窗与并发冲突恢复**

弹窗根据 `actionsForCase` 限制动作，生成稳定 UUID，提交 `expectedVersion`；`request_information` 显示独立考生可见问题。409 版本冲突时关闭编辑态、重新加载详情并提示已有新处理，不自动重放决定。

- [x] **Step 6: 接入页面注册与中英文文案**

在 `componentRegistry` 注册 `proctoring-review-queue`；文案明确“结论不会自动改成绩或处罚账号”。不自动修改生产菜单，预发布菜单授权在部署阶段单独执行。

- [x] **Step 7: 运行前端任务测试、类型检查和构建**

Run: `pnpm -C apps/web test -- src/features/proctoring-review/domain/reviewPresentation.test.ts`

Run: `pnpm -C apps/web typecheck`

Run: `pnpm -C apps/web build`

Expected: PASS；不提交 Git，仅保留本地检查点。

---

### Task 6: 考生结果页、补充说明、申诉和手机路由

**Files:**
- Modify: `apps/web/src/shared/api/endpoints/proctoringReview.ts`
- Create: `apps/web/src/features/proctoring-review/hooks/useMyProctoringReview.ts`
- Create: `apps/web/src/features/proctoring-review/components/MyProctoringReviewCard.tsx`
- Create: `apps/web/src/features/proctoring-review/pages/MyProctoringReviewPage.tsx`
- Create: `apps/web/src/features/proctoring-review/components/MyProctoringReviewCard.test.tsx`
- Modify: `apps/web/src/features/exams/pages/ResultDetailPage.tsx`
- Modify: `apps/web/src/features/exams/components/ResultDetailView.tsx`
- Modify: `apps/web/src/app/mobile/mobileRouteManifest.ts`
- Modify: `apps/web/src/app/mobile/MobileAppRouter.tsx`
- Modify: `apps/web/src/app/i18n/zh-CN.ts`
- Modify: `apps/web/src/app/i18n/en-US.ts`

**Interfaces:**
- Consumes: Task 4 考生 API 和 Task 5 类型/展示策略。
- Produces: 结果页监考复核卡片与 `/proctoring/reviews/:caseId` 手机详情页。

- [x] **Step 1: 写失败的考生卡片行为测试**

使用完整案件响应测试：无案件不渲染；等待补充显示信息请求和回复按钮；已排除异常不显示申诉；确认违规且在期限内显示申诉；过期和申诉已提交时禁用重复申诉；任何状态都显示成绩与监考结论相互独立。

Run: `pnpm -C apps/web test -- src/features/proctoring-review/components/MyProctoringReviewCard.test.tsx`

Expected: FAIL，因为组件不存在。

- [x] **Step 2: 实现本人案件 Hook 和结果页卡片**

结果详情数据必须获得可靠 `attemptId`；若现有结果 API 未返回，则只修改结果服务返回该已有字段，不用 `examId` 猜测作答。卡片通过 `GET /my-review-cases?attemptId=...` 加载。

- [x] **Step 3: 实现补充说明与申诉表单**

表单只接受纯文本和原因枚举，显示剩余字符数；提交 UUID 与 `expectedVersion`。409 冲突重新加载，网络不确定时使用相同 UUID 手动重试，不生成第二次申诉。

- [x] **Step 4: 添加手机路由和安全区适配**

在 manifest 和 router 同时加入 `/proctoring/reviews/:caseId`。页面使用单列卡片、底部安全区和可滚动表单；键盘出现时提交按钮不得被固定底栏遮挡。

- [x] **Step 5: 运行组件测试并使其通过**

Run: `pnpm -C apps/web test -- src/features/proctoring-review/components/MyProctoringReviewCard.test.tsx`

Expected: PASS。

- [x] **Step 6: 前端类型检查和构建**

Run: `pnpm -C apps/web typecheck`

Run: `pnpm -C apps/web build`

Expected: PASS；不提交 Git，仅保留本地检查点。

---

### Task 7: 手机端到端场景、全量回归与第五阶段验证记录

**Files:**
- Create: `apps/web/scripts/verify_mobile_phase5.py`
- Create: `docs/verification/2026-08-30-wenheng-ios-phase-5.md`
- Modify: `docs/superpowers/plans/2026-08-30-wenheng-ios-phase-5-proctoring-review.md`

**Interfaces:**
- Consumes: Tasks 1–6 全部实现。
- Produces: 可重复的 393×852 证据、全量测试/构建记录和诚实上线边界。

- [x] **Step 1: 编写手机端失败场景脚本**

Playwright 脚本使用完整 API 信封与案件数据，至少验证：

1. 结果页显示“成绩”和“监考复核”两个独立区块。
2. `information_requested` 可提交一次补充说明并回到待复核。
3. `decided/violation_confirmed` 可在期限内提交一次申诉。
4. 申诉提交后复用同一 UUID 重试，不产生第二条申诉。
5. 版本冲突显示刷新提示且不覆盖服务端案件。
6. 393×852 下无横向溢出、按钮可见、控制台错误为 0。

在页面实现未完成前运行应失败于缺少卡片或路由，证明脚本能捕获缺失行为。

实际执行记录：缺少卡片由组件 Red 测试先行证明；端到端脚本在页面完成后补齐，首次失败于 iOS 安全会话桥接边界，未将其误记为缺少 UI。详见阶段五验证记录。

- [x] **Step 2: 启动本地预览并运行手机端脚本**

Run: `pnpm -C apps/web preview --host 127.0.0.1 --port 4173`

Run: `python3 apps/web/scripts/verify_mobile_phase5.py`

Expected: 输出 `ok: true`，截图写入 `/tmp/wenheng-mobile-proctoring-review-phase5.png`，控制台错误数组为空。

- [x] **Step 3: 运行后端和 Web 全量回归**

Run: `pnpm -C apps/backend test`

Run: `pnpm -C apps/web test`

Expected: 0 failed、0 cancelled。

- [x] **Step 4: 运行类型检查、构建、迁移导入和差异检查**

Run: `pnpm -C apps/backend typecheck && pnpm -C apps/backend build`

Run: `pnpm -C apps/web typecheck && pnpm -C apps/web build`

Run: Task 3 的迁移导入命令。

Run: `git diff --check`

Expected: 全部退出码 0。

- [x] **Step 5: 同步 iOS 资源并构建双架构模拟器包**

Run: `pnpm -C apps/web cap:sync:ios`

Run:

```bash
xcodebuild -project apps/web/ios/App/App.xcodeproj -scheme App -sdk iphonesimulator -configuration Debug -derivedDataPath /tmp/wenheng-phase5-derived CODE_SIGNING_ALLOWED=NO build
```

Run: `lipo -archs /tmp/wenheng-phase5-derived/Build/Products/Debug-iphonesimulator/App.app/App`

Expected: `x86_64 arm64`，构建退出码 0。

- [x] **Step 6: 写第五阶段验证记录并逐项核对规格**

验证文档必须列出已实现能力、测试数量、手机截图、迁移未执行、生产菜单未修改、通知未发送、真实账号/真机/预发布/生产未覆盖，以及不会自动改成绩或账号的证据。

- [x] **Step 7: 最终新鲜验证**

在宣称完成前重新运行全量测试、类型检查、构建、`git diff --check` 和计划复核；只报告本次输出，不引用旧结果。计划全部勾选后仍不提交 Git，等待用户单独决定下一阶段外部操作。
