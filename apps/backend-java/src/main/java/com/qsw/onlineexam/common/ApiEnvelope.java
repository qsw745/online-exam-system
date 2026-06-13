package com.qsw.onlineexam.common;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

public final class ApiEnvelope {
  private ApiEnvelope() {}

  public static Map<String, Object> ok(Object data, String message) {
    return body(true, "OK", 200, data, message == null ? "OK" : message, null);
  }

  public static Map<String, Object> created(Object data, String message) {
    return body(true, "CREATED", 201, data, message == null ? "Created" : message, null);
  }

  public static Map<String, Object> fail(int status, String code, String message, Object details) {
    return body(false, code, status, null, message, details);
  }

  private static Map<String, Object> body(
      boolean success,
      String code,
      int status,
      Object data,
      String message,
      Object details
  ) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("success", success);
    out.put("code", code);
    out.put("status", status);
    out.put("message", message);
    if (success) {
      out.put("data", data);
    } else {
      Map<String, Object> error = new LinkedHashMap<>();
      error.put("details", details);
      out.put("error", error);
    }
    Map<String, Object> trace = new LinkedHashMap<>();
    trace.put("timestamp", Instant.now().toString());
    out.put("trace", trace);
    return out;
  }
}
