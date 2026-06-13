package com.qsw.onlineexam.workflow;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class WorkflowRepository {
  private final JdbcTemplate jdbc;

  public WorkflowRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public void ensureEngineColumns() {
    addColumnIfMissing("workflow_instances", "engine_type", "VARCHAR(32) NULL");
    addColumnIfMissing("workflow_instances", "engine_instance_id", "VARCHAR(128) NULL");
    addColumnIfMissing("workflow_instances", "process_definition_id", "VARCHAR(128) NULL");
    addColumnIfMissing("workflow_templates", "engine_process_key", "VARCHAR(128) NULL");
  }

  private void addColumnIfMissing(String table, String column, String definition) {
    if (!tableExists(table)) return;
    Integer count = jdbc.queryForObject(
        "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
        Integer.class,
        table,
        column
    );
    if (count == null || count == 0) {
      jdbc.execute("ALTER TABLE `" + table + "` ADD COLUMN `" + column + "` " + definition);
    }
  }

  private boolean tableExists(String table) {
    Integer count = jdbc.queryForObject(
        "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
        Integer.class,
        table
    );
    return count != null && count > 0;
  }

  public List<Map<String, Object>> listTemplates(Map<String, String> params) {
    List<Object> values = new ArrayList<>();
    List<String> conds = new ArrayList<>();
    addEq(conds, values, "entity_type", params.get("entity_type"));
    addEq(conds, values, "app_code", params.get("app_code"));
    addEq(conds, values, "module_code", params.get("module_code"));
    String status = params.get("status");
    if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status)) {
      addEq(conds, values, "status", status);
    }
    String where = conds.isEmpty() ? "" : " WHERE " + String.join(" AND ", conds);
    return jdbc
        .queryForList("SELECT * FROM workflow_templates" + where + " ORDER BY updated_at DESC", values.toArray())
        .stream()
        .map(this::template)
        .toList();
  }

  public Optional<Map<String, Object>> getTemplate(long id) {
    List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM workflow_templates WHERE id = ?", id);
    return rows.stream().findFirst().map(this::template);
  }

  public Optional<Map<String, Object>> latestPublished(String entityType) {
    List<Map<String, Object>> rows = jdbc.queryForList(
        "SELECT * FROM workflow_templates WHERE entity_type = ? AND status = 'published' ORDER BY updated_at DESC LIMIT 1",
        entityType
    );
    return rows.stream().findFirst().map(this::template);
  }

  public int nextVersion(String name) {
    Integer max = jdbc.queryForObject(
        "SELECT COALESCE(MAX(version), 0) FROM workflow_templates WHERE name = ?",
        Integer.class,
        name
    );
    return (max == null ? 0 : max) + 1;
  }

  public long createTemplate(Map<String, Object> input) {
    KeyHolder key = new GeneratedKeyHolder();
    jdbc.update(connection -> {
      PreparedStatement ps = connection.prepareStatement(
          """
          INSERT INTO workflow_templates
            (name, entity_type, app_code, module_code, form_key, form_name, version, status, definition, starter_roles, created_by, engine_process_key)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          """,
          Statement.RETURN_GENERATED_KEYS
      );
      ps.setObject(1, input.get("name"));
      ps.setObject(2, input.get("entity_type"));
      ps.setObject(3, input.get("app_code"));
      ps.setObject(4, input.get("module_code"));
      ps.setObject(5, input.get("form_key"));
      ps.setObject(6, input.get("form_name"));
      ps.setObject(7, input.get("version"));
      ps.setObject(8, input.getOrDefault("status", "draft"));
      ps.setObject(9, Jsons.write(input.get("definition")));
      ps.setObject(10, Jsons.write(input.get("starter_roles")));
      ps.setObject(11, input.get("created_by"));
      ps.setObject(12, input.get("engine_process_key"));
      return ps;
    }, key);
    Number id = key.getKey();
    return id == null ? 0 : id.longValue();
  }

  public int updateTemplate(long id, Map<String, Object> input) {
    List<String> sets = new ArrayList<>();
    List<Object> values = new ArrayList<>();
    set(sets, values, "name", input);
    set(sets, values, "entity_type", input);
    set(sets, values, "app_code", input);
    set(sets, values, "module_code", input);
    set(sets, values, "form_key", input);
    set(sets, values, "form_name", input);
    set(sets, values, "version", input);
    set(sets, values, "status", input);
    if (input.containsKey("definition")) {
      sets.add("definition = ?");
      values.add(Jsons.write(input.get("definition")));
    }
    if (input.containsKey("starter_roles")) {
      sets.add("starter_roles = ?");
      values.add(Jsons.write(input.get("starter_roles")));
    }
    set(sets, values, "engine_process_key", input);
    if (sets.isEmpty()) return 0;
    values.add(id);
    return jdbc.update("UPDATE workflow_templates SET " + String.join(", ", sets) + ", updated_at = NOW() WHERE id = ?", values.toArray());
  }

  public long createInstance(Map<String, Object> input) {
    KeyHolder key = new GeneratedKeyHolder();
    jdbc.update(connection -> {
      PreparedStatement ps = connection.prepareStatement(
          """
          INSERT INTO workflow_instances
            (template_id, entity_type, entity_id, status, current_nodes, payload, created_by, engine_type, engine_instance_id, process_definition_id)
          VALUES (?, ?, ?, 'running', ?, ?, ?, ?, ?, ?)
          """,
          Statement.RETURN_GENERATED_KEYS
      );
      ps.setObject(1, input.get("template_id"));
      ps.setObject(2, input.get("entity_type"));
      ps.setObject(3, input.get("entity_id"));
      ps.setObject(4, Jsons.write(input.get("current_nodes")));
      ps.setObject(5, Jsons.write(input.get("payload")));
      ps.setObject(6, input.get("created_by"));
      ps.setObject(7, input.getOrDefault("engine_type", "flowable"));
      ps.setObject(8, input.get("engine_instance_id"));
      ps.setObject(9, input.get("process_definition_id"));
      return ps;
    }, key);
    Number id = key.getKey();
    return id == null ? 0 : id.longValue();
  }

  public int updateInstance(long id, String status, List<String> currentNodes) {
    List<String> sets = new ArrayList<>();
    List<Object> values = new ArrayList<>();
    if (status != null) {
      sets.add("status = ?");
      values.add(status);
    }
    if (currentNodes != null) {
      sets.add("current_nodes = ?");
      values.add(Jsons.write(currentNodes));
    }
    if (sets.isEmpty()) return 0;
    values.add(id);
    return jdbc.update("UPDATE workflow_instances SET " + String.join(", ", sets) + ", updated_at = NOW() WHERE id = ?", values.toArray());
  }

  public void updateInstancePayload(long id, Object payload) {
    jdbc.update("UPDATE workflow_instances SET payload = ?, updated_at = NOW() WHERE id = ?", Jsons.write(payload), id);
  }

  public Optional<Map<String, Object>> getInstance(long id) {
    List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM workflow_instances WHERE id = ?", id);
    return rows.stream().findFirst().map(this::instance);
  }

  public void createTasks(List<Map<String, Object>> tasks) {
    for (Map<String, Object> task : tasks) {
      jdbc.update(
          """
          INSERT INTO workflow_tasks (instance_id, node_id, node_name, assignee_id, status, meta)
          VALUES (?, ?, ?, ?, 'pending', ?)
          """,
          task.get("instance_id"),
          task.get("node_id"),
          task.get("node_name"),
          task.get("assignee_id"),
          Jsons.write(task.get("meta"))
      );
    }
  }

  public List<Map<String, Object>> listTasksForUser(long userId, String status, int page, int limit, String entityType) {
    int offset = (page - 1) * limit;
    List<Object> values = new ArrayList<>();
    StringBuilder where = new StringBuilder("t.assignee_id = ?");
    values.add(userId);
    if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status)) {
      where.append(" AND t.status = ?");
      values.add(status);
    }
    if (entityType != null && !entityType.isBlank()) {
      where.append(" AND i.entity_type = ?");
      values.add(entityType);
    }
    values.add(offset);
    values.add(limit);
    return jdbc
        .queryForList(
            """
            SELECT t.*, i.entity_type, i.entity_id, i.status AS instance_status, i.payload
            FROM workflow_tasks t
            JOIN workflow_instances i ON i.id = t.instance_id
            WHERE %s
            ORDER BY t.created_at DESC
            LIMIT ?, ?
            """.formatted(where),
            values.toArray()
        )
        .stream()
        .map(this::task)
        .toList();
  }

  public long countTasksForUser(long userId, String status, String entityType) {
    List<Object> values = new ArrayList<>();
    StringBuilder where = new StringBuilder("t.assignee_id = ?");
    values.add(userId);
    if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status)) {
      where.append(" AND t.status = ?");
      values.add(status);
    }
    if (entityType != null && !entityType.isBlank()) {
      where.append(" AND i.entity_type = ?");
      values.add(entityType);
    }
    Long total = jdbc.queryForObject(
        "SELECT COUNT(*) FROM workflow_tasks t JOIN workflow_instances i ON i.id = t.instance_id WHERE " + where,
        Long.class,
        values.toArray()
    );
    return total == null ? 0 : total;
  }

  public Optional<Map<String, Object>> getTask(long id) {
    List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM workflow_tasks WHERE id = ?", id);
    return rows.stream().findFirst().map(this::task);
  }

  public List<Map<String, Object>> listTasksByNode(long instanceId, String nodeId) {
    return jdbc
        .queryForList(
            "SELECT * FROM workflow_tasks WHERE instance_id = ? AND node_id = ? ORDER BY created_at ASC",
            instanceId,
            nodeId
        )
        .stream()
        .map(this::task)
        .toList();
  }

  public List<Map<String, Object>> listTasksByInstance(long instanceId) {
    return jdbc
        .queryForList(
            """
            SELECT t.*, u.username, u.nickname
            FROM workflow_tasks t
            LEFT JOIN users u ON u.id = t.assignee_id
            WHERE t.instance_id = ?
            ORDER BY t.created_at ASC
            """,
            instanceId
        )
        .stream()
        .map(row -> {
          Map<String, Object> task = task(row);
          Object nickname = row.get("nickname");
          Object username = row.get("username");
          task.put("assignee_name", nickname != null ? nickname : username != null ? username : String.valueOf(task.get("assignee_id")));
          return task;
        })
        .toList();
  }

  public int updateTaskStatus(long id, String status, String comment) {
    return jdbc.update(
        """
        UPDATE workflow_tasks
        SET status = ?, comment = ?, decided_at = NOW(), updated_at = NOW()
        WHERE id = ? AND status = 'pending'
        """,
        status,
        comment,
        id
    );
  }

  public void cancelPendingTasks(long instanceId, String nodeId) {
    jdbc.update(
        "UPDATE workflow_tasks SET status = 'canceled', updated_at = NOW() WHERE instance_id = ? AND node_id = ? AND status = 'pending'",
        instanceId,
        nodeId
    );
  }

  public List<Long> listUserIdsByRoles(List<Long> roleIds) {
    if (roleIds == null || roleIds.isEmpty()) return List.of();
    String placeholders = placeholders(roleIds.size());
    List<Object> params = new ArrayList<>();
    params.addAll(roleIds);
    params.addAll(roleIds);
    List<Long> out = new ArrayList<>(jdbc.queryForList(
        """
        SELECT DISTINCT user_id FROM user_roles WHERE role_id IN (%s)
        UNION
        SELECT DISTINCT user_id FROM user_org_roles WHERE role_id IN (%s)
        """.formatted(placeholders, placeholders),
        Long.class,
        params.toArray()
    ));
    return out.stream().distinct().toList();
  }

  public List<Long> listUserIdsByDepartments(List<Long> departmentIds) {
    if (departmentIds == null || departmentIds.isEmpty()) return List.of();
    String placeholders = placeholders(departmentIds.size());
    return jdbc.queryForList(
        "SELECT DISTINCT user_id FROM user_organizations WHERE org_id IN (" + placeholders + ")",
        Long.class,
        departmentIds.toArray()
    );
  }

  public Optional<Map<String, Object>> findExam(long id) {
    List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM exams WHERE id = ? LIMIT 1", id);
    return rows.stream().findFirst();
  }

  public Optional<Map<String, Object>> findPaper(long id) {
    List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM papers WHERE id = ? LIMIT 1", id);
    return rows.stream().findFirst();
  }

  public void updateExamStatus(long id, String status) {
    jdbc.update("UPDATE exams SET status = ?, updated_at = NOW() WHERE id = ?", status, id);
  }

  public void updatePaperWorkflowFields(long id, Long templateId, Object formData) {
    jdbc.update(
        "UPDATE papers SET workflow_requires_review = 1, workflow_template_id = ?, workflow_form_data = ?, updated_at = NOW() WHERE id = ?",
        templateId,
        Jsons.write(formData),
        id
    );
  }

  public void updateExamWorkflowFields(long id, Long templateId, Object formData) {
    jdbc.update(
        "UPDATE exams SET workflow_requires_review = 1, workflow_template_id = ?, workflow_form_data = ?, updated_at = NOW() WHERE id = ?",
        templateId,
        Jsons.write(formData),
        id
    );
  }

  private static void addEq(List<String> conds, List<Object> values, String column, String value) {
    if (value == null || value.isBlank()) return;
    conds.add(column + " = ?");
    values.add(value);
  }

  private static void set(List<String> sets, List<Object> values, String column, Map<String, Object> input) {
    if (!input.containsKey(column)) return;
    sets.add(column + " = ?");
    values.add(input.get(column));
  }

  private Map<String, Object> template(Map<String, Object> row) {
    Map<String, Object> out = new LinkedHashMap<>(row);
    out.put("definition", Jsons.map(row.get("definition")));
    out.put("starter_roles", Jsons.longList(row.get("starter_roles")));
    return out;
  }

  private Map<String, Object> instance(Map<String, Object> row) {
    Map<String, Object> out = new LinkedHashMap<>(row);
    out.put("current_nodes", Jsons.stringList(row.get("current_nodes")));
    out.put("payload", Jsons.map(row.get("payload")));
    return out;
  }

  private Map<String, Object> task(Map<String, Object> row) {
    Map<String, Object> out = new LinkedHashMap<>(row);
    out.put("meta", Jsons.map(row.get("meta")));
    out.put("payload", Jsons.map(row.get("payload")));
    return out;
  }

  private static String placeholders(int count) {
    return String.join(",", java.util.Collections.nCopies(count, "?"));
  }
}
