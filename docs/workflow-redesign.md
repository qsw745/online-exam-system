# 企业级工作流重构方案（钉钉式审批流 + Flowable）

> 目标：把现有「开始→审批→结束」的简易流程，重做成企业级审批流系统。
> 决策（2026-06-30）：**设计器=钉钉/飞书式竖向审批链**；**引擎=统一到 Java Flowable 7.2**（弃用 Node 自研）；
> **功能=条件分支(网关) + 会签/或签 + 抄送/加签/转办/撤回 + 表单设计器(节点字段权限)**。

## 1. 架构

```
前端(React)
  ├─ 审批流设计器（竖向链：发起人→审批→抄送→条件分支→结束）
  ├─ 表单设计器（拖拽字段 + 节点级读写权限）
  └─ 任务中心（待办/已办/我发起 + 审批动作 + 进度时间线）
        │  /api/workflows/*  （dev: vite 代理该前缀到 Java 端口；prod: Caddy 路由）
        ▼
Java 后端（Spring Boot + Flowable 7.2）
  ├─ FlowDefinition（审批流 JSON 模型 + 编译出的 BPMN + 版本）
  ├─ FlowableBpmnBuilder v2（JSON 模型 → BPMN：userTask 多实例 / exclusiveGateway / serviceTask 抄送 / ...）
  ├─ 运行时 API（发起/待办/同意/拒绝/加签/转办/撤回/抄送）
  └─ Flowable 引擎（ACT_* 表：流程定义、运行实例、任务、历史）
```

弃用 Node 的 `workflow_templates/instances/tasks` 那套；旧数据按需迁移或归档。

## 2. 审批流 JSON 模型（核心抽象，存 FlowDefinition）

钉钉式是一条**竖向节点链**，条件节点产生并列分支：

```jsonc
{
  "nodes": [
    { "id":"start", "type":"start", "initiators": { "roles":[], "users":[] } },
    { "id":"n1", "type":"approval", "name":"主管审批",
      "assignee": { "type":"role|user|dept_leader|initiator_self|form_field", "ids":[] },
      "mode": "and|or|sequential",     // 会签/或签/依次
      "rejectPolicy": "to_initiator|to_prev|end" },
    { "id":"n2", "type":"cc", "users": { "roles":[], "users":[] } },
    { "id":"c1", "type":"condition",
      "branches": [
        { "id":"b1", "name":"金额>1000", "conditions":[{ "field":"amount","op":">","value":1000 }], "children":[ /*…nodes…*/ ] },
        { "id":"b2", "name":"其它", "default":true, "children":[ /*…nodes…*/ ] }
      ] },
    { "id":"end", "type":"end" }
  ]
}
```

## 3. BPMN 编译规则（FlowableBpmnBuilder v2）

| 模型节点 | BPMN |
|---|---|
| start | `startEvent`（+ initiator 变量） |
| approval | `userTask` + `candidateUsers/Groups`；会签=`multiInstance(isSequential=false, 全部完成)`；或签=`completionCondition` 任一通过；依次=`isSequential=true` |
| cc | `serviceTask`（flowable delegate：记录抄送 + 发通知）或 executionListener |
| condition | `exclusiveGateway` + 各分支 `sequenceFlow` 上的条件表达式（基于表单变量的 JUEL） |
| parallel(可选) | `parallelGateway` |
| end | `endEvent` |

**运行时动作**（非 BPMN，用 Flowable API）：
- 加签：`TaskService.addCandidateUser` / 创建并行子任务
- 转办：`TaskService.setAssignee`
- 撤回：`runtimeService.createChangeActivityStateBuilder()` 把执行移回上一节点
- 抄送：写抄送记录表 + 通知

## 4. 前端三大件

1. **审批流设计器**（钉钉式）：竖向链，节点间 `+` 插入；条件节点渲染为并列分支列；节点点开右侧抽屉配置（审批人选择器、会签/或签、条件规则）。
2. **表单设计器**：拖拽字段（单行/多行/数字/日期/下拉/人员/附件…）；每个审批节点可配字段的「只读/可编辑/隐藏」。
3. **任务中心**：待办/已办/我发起；审批动作（同意/拒绝/加签/转办/撤回/评论）；实例审批进度时间线。

## 5. 分阶段实施

| 阶段 | 内容 | 产出 |
|---|---|---|
| **P1** 引擎接通 | 前端 workflows 路由切到 Java；定义 FlowDefinition 存储；跑通最简 开始→审批→结束 | 链路打通 |
| **P2** 基础设计器 | 钉钉式竖向设计器（发起/审批/抄送/结束）+ 节点配置 + userTask 多实例(会签/或签)+ cc | 能建/发起基础审批流 |
| **P3** 条件分支 | condition 节点 + 分支列 UI + exclusiveGateway + 表单字段条件 | 分支审批 |
| **P4** 表单设计器 | 拖拽表单 + 节点字段权限 + 数据联动 | 表单驱动审批 |
| **P5** 审批动作 | 加签/转办/撤回/评论/抄送知会 + 任务中心 + 进度时间线 | 完整审批体验 |
| **P6** 收尾 | 权限/通知/历史/i18n/旧数据迁移 | 可上线 |

每个阶段都不小；建议逐阶段交付验证。

## 6. 待确认/风险

- **dev 路由**：`/api/workflows/*` 需从 Node(8848) 切到 Java；dev 用 vite 代理加一条规则，prod 用 Caddy。需确认 Java 后端端口与启动方式。
- Flowable「撤回」语义较复杂，P5 单独处理。
- 表单设计器是独立子系统，P4 工作量大。
