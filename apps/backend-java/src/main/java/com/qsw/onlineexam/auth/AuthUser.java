package com.qsw.onlineexam.auth;

import java.util.List;

public record AuthUser(
    long id,
    String email,
    String role,
    List<Long> roleIds,
    List<String> roleCodes,
    String sessionId
) {
  public boolean hasAnyRole(String... allowed) {
    for (String item : allowed) {
      String normalized = item == null ? "" : item.trim().toLowerCase();
      if (normalized.isEmpty()) continue;
      if (role != null && role.equalsIgnoreCase(normalized)) return true;
      if (roleCodes != null && roleCodes.stream().anyMatch(code -> code.equalsIgnoreCase(normalized))) return true;
    }
    return false;
  }

  public boolean isAdmin() {
    if (hasAnyRole("admin", "super_admin", "superadmin")) return true;
    return roleIds != null && (roleIds.contains(1L) || roleIds.contains(2L));
  }
}
