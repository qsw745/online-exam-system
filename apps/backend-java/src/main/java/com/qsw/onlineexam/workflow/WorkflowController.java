package com.qsw.onlineexam.workflow;

import com.qsw.onlineexam.auth.AuthService;
import com.qsw.onlineexam.auth.AuthUser;
import com.qsw.onlineexam.common.ApiEnvelope;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/workflows")
public class WorkflowController {
  private final WorkflowService workflowService;
  private final AuthService authService;

  public WorkflowController(WorkflowService workflowService, AuthService authService) {
    this.workflowService = workflowService;
    this.authService = authService;
  }

  @GetMapping("/engine/status")
  public ResponseEntity<Map<String, Object>> engineStatus() {
    return ResponseEntity.ok(ApiEnvelope.ok(workflowService.engineStatus(), "OK"));
  }

  @GetMapping("/templates")
  public ResponseEntity<Map<String, Object>> listTemplates(
      HttpServletRequest request,
      @RequestParam Map<String, String> query
  ) {
    AuthUser user = authService.requireUser(request);
    Map<String, Object> data = Map.of("items", workflowService.listTemplates(user, query));
    return ResponseEntity.ok(ApiEnvelope.ok(data, "获取模板成功"));
  }

  @GetMapping("/templates/{id}")
  public ResponseEntity<Map<String, Object>> getTemplate(HttpServletRequest request, @PathVariable long id) {
    AuthUser user = authService.requireUser(request);
    return ResponseEntity.ok(ApiEnvelope.ok(workflowService.getTemplate(user, id), "获取模板成功"));
  }

  @PostMapping("/templates")
  public ResponseEntity<Map<String, Object>> createTemplate(
      HttpServletRequest request,
      @RequestBody Map<String, Object> payload
  ) {
    AuthUser user = authService.requireUser(request);
    return ResponseEntity
        .status(201)
        .body(ApiEnvelope.created(workflowService.createTemplate(user, safe(payload)), "创建模板成功"));
  }

  @PutMapping("/templates/{id}")
  public ResponseEntity<Map<String, Object>> updateTemplate(
      HttpServletRequest request,
      @PathVariable long id,
      @RequestBody Map<String, Object> payload
  ) {
    AuthUser user = authService.requireUser(request);
    return ResponseEntity.ok(ApiEnvelope.ok(workflowService.updateTemplate(user, id, safe(payload)), "更新模板成功"));
  }

  @PostMapping("/templates/{id}/publish")
  public ResponseEntity<Map<String, Object>> publishTemplate(HttpServletRequest request, @PathVariable long id) {
    AuthUser user = authService.requireUser(request);
    return ResponseEntity.ok(ApiEnvelope.ok(workflowService.publishTemplate(user, id), "发布模板成功"));
  }

  @PostMapping("/instances")
  public ResponseEntity<Map<String, Object>> startInstance(
      HttpServletRequest request,
      @RequestBody Map<String, Object> payload
  ) {
    AuthUser user = authService.requireUser(request);
    return ResponseEntity
        .status(201)
        .body(ApiEnvelope.created(workflowService.startInstance(user, safe(payload)), "启动流程成功"));
  }

  @GetMapping("/instances/{id}")
  public ResponseEntity<Map<String, Object>> getInstance(HttpServletRequest request, @PathVariable long id) {
    AuthUser user = authService.requireUser(request);
    return ResponseEntity.ok(ApiEnvelope.ok(workflowService.getInstanceDetail(user, id), "获取流程详情成功"));
  }

  @GetMapping("/tasks/mine")
  public ResponseEntity<Map<String, Object>> listMyTasks(
      HttpServletRequest request,
      @RequestParam Map<String, String> query
  ) {
    AuthUser user = authService.requireUser(request);
    return ResponseEntity.ok(ApiEnvelope.ok(workflowService.listMyTasks(user, query), "获取我的任务成功"));
  }

  @PostMapping("/tasks/{id}/approve")
  public ResponseEntity<Map<String, Object>> approve(
      HttpServletRequest request,
      @PathVariable long id,
      @RequestBody(required = false) Map<String, Object> payload
  ) {
    AuthUser user = authService.requireUser(request);
    Map<String, Object> body = safe(payload);
    Object formValues = body.get("form_values");
    return ResponseEntity.ok(ApiEnvelope.ok(
        workflowService.decideTask(user, id, "approved", Jsons.string(body.get("comment")), formValues),
        "审批通过"
    ));
  }

  @PostMapping("/tasks/{id}/reject")
  public ResponseEntity<Map<String, Object>> reject(
      HttpServletRequest request,
      @PathVariable long id,
      @RequestBody(required = false) Map<String, Object> payload
  ) {
    AuthUser user = authService.requireUser(request);
    Map<String, Object> body = safe(payload);
    Object formValues = body.get("form_values");
    return ResponseEntity.ok(ApiEnvelope.ok(
        workflowService.decideTask(user, id, "rejected", Jsons.string(body.get("comment")), formValues),
        "审批驳回"
    ));
  }

  @PostMapping("/exams/{id}/review")
  public ResponseEntity<Map<String, Object>> submitExamReview(
      HttpServletRequest request,
      @PathVariable long id,
      @RequestBody(required = false) Map<String, Object> payload
  ) {
    AuthUser user = authService.requireUser(request);
    return ResponseEntity.ok(ApiEnvelope.ok(workflowService.submitExamReview(user, id, safe(payload)), "提交审核成功"));
  }

  private static Map<String, Object> safe(Map<String, Object> payload) {
    return payload == null ? new LinkedHashMap<>() : payload;
  }
}
