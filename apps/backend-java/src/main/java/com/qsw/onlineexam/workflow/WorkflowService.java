package com.qsw.onlineexam.workflow;

import com.qsw.onlineexam.auth.AuthUser;
import com.qsw.onlineexam.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.repository.Deployment;
import org.flowable.engine.repository.ProcessDefinition;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.task.api.Task;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkflowService {
  private final WorkflowRepository repo;
  private final RepositoryService repositoryService;
  private final RuntimeService runtimeService;
  private final TaskService taskService;

  public WorkflowService(
      WorkflowRepository repo,
      RepositoryService repositoryService,
      RuntimeService runtimeService,
      TaskService taskService
  ) {
    this.repo = repo;
    this.repositoryService = repositoryService;
    this.runtimeService = runtimeService;
    this.taskService = taskService;
  }

  public Map<String, Object> engineStatus() {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("engine", "flowable");
    out.put("deployments", repositoryService.createDeploymentQuery().count());
    out.put("processDefinitions", repositoryService.createProcessDefinitionQuery().count());
    out.put("runtimeInstances", runtimeService.createProcessInstanceQuery().count());
    return out;
  }

  public List<Map<String, Object>> listTemplates(AuthUser user, Map<String, String> params) {
    requireUser(user);
    return repo.listTemplates(params);
  }

  public Map<String, Object> getTemplate(AuthUser user, long id) {
    requireUser(user);
    return repo.getTemplate(id).orElseThrow(() -> ApiException.notFound("模板不存在"));
  }

  @Transactional
  public Map<String, Object> createTemplate(AuthUser user, Map<String, Object> payload) {
    requireRole(user, "admin", "teacher");
    String name = requiredString(payload, "name", "缺少模板名称");
    String entityType = requiredString(payload, "entity_type", "缺少流程对象类型");
    Object definition = payload.get("definition");
    if (!(definition instanceof Map<?, ?>)) throw ApiException.badRequest("缺少流程定义");
    int version = Jsons.intValue(payload.get("version"), repo.nextVersion(name));
    Map<String, Object> input = new LinkedHashMap<>();
    input.put("name", name);
    input.put("entity_type", entityType);
    input.put("app_code", blankToNull(payload.get("app_code")));
    input.put("module_code", blankToNull(payload.get("module_code")));
    input.put("form_key", blankToNull(payload.get("form_key")));
    input.put("form_name", blankToNull(payload.get("form_name")));
    input.put("version", version);
    input.put("status", String.valueOf(payload.getOrDefault("status", "draft")));
    input.put("definition", definition);
    input.put("starter_roles", Jsons.longList(payload.get("starter_roles")));
    input.put("created_by", user.id());
    input.put("engine_process_key", FlowableBpmnBuilder.processKey(0, version));
    long id = repo.createTemplate(input);
    repo.updateTemplate(id, Map.of("engine_process_key", FlowableBpmnBuilder.processKey(id, version)));
    return Map.of("id", id);
  }

  @Transactional
  public Map<String, Object> updateTemplate(AuthUser user, long id, Map<String, Object> payload) {
    requireRole(user, "admin", "teacher");
    Map<String, Object> existed = repo.getTemplate(id).orElseThrow(() -> ApiException.notFound("模板不存在"));
    if (payload.containsKey("definition")) {
      String name = stringOr(payload.get("name"), String.valueOf(existed.get("name")));
      String entityType = stringOr(payload.get("entity_type"), String.valueOf(existed.get("entity_type")));
      int version = repo.nextVersion(name);
      Map<String, Object> input = new LinkedHashMap<>();
      input.put("name", name);
      input.put("entity_type", entityType);
      input.put("app_code", payload.getOrDefault("app_code", existed.get("app_code")));
      input.put("module_code", payload.getOrDefault("module_code", existed.get("module_code")));
      input.put("form_key", payload.getOrDefault("form_key", existed.get("form_key")));
      input.put("form_name", payload.getOrDefault("form_name", existed.get("form_name")));
      input.put("version", version);
      input.put("status", payload.getOrDefault("status", existed.getOrDefault("status", "draft")));
      input.put("definition", payload.get("definition"));
      input.put("starter_roles", payload.containsKey("starter_roles") ? Jsons.longList(payload.get("starter_roles")) : existed.get("starter_roles"));
      input.put("created_by", user.id());
      input.put("engine_process_key", FlowableBpmnBuilder.processKey(0, version));
      long nextId = repo.createTemplate(input);
      repo.updateTemplate(nextId, Map.of("engine_process_key", FlowableBpmnBuilder.processKey(nextId, version)));
      return Map.of("id", nextId, "version", version, "created", true, "updated", 1);
    }
    Map<String, Object> patch = new LinkedHashMap<>();
    copy(payload, patch, "name");
    copy(payload, patch, "entity_type");
    copy(payload, patch, "app_code");
    copy(payload, patch, "module_code");
    copy(payload, patch, "form_key");
    copy(payload, patch, "form_name");
    copy(payload, patch, "status");
    if (payload.containsKey("starter_roles")) patch.put("starter_roles", Jsons.longList(payload.get("starter_roles")));
    int updated = repo.updateTemplate(id, patch);
    return Map.of("updated", updated, "id", id);
  }

  public Map<String, Object> publishTemplate(AuthUser user, long id) {
    return updateTemplate(user, id, Map.of("status", "published"));
  }

  @Transactional
  public Map<String, Object> startInstance(AuthUser user, Map<String, Object> payload) {
    requireUser(user);
    String entityType = requiredString(payload, "entity_type", "缺少流程对象");
    long entityId = Jsons.longValue(first(payload, "entity_id", "entityId"), 0);
    if (entityId <= 0) throw ApiException.badRequest("缺少流程对象");
    long templateId = Jsons.longValue(first(payload, "template_id", "templateId"), 0);
    Map<String, Object> template = templateId > 0
        ? repo.getTemplate(templateId).orElseThrow(() -> ApiException.notFound("未找到流程模板"))
        : repo.latestPublished(entityType).orElseThrow(() -> ApiException.notFound("未找到流程模板"));
    if (!"published".equals(String.valueOf(template.get("status")))) throw ApiException.badRequest("流程模板未发布");

    Map<String, Object> definition = Jsons.map(template.get("definition"));
    Map<String, Object> startNode = nodes(definition).stream()
        .filter(n -> "start".equals(String.valueOf(n.get("type"))))
        .findFirst()
        .orElseThrow(() -> ApiException.badRequest("流程缺少开始节点"));
    Map<String, Object> processPayload = Jsons.map(payload.getOrDefault("payload", payload));
    Map<String, Object> ctx = Map.of("payload", processPayload);
    List<String> next = nextNodes(definition, String.valueOf(startNode.get("id")), ctx);
    if (next.isEmpty()) throw ApiException.badRequest("流程缺少后续节点");
    Split split = splitNextNodes(definition, next);

    FlowableStart flowable = deployAndStart(template, processPayload);
    Map<String, Object> instanceInput = new LinkedHashMap<>();
    instanceInput.put("template_id", template.get("id"));
    instanceInput.put("entity_type", entityType);
    instanceInput.put("entity_id", entityId);
    instanceInput.put("current_nodes", split.activeNodes());
    instanceInput.put("payload", processPayload);
    instanceInput.put("created_by", user.id());
    instanceInput.put("engine_type", "flowable");
    instanceInput.put("engine_instance_id", flowable.processInstanceId());
    instanceInput.put("process_definition_id", flowable.processDefinitionId());
    long instanceId = repo.createInstance(instanceInput);

    if (split.activeNodes().isEmpty() && split.hasEnd()) {
      repo.updateInstance(instanceId, "approved", List.of());
      syncEntityStatus(entityType, entityId, "approved");
      completeAllFlowableTasks(flowable.processInstanceId(), null);
      return Map.of("id", instanceId, "template_id", template.get("id"), "status", "approved", "engine", "flowable");
    }

    createTasksForNodes(instanceId, definition, split.activeNodes(), ctx);
    return Map.of("id", instanceId, "template_id", template.get("id"), "status", "running", "engine", "flowable");
  }

  public Map<String, Object> listMyTasks(AuthUser user, Map<String, String> query) {
    requireUser(user);
    int page = Math.max(1, Jsons.intValue(query.get("page"), 1));
    int limit = Math.max(1, Math.min(100, Jsons.intValue(query.get("limit"), 20)));
    String status = query.get("status");
    String entityType = query.get("entity_type");
    List<Map<String, Object>> items = repo.listTasksForUser(user.id(), status, page, limit, entityType);
    long total = repo.countTasksForUser(user.id(), status, entityType);
    return Map.of("items", items, "total", total, "page", page, "limit", limit);
  }

  @Transactional
  public Map<String, Object> decideTask(AuthUser user, long taskId, String action, String comment, Object formValues) {
    requireUser(user);
    Map<String, Object> task = repo.getTask(taskId).orElseThrow(() -> ApiException.notFound("任务不存在"));
    if (Jsons.longValue(task.get("assignee_id"), 0) != user.id()) throw ApiException.forbidden("无权限审核");
    int updated = repo.updateTaskStatus(taskId, action, comment);
    if (updated == 0) throw ApiException.badRequest("任务已处理");

    long instanceId = Jsons.longValue(task.get("instance_id"), 0);
    Map<String, Object> instance = repo.getInstance(instanceId).orElseThrow(() -> ApiException.notFound("流程实例不存在"));
    if (formValues instanceof Map<?, ?> form) {
      Map<String, Object> payload = new LinkedHashMap<>(Jsons.map(instance.get("payload")));
      Map<String, Object> merged = new LinkedHashMap<>(Jsons.map(payload.get("form_values")));
      for (Map.Entry<?, ?> entry : form.entrySet()) merged.put(String.valueOf(entry.getKey()), entry.getValue());
      payload.put("form_values", merged);
      repo.updateInstancePayload(instanceId, payload);
      instance.put("payload", payload);
    }

    Map<String, Object> template = repo.getTemplate(Jsons.longValue(instance.get("template_id"), 0))
        .orElseThrow(() -> ApiException.notFound("流程模板不存在"));
    Map<String, Object> definition = Jsons.map(template.get("definition"));
    String nodeId = String.valueOf(task.get("node_id"));
    Map<String, Object> node = findNode(definition, nodeId).orElse(null);
    if (node == null) return Map.of("status", instance.get("status"));

    Map<String, Object> ctx = Map.of("payload", Jsons.map(instance.get("payload")));
    List<Map<String, Object>> nodeTasks = repo.listTasksByNode(instanceId, nodeId);
    String nodeResult = evaluateNode(node, nodeTasks, ctx);
    if ("pending".equals(nodeResult)) return Map.of("status", instance.get("status"));

    repo.cancelPendingTasks(instanceId, nodeId);

    if ("rejected".equals(nodeResult)) {
      repo.updateInstance(instanceId, "rejected", List.of());
      syncEntityStatus(String.valueOf(instance.get("entity_type")), Jsons.longValue(instance.get("entity_id"), 0), "rejected");
      completeAllFlowableTasks(Jsons.string(instance.get("engine_instance_id")), nodeId);
      return Map.of("status", "rejected");
    }

    completeAllFlowableTasks(Jsons.string(instance.get("engine_instance_id")), nodeId);
    List<String> outgoing = nextNodes(definition, nodeId, ctx);
    if (outgoing.isEmpty()) {
      repo.updateInstance(instanceId, "approved", List.of());
      syncEntityStatus(String.valueOf(instance.get("entity_type")), Jsons.longValue(instance.get("entity_id"), 0), "approved");
      return Map.of("status", "approved");
    }
    Split split = splitNextNodes(definition, outgoing);
    Set<String> nextSet = new LinkedHashSet<>(Jsons.stringList(instance.get("current_nodes")));
    nextSet.remove(nodeId);
    nextSet.addAll(split.activeNodes());
    List<String> currentNodes = new ArrayList<>(nextSet);
    if (currentNodes.isEmpty() && split.hasEnd()) {
      repo.updateInstance(instanceId, "approved", List.of());
      syncEntityStatus(String.valueOf(instance.get("entity_type")), Jsons.longValue(instance.get("entity_id"), 0), "approved");
      return Map.of("status", "approved");
    }
    repo.updateInstance(instanceId, "running", currentNodes);
    createTasksForNodes(instanceId, definition, split.activeNodes(), ctx);
    return Map.of("status", "running");
  }

  public Map<String, Object> getInstanceDetail(AuthUser user, long id) {
    requireUser(user);
    Map<String, Object> instance = repo.getInstance(id).orElseThrow(() -> ApiException.notFound("流程实例不存在"));
    Map<String, Object> template = repo.getTemplate(Jsons.longValue(instance.get("template_id"), 0))
        .orElseThrow(() -> ApiException.notFound("流程模板不存在"));
    List<Map<String, Object>> tasks = repo.listTasksByInstance(id);
    return Map.of("instance", instance, "template", template, "tasks", tasks);
  }

  @Transactional
  public Map<String, Object> submitExamReview(AuthUser user, long examId, Map<String, Object> payload) {
    requireUser(user);
    Map<String, Object> exam = repo.findExam(examId).orElseThrow(() -> ApiException.notFound("考试不存在"));
    long createdBy = Jsons.longValue(exam.get("created_by"), 0);
    if (createdBy > 0 && createdBy != user.id() && !user.isAdmin()) throw ApiException.notFound("考试不存在或无权限修改");
    long templateId = Jsons.longValue(first(payload, "template_id", "templateId"), Jsons.longValue(exam.get("workflow_template_id"), 0));
    Object formValues = first(payload, "form_values", "formValues");
    List<Long> reviewers = Jsons.longList(payload.get("reviewer_ids"));
    Object required = first(payload, "required_approvals", "requiredApprovals");
    repo.updateExamWorkflowFields(examId, templateId > 0 ? templateId : null, formValues);
    Map<String, Object> instance = startInstance(user, Map.of(
        "entity_type", "exam",
        "entity_id", examId,
        "template_id", templateId,
        "payload", Map.of(
            "reviewer_ids", reviewers,
            "required_approvals", required == null ? reviewers.size() : required,
            "form_values", formValues == null ? Map.of() : formValues
        )
    ));
    repo.updateExamStatus(examId, "reviewing");
    return instance;
  }

  @Transactional
  public Map<String, Object> submitPaperReview(AuthUser user, long paperId, Map<String, Object> payload) {
    requireUser(user);
    Map<String, Object> paper = repo.findPaper(paperId).orElseThrow(() -> ApiException.notFound("试卷不存在"));
    long templateId = Jsons.longValue(first(payload, "template_id", "templateId"), Jsons.longValue(paper.get("workflow_template_id"), 0));
    Object formValues = first(payload, "form_values", "formValues");
    List<Long> reviewers = Jsons.longList(payload.get("reviewer_ids"));
    Object required = first(payload, "required_approvals", "requiredApprovals");
    repo.updatePaperWorkflowFields(paperId, templateId > 0 ? templateId : null, formValues);
    return startInstance(user, Map.of(
        "entity_type", "paper",
        "entity_id", paperId,
        "template_id", templateId,
        "payload", Map.of(
            "reviewer_ids", reviewers,
            "required_approvals", required == null ? reviewers.size() : required,
            "form_values", formValues == null ? Map.of() : formValues
        )
    ));
  }

  private FlowableStart deployAndStart(Map<String, Object> template, Map<String, Object> payload) {
    long templateId = Jsons.longValue(template.get("id"), 0);
    int version = Jsons.intValue(template.get("version"), 1);
    String key = Optional.ofNullable(Jsons.string(template.get("engine_process_key")))
        .filter(s -> !s.isBlank())
        .orElseGet(() -> FlowableBpmnBuilder.processKey(templateId, version));
    String bpmn = FlowableBpmnBuilder.build(key, String.valueOf(template.get("name")), Jsons.map(template.get("definition")));
    Deployment deployment = repositoryService
        .createDeployment()
        .name("online-exam-template-" + templateId + "-v" + version)
        .addBytes(key + ".bpmn20.xml", bpmn.getBytes(StandardCharsets.UTF_8))
        .deploy();
    ProcessDefinition processDefinition = repositoryService
        .createProcessDefinitionQuery()
        .deploymentId(deployment.getId())
        .processDefinitionKey(key)
        .singleResult();
    Map<String, Object> variables = new LinkedHashMap<>();
    variables.put("payload", payload);
    variables.putAll(candidateVariables(Jsons.map(template.get("definition")), payload));
    ProcessInstance instance = runtimeService.startProcessInstanceByKey(key, variables);
    return new FlowableStart(instance.getId(), processDefinition == null ? null : processDefinition.getId());
  }

  private Map<String, Object> candidateVariables(Map<String, Object> definition, Map<String, Object> payload) {
    Map<String, Object> ctx = Map.of("payload", payload);
    Map<String, Object> vars = new LinkedHashMap<>();
    for (Map<String, Object> node : nodes(definition)) {
      if (!"approval".equals(String.valueOf(node.get("type")))) continue;
      List<Long> approvers = resolveApprovers(node, ctx);
      String csv = String.join(",", approvers.stream().map(String::valueOf).toList());
      vars.put(FlowableBpmnBuilder.candidateVariable(String.valueOf(node.get("id"))), csv);
    }
    return vars;
  }

  private void createTasksForNodes(long instanceId, Map<String, Object> definition, List<String> nodeIds, Map<String, Object> ctx) {
    List<Map<String, Object>> tasks = new ArrayList<>();
    for (String nodeId : nodeIds) {
      Map<String, Object> node = findNode(definition, nodeId).orElse(null);
      if (node == null || !"approval".equals(String.valueOf(node.get("type")))) continue;
      List<Long> approvers = resolveApprovers(node, ctx);
      if (approvers.isEmpty()) throw ApiException.badRequest("节点 " + node.getOrDefault("name", nodeId) + " 未配置审核人");
      for (Long approver : approvers) {
        Map<String, Object> task = new LinkedHashMap<>();
        task.put("instance_id", instanceId);
        task.put("node_id", nodeId);
        task.put("node_name", node.getOrDefault("name", nodeId));
        task.put("assignee_id", approver);
        task.put("meta", Map.of("rule", node.getOrDefault("approval_rule", "all"), "engine", "flowable"));
        tasks.add(task);
      }
    }
    repo.createTasks(tasks);
  }

  private List<Long> resolveApprovers(Map<String, Object> node, Map<String, Object> ctx) {
    Set<Long> ids = new LinkedHashSet<>();
    ids.addAll(Jsons.longList(node.get("approvers")));
    ids.addAll(Jsons.longList(node.get("approver_users")));
    String from = Jsons.string(node.get("approvers_from"));
    if (from != null && !from.isBlank()) ids.addAll(Jsons.longList(getPath(ctx, from)));
    List<Long> roleIds = Jsons.longList(node.get("approver_roles"));
    if (!roleIds.isEmpty()) ids.addAll(repo.listUserIdsByRoles(roleIds));
    List<Long> deptIds = Jsons.longList(node.get("approver_departments"));
    if (!deptIds.isEmpty()) ids.addAll(repo.listUserIdsByDepartments(deptIds));
    return ids.stream().filter(v -> v != null && v > 0).toList();
  }

  private String evaluateNode(Map<String, Object> node, List<Map<String, Object>> tasks, Map<String, Object> ctx) {
    int total = tasks.size();
    long approved = tasks.stream().filter(t -> "approved".equals(String.valueOf(t.get("status")))).count();
    long rejected = tasks.stream().filter(t -> "rejected".equals(String.valueOf(t.get("status")))).count();
    String rule = String.valueOf(node.getOrDefault("approval_rule", "all"));
    String rejectRule = String.valueOf(node.getOrDefault("reject_rule", "any"));
    int required = requiredApprovals(node, ctx, total);
    boolean shouldReject = switch (rejectRule) {
      case "majority" -> rejected > total / 2.0;
      case "count" -> rejected >= required;
      default -> rejected >= 1;
    };
    if (shouldReject) return "rejected";
    boolean shouldApprove = switch (rule) {
      case "any" -> approved >= 1;
      case "majority" -> approved > total / 2.0;
      case "count" -> approved >= required;
      default -> approved >= total;
    };
    return shouldApprove ? "approved" : "pending";
  }

  private int requiredApprovals(Map<String, Object> node, Map<String, Object> ctx, int total) {
    Object raw = node.get("required_approvals");
    Object value = raw instanceof String s && s.startsWith("payload.") ? getPath(ctx, s) : raw;
    int n = Jsons.intValue(value, total);
    if (n <= 0) return total;
    return Math.min(n, total);
  }

  private void completeAllFlowableTasks(String processInstanceId, String nodeId) {
    if (processInstanceId == null || processInstanceId.isBlank()) return;
    List<Task> tasks = taskService.createTaskQuery().processInstanceId(processInstanceId).list();
    for (Task task : tasks) {
      if (nodeId == null || Objects.equals(task.getTaskDefinitionKey(), nodeId)) {
        taskService.complete(task.getId());
      }
    }
  }

  private void syncEntityStatus(String entityType, long entityId, String status) {
    if ("exam".equals(entityType)) {
      if ("approved".equals(status)) repo.updateExamStatus(entityId, "approved");
      if ("rejected".equals(status)) repo.updateExamStatus(entityId, "rejected");
    }
  }

  private List<Map<String, Object>> nodes(Map<String, Object> definition) {
    return Jsons.listOfMaps(definition.get("nodes"));
  }

  private List<Map<String, Object>> edges(Map<String, Object> definition) {
    return Jsons.listOfMaps(definition.get("edges"));
  }

  private Optional<Map<String, Object>> findNode(Map<String, Object> definition, String id) {
    return nodes(definition).stream().filter(n -> Objects.equals(String.valueOf(n.get("id")), id)).findFirst();
  }

  private List<String> nextNodes(Map<String, Object> definition, String from, Map<String, Object> ctx) {
    return edges(definition)
        .stream()
        .filter(e -> Objects.equals(String.valueOf(e.get("from")), from))
        .filter(e -> matchCondition(Jsons.map(e.get("condition")), ctx))
        .map(e -> String.valueOf(e.get("to")))
        .filter(s -> s != null && !s.isBlank())
        .toList();
  }

  private boolean matchCondition(Map<String, Object> condition, Map<String, Object> ctx) {
    if (condition == null || condition.isEmpty()) return true;
    Object left = getPath(ctx, Jsons.string(condition.get("field")));
    Object right = resolveValue(condition.get("value"), ctx);
    String op = String.valueOf(condition.get("op"));
    return switch (op) {
      case "==" -> Objects.equals(String.valueOf(left), String.valueOf(right));
      case "!=" -> !Objects.equals(String.valueOf(left), String.valueOf(right));
      case ">" -> Jsons.longValue(left, 0) > Jsons.longValue(right, 0);
      case ">=" -> Jsons.longValue(left, 0) >= Jsons.longValue(right, 0);
      case "<" -> Jsons.longValue(left, 0) < Jsons.longValue(right, 0);
      case "<=" -> Jsons.longValue(left, 0) <= Jsons.longValue(right, 0);
      case "in" -> right instanceof Iterable<?> it && contains(it, left);
      case "not_in" -> right instanceof Iterable<?> it && !contains(it, left);
      default -> false;
    };
  }

  private Object resolveValue(Object value, Map<String, Object> ctx) {
    if (value instanceof String s && s.startsWith("payload.")) return getPath(ctx, s);
    return value;
  }

  @SuppressWarnings("unchecked")
  private Object getPath(Object root, String path) {
    if (path == null || path.isBlank()) return null;
    Object cur = root;
    for (String part : path.split("\\.")) {
      if (part.isBlank()) continue;
      if (!(cur instanceof Map<?, ?> map)) return null;
      cur = ((Map<String, Object>) map).get(part);
      if (cur == null) return null;
    }
    return cur;
  }

  private boolean contains(Iterable<?> items, Object value) {
    for (Object item : items) {
      if (Objects.equals(String.valueOf(item), String.valueOf(value))) return true;
    }
    return false;
  }

  private Split splitNextNodes(Map<String, Object> definition, List<String> ids) {
    List<String> active = new ArrayList<>();
    boolean hasEnd = false;
    for (String id : ids) {
      Map<String, Object> node = findNode(definition, id).orElse(null);
      if (node == null) continue;
      if ("end".equals(String.valueOf(node.get("type")))) hasEnd = true;
      else active.add(id);
    }
    return new Split(active, hasEnd);
  }

  private void requireUser(AuthUser user) {
    if (user == null) throw ApiException.unauthorized("未授权");
  }

  private void requireRole(AuthUser user, String... roles) {
    requireUser(user);
    if (user.isAdmin() || user.hasAnyRole(roles)) return;
    throw ApiException.forbidden("无权限");
  }

  private static Object first(Map<String, Object> map, String... keys) {
    for (String key : keys) {
      if (map.containsKey(key)) return map.get(key);
    }
    return null;
  }

  private static String requiredString(Map<String, Object> map, String key, String message) {
    Object value = map.get(key);
    String text = value == null ? "" : String.valueOf(value).trim();
    if (text.isBlank()) throw ApiException.badRequest(message);
    return text;
  }

  private static String stringOr(Object value, String fallback) {
    String text = value == null ? "" : String.valueOf(value).trim();
    return text.isBlank() ? fallback : text;
  }

  private static Object blankToNull(Object value) {
    if (value == null) return null;
    String text = String.valueOf(value).trim();
    return text.isBlank() ? null : text;
  }

  private static void copy(Map<String, Object> from, Map<String, Object> to, String key) {
    if (from.containsKey(key)) to.put(key, from.get(key));
  }

  private record Split(List<String> activeNodes, boolean hasEnd) {}

  private record FlowableStart(String processInstanceId, String processDefinitionId) {}
}
