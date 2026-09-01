# 问衡 iOS 阶段六数据生命周期与账号删除闭环实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可自动执行、可恢复、可审计的账号删除与数据到期清理闭环，并让 Web、iOS 和区域管理端真实呈现执行状态。

**Architecture:** 以区域 MySQL 生命周期账本为唯一事实来源，账号注销请求和系统期限扫描分别作为步骤父记录，独立 Node Worker 使用数据库租约、小批量游标和显式处理器执行删除、匿名化或限制保留。高熵状态令牌支持账号删除后继续查询；事务消息箱、外部删除墓碑接口和恢复重放命令分别解决通知一致性与旧备份数据复活风险。

**Tech Stack:** Node.js、TypeScript、Express、MySQL 8/Knex、mysql2、React 19、Ant Design、Vitest、Node test runner、Capacitor 8.5、Swift/Keychain、Xcode Simulator。

**Spec:** `docs/superpowers/specs/2026-08-31-wenheng-data-lifecycle-design.md`

## Global Constraints

- `IMMEDIATE` 账号提交后立即冻结且不可取消，目标 24 小时内完成；`GRACE_PERIOD` 账号立即冻结、30 天后执行且只在不可逆执行前允许取消。
- 人脸凭据在撤回同意或注销执行时立即删除，身份核验原始画面继续保持 0 天且不落库。
- 监考与身份核验结果默认 180 天；个人考试档案 365 天；机构考试档案默认 3 年且只允许在 1–5 年内配置。
- 策略在创建记录或任务时固化 `retainUntil`；后续策略更新不能静默延长既有期限。
- 依法保留必须有类别、范围、依据和非空到期时间；不能冻结会话凭据、人脸凭据或无关数据。
- 删除任务以区域数据库为事实来源，Redis 只能唤醒；运行时请求不得提供表名、列名或任意 SQL。
- 注销完成后不得存在同时连接原用户身份与 `anonymous_subject_id` 的持久记录。
- Web 状态凭证只进 `sessionStorage`；iOS 状态凭证只进 Keychain；服务端只保存摘要。
- 注销通知只使用 App 内状态和已验证邮箱，不使用 APNs 锁屏通知；消息箱地址和载荷必须加密并在成功或最多 7 天后清理。
- 本计划只完成本地代码、迁移导入、自动化、响应式验收和无签名 iOS 模拟器构建；不执行迁移 `up/down`、不连接生产数据、不发送真实邮件、不部署、不提审。

## 文件结构与职责

- `apps/backend/src/modules/privacy-lifecycle/domain/*`：状态机、策略解析、合法冻结、摘要与稳定错误码。
- `apps/backend/src/modules/privacy-lifecycle/repositories/*`：账本、租约、控制面、消息箱、墓碑和扫描持久化。
- `apps/backend/src/modules/privacy-lifecycle/handlers/*`：按数据类别注册的删除、匿名化、隔离和最终账号处理器。
- `apps/backend/src/modules/privacy-lifecycle/services/*`：Worker 编排、期限扫描、管理 API、通知分发和恢复重放。
- `apps/backend/src/modules/privacy-lifecycle/workers/*`：独立进程入口；不从 Web API 进程隐式启动。
- `apps/backend/src/modules/account/*`：双路径申请、状态令牌查询、取消与兼容响应。
- `apps/web/src/platform/account-deletion/*`：Web 会话与 iOS Keychain 状态凭证适配。
- `apps/web/src/features/account/*`：用户申请、状态、取消与中断恢复界面。
- `apps/web/src/features/privacy-lifecycle/*`：区域管理控制台，不读取被清理内容。

---

### Task 1: 生命周期领域模型、策略解析和状态令牌

**Files:**
- Create: `apps/backend/src/modules/privacy-lifecycle/domain/lifecycle.model.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/domain/lifecycle.policy.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/domain/lifecycle.policy.test.ts`
- Modify: `apps/backend/src/modules/account/domain/account-deletion.policy.ts`
- Modify: `apps/backend/src/modules/account/domain/account-deletion.policy.test.ts`

**Interfaces:**
- Produces: `DeletionMode`、`LifecycleStatus`、`LifecycleStepStatus`、`LifecycleCategoryCode`、`RetentionAction`、`LifecyclePolicySnapshot`。
- Produces: `resolveLifecyclePolicy(input)`、`deriveLifecycleStatus(steps)`、`normalizeLifecycleUuid(value, label)`、`lifecycleRequestDigest(value)`。
- Produces: `normalizeDeletionStatusToken(token)`、`digestDeletionStatusToken(token)`、`verifyDeletionStatusToken(token, digest)`。
- Consumed by: Tasks 2–12。

- [x] **Step 1: 写失败的分层期限与策略固化测试**

```ts
test('机构考试期限只能在平台允许的 1 至 5 年范围内', () => {
  const policy = resolveLifecyclePolicy({
    dataRegion: 'CN',
    accountType: 'INSTITUTION',
    institutionExamRetentionDays: 1095,
    createdAt: new Date('2026-08-31T00:00:00.000Z'),
  })
  assert.equal(policy.version, 'wenheng-lifecycle-2026-08-v1')
  assert.equal(policy.categories.EXAM_ARCHIVE.retentionDays, 1095)
  assert.equal(policy.categories.FACE_CREDENTIALS.action, 'DELETE')
  assert.throws(
    () => resolveLifecyclePolicy({
      dataRegion: 'CN',
      accountType: 'INSTITUTION',
      institutionExamRetentionDays: 2190,
      createdAt: new Date('2026-08-31T00:00:00.000Z'),
    }),
    (error: any) => error.code === 'LIFECYCLE_POLICY_OUT_OF_RANGE',
  )
})
```

覆盖个人 365 天、机构默认 1095 天、监考 180 天、日志 180 天、回执 1095 天、原始身份画面 0 天，以及已有 `retainUntil` 不因新策略延长。

- [x] **Step 2: 运行领域测试并确认缺少导出而失败**

Run: `pnpm -C apps/backend test -- src/modules/privacy-lifecycle/domain/lifecycle.policy.test.ts src/modules/account/domain/account-deletion.policy.test.ts`

Expected: FAIL，错误指向 `lifecycle.policy.ts` 不存在或缺少导出。

- [x] **Step 3: 定义稳定类型与最小策略解析器**

```ts
export type DeletionMode = 'IMMEDIATE' | 'GRACE_PERIOD'
export type LifecycleStatus =
  | 'REQUESTED' | 'SCHEDULED' | 'RUNNING' | 'HELD' | 'RETRYING'
  | 'ATTENTION_REQUIRED' | 'COMPLETED' | 'COMPLETED_WITH_RESTRICTED_RETENTION'
  | 'CANCELLED'
export type LifecycleStepStatus = 'PENDING' | 'RUNNING' | 'HELD' | 'RETRYING' | 'ATTENTION_REQUIRED' | 'COMPLETED'
export type LifecycleCategoryCode =
  | 'AUTH_CREDENTIALS' | 'FACE_CREDENTIALS' | 'PROFILE_AND_SETTINGS'
  | 'USER_CONTENT' | 'EXAM_ARCHIVE' | 'PROCTORING_AND_IDENTITY'
  | 'MEMBERSHIPS_AND_RANKINGS' | 'SECURITY_LOGS' | 'ACCOUNT_ROW'
  | 'RECEIPT_AND_TOMBSTONE'
export type RetentionAction = 'DELETE' | 'ANONYMIZE' | 'RESTRICTED_RETENTION' | 'NO_SUBJECT_DATA'
```

`resolveLifecyclePolicy` 返回无凭据 JSON 快照；所有时间由调用者注入，测试不得依赖本机当前时间。

- [x] **Step 4: 写失败的状态推导、UUID、摘要和令牌测试**

```ts
test('完成且仍有合法保留步骤时返回受限保留完成', () => {
  assert.equal(deriveLifecycleStatus([
    { status: 'COMPLETED', action: 'DELETE' },
    { status: 'HELD', action: 'RESTRICTED_RETENTION' },
  ]), 'COMPLETED_WITH_RESTRICTED_RETENTION')
})

test('状态令牌只接受 32 字节高熵 URL-safe 值并用恒定时间校验', () => {
  const token = Buffer.alloc(32, 7).toString('base64url')
  const digest = digestDeletionStatusToken(token)
  assert.equal(normalizeDeletionStatusToken(token), token)
  assert.equal(verifyDeletionStatusToken(token, digest), true)
  assert.equal(verifyDeletionStatusToken(`${token}x`, digest), false)
})
```

摘要使用递归键排序后的 JSON 和 SHA-256；UUID 只接受规范小写形式；令牌摘要不使用邮箱或用户编号作盐。

- [x] **Step 5: 实现状态推导、规范化和令牌函数后复跑测试**

Run: `pnpm -C apps/backend test -- src/modules/privacy-lifecycle/domain/lifecycle.policy.test.ts src/modules/account/domain/account-deletion.policy.test.ts`

Expected: PASS。

- [x] **Step 6: 提交领域基线**

```bash
git add apps/backend/src/modules/privacy-lifecycle/domain apps/backend/src/modules/account/domain
git commit -m "feat(privacy): 建立生命周期策略与状态模型"
```

---

### Task 2: 阶段六数据库迁移与父记录约束

**Files:**
- Create: `apps/backend/db/migrations/20260831_000005_add_data_lifecycle_foundation.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/domain/lifecycle-schema.contract.test.ts`

**Interfaces:**
- Consumes: Task 1 类型和规格字段。
- Produces: `account_deletion_requests` 扩展、`data_lifecycle_steps`、`data_retention_scan_runs`、`data_retention_holds`、`data_retention_policies`、`data_lifecycle_controls`、`anonymous_exam_subjects`、`data_deletion_receipts`、`data_deletion_tombstones`、`transactional_outbox`。
- Produces: 考试、答卷、监考和复核表的 `anonymous_subject_id`、`retain_until` 与可空主体列。

- [x] **Step 1: 写失败的迁移结构契约测试**

```ts
test('阶段六迁移导出 up/down 并声明两个互斥步骤父键', async () => {
  const migration = await import('../../../../db/migrations/20260831_000005_add_data_lifecycle_foundation')
  assert.equal(typeof migration.up, 'function')
  assert.equal(typeof migration.down, 'function')
  assert.deepEqual(migration.LIFECYCLE_STEP_PARENTS, ['request_id', 'scan_run_id'])
  assert.equal(migration.ACCOUNT_DELETION_USER_FK, 'fk_account_deletion_user_set_null')
})
```

- [x] **Step 2: 运行测试确认迁移不存在**

Run: `pnpm -C apps/backend test -- src/modules/privacy-lifecycle/domain/lifecycle-schema.contract.test.ts`

Expected: FAIL with module-not-found。

- [x] **Step 3: 创建幂等迁移和明确约束**

```ts
export const LIFECYCLE_STEP_PARENTS = ['request_id', 'scan_run_id'] as const
export const ACCOUNT_DELETION_USER_FK = 'fk_account_deletion_user_set_null'

await knex.schema.createTable('data_lifecycle_steps', table => {
  table.bigIncrements('id').primary()
  table.uuid('step_id').notNullable().unique('uk_lifecycle_step_id')
  table.uuid('request_id').nullable()
  table.uuid('scan_run_id').nullable()
  table.string('step_code', 64).notNullable()
  table.string('category_code', 64).notNullable()
  table.string('action', 32).notNullable()
  table.string('status', 32).notNullable().defaultTo('PENDING')
  table.json('cursor_json').nullable()
  table.bigInteger('planned_count').unsigned().notNullable().defaultTo(0)
  table.bigInteger('processed_count').unsigned().notNullable().defaultTo(0)
  table.integer('attempt_count').unsigned().notNullable().defaultTo(0)
  table.string('lease_owner', 96).nullable()
  table.timestamp('lease_expires_at').nullable()
  table.timestamp('next_attempt_at').nullable()
  table.string('last_error_code', 96).nullable()
  table.timestamps(true, true)
  table.unique(['request_id', 'step_code'], 'uk_lifecycle_request_step')
  table.unique(['scan_run_id', 'step_code'], 'uk_lifecycle_scan_step')
})
await knex.raw(`ALTER TABLE data_lifecycle_steps ADD CONSTRAINT chk_lifecycle_one_parent
  CHECK ((request_id IS NULL) <> (scan_run_id IS NULL))`)
```

父表创建完成后，`request_id` 外键引用 `account_deletion_requests.request_id`，`scan_run_id` 外键引用 `data_retention_scan_runs.scan_run_id`，均使用 `ON DELETE CASCADE`；父记录本身按回执策略保留，不能由 Worker 提前删除。

迁移必须先删除旧 `fk_account_deletion_user`，把 `account_deletion_requests.user_id`、`confirmation_phrase` 和 `reauthenticated_at` 改为可空，再建立 `ON DELETE SET NULL`。现有 `PENDING/CANCELLED/COMPLETED` 只映射状态，不创建待执行步骤。

- [x] **Step 4: 添加匿名档案、受限保留和控制面字段**

为 `exam_results`、`answer_records`、`proctoring_sessions`、`proctoring_events`、`proctoring_identity_checks`、`proctoring_review_cases` 增加可空 `anonymous_subject_id` 与相应索引；为需要按期清理的上述表及 `logs` 增加可空 `retain_until` 和 `retention_policy_version`。需要在注销后保留的 `user_id` 改为可空。复核决定和消息的 `actor_user_id`、申诉的 `user_id` 改为可空，保留动作但不保留注销操作者映射。

迁移还必须把 Task 3 注册表中采用 `ANONYMIZE` 或 `RESTRICTED_RETENTION` 的主体列改为可空：`discussions.user_id`、`discussion_replies.user_id`、`guardian_consents.child_user_id/guardian_user_id`、`tasks.user_id`、`task_department_assignments.assigned_by`、`announcements.created_by`、`files.created_by/updated_by`、`workflow_requests.created_by`、`workflow_approvals.user_id`、`workflow_templates.created_by`、`workflow_instances.created_by`、`face_credentials.created_by`、`logs.user_id`、`data_retention_holds.created_by/released_by` 和 `data_lifecycle_controls.updated_by`。表或列在兼容模式中不存在时记录跳过；存在但无法安全改造时迁移失败，不吞掉异常。

`data_lifecycle_controls` 每区域一行，字段固定为 `data_region`、`paused`、`pause_reason`、`review_at`、`updated_by`、`updated_at`；`data_retention_scan_runs` 使用 `data_region + category_code + window_start + window_end` 唯一键。

- [x] **Step 5: 实现安全的 `down` 拒绝条件并验证导入**

```ts
const [{ irreversible_count }] = await knex('account_deletion_requests')
  .whereNull('user_id')
  .whereIn('execution_status', ['COMPLETED', 'COMPLETED_WITH_RESTRICTED_RETENTION'])
  .count<{ irreversible_count: number }[]>({ irreversible_count: '*' })
if (Number(irreversible_count) > 0) {
  throw new Error('Cannot rollback lifecycle schema after irreversible deletion execution')
}
```

Run: `pnpm -C apps/backend exec tsx -e "import('./db/migrations/20260831_000005_add_data_lifecycle_foundation.ts').then(m => { if (typeof m.up !== 'function' || typeof m.down !== 'function') process.exit(1); console.log('phase6 migration import ok') })"`

Expected: `phase6 migration import ok`，不得建立数据库连接或执行迁移。

- [x] **Step 6: 运行契约测试和类型检查**

Run: `pnpm -C apps/backend test -- src/modules/privacy-lifecycle/domain/lifecycle-schema.contract.test.ts`

Run: `pnpm -C apps/backend typecheck`

Expected: PASS。

- [x] **Step 7: 提交迁移**

```bash
git add apps/backend/db/migrations/20260831_000005_add_data_lifecycle_foundation.ts apps/backend/src/modules/privacy-lifecycle/domain/lifecycle-schema.contract.test.ts
git commit -m "feat(privacy): 新增生命周期账本迁移"
```

---

### Task 3: 显式数据处理器注册表与模式覆盖审计

**Files:**
- Create: `apps/backend/src/modules/privacy-lifecycle/domain/data-handler.registry.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/domain/data-handler.registry.test.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/services/lifecycle-schema-audit.service.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/services/lifecycle-schema-audit.service.test.ts`
- Create: `apps/backend/scripts/privacy/lifecycle-schema-audit.ts`
- Modify: `apps/backend/package.json`

**Interfaces:**
- Produces: `LifecycleDatasetDefinition`、`LIFECYCLE_DATASETS`、`assertLifecycleSchemaCovered(schemaColumns)`。
- Produces: `LifecycleSchemaAuditService.inspect()`，只读取 `information_schema`。
- Consumed by: Tasks 5–9 的 Worker、安全预演和期限扫描。

- [x] **Step 1: 写失败的未分类数据集阻断测试**

```ts
test('新增 user_id 表未注册时阻断执行', () => {
  assert.throws(
    () => assertLifecycleSchemaCovered([
      { tableName: 'users', columnName: 'id', referencedTableName: null },
      { tableName: 'new_subject_notes', columnName: 'user_id', referencedTableName: 'users' },
    ]),
    (error: any) => error.code === 'LIFECYCLE_UNCLASSIFIED_DATASET',
  )
})
```

再覆盖邮箱、手机号、`actor_user_id`、`created_by`、`shared_by`、`reviewer_user_id` 等已知身份列；错误只返回表名、列名和分类缺失，不返回数据内容。

- [x] **Step 2: 定义只允许固定标识符的注册表**

```ts
export type LifecycleDatasetDefinition = {
  tableName: string
  subjectColumns: readonly string[]
  identityColumns: readonly string[]
  category: LifecycleCategoryCode
  action: RetentionAction
  handlerCode: string
}

export const LIFECYCLE_DATASETS = [
  { tableName: 'users', subjectColumns: ['id'], identityColumns: ['email', 'phone', 'public_id', 'username', 'nickname'], category: 'ACCOUNT_ROW', action: 'DELETE', handlerCode: 'delete_account' },
  { tableName: 'face_credentials', subjectColumns: ['user_id'], identityColumns: ['embedding'], category: 'FACE_CREDENTIALS', action: 'DELETE', handlerCode: 'delete_face_credentials' },
  { tableName: 'refresh_tokens', subjectColumns: ['user_id'], identityColumns: ['jti'], category: 'AUTH_CREDENTIALS', action: 'DELETE', handlerCode: 'delete_auth_credentials' },
  { tableName: 'password_reset_tokens', subjectColumns: ['user_id'], identityColumns: ['token'], category: 'AUTH_CREDENTIALS', action: 'DELETE', handlerCode: 'delete_auth_credentials' },
  { tableName: 'user_oauth_accounts', subjectColumns: ['user_id'], identityColumns: ['provider_user_id'], category: 'AUTH_CREDENTIALS', action: 'DELETE', handlerCode: 'delete_auth_credentials' },
  { tableName: 'user_identities', subjectColumns: ['user_id'], identityColumns: ['identifier_normalized', 'provider_subject'], category: 'AUTH_CREDENTIALS', action: 'DELETE', handlerCode: 'delete_auth_credentials' },
  { tableName: 'exam_results', subjectColumns: ['user_id'], identityColumns: [], category: 'EXAM_ARCHIVE', action: 'ANONYMIZE', handlerCode: 'anonymize_exam_archive' },
  { tableName: 'answer_records', subjectColumns: ['user_id'], identityColumns: [], category: 'EXAM_ARCHIVE', action: 'ANONYMIZE', handlerCode: 'anonymize_exam_archive' },
  { tableName: 'logs', subjectColumns: ['user_id'], identityColumns: ['ip', 'user_agent'], category: 'SECURITY_LOGS', action: 'ANONYMIZE', handlerCode: 'redact_security_logs' },
] as const satisfies readonly LifecycleDatasetDefinition[]
```

注册表必须逐项包含以下当前模式分类，不得用通配表名或动态 SQL 代替：

| 处理器 | 表与主体列 | 动作 |
| --- | --- | --- |
| `delete_auth_credentials` | `refresh_tokens.user_id`、`user_oauth_accounts.user_id`、`user_identities.user_id`、`password_reset_tokens.user_id` | `DELETE` |
| `delete_face_credentials` | `face_credentials.user_id`；代录者 `created_by` 另由审计操作者处理 | `DELETE` |
| `delete_profile_learning_data` | `user_settings.user_id`、`favorite_categories.user_id`、`favorites.user_id`、`favorite_shares.shared_by`、`wrong_question_books.user_id`、`wrong_questions.user_id`、`wrong_question_practice_records.user_id`、`wrong_question_book_shares.shared_by`、`practice_records.user_id`、`learning_progress.user_id`、`learning_statistics.user_id`、`learning_tracks.user_id`、`learning_goals.user_id`、`learning_achievements.user_id`、`ai_chat_sessions.user_id`、`ai_chat_logs.user_id` | `DELETE` |
| `delete_private_messages_tasks` | `messages.user_id`、`todos.user_id`、`notifications.user_id`、`user_menus.user_id`、`mail_recipients.recipient_id`、`mail_messages.sender_id`（连同该消息的收件关系） | `DELETE` |
| `detach_memberships_rankings` | `user_roles.user_id`、`user_organizations.user_id`、`user_org_roles.user_id`、`task_assignments.user_id`、`leaderboard_entries.user_id`、`leaderboard_records.user_id`、`competition_participants.user_id` | `DELETE` |
| `anonymize_user_content` | `discussions.user_id`、`discussion_replies.user_id` 使用“已注销用户”占位；`discussion_likes.user_id`、`discussion_bookmarks.user_id`、`discussion_follows.user_id`、`discussion_reports.user_id`、`user_discussion_stats.user_id` 删除 | `ANONYMIZE` |
| `anonymize_exam_archive` | `exam_results.user_id`、`answer_records.user_id` | `ANONYMIZE` |
| `restrict_proctoring_data` | `proctoring_consents.user_id`、`proctoring_sessions.user_id`、`proctoring_events.user_id`、`proctoring_identity_checks.user_id`、`proctoring_review_cases.user_id`、`proctoring_review_appeals.user_id` | `RESTRICTED_RETENTION` |
| `redact_audit_actors` | `proctoring_review_decisions.actor_user_id`、`proctoring_review_messages.actor_user_id`、`tasks.user_id`、`task_department_assignments.assigned_by`、`announcements.created_by`、`files.created_by/updated_by`、`workflow_requests.created_by`、`workflow_approvals.user_id`、`workflow_templates.created_by`、`workflow_instances.created_by`、`face_credentials.created_by`、`data_retention_holds.created_by/released_by`、`data_lifecycle_controls.updated_by` | `ANONYMIZE` |
| `restrict_guardian_consents` | `guardian_consents.child_user_id/guardian_user_id` 清空，`evidence_json` 去标识，到期前限制保留 | `RESTRICTED_RETENTION` |
| `redact_security_logs` | `logs.user_id` 及日志 JSON 中的邮箱、手机号、IP/UA 非必要直接标识；`login_failures/auth_login_failures` 的登录标识 | `ANONYMIZE` |
| `delete_account` | `users.id` | `DELETE` |

运行真实模式审计时如果发现同名表不存在可报告 `ABSENT`；如果发现表存在但列、动作或处理器未注册则失败关闭。迁移中出现的重复/兼容表名仍必须由模式审计按实际数据库结果裁决。

- [x] **Step 3: 实现只读 `information_schema` 审计服务**

```ts
const [rows] = await pool.query(`
  SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName,
         REFERENCED_TABLE_NAME AS referencedTableName
    FROM information_schema.KEY_COLUMN_USAGE
   WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = 'users'
  UNION DISTINCT
  SELECT TABLE_NAME, COLUMN_NAME, NULL
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND (
       COLUMN_NAME IN (
         'user_id','actor_user_id','created_by','updated_by','assigned_by','shared_by','reviewer_user_id',
         'child_user_id','guardian_user_id','sender_id','recipient_id','email','phone','username','nickname',
         'identifier_normalized','provider_subject','provider_user_id','ip','ip_address','user_agent','token','jti','embedding'
       )
       OR (TABLE_NAME = 'users' AND COLUMN_NAME = 'public_id')
     )
`)
return assertLifecycleSchemaCovered(rows as LifecycleSchemaColumn[])
```

- [x] **Step 4: 添加只读审计脚本和包命令**

```json
{
  "privacy:schema-audit": "tsx scripts/privacy/lifecycle-schema-audit.ts"
}
```

脚本成功只输出按类别聚合的表/列数量；失败输出未分类标识符并以状态码 1 退出。脚本不得读取业务行。

- [x] **Step 5: 运行注册表测试、审计服务测试和类型检查**

Run: `pnpm -C apps/backend test -- src/modules/privacy-lifecycle/domain/data-handler.registry.test.ts src/modules/privacy-lifecycle/services/lifecycle-schema-audit.service.test.ts`

Run: `pnpm -C apps/backend typecheck`

Expected: PASS；本地没有隔离数据库时不运行真实 `privacy:schema-audit`。

- [x] **Step 6: 提交覆盖审计**

```bash
git add apps/backend/src/modules/privacy-lifecycle apps/backend/scripts/privacy apps/backend/package.json
git commit -m "feat(privacy): 阻断未分类用户数据集"
```

---

### Task 4: 双路径注销申请、状态查询和取消 API

**Files:**
- Create: `apps/backend/src/modules/account/domain/account-deletion.model.ts`
- Create: `apps/backend/src/modules/account/services/account-deletion.service.test.ts`
- Modify: `apps/backend/src/modules/account/repositories/account-deletion.repository.ts`
- Modify: `apps/backend/src/modules/account/services/account-deletion.service.ts`
- Modify: `apps/backend/src/modules/account/controllers/account-deletion.controller.ts`
- Modify: `apps/backend/src/modules/account/routes/account.routes.ts`
- Modify: `apps/backend/src/modules/auth/domain/auth.model.ts`
- Modify: `apps/backend/src/types/response.ts`
- Create: `apps/backend/src/common/logging/sensitive-field-redaction.ts`
- Create: `apps/backend/src/common/logging/sensitive-field-redaction.test.ts`
- Modify: `apps/backend/src/app.ts`
- Modify: `apps/backend/src/common/middleware/http-logger.ts`

**Interfaces:**
- Consumes: Task 1 策略、摘要、UUID 和状态令牌。
- Produces: `AccountDeletionRepositoryContract` 与 MySQL 实现。
- Produces: `request(userId, { requestId, mode, statusToken, password, confirmationPhrase })`、`status({ requestId, statusToken } | { email, password })`、`cancel({ email, password })`。
- Produces: `DeletionStatusResponse` 与仅申请成功响应使用的 `DeletionRequestAcceptedResponse`，供 Task 10 前端使用。

- [x] **Step 1: 定义完整服务契约和内存仓储，写失败测试**

```ts
test('立即删除冻结账号、撤销会话并只保存客户端状态令牌摘要', async () => {
  const repository = new MemoryAccountDeletionRepository(activeUser())
  const service = new AccountDeletionService(repository, fixedClock)
  const statusToken = Buffer.alloc(32, 7).toString('base64url')
  const result = await service.request(7, {
    requestId: '1132689c-4a5d-42a2-86c5-3661e62d4d1f',
    mode: 'IMMEDIATE',
    statusToken,
    password: 'correct-password',
    confirmationPhrase: '删除问衡账号',
  })
  assert.equal(result.status, 'SCHEDULED')
  assert.equal(result.scheduledFor, '2026-08-31T08:00:00.000Z')
  assert.equal(result.statusToken, statusToken) // 只原样回显本次请求输入，不从数据库恢复
  assert.equal(repository.requests[0].statusTokenDigest, digestDeletionStatusToken(statusToken))
  assert.equal(repository.user.deletionStatus, 'SCHEDULED')
  assert.equal(repository.activeSessionCount, 0)
})
```

覆盖宽限 30 天、立即模式不可取消、开始执行后不可取消、相同 UUID/相同语义重放、相同 UUID/不同语义冲突、区域缺失和错误密码。

- [x] **Step 2: 运行服务测试确认现有接口不满足新契约**

Run: `pnpm -C apps/backend test -- src/modules/account/services/account-deletion.service.test.ts`

Expected: FAIL，原因是构造器、模式或状态令牌契约缺失。

- [x] **Step 3: 重构仓储为依赖注入契约并保持单事务冻结**

```ts
export interface AccountDeletionRepositoryContract {
  findUserForReauthentication(userId: number): Promise<AccountDeletionUser | null>
  findUserByEmailForReauthentication(email: string): Promise<AccountDeletionUser | null>
  createOrReplay(input: CreateDeletionRequestInput): Promise<CreateDeletionRequestResult>
  findByStatusCredential(requestId: string): Promise<AccountDeletionRecord | null>
  findLatestByUser(userId: number): Promise<AccountDeletionRecord | null>
  cancelGraceRequest(userId: number, now: Date): Promise<AccountDeletionRecord>
}
```

`createOrReplay` 在同一事务中锁定用户，写请求与固定策略快照、创建全部账号步骤、撤销 `refresh_tokens` 并冻结 `users.deletion_status`。服务层验证客户端令牌是 32 字节高熵 Base64URL 值，仓储只接收摘要；网络不确定重试必须携带相同 UUID、模式和令牌。申请消息箱在 Task 8 加入同一事务，以避免本任务依赖尚未建立的加密实现。

- [x] **Step 4: 实现令牌优先状态查询与完成后最小化响应**

```ts
async status(input: StatusByToken | StatusByPassword) {
  if ('statusToken' in input) {
    const row = await this.repository.findByStatusCredential(normalizeLifecycleUuid(input.requestId, '请求编号'))
    if (!row || !verifyDeletionStatusToken(input.statusToken, row.statusTokenDigest)) {
      throw new HttpError('注销请求或状态凭证无效', 404, { code: 'LIFECYCLE_STATUS_TOKEN_INVALID' })
    }
    return toPublicDeletionStatus(row)
  }
  const user = await this.verifyPassword(input.email, input.password)
  return toPublicDeletionStatus(await this.repository.findLatestByUser(user.id))
}
```

常规状态响应允许字段仅为请求编号、模式、区域、状态、步骤代码/状态、申请/计划/开始/完成时间、受限保留最晚日期和无身份统计；不返回原始状态令牌、内部错误正文、用户 ID、匿名主体 ID 或收件地址。只有申请成功的 `DeletionRequestAcceptedResponse` 可把本次请求体中的令牌原样回显一次，服务端不得从持久层恢复明文。

- [x] **Step 5: 扩展控制器白名单和稳定错误码**

请求体只选取 `requestId/mode/statusToken/password/confirmationPhrase`；状态只选取 `requestId/statusToken/email/password`；取消只选取 `email/password`。对外稳定使用 `LIFECYCLE_REQUEST_CONFLICT`、`LIFECYCLE_ALREADY_IRREVERSIBLE`、`LIFECYCLE_STATUS_TOKEN_INVALID`；模式、UUID 和确认词错误继续使用明确的 400 校验码。

新增递归日志脱敏器并让 `app.ts` 的错误请求快照调用它；键名大小写不敏感地清除 `password/statusToken/token/authorization/cookie/confirmationPhrase/email/phone`，数组和嵌套对象同样处理，且不修改原始请求体：

```ts
export function redactSensitiveFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitiveFields)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key,
    SENSITIVE_LOG_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redactSensitiveFields(item),
  ]))
}
```

`app.ts` 的 SQL 错误元信息只保留 `code/errno/sqlState/sqlMessage`，不再记录 SQL 参数或完整 SQL。`http-logger.ts` 用 `req.path` 代替可能包含查询串的 `originalUrl`，删除 `referer` 和完整 UA，只把 IPv4 归并到 `/24`、IPv6 归并到 `/48` 网络前缀；测试断言原始 IP、URL 查询和状态令牌不会进入日志对象。

- [x] **Step 6: 运行服务测试、旧策略测试、类型检查和构建**

Run: `pnpm -C apps/backend test -- src/modules/account/domain/account-deletion.policy.test.ts src/modules/account/services/account-deletion.service.test.ts src/common/logging/sensitive-field-redaction.test.ts`

Run: `pnpm -C apps/backend typecheck`

Run: `pnpm -C apps/backend build`

Expected: PASS。

- [x] **Step 7: 提交账号 API**

```bash
git add apps/backend/src/modules/account apps/backend/src/modules/auth/domain/auth.model.ts apps/backend/src/types/response.ts apps/backend/src/common/logging apps/backend/src/common/middleware/http-logger.ts apps/backend/src/app.ts
git commit -m "feat(account): 支持双路径注销与状态令牌"
```

---

### Task 5: 数据库租约、步骤状态机与独立 Worker

**Files:**
- Create: `apps/backend/src/modules/privacy-lifecycle/repositories/lifecycle-worker.repository.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/services/lifecycle-worker.service.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/services/lifecycle-worker.service.test.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/services/lifecycle-observability.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/workers/lifecycle.worker.ts`
- Modify: `apps/backend/package.json`

**Interfaces:**
- Produces: `LifecycleHandler`、`LifecycleHandlerContext`、`LifecycleBatchResult`。
- Produces: `LifecycleWorkerRepositoryContract.claimDueParent`、`claimNextStep`、`completeBatch`、`markRetry`、`releaseExpiredLeases`。
- Produces: `runLifecycleWorkerOnce(options): Promise<LifecycleWorkerRunSummary>`。
- Produces: `LifecycleMetrics` 和 `sanitizeLifecycleMetricLabels(labels)`；指标标签只允许区域、类别、状态和稳定错误码。
- Consumed by: Tasks 6、8、9。

- [x] **Step 1: 写失败的并发租约、崩溃接管与重试测试**

```ts
test('两个 Worker 不能同时执行同一步骤，租约过期后可接管', async () => {
  const repository = new MemoryLifecycleWorkerRepository(dueRequest())
  const first = await repository.claimNextStep('worker-a', now, 30_000)
  const second = await repository.claimNextStep('worker-b', now, 30_000)
  assert.equal(first?.stepId, STEP_ID)
  assert.equal(second, null)
  const takeover = await repository.claimNextStep('worker-b', new Date(now.getTime() + 30_001), 30_000)
  assert.equal(takeover?.stepId, STEP_ID)
})
```

覆盖同批次重复执行、游标只前进不后退、可恢复错误指数退避、五次失败以 `LIFECYCLE_STEP_RETRY_EXHAUSTED` 进入 `ATTENTION_REQUIRED`、全局暂停不认领、无关合法冻结步骤继续。

- [x] **Step 2: 定义处理器与仓储契约**

```ts
export interface LifecycleHandler {
  readonly stepCode: string
  readonly category: LifecycleCategoryCode
  planCount(context: LifecycleHandlerContext): Promise<number>
  executeBatch(context: LifecycleHandlerContext): Promise<LifecycleBatchResult>
}

export type LifecycleParentContext =
  | { kind: 'ACCOUNT_DELETION'; requestId: string; userId: number }
  | { kind: 'RETENTION_SCAN'; scanRunId: string; windowStart: Date; windowEnd: Date }

export interface DeletionManifestStager {
  stageFingerprint(input: {
    requestId: string
    dataRegion: DataRegion
    publicId: string
    connection: LifecycleTransaction
  }): Promise<void>
}

export type LifecycleBatchResult = {
  processedCount: number
  nextCursor: { afterId: string | number } | null
  done: boolean
  restrictedRetentionUntil?: string | null
}
```

处理器上下文包含 `parent: LifecycleParentContext`、区域、策略快照、游标、批量上限、当前时间和数据库连接工厂；账号处理器只接受 `ACCOUNT_DELETION`，期限处理器只接受声明支持的父类型，不接收任意表名。

- [x] **Step 3: 实现 MySQL 8 原子认领与租约续期**

认领事务使用以下固定查询，随后写 `lease_owner/lease_expires_at/status='RUNNING'`：

```sql
SELECT step_id
  FROM data_lifecycle_steps
 WHERE status IN ('PENDING', 'RETRYING')
   AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
   AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
 ORDER BY created_at, id
 LIMIT 1
 FOR UPDATE SKIP LOCKED
```

`completeBatch` 必须校验 `step_id + lease_owner`，处理器事务成功后才更新游标与计数；租约不匹配返回 `LIFECYCLE_LEASE_CONFLICT`。

- [x] **Step 4: 实现单轮 Worker 编排**

```ts
export async function runLifecycleWorkerOnce(options: LifecycleWorkerOptions) {
  await options.repository.releaseExpiredLeases(options.now)
  if (await options.repository.isRegionPaused(options.dataRegion)) {
    return { claimed: 0, completed: 0, retried: 0, paused: true }
  }
  const step = await options.repository.claimNextStep(options.workerId, options.now, options.leaseMs)
  if (!step) return { claimed: 0, completed: 0, retried: 0, paused: false }
  const handler = options.handlers.get(step.stepCode)
  if (!handler) return options.repository.markAttention(step, 'LIFECYCLE_UNCLASSIFIED_DATASET')
  return executeClaimedStep(step, handler, options)
}
```

错误日志只写父编号、步骤代码、稳定错误码和尝试次数；不得序列化处理器输入或 SQL 参数。

`LifecycleMetrics` 记录任务状态数/最老年龄、处理器成功/重试/关注/行数、租约接管和单步耗时。`sanitizeLifecycleMetricLabels` 遇到 `requestId/userId/email/phone/name` 等标签直接抛出 `LIFECYCLE_METRIC_LABEL_FORBIDDEN`；测试使用内存指标接收器断言没有高基数主体标签。

- [x] **Step 5: 添加显式独立进程命令**

```json
{
  "worker:lifecycle": "tsx src/modules/privacy-lifecycle/workers/lifecycle.worker.ts",
  "worker:lifecycle:once": "tsx src/modules/privacy-lifecycle/workers/lifecycle.worker.ts --once"
}
```

入口必须要求 `DATA_REGION`，生产模式还要求租约配置与外部墓碑接收器；启动后先运行 Task 3 的只读模式覆盖审计，发现未分类表/列立即以 `LIFECYCLE_UNCLASSIFIED_DATASET` 退出，不能开始认领。不得从 `app.ts` 自动启动。

- [x] **Step 6: 运行 Worker 测试、类型检查和构建**

Run: `pnpm -C apps/backend test -- src/modules/privacy-lifecycle/services/lifecycle-worker.service.test.ts`

Run: `pnpm -C apps/backend typecheck`

Run: `pnpm -C apps/backend build`

Expected: PASS；不运行 Worker 进程。

- [x] **Step 7: 提交 Worker 核心**

```bash
git add apps/backend/src/modules/privacy-lifecycle apps/backend/package.json
git commit -m "feat(privacy): 建立可恢复生命周期 Worker"
```

---

### Task 6: 物理删除、匿名考试档案与最终关联性断言

**Files:**
- Create: `apps/backend/src/modules/privacy-lifecycle/handlers/delete-auth-credentials.handler.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/handlers/delete-face-credentials.handler.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/handlers/delete-personal-data.handler.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/handlers/delete-private-messages.handler.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/handlers/anonymize-user-content.handler.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/handlers/anonymize-exam-archive.handler.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/handlers/restrict-proctoring-data.handler.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/handlers/restrict-guardian-consents.handler.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/handlers/detach-memberships.handler.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/handlers/redact-audit-actors.handler.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/handlers/redact-security-logs.handler.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/handlers/delete-account.handler.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/handlers/index.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/handlers/lifecycle-handlers.test.ts`
- Modify: `apps/backend/src/modules/privacy-lifecycle/workers/lifecycle.worker.ts`
- Modify: `apps/backend/src/modules/exams/repositories/result.repository.ts`
- Modify: `apps/backend/src/modules/exams/repositories/exam.repository.ts`
- Modify: `apps/backend/src/modules/proctoring/repositories/proctoring-review.repository.ts`
- Modify: `apps/backend/src/modules/proctoring/repositories/proctoring.repository.ts`
- Modify: `apps/backend/src/modules/leaderboard/repositories/leaderboard.repository.ts`
- Modify: `apps/backend/src/modules/logs/repositories/log.repository.ts`

**Interfaces:**
- Consumes: Task 3 固定注册表与 Task 5 `LifecycleHandler`。
- Produces: `createLifecycleHandlerMap(dependencies)`，键必须与步骤代码一一对应。
- Produces: `assertNoIdentityToAnonymousLink(connection, requestId)`。

- [x] **Step 1: 写失败的执行顺序、幂等和匿名化测试**

```ts
test('考试档案迁移到随机匿名主体后清空所有原用户列', async () => {
  const db = lifecycleFixture({ examResults: 1, answers: 2, proctoringEvents: 3 })
  const handler = createAnonymizeExamArchiveHandler(db)
  const result = await handler.executeBatch(contextForUser(7))
  assert.equal(result.done, true)
  assert.equal(db.examResults[0].userId, null)
  assert.match(db.examResults[0].anonymousSubjectId, UUID_RE)
  assert.equal(db.answers.every(row => row.userId === null), true)
  assert.equal(db.identityToAnonymousLinks(), 0)
})
```

覆盖人脸与认证凭据先删、资料/收藏/错题物理删除、机构成绩匿名化、个人成绩期限、监考数据到期删除/未到期限制保留、组织与排行榜解除、日志字段脱敏、重复批次不重复创建匿名主体。

- [x] **Step 2: 实现固定 SQL 模板与小批量游标**

每个处理器只声明本文件内常量 SQL，并对 `id > ? ORDER BY id LIMIT ?` 使用上一步游标。`anonymize-exam-archive` 在同一事务创建一次 `anonymous_exam_subjects`，更新 `exam_results/answer_records`，随后更新需要保留的监考与复核父记录；中途失败必须整体回滚该批。

同时修改新数据写入路径固化期限：`exam.repository.ts` 按 `exams.org_id IS NULL` 选择 365 天，否则使用机构策略 1–5 年；`answer_records` 继承所属 `exam_results.retain_until`；`proctoring.repository.ts` 使用考试快照的 180 天或受约束配置写入事件、会话和身份结果期限；`log.repository.ts` 写 180 天。每条记录同时写 `retention_policy_version='wenheng-lifecycle-2026-08-v1'`，后续策略更新不得改写已有值。

- [x] **Step 3: 实现最终账号处理器的硬性前置条件**

```ts
const incomplete = await repository.countRequiredStepsNotCompleted(requestId, ['delete_account'])
if (incomplete > 0) throw new LifecyclePolicyError('前置步骤尚未完成', 'LIFECYCLE_PREREQUISITE_INCOMPLETE', 409)
await assertNoIdentityToAnonymousLink(connection, requestId)
const subject = await repository.lockUserPublicId(userId, connection)
if (!subject) return { processedCount: 0, nextCursor: null, done: true }
await manifest.stageFingerprint({ requestId, dataRegion, publicId: subject.publicId, connection })
await connection.query('DELETE FROM users WHERE id = ?', [userId])
await repository.assertRequestUserCleared(requestId, connection)
```

只有墓碑暂存已写入同一事务、所有前置步骤完成和关联断言通过才允许删除 `users`；回执与外部墓碑同步由 Task 9 完成。Task 5 的 Worker 入口在本任务改为注入 `createLifecycleHandlerMap`；墓碑暂存器在 Task 9 接入真实实现前使用失败关闭适配器，因此不得运行真实删除 Worker。

- [x] **Step 4: 调整考试与复核读模型显示注销主体**

`result.repository.ts` 使用 `LEFT JOIN users`，当 `r.user_id IS NULL AND r.anonymous_subject_id IS NOT NULL` 时返回 `student_name='已注销考生'`、`student_email=NULL`。复核仓储采用相同占位文案且不构造 `WH-${user_id}`；排行榜查询排除 `user_id IS NULL` 并删除既有排行榜关系。

- [x] **Step 5: 运行处理器、考试和复核回归测试**

Run: `pnpm -C apps/backend test -- src/modules/privacy-lifecycle/handlers/lifecycle-handlers.test.ts src/modules/proctoring/services/proctoring-review.service.test.ts src/modules/proctoring/services/proctoring-review-case-creation.test.ts`

Run: `pnpm -C apps/backend typecheck`

Expected: PASS。

- [x] **Step 6: 提交数据处理器**

```bash
git add apps/backend/src/modules/privacy-lifecycle/handlers apps/backend/src/modules/privacy-lifecycle/workers/lifecycle.worker.ts apps/backend/src/modules/exams/repositories/result.repository.ts apps/backend/src/modules/exams/repositories/exam.repository.ts apps/backend/src/modules/proctoring/repositories/proctoring-review.repository.ts apps/backend/src/modules/proctoring/repositories/proctoring.repository.ts apps/backend/src/modules/leaderboard/repositories/leaderboard.repository.ts apps/backend/src/modules/logs/repositories/log.repository.ts
git commit -m "feat(privacy): 执行账号数据删除与匿名化"
```

---

### Task 7: 合法冻结、区域控制面和管理 API

**Files:**
- Create: `apps/backend/src/modules/privacy-lifecycle/domain/retention-hold.policy.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/domain/retention-hold.policy.test.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/repositories/privacy-lifecycle-admin.repository.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/services/privacy-lifecycle-admin.service.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/services/privacy-lifecycle-admin.service.test.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/controllers/privacy-lifecycle.controller.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/routes/privacy-lifecycle.routes.ts`
- Modify: `apps/backend/src/routes/index.ts`
- Modify: `apps/backend/src/types/response.ts`

**Interfaces:**
- Produces: `createHold`、`releaseHold`、`extendHold`、`pauseRegion`、`resumeRegion`、`retryStep`、`dryRun`、`listRequests`、`getRequest`。
- Produces: `/privacy/lifecycle/*` 管理接口，只允许管理员且强制当前服务区域。
- Consumed by: Task 11 管理端。

- [x] **Step 1: 写失败的冻结范围、到期和权限测试**

```ts
test('人脸和认证凭据不能创建合法冻结', () => {
  for (const category of ['FACE_CREDENTIALS', 'AUTH_CREDENTIALS'] as const) {
    assert.throws(
      () => normalizeRetentionHold({
        category, scopeType: 'USER_REQUEST', scopeId: REQUEST_ID,
        reasonCode: 'LEGAL_DISPUTE', legalBasisReference: '案号 2026-08-31-01',
        expiresAt: '2026-09-30T00:00:00.000Z',
      }, new Date('2026-08-31T00:00:00.000Z')),
      (error: any) => error.code === 'LIFECYCLE_HOLD_CATEGORY_FORBIDDEN',
    )
  }
})
```

覆盖期限必须晚于当前时间、最高期限、空依据、跨区域访问、教师拒绝、重复 UUID/同语义重放、不同语义冲突、冻结到期自动失效。

- [x] **Step 2: 实现纯冻结策略和管理仓储契约**

```ts
export const HOLDABLE_CATEGORIES = new Set<LifecycleCategoryCode>([
  'EXAM_ARCHIVE', 'PROCTORING_AND_IDENTITY', 'SECURITY_LOGS', 'RECEIPT_AND_TOMBSTONE',
])
```

仓储查询必须始终携带 `data_region = ?`；列表与详情只选择父编号、模式、状态、步骤代码、计数、错误码、租约时间和受限保留期限。

- [x] **Step 3: 实现安全预演和控制操作**

`dryRun` 先调用 Task 3 模式覆盖审计，再调用每个处理器的 `planCount`，只返回 `{ category, action, count }[]`。暂停必须包含原因与 `reviewAt`，恢复清空暂停字段；`retryStep` 只允许 `ATTENTION_REQUIRED/RETRYING`，不允许修改成完成或跳过。

- [x] **Step 4: 注册管理员路由和稳定响应**

```ts
router.use(authenticateToken, requireRoleStr(['admin']))
router.get('/requests', wrap(PrivacyLifecycleController.listRequests))
router.get('/requests/:requestId', wrap(PrivacyLifecycleController.getRequest))
router.post('/dry-run', wrap(PrivacyLifecycleController.dryRun))
router.post('/holds', wrap(PrivacyLifecycleController.createHold))
router.post('/holds/:holdId/release', wrap(PrivacyLifecycleController.releaseHold))
router.post('/holds/:holdId/extend', wrap(PrivacyLifecycleController.extendHold))
router.post('/controls/pause', wrap(PrivacyLifecycleController.pause))
router.post('/controls/resume', wrap(PrivacyLifecycleController.resume))
router.post('/steps/:stepId/retry', wrap(PrivacyLifecycleController.retry))
```

- [x] **Step 5: 运行冻结/管理测试、类型检查和构建**

Run: `pnpm -C apps/backend test -- src/modules/privacy-lifecycle/domain/retention-hold.policy.test.ts src/modules/privacy-lifecycle/services/privacy-lifecycle-admin.service.test.ts`

Run: `pnpm -C apps/backend typecheck`

Run: `pnpm -C apps/backend build`

Expected: PASS。

- [x] **Step 6: 提交管理控制面**

```bash
git add apps/backend/src/modules/privacy-lifecycle apps/backend/src/routes/index.ts apps/backend/src/types/response.ts
git commit -m "feat(privacy): 增加合法冻结与区域控制 API"
```

---

### Task 8: 加密事务消息箱与最小化注销通知

**Files:**
- Create: `apps/backend/src/modules/privacy-lifecycle/domain/outbox-crypto.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/domain/outbox-crypto.test.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/repositories/lifecycle-outbox.repository.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/services/lifecycle-notification.service.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/services/lifecycle-notification.service.test.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/workers/lifecycle-outbox.worker.ts`
- Modify: `apps/backend/src/modules/account/repositories/account-deletion.repository.ts`
- Modify: `apps/backend/src/modules/account/services/account-deletion.service.test.ts`
- Modify: `apps/backend/package.json`

**Interfaces:**
- Produces: `encryptOutboxValue`、`decryptOutboxValue`，使用带版本 AES-256-GCM 信封。
- Produces: `dispatchLifecycleOutboxOnce(options)`。
- Consumes: `emailService.sendPlainEmail`，通过依赖注入测试，不发送真实邮件。
- Consumes: Task 5 `LifecycleMetrics`，只上报队列长度、最老消息年龄、发送/重试/过期数量。

- [x] **Step 1: 写失败的加密、最小化和清理测试**

```ts
test('消息箱密文不包含邮箱、请求状态正文或原始载荷', () => {
  const envelope = encryptOutboxValue(
    Buffer.alloc(32, 9),
    'user@example.com',
    () => Buffer.alloc(12, 3),
  )
  assert.doesNotMatch(JSON.stringify(envelope), /user@example\.com/)
  assert.equal(decryptOutboxValue(Buffer.alloc(32, 9), envelope), 'user@example.com')
})
```

覆盖认证失败、未知密钥版本、发送成功立即清除密文、失败指数退避、7 天后即使未发送也清除收件地址与载荷、相同消息键不重复发送。

- [x] **Step 2: 实现 AES-GCM 信封和严格密钥校验**

```ts
export type EncryptedEnvelope = {
  keyVersion: string
  iv: string
  ciphertext: string
  authTag: string
}
```

生产启动要求 `LIFECYCLE_OUTBOX_KEY_V1` 为 32 字节 Base64；开发测试可注入固定 `Buffer`，不得提供硬编码默认密钥。

- [x] **Step 3: 实现事务消息箱认领与邮件适配**

消息类型固定为 `DELETION_REQUESTED`、`DELETION_GRACE_7D`、`DELETION_GRACE_24H`、`DELETION_CANCELLED`、`DELETION_COMPLETED`、`DELETION_RESTRICTED_RETENTION`、`DELETION_DELAYED`。邮件正文只含产品名、请求编号、状态、计划/完成时间、依法保留最晚日期和状态查询入口，不含成绩、监考、人脸或删除统计明细。

同时修改 `AccountDeletionRepository.createOrReplay`：在创建注销请求的同一数据库事务中，用注入的 `encryptOutboxValue` 写入唯一消息键 `deletion-requested:${requestId}`；幂等重放不得新增第二条消息。`cancelGraceRequest` 在恢复账号的同一事务中写 `deletion-cancelled:${requestId}`；完成、受限保留和延期消息由 Worker 状态转换事务写入。服务测试断言请求/取消、账号状态、会话撤销和相应消息箱要么一起提交，要么一起回滚。

- [x] **Step 4: 添加独立消息箱 Worker 命令**

```json
{
  "worker:lifecycle-outbox": "tsx src/modules/privacy-lifecycle/workers/lifecycle-outbox.worker.ts",
  "worker:lifecycle-outbox:once": "tsx src/modules/privacy-lifecycle/workers/lifecycle-outbox.worker.ts --once"
}
```

开发环境 `--once` 仍要求显式注入邮件适配器；测试使用内存适配器，不调用 SMTP。

- [x] **Step 5: 运行消息箱测试、类型检查和构建**

Run: `pnpm -C apps/backend test -- src/modules/privacy-lifecycle/domain/outbox-crypto.test.ts src/modules/privacy-lifecycle/services/lifecycle-notification.service.test.ts`

Run: `pnpm -C apps/backend typecheck`

Run: `pnpm -C apps/backend build`

Expected: PASS。

- [x] **Step 6: 提交消息箱**

```bash
git add apps/backend/src/modules/privacy-lifecycle apps/backend/src/modules/account/repositories/account-deletion.repository.ts apps/backend/src/modules/account/services/account-deletion.service.test.ts apps/backend/package.json
git commit -m "feat(privacy): 增加加密注销消息箱"
```

---

### Task 9: 删除墓碑、期限扫描与旧备份恢复重放

**Files:**
- Create: `apps/backend/src/modules/privacy-lifecycle/services/deletion-manifest.service.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/services/deletion-manifest.service.test.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/repositories/retention-scan.repository.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/services/retention-scan.service.ts`
- Create: `apps/backend/src/modules/privacy-lifecycle/services/retention-scan.service.test.ts`
- Create: `apps/backend/scripts/privacy/replay-deletion-manifest.ts`
- Create: `apps/backend/scripts/privacy/backfill-retain-until.ts`
- Modify: `apps/backend/src/modules/privacy-lifecycle/handlers/delete-account.handler.ts`
- Modify: `apps/backend/src/modules/privacy-lifecycle/workers/lifecycle.worker.ts`
- Modify: `apps/backend/package.json`

**Interfaces:**
- Produces: `DeletionManifestSink`、`DeletionManifestEntry`、`FileDeletionManifestSink`（仅非生产）。
- Produces: `runRetentionScanOnce({ dataRegion, category, windowStart, windowEnd, now })`。
- Produces: `replayDeletionManifest(source, database, keyring)`，恢复开放前调用。
- Consumes: Task 5 `LifecycleMetrics`，只上报墓碑待同步数量、扫描处理数量和恢复重放聚合结果。

- [x] **Step 1: 写失败的墓碑不可逆与恢复重放测试**

```ts
test('旧备份恢复后墓碑重放再次删除已注销主体且不暴露原编号', async () => {
  const sink = new MemoryDeletionManifestSink()
  await sink.append(createManifestEntry({ publicId: 'fa0d8c4e-4fd0-4f56-99aa-3f089d0e474a' }))
  const restored = restoredDatabaseWithPublicId('fa0d8c4e-4fd0-4f56-99aa-3f089d0e474a')
  const summary = await replayDeletionManifest(sink, restored, keyring)
  assert.equal(summary.deletedSubjects, 1)
  assert.equal(restored.users.length, 0)
  assert.doesNotMatch(JSON.stringify(await sink.list()), /fa0d8c4e/)
})
```

覆盖错误密钥版本失败关闭、墓碑重复重放幂等、清单同步前请求不能标完成、生产禁止文件接收器。

- [x] **Step 2: 实现版本化 HMAC 墓碑接口**

```ts
export type DeletionManifestEntry = {
  requestId: string
  dataRegion: DataRegion
  subjectDigest: string
  keyVersion: string
  completedAt: string
}

export interface DeletionManifestSink {
  append(entry: DeletionManifestEntry): Promise<void>
  list(cursor?: string): Promise<{ entries: DeletionManifestEntry[]; nextCursor: string | null }>
}
```

摘要为 `HMAC-SHA256(regionKey, publicId)`；主数据库墓碑和独立接收器都不保存原 `publicId/users.id/email/phone`。`FileDeletionManifestSink` 只有 `NODE_ENV !== 'production'` 且传入明确文件路径时可创建。

把 Task 6 的失败关闭墓碑暂存器替换为本任务实现：账号处理器先把主体指纹写入主库墓碑，提交后由 Worker 同步到 `DeletionManifestSink`；只有外部接收器确认同一请求编号/摘要已存在，才完成回执步骤并推导父状态为完成。

- [x] **Step 3: 写失败的期限扫描唯一窗口和期限测试**

```ts
test('重复调度同一区域类别窗口只继续同一次扫描', async () => {
  const repository = new MemoryRetentionScanRepository()
  const first = await repository.createOrResume(windowInput)
  const second = await repository.createOrResume(windowInput)
  assert.equal(second.scanRunId, first.scanRunId)
  assert.equal(repository.scanRunCount, 1)
})
```

覆盖 `retain_until > now` 不清理、有效冻结跳过、冻结过期重新入队、7 天/24 小时宽限提醒只入箱一次、消息箱过期清理和匿名档案到期删除。

- [x] **Step 4: 实现确定性扫描父记录并复用 Worker 步骤**

扫描类别固定为 `FACE_CREDENTIALS`、`EXAM_ARCHIVE`、`PROCTORING_AND_IDENTITY`、`SECURITY_LOGS`、`RECEIPT_AND_TOMBSTONE`、`OUTBOX_PURGE`、`DELETION_REMINDERS`。`FACE_CREDENTIALS` 只选择已撤回同意或进入注销处理的凭据并立即清理；`createOrResume` 以区域、类别和 UTC 日窗口唯一，只把到期主键范围写入游标，不保存记录内容。

- [x] **Step 5: 添加恢复命令和包脚本**

```json
{
  "privacy:retention:once": "tsx src/modules/privacy-lifecycle/workers/lifecycle.worker.ts --retention-once",
  "privacy:retention:backfill": "tsx scripts/privacy/backfill-retain-until.ts",
  "privacy:manifest:replay": "tsx scripts/privacy/replay-deletion-manifest.ts"
}
```

重放脚本必须要求显式 `--source`、`--data-region` 和 `--dry-run` 或 `--execute`；默认只允许 `--dry-run`。`--execute` 不能由本计划本地验收调用。

历史期限回填脚本同样默认 `--dry-run`，并输出按类别聚合数量：`exam_results` 通过 `exams.org_id` 判断个人 365 天或机构默认 1095 天，`answer_records` 继承结果期限，监考/身份/复核使用考试快照和关闭时间，日志使用 180 天。只有显式 `--execute --data-region=<CN|GLOBAL>` 才更新空的 `retain_until/retention_policy_version`，绝不覆盖已有快照；本计划不运行 `--execute`。

- [x] **Step 6: 运行墓碑、扫描测试与后端全量检查**

Run: `pnpm -C apps/backend test -- src/modules/privacy-lifecycle/services/deletion-manifest.service.test.ts src/modules/privacy-lifecycle/services/retention-scan.service.test.ts`

Run: `pnpm -C apps/backend test`

Run: `pnpm -C apps/backend typecheck`

Run: `pnpm -C apps/backend build`

Expected: PASS；不连接数据库、不执行恢复命令。

- [x] **Step 7: 提交墓碑与扫描器**

```bash
git add apps/backend/src/modules/privacy-lifecycle apps/backend/scripts/privacy apps/backend/package.json
git commit -m "feat(privacy): 增加删除墓碑与期限扫描"
```

---

### Task 10: Web 与 iOS 状态凭证和用户注销闭环

**Files:**
- Create: `apps/web/src/platform/account-deletion/deletionStatusCredential.ts`
- Create: `apps/web/src/platform/account-deletion/deletionStatusCredential.test.ts`
- Create: `apps/web/src/features/account/components/AccountDeletionRequestCard.tsx`
- Create: `apps/web/src/features/account/components/AccountDeletionRequestCard.test.tsx`
- Create: `apps/web/src/features/account/pages/AccountDeletionPage.test.tsx`
- Modify: `apps/web/src/platform/secure-session/nativeSecureSession.ts`
- Modify: `apps/web/src/platform/secure-session/nativeSecureSession.test.ts`
- Modify: `apps/web/ios/App/App/WenhengSecureSessionPlugin.swift`
- Modify: `apps/web/src/shared/api/endpoints/accountDeletion.ts`
- Modify: `apps/web/src/features/account/pages/AccountDeletionPage.tsx`
- Modify: `apps/web/src/features/settings/pages/tabs/AccountTab.tsx`
- Modify: `apps/web/src/app/i18n/zh-CN.ts`
- Modify: `apps/web/src/app/i18n/en-US.ts`

**Interfaces:**
- Consumes: Task 4 用户 API。
- Produces: `DeletionStatusCredentialStore.read/write/clear`。
- Produces: `createClientDeletionStatusToken(cryptoSource)`，返回 32 字节 Base64URL 值。
- Produces: 双模式申请卡、状态时间线、宽限取消和中断恢复。

- [x] **Step 1: 写失败的 Web 会话与原生 Keychain 凭证测试**

```ts
test('Web 注销状态凭证只写 sessionStorage', async () => {
  const store = createDeletionStatusCredentialStore({ target: 'web' })
  const statusToken = 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc'
  await store.write({ requestId: REQUEST_ID, statusToken })
  expect(sessionStorage.getItem('wenheng.deletion-status.v1')).toContain(REQUEST_ID)
  expect(localStorage.getItem('wenheng.deletion-status.v1')).toBeNull()
})
```

原生测试注入插件并断言写入后不会落 `sessionStorage/localStorage`；清理失败必须向页面传递，不得静默丢失状态恢复能力。

- [x] **Step 2: 扩展现有原生安全插件的独立 Keychain 项**

先实现浏览器安全随机令牌生成；测试注入固定 `getRandomValues`，生产不允许 `Math.random`：

```ts
export function createClientDeletionStatusToken(
  cryptoSource: Pick<Crypto, 'getRandomValues'> = globalThis.crypto,
): string {
  const bytes = cryptoSource.getRandomValues(new Uint8Array(32))
  const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('')
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
```

```swift
private static let deletionStatusAccount = "account-deletion-status-v1"

public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "readDeletionStatus", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "writeDeletionStatus", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "clearDeletionStatus", returnType: CAPPluginReturnPromise)
]
```

注销状态与登录会话使用不同 `kSecAttrAccount`；写入属性继续使用 `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`。清理登录令牌不得误删注销状态凭证。

- [x] **Step 3: 写失败的双模式申请组件测试**

```tsx
test('立即删除明确显示不可取消并提交固定 UUID', async () => {
  render(<AccountDeletionRequestCard api={fakeApi} credentialStore={memoryCredentialStore} />)
  await user.click(screen.getByLabelText('立即删除'))
  await user.type(screen.getByLabelText('当前密码'), 'correct-password')
  await user.type(screen.getByLabelText('确认词'), '删除问衡账号')
  await user.click(screen.getByRole('button', { name: '确认并冻结账号' }))
  expect(fakeApi.lastRequest.mode).toBe('IMMEDIATE')
  expect(fakeApi.lastRequest.requestId).toMatch(UUID_RE)
  expect(fakeApi.lastRequest.statusToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
  expect(await memoryCredentialStore.read()).toEqual({ requestId: fakeApi.requestId, statusToken: fakeApi.statusToken })
})
```

覆盖 30 天模式可取消、预览分类、错误密码、不确定网络重试复用同一 UUID/语义。组件在发起请求前先把 `{ requestId, statusToken }` 安全写入凭证存储；明确的 4xx 拒绝时清理，网络结果不确定时保留并允许原样重试；成功后再清理登录令牌。

- [x] **Step 4: 更新 API 类型与用户申请入口**

```ts
request(payload: {
  requestId: string
  mode: 'IMMEDIATE' | 'GRACE_PERIOD'
  statusToken: string
  password: string
  confirmationPhrase: string
}) {
  return api.post<DeletionStatus>('/account/deletion/request', payload)
}
status(payload: { requestId: string; statusToken: string } | { email: string; password: string }) {
  return api.post<DeletionStatus>('/account/deletion/status', payload)
}
```

`AccountTab` 增加危险区卡片并加载真实预览；申请成功后写状态凭证、清除登录 Token、跳转 `/account-deletion`。不在 React Router state、URL、日志或错误提示中放原始令牌。

- [x] **Step 5: 重构状态页为令牌优先和完整状态时间线**

页面启动先读取状态凭证并查询；没有凭证时才显示邮箱/密码恢复表单。展示所有主状态、请求模式、计划时间、受限保留说明和稳定错误；只有 `GRACE_PERIOD + SCHEDULED/REQUESTED` 显示取消。取消成功清理状态凭证并返回登录页。

- [x] **Step 6: 运行前端目标测试、类型检查和构建**

Run: `pnpm -C apps/web test -- src/platform/account-deletion/deletionStatusCredential.test.ts src/platform/secure-session/nativeSecureSession.test.ts src/features/account/components/AccountDeletionRequestCard.test.tsx src/features/account/pages/AccountDeletionPage.test.tsx`

Run: `pnpm -C apps/web typecheck`

Run: `pnpm -C apps/web build`

Run: `pnpm -C apps/web build:ios`

Expected: PASS。

- [x] **Step 7: 提交用户端闭环**

```bash
git add apps/web/src/platform/account-deletion apps/web/src/platform/secure-session apps/web/ios/App/App/WenhengSecureSessionPlugin.swift apps/web/src/shared/api/endpoints/accountDeletion.ts apps/web/src/features/account apps/web/src/features/settings/pages/tabs/AccountTab.tsx apps/web/src/app/i18n
git commit -m "feat(mobile): 完成注销申请与状态恢复界面"
```

---

### Task 11: 区域管理生命周期控制台

**Files:**
- Create: `apps/web/src/shared/api/endpoints/privacyLifecycle.ts`
- Create: `apps/web/src/features/privacy-lifecycle/domain/lifecyclePresentation.ts`
- Create: `apps/web/src/features/privacy-lifecycle/domain/lifecyclePresentation.test.ts`
- Create: `apps/web/src/features/privacy-lifecycle/hooks/usePrivacyLifecycle.ts`
- Create: `apps/web/src/features/privacy-lifecycle/components/RetentionHoldModal.tsx`
- Create: `apps/web/src/features/privacy-lifecycle/components/LifecycleRequestDrawer.tsx`
- Create: `apps/web/src/features/privacy-lifecycle/pages/PrivacyLifecyclePage.tsx`
- Create: `apps/web/src/features/privacy-lifecycle/pages/PrivacyLifecyclePage.test.tsx`
- Modify: `apps/web/src/shared/api/endpoints/index.ts`
- Modify: `apps/web/src/app/routing/pageRegistry.ts`
- Modify: `apps/web/src/app/routing/DynamicRoutes.tsx`
- Modify: `apps/web/src/app/i18n/zh-CN.ts`
- Modify: `apps/web/src/app/i18n/en-US.ts`

**Interfaces:**
- Consumes: Task 7 管理 API。
- Produces: `privacy-lifecycle` 页面键和 `/admin/privacy/lifecycle` 固定后台路由。
- Produces: 聚合队列、步骤抽屉、安全预演、合法冻结、暂停/恢复和人工重试。

- [x] **Step 1: 写失败的状态展示与禁止操作测试**

```ts
test('控制台不提供强制完成、跳过或查看已删除内容入口', () => {
  render(<PrivacyLifecyclePage api={fakeAdminApi} currentRole="admin" />)
  expect(screen.queryByRole('button', { name: /强制完成|跳过步骤|查看原始数据/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '安全预演' })).toBeEnabled()
})
```

覆盖教师拒绝、区域只读标签、暂停必须填写原因和复核时间、合法冻结表单、不可冻结类别不出现、`ATTENTION_REQUIRED` 才显示重试、详情不显示邮箱/手机号/用户 ID。

- [x] **Step 2: 实现前端 API 和稳定展示映射**

`LifecycleAdminRequest` 只包含 `requestId/mode/status/region/requestedAt/scheduledFor/startedAt/completedAt/restrictedRetentionUntil/steps`。展示函数穷尽 Task 1 状态枚举，未知值统一显示“未知状态”且禁止操作。

- [x] **Step 3: 实现响应式队列与详情抽屉**

桌面表格显示请求编号、模式、状态、最老任务时间和区域；窄屏切换卡片。抽屉只显示步骤代码、动作、状态、计划/已处理数量、尝试次数和稳定错误码。安全预演仅显示类别聚合数量并要求二次确认，不触发执行。

- [x] **Step 4: 实现冻结与控制操作**

冻结表单字段固定为 `holdId/categoryCode/scopeType/scopeId/reasonCode/legalBasisReference/expiresAt`；暂停表单固定为 `reason/reviewAt`。每次写操作生成 UUID，网络不确定重试复用同一 UUID；成功后刷新区域队列。

- [x] **Step 5: 注册固定后台路由并保留服务端权限闸门**

```ts
const PrivacyLifecyclePage = lazy(() => import('@/features/privacy-lifecycle/pages/PrivacyLifecyclePage'))
// pageRegistry
'privacy-lifecycle': PrivacyLifecyclePage,
// DynamicRoutes.extraAdminRoutes
{ path: 'privacy/lifecycle', element: elementFromRegistry('privacy-lifecycle') },
```

页面检查当前角色并对非管理员渲染 403；真正权限仍由后端 `requireRoleStr(['admin'])` 与区域条件执行。

- [x] **Step 6: 运行控制台测试、前端全量检查和构建**

Run: `pnpm -C apps/web test -- src/features/privacy-lifecycle/domain/lifecyclePresentation.test.ts src/features/privacy-lifecycle/pages/PrivacyLifecyclePage.test.tsx`

Run: `pnpm -C apps/web test`

Run: `pnpm -C apps/web typecheck`

Run: `pnpm -C apps/web build`

Expected: PASS。

- [x] **Step 7: 提交管理端**

```bash
git add apps/web/src/shared/api/endpoints apps/web/src/features/privacy-lifecycle apps/web/src/app/routing apps/web/src/app/i18n
git commit -m "feat(admin): 增加数据生命周期控制台"
```

---

### Task 12: 全链路隐私测试、手机验收、iOS 构建与验证记录

**Files:**
- Create: `apps/backend/src/modules/privacy-lifecycle/services/lifecycle-e2e.service.test.ts`
- Create: `apps/web/e2e/mobile-account-deletion.phase6.spec.ts`
- Create: `apps/web/playwright.config.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/web/vite.config.ts`
- Modify: `apps/web/src/shared/styles/mobile-foundation.css`
- Modify: `apps/web/src/features/account/pages/AccountDeletionPage.tsx`
- Modify: `apps/web/src/features/account/pages/AccountDeletionPage.test.tsx`
- Modify: `apps/web/src/features/profile/components/AccountDeletionCard.tsx`
- Modify: `apps/web/src/features/settings/pages/tabs/AccountTab.tsx`
- Modify: `pnpm-lock.yaml`
- Create: `docs/verification/2026-08-31-wenheng-ios-phase-6.md`
- Modify: `docs/superpowers/specs/2026-08-31-wenheng-data-lifecycle-design.md`
- Modify: `docs/superpowers/plans/2026-08-31-wenheng-ios-phase-6-data-lifecycle.md`

**Interfaces:**
- Consumes: Tasks 1–11 的完整实现。
- Produces: 可复核的本地验证证据和明确的生产边界。

- [x] **Step 1: 写并运行隔离全链路测试**

```ts
test('立即注销从冻结走到物理删除且只保留去身份回执', async () => {
  const system = await createLifecycleTestSystem()
  const request = await system.requestImmediateDeletion(testUser)
  await system.runUntilIdle()
  assert.equal(await system.users.exists(testUser.id), false)
  assert.equal(await system.faceCredentials.count(testUser.id), 0)
  assert.equal(await system.examArchive.hasOriginalUserId(testUser.id), false)
  assert.equal(await system.receipts.containsForbiddenIdentity(request.requestId), false)
  assert.equal(await system.status(request.credential), 'COMPLETED')
})
```

同文件覆盖 30 天取消、合法保留完成、Worker 中断恢复、租约竞争、处理器故障、未知表阻断、期限扫描、消息箱清理、墓碑重放和完成后关联断言。本地没有隔离 MySQL 时使用事务化内存契约测试并在验证记录标记“未覆盖真实 MySQL”。

- [x] **Step 2: 运行后端完整验证矩阵**

Run: `pnpm -C apps/backend test`

Run: `pnpm -C apps/backend typecheck`

Run: `pnpm -C apps/backend build`

Run: `pnpm -C apps/backend exec tsx -e "import('./db/migrations/20260831_000005_add_data_lifecycle_foundation.ts').then(m => { if (typeof m.up !== 'function' || typeof m.down !== 'function') process.exit(1); console.log('phase6 migration import ok') })"`

Expected: 全部 PASS；明确不运行 `db:latest`、`privacy:schema-audit` 真实数据库模式、Worker 或邮件进程。

- [x] **Step 3: 建立可重复的本地浏览器验收环境**

Run: `pnpm -C apps/web add -D @playwright/test`

Run: `pnpm -C apps/web exec playwright install chromium`

新增配置只启动本地 iOS 目标 Vite，不连接真实后端：

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:4176', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm exec cross-env VITE_APP_TARGET=ios vite --host 127.0.0.1 --port 4176',
    url: 'http://127.0.0.1:4176',
    reuseExistingServer: false,
  },
})
```

E2E 用 `context.route('**/api/**', handler)` 返回完整 API 信封；登录、预览、申请、状态和取消均使用固定夹具。测试在页面加载前通过 `context.exposeFunction` 提供内存 Keychain 状态，再借助 Capacitor 插件头和 `nativePromise` 把 `WenhengSecureSession` 的六个方法桥接到该状态，使刷新/新文档仍能恢复凭证；这只是浏览器中的最小原生桥接桩。测试标题和验证记录必须同时说明“本地模拟 API + 模拟 Keychain 桥接”，不能写成真机验证。

- [x] **Step 4: 运行 Web 完整验证矩阵**

Run: `pnpm -C apps/web test`

Run: `pnpm -C apps/web typecheck`

Run: `pnpm -C apps/web build`

Run: `pnpm -C apps/web build:ios`

Expected: 全部 PASS，记录测试文件数、测试数和已存在但不阻断的构建警告。

- [x] **Step 5: 在两个手机视口执行注销闭环验收**

Run: `pnpm -C apps/web exec playwright test e2e/mobile-account-deletion.phase6.spec.ts --project=chromium`

验收固定覆盖 375×667 与 393×852：立即删除、30 天删除、取消、状态令牌恢复、网络中断、杀页面后恢复、受限保留文案、无横向溢出和意外应用控制台错误为 0。主动中断请求产生的 Chromium `net::ERR_FAILED` 资源诊断单独精确断言，不把它误报为应用错误。API 使用与生产相同的响应信封和状态枚举，不把前端 mock 成“已删除真实数据”。

- [x] **Step 6: 同步 Capacitor 并构建无签名通用模拟器**

Run: `pnpm -C apps/web cap:sync:ios`

Run: `pnpm -C apps/web ios:build:sim`

Run: `lipo -info apps/web/.build/ios-derived/Build/Products/Debug-iphonesimulator/App.app/App`

Expected: 构建成功，主程序包含 `x86_64 arm64`；不归档、不签名、不上传。

- [x] **Step 7: 自审隐私边界和变更完整性**

Run: `rg -n "statusToken|email|phone|anonymousSubjectId|anonymous_subject_id" apps/backend/src/modules/privacy-lifecycle apps/web/src/features/privacy-lifecycle`

逐处确认：服务端日志/回执/管理 API 没有原始状态令牌、邮箱、手机号和匿名主体编号；管理端类型没有禁止字段；账号完成后没有同时连接原用户和匿名主体的模型。随后运行 `git diff --check`。

- [x] **Step 8: 编写验证记录并更新计划勾选**

验证记录必须分开写：已实现、自动化通过、响应式通过、iOS 模拟器通过、未运行真实迁移、未连接生产、未发送邮件、未验证真机、未部署、未提审。不得把迁移可导入写成迁移已执行，也不得把模拟器构建写成 App Store 可发布。

- [x] **Step 9: 提交最终验证文档**

```bash
git add .gitignore apps/backend/src/modules/privacy-lifecycle/services/lifecycle-e2e.service.test.ts apps/web/e2e/mobile-account-deletion.phase6.spec.ts apps/web/playwright.config.ts apps/web/package.json apps/web/vite.config.ts apps/web/src/shared/styles/mobile-foundation.css apps/web/src/features/account/pages/AccountDeletionPage.tsx apps/web/src/features/account/pages/AccountDeletionPage.test.tsx apps/web/src/features/profile/components/AccountDeletionCard.tsx apps/web/src/features/settings/pages/tabs/AccountTab.tsx pnpm-lock.yaml docs/verification/2026-08-31-wenheng-ios-phase-6.md docs/superpowers/specs/2026-08-31-wenheng-data-lifecycle-design.md docs/superpowers/plans/2026-08-31-wenheng-ios-phase-6-data-lifecycle.md
git commit -m "test(mobile): 验证问衡数据生命周期闭环"
```

---

## 完成门槛

- 双路径注销、令牌状态查询、宽限取消在 Web 与 iOS 手机界面可用，所有状态文案与服务端一致。
- MySQL 账本、扫描父记录、租约 Worker、显式处理器、合法冻结、加密消息箱、匿名主体、回执和墓碑接口全部有测试。
- 未分类数据集、身份到匿名反向关联、强制完成、跨区域访问和不可冻结类别都被失败关闭。
- 后端与 Web 全量测试、类型检查、构建、两个手机视口、Capacitor 同步和 iOS 双架构模拟器构建通过。
- 最终验证记录清楚区分本地实现、隔离/预发布验证、生产执行、App Store 提交、审核通过和公开发布。
- 仍不执行真实迁移、真实删除、真实通知、生产部署、TestFlight 或 App Store 操作。
