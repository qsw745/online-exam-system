package com.qsw.onlineexam.common;

public class ApiException extends RuntimeException {
  private final int status;
  private final String code;

  public ApiException(String message, int status, String code) {
    super(message);
    this.status = status;
    this.code = code;
  }

  public int status() {
    return status;
  }

  public String code() {
    return code;
  }

  public static ApiException unauthorized(String message) {
    return new ApiException(message, 401, "AUTH_UNAUTHORIZED");
  }

  public static ApiException forbidden(String message) {
    return new ApiException(message, 403, "AUTH_FORBIDDEN");
  }

  public static ApiException badRequest(String message) {
    return new ApiException(message, 400, "VALIDATION_ERROR");
  }

  public static ApiException notFound(String message) {
    return new ApiException(message, 404, "NOT_FOUND");
  }
}
