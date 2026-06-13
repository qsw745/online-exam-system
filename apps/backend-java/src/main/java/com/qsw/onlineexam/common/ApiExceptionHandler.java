package com.qsw.onlineexam.common;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
  private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

  @ExceptionHandler(ApiException.class)
  public ResponseEntity<Map<String, Object>> handleApi(ApiException e) {
    return ResponseEntity
        .status(e.status())
        .body(ApiEnvelope.fail(e.status(), e.code(), e.getMessage(), null));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<Map<String, Object>> handleAny(Exception e) {
    log.error("Unhandled API error", e);
    return ResponseEntity
        .status(500)
        .body(ApiEnvelope.fail(500, "INTERNAL_ERROR", e.getMessage() == null ? "服务器内部错误" : e.getMessage(), null));
  }
}
