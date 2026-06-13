package com.qsw.onlineexam.common;

import com.qsw.onlineexam.workflow.WorkflowService;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
  private final JdbcTemplate jdbc;
  private final WorkflowService workflowService;

  public HealthController(JdbcTemplate jdbc, WorkflowService workflowService) {
    this.jdbc = jdbc;
    this.workflowService = workflowService;
  }

  @GetMapping("/api/health")
  public Map<String, Object> health() {
    Map<String, Object> data = new LinkedHashMap<>();
    data.put("ok", true);
    data.put("runtime", "java");
    data.put("database", jdbc.queryForObject("SELECT 1", Integer.class));
    data.put("workflow", workflowService.engineStatus());
    return ApiEnvelope.ok(data, "OK");
  }
}
