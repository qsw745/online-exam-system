package com.qsw.onlineexam.workflow;

import com.qsw.onlineexam.auth.AuthService;
import com.qsw.onlineexam.auth.AuthUser;
import com.qsw.onlineexam.common.ApiEnvelope;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ReviewController {
  private final WorkflowService workflowService;
  private final AuthService authService;

  public ReviewController(WorkflowService workflowService, AuthService authService) {
    this.workflowService = workflowService;
    this.authService = authService;
  }

  @PostMapping("/api/exams/{id}/review")
  public ResponseEntity<Map<String, Object>> submitExamReview(
      HttpServletRequest request,
      @PathVariable long id,
      @RequestBody(required = false) Map<String, Object> payload
  ) {
    AuthUser user = authService.requireUser(request);
    return ResponseEntity.ok(ApiEnvelope.ok(workflowService.submitExamReview(user, id, safe(payload)), "提交审核成功"));
  }

  @PostMapping("/api/papers/{id}/review")
  public ResponseEntity<Map<String, Object>> submitPaperReview(
      HttpServletRequest request,
      @PathVariable long id,
      @RequestBody(required = false) Map<String, Object> payload
  ) {
    AuthUser user = authService.requireUser(request);
    return ResponseEntity.ok(ApiEnvelope.ok(workflowService.submitPaperReview(user, id, safe(payload)), "提交审核成功"));
  }

  private static Map<String, Object> safe(Map<String, Object> payload) {
    return payload == null ? new LinkedHashMap<>() : payload;
  }
}
