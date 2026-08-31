# 问衡严格监考人工复核与申诉设计

> 日期：2026-08-30
> 状态：待规格确认
> 前置规格：`docs/superpowers/specs/2026-08-30-wenheng-mobile-product-design.md`
> 前置实现：`docs/verification/2026-08-30-wenheng-ios-phase-4.md`

## 1. 目标

为进入 `review_required` 的严格监考会话建立完整、可追溯的人工复核闭环，使考务人员能够在权限范围内查看客观事件、形成决定、请求考生补充说明并处理申诉，同时保证原始事件不可篡改、客户端或模型不能自动认定作弊、复核结果不会自动改成绩或处罚账号。

## 2. 范围

本阶段包含：

- 自动建立与监考会话一一对应的复核案件。
- 管理员和考试创建教师的待复核队列、案件详情、决定与 CSV 审计导出。
- 考生查看本人案件、提交补充说明、查看结论和对“确认违规”结论发起一次限期申诉。
- 复核决定、补充信息、申诉和申诉处理的追加式审计记录。
- Web 响应式考务页面，以及 iOS/手机 Web 可用的考生案件入口与详情。
- 服务端角色、考试所有权、账号数据区域、状态机、幂等和并发冲突校验。

本阶段不包含：

- 自动扣分、改成绩、封禁账号、取消证书或自动通知第三方。
- AI、客户端或人脸模型直接输出“作弊”结论。
- 新增原始音视频、录音、连续录像或身份核验原图存储。
- 申诉附件上传；首版只接受结构化原因和限定长度的文字说明。
- 生产迁移、生产部署、真实通知发送、TestFlight 或 App Store 操作。

## 3. 方案选择

采用独立复核领域模型，不复用通用工作流，也不只在 `proctoring_sessions` 上增加一个可覆盖状态字段。

选择理由：

- 通用工作流适合发布审批，但无法自然表达不可变监考证据、一次申诉、复核结论与成绩隔离。
- 单字段方案无法保留决定历史、补充说明、申诉和并发操作证据。
- 独立案件、追加式决定和消息既能保持边界清晰，也便于以后接入通知、法务导出和运营指标。

## 4. 核心不变量

1. `proctoring_events`、身份核验结果和原始会话字段是只读证据；复核操作不得更新或删除这些记录。
2. 每个监考会话最多一个复核案件，案件通过 `session_id` 唯一约束保证幂等。
3. 教师只能读取和处理 `exams.created_by` 等于自己的案件；管理员可以处理当前服务数据区域内的案件；考生只能读取和操作 `user_id` 等于自己的案件。
4. 原始事件只包含既有白名单事实和有限状态，不接受自由文本、音频内容或客户端严重度。
5. 自由文本只允许出现在复核决定、信息请求、考生说明和申诉中，需去除控制字符、限制长度并保留作者和时间。
6. “确认违规”是监考复核结论，不会自动改变 `exam_results.score/status`，也不会改变用户账号状态。
7. 只有结论为“确认违规”的已决定案件可以申诉；每个案件最多一次申诉，期限为首次决定后 7 个自然日。
8. 所有写操作由客户端提供 UUID 和 `expectedVersion`；相同 UUID、相同内容重放返回原结果，不同内容或过期版本返回冲突。
9. 决定、申诉、说明和案件版本更新在同一数据库事务内完成；并发操作不能覆盖先完成的决定。
10. 所有人工写操作同时进入复核专用追加表和系统 `audit` 日志。

## 5. 数据模型

### 5.1 `proctoring_review_cases`

一条记录代表一个监考会话的当前复核投影。

| 字段 | 类型 | 约束与说明 |
| --- | --- | --- |
| `case_id` | `char(36)` | 主键，服务端 UUID |
| `session_id` | `char(36)` | 唯一，关联 `proctoring_sessions` |
| `exam_id` | 整数 | 索引，案件所属考试 |
| `task_id` | 整数可空 | 对应任务 |
| `attempt_id` | `char(36)` | 作答编号 |
| `user_id` | 整数 | 考生账号 |
| `data_region` | `CN/GLOBAL` | 创建时固化，不允许修改 |
| `status` | 枚举 | `pending_review`、`information_requested`、`decided`、`appeal_pending`、`appeal_resolved` |
| `outcome` | 枚举 | `pending`、`cleared`、`violation_confirmed` |
| `trigger_reason_code` | `varchar(64)` | 由监考会话的服务端原因生成 |
| `version` | 无符号整数 | 初始为 1，每次有效写操作加 1 |
| `opened_at` | 时间 | 案件创建时间 |
| `first_decided_at` | 时间可空 | 首次形成结论的时间，用于申诉截止时间 |
| `appeal_deadline_at` | 时间可空 | 首次决定后 7 个自然日 |
| `closed_at` | 时间可空 | 最终完成时间 |
| `retain_until` | 时间 | 监考事件留存截止与申诉截止中的较晚时间 |
| `created_at/updated_at` | 时间 | 审计时间 |

案件不复制身份特征、原始画面或自由文本事件；详情通过受权查询读取已有会话、身份核验摘要和事件。

### 5.2 `proctoring_review_decisions`

追加式人工决定表，不提供更新和删除接口。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `decision_id` | `char(36)` | 主键，由客户端生成以支持幂等 |
| `case_id` | `char(36)` | 案件 |
| `actor_user_id` | 整数 | 操作人 |
| `action` | 枚举 | `request_information`、`clear`、`confirm_violation`、`resolve_appeal_upheld`、`resolve_appeal_rejected` |
| `reason_code` | `varchar(64)` | 服务端白名单原因 |
| `comment` | `varchar(1000)` | 处理说明，1–1000 字符 |
| `case_version_before/after` | 整数 | 决定前后版本 |
| `created_at` | 时间 | 创建后不可变 |

复核原因白名单首版包括：`SENSOR_INTERRUPTION_EXPLAINED`、`IDENTITY_CONFIRMED_MANUALLY`、`INSUFFICIENT_EVIDENCE`、`MULTIPLE_PERSONS_CONFIRMED`、`SCREEN_CAPTURE_CONFIRMED`、`IDENTITY_MISMATCH_CONFIRMED`、`UNRESOLVED_SENSOR_INTERRUPTION`、`CANDIDATE_EXPLANATION_REQUIRED`、`APPEAL_EVIDENCE_ACCEPTED`、`APPEAL_EVIDENCE_REJECTED`。

### 5.3 `proctoring_review_messages`

保存复核期间的文字补充，不与原始事件混表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `message_id` | `char(36)` | 主键，由客户端生成以支持幂等 |
| `case_id` | `char(36)` | 案件 |
| `actor_user_id` | 整数 | 作者 |
| `message_type` | 枚举 | `information_request`、`candidate_response` |
| `reply_to_message_id` | `char(36)` 可空 | 考生回复必须指向当前待回复的信息请求 |
| `body` | `varchar(1000)` | 1–1000 字符，去除控制字符 |
| `case_version_before/after` | 整数 | 写入前后版本 |
| `created_at` | 时间 | 创建后不可变 |

`request_information` 决定和 `information_request` 消息在同一事务写入。考生只可在 `information_requested` 状态对当前待回复消息写入一次 `candidate_response`，写入后案件回到 `pending_review`；考务人员以后可以再次发起新的信息请求，但不能让同一请求产生多份回复。

### 5.4 `proctoring_review_appeals`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `appeal_id` | `char(36)` | 主键，由客户端生成以支持幂等 |
| `case_id` | `char(36)` | 唯一，每案最多一次 |
| `user_id` | 整数 | 必须等于案件考生 |
| `reason_code` | 枚举 | `DEVICE_INTERRUPTION`、`ENVIRONMENTAL_CAUSE`、`IDENTITY_ERROR`、`EVENT_MISINTERPRETED`、`OTHER` |
| `statement` | `varchar(1000)` | 1–1000 字符 |
| `status` | 枚举 | `pending`、`upheld`、`rejected` |
| `resolution_decision_id` | `char(36)` 可空 | 关联申诉处理决定 |
| `submitted_at/resolved_at` | 时间 | 审计时间 |

## 6. 案件状态机

```text
review_required session
        │
        ▼
pending_review ──request_information──▶ information_requested
      ▲                                      │
      └────────candidate_response────────────┘
        │
        ├──clear──────────────▶ decided / cleared
        │
        └──confirm_violation──▶ decided / violation_confirmed
                                          │
                               submit appeal within 7 days
                                          ▼
                                     appeal_pending
                                     │           │
                         appeal upheld           appeal rejected
                                     │           │
                                     ▼           ▼
                         appeal_resolved /   appeal_resolved /
                              cleared         violation_confirmed
```

状态转换由服务端纯策略函数校验。已经 `appeal_resolved` 的案件不可再次写入；`decided/cleared` 不提供申诉入口；超过 `appeal_deadline_at` 的申诉返回明确冲突。

`cleared` 决定立即写入 `closed_at`；`violation_confirmed` 在申诉期内保持可申诉，申诉处理后写入 `closed_at`。未申诉且申诉期届满的案件由后续数据生命周期作业写入 `closed_at`，不改变既有决定历史。

## 7. 案件创建与一致性

- `recordEvent`、`heartbeat` 和 `insertIdentityCheck` 任何路径把会话转为 `review_required` 时，必须在同一事务内执行 `INSERT ... ON DUPLICATE KEY` 建立案件。
- 迁移执行时回填已有 `review_required` 会话，保证升级前产生的待复核记录不会丢失。
- 队列查询只读取案件表，不临时从事件推断作弊或复核结论。
- 案件保存 `session_id/exam_id/attempt_id/user_id/data_region` 快照，但权限判断仍需联表验证考试创建人和当前用户。

## 8. 服务端接口

所有接口位于 `/api/proctoring`，使用现有 access token 与数据区域校验。

### 8.1 考务接口

- `GET /review-cases`
  - 角色：`admin`、`teacher`。
  - 条件：`status`、`outcome`、`examId`、`reasonCode`、`page`、`limit`。
  - 教师查询强制附加 `exams.created_by = currentUserId`，忽略客户端扩大范围的条件。
- `GET /review-cases/:caseId`
  - 返回案件、会话摘要、身份核验摘要、按时间排序的客观事件、决定、消息和申诉。
  - 不返回人脸特征、原始核验画面、密码、令牌或音频。
- `POST /review-cases/:caseId/decisions`
  - 请求：`decisionId`、`action`、`reasonCode`、`comment`、`expectedVersion`；`request_information` 另带 `messageId` 和 `informationRequest`。
  - 响应：最新案件和新增决定；重放时标记 `replayed: true`。
- `GET /review-cases/:caseId/export.csv`
  - 导出案件、会话摘要、客观事件、决定、消息和申诉时间线。
  - 所有单元格进行 CSV 公式注入防护；导出动作写审计日志。

### 8.2 考生接口

- `GET /my-review-cases?attemptId=...`
  - 只返回当前用户案件；支持结果页按 `attemptId` 查询。
- `GET /my-review-cases/:caseId`
  - 返回考生可见的案件状态、结论、原因说明、信息请求、本人回复、申诉和截止时间。
  - 不向考生暴露内部相似度阈值、其他用户信息或考务内部备注。
- `POST /my-review-cases/:caseId/responses`
  - 请求：`messageId`、`body`、`expectedVersion`。
  - 只允许案件本人在 `information_requested` 状态提交一次补充说明。
- `POST /my-review-cases/:caseId/appeals`
  - 请求：`appealId`、`reasonCode`、`statement`、`expectedVersion`。
  - 只允许案件本人对 `decided/violation_confirmed` 且未过期的案件提交一次申诉。

## 9. 权限与隐私

- 路由层用 `requireRole(['admin', 'teacher'])` 保护考务接口，服务层再次校验考试所有权，不能只相信前端菜单权限。
- 考生接口始终从认证用户取 `userId`，不接受请求体或查询参数指定其他用户。
- 管理员访问范围由已部署服务的数据区域限定；中国大陆和海外服务不能跨区查询案件。
- 列表只返回必要摘要，详情按需加载事件，避免批量暴露监考数据。
- 系统不保存新的生物特征或媒体；复核案件引用阶段四已有的身份核验结果摘要。
- 自由文本规范化换行与空白，移除 C0/C1 控制字符，限制 1000 字符；前端按纯文本渲染。
- 复核数据的 `retain_until` 取监考事件留存截止时间和申诉截止时间中的较晚者；实际物理清理接入后续统一数据生命周期作业，生产上线前必须完成作业验收。

## 10. 前端体验

### 10.1 考务复核队列

新增独立 `ProctoringReviewQueuePage`，不复用现有考试发布审批 `ExamReviewPage`：

- 顶部显示待复核、等待考生补充、申诉中、今日处理四个计数。
- 支持按状态、结论、考试和触发原因筛选。
- 表格/手机卡片显示案件编号、考试、考生公开标识、触发原因、状态、打开时间和申诉截止时间。
- 案件详情抽屉按时间线显示身份核验摘要和客观事件；人工决定、考生消息和申诉使用独立区块。
- 处理弹窗依据当前状态只展示合法动作；提交前显示“不会自动改成绩或处罚账号”。
- 版本冲突时不覆盖，重新加载案件并提示其他考务人员已处理。

### 10.2 考生结果页与案件详情

- `ResultDetailPage` 在存在案件时显示“监考复核”卡片，明确区分考试成绩与监考结论。
- 待复核时提示成绩不因客户端风险事件自动改变；等待补充时显示信息请求和补充入口。
- 结论为已排除异常时显示结束状态；确认违规时显示理由、首次决定时间、申诉截止时间和申诉入口。
- 申诉中和申诉已处理状态展示完整时间线；不承诺申诉一定改变考试成绩。
- iOS 手机路由新增本人案件详情页，所有操作按钮适配 393×852 视口和安全区。

## 11. 错误与冲突处理

- 无权限统一返回 403，资源不存在或无权查看对外都返回 404，避免枚举案件。
- 非法状态转换返回 409 和稳定错误码，例如 `PROCTORING_REVIEW_STATE_CONFLICT`。
- `expectedVersion` 过期返回 409 `PROCTORING_REVIEW_VERSION_CONFLICT`，响应不包含其他案件数据。
- 相同操作 UUID 与相同请求摘要返回既有结果；相同 UUID 携带不同内容返回 409 `PROCTORING_REVIEW_IDEMPOTENCY_CONFLICT`。
- 文本、原因代码、UUID、分页和筛选参数在服务端校验；未知原因代码返回 400。
- CSV 导出失败不改变案件；人工决定事务失败时不写部分决定、消息或案件状态。

## 12. 测试与验收

### 12.1 纯策略测试

- 合法和非法状态转换。
- 首次决定生成 7 天申诉截止时间。
- 已排除异常不能申诉、确认违规只能申诉一次、过期不能申诉。
- 决定动作与原因代码配对校验。
- 文本规范化、长度限制和 CSV 公式注入防护。

### 12.2 服务层与仓储测试

- 三种会话转入 `review_required` 的路径都幂等创建案件。
- 教师只能读取和处理自己创建的考试，管理员可读取当前区域，学生只能读取本人案件。
- 决定、信息请求、考生回复和申诉均验证版本并在事务内更新。
- 相同 UUID 重放和内容冲突行为。
- “确认违规”不会更新考试成绩或账号。
- 详情不会返回人脸特征、原始画面和音频内容。

### 12.3 前端与手机验收

- 考务队列筛选、详情、请求补充、清除异常、确认违规和处理申诉。
- 结果页按 `attemptId` 加载本人案件。
- 393×852 视口完成考生补充说明与申诉，按钮、弹窗和键盘滚动可用。
- 模拟并发版本冲突，页面重新加载且不覆盖已有决定。
- 中英文界面无原始状态码直出，控制台无错误。

### 12.4 全量验证

- 后端与 Web 全量测试、类型检查和生产构建。
- 新迁移只做导入检查，不连接生产数据库。
- `git diff --check`、隐私文件语法检查、Capacitor 同步和 iOS 模拟器双架构构建。

## 13. 上线边界

本地实现完成后仍需在预发布环境执行迁移和集成测试，使用真实管理员、教师、考生、考试和严格监考会话验证所有权限与状态转换；完成真机、真实通知、运营流程、法律文本和数据清理作业验收后，才能单独确认生产迁移、部署与商店提交。
