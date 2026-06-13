package com.qsw.onlineexam.auth;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qsw.onlineexam.common.ApiException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
  private final JdbcTemplate jdbc;
  private final ObjectMapper objectMapper;
  private final String jwtSecret;

  public AuthService(
      JdbcTemplate jdbc,
      ObjectMapper objectMapper,
      @Value("${online-exam.auth.jwt-secret:}") String jwtSecret
  ) {
    this.jdbc = jdbc;
    this.objectMapper = objectMapper;
    this.jwtSecret = jwtSecret == null ? "" : jwtSecret.trim();
  }

  public AuthUser requireUser(HttpServletRequest request) {
    AuthUser user = currentUser(request);
    if (user == null) throw ApiException.unauthorized("访问令牌缺失或无效");
    return user;
  }

  public AuthUser currentUser(HttpServletRequest request) {
    String token = readToken(request);
    if (token == null || token.isBlank() || jwtSecret.isBlank()) return null;
    try {
      Map<String, Object> claims = verifyHs256Token(token);
      Object type = claims.get("type");
      if (type != null && !"access".equals(String.valueOf(type))) return null;
      long userId = numberValue(claims.get("id"), numberValue(claims.get("sub"), 0L));
      if (userId <= 0) return null;
      List<Long> roleIds = longList(claims.get("role_ids"));
      List<String> roleCodes = roleCodes(claims.get("roles"));
      String sid = stringValue(claims.get("sid"));
      return hydrateUser(userId, roleIds, roleCodes, sid);
    } catch (Exception ignored) {
      return null;
    }
  }

  private Map<String, Object> verifyHs256Token(String token) throws Exception {
    String[] parts = token.split("\\.", -1);
    if (parts.length != 3 || parts[0].isBlank() || parts[1].isBlank() || parts[2].isBlank()) {
      throw new IllegalArgumentException("invalid jwt");
    }

    Base64.Decoder decoder = Base64.getUrlDecoder();
    Map<String, Object> header = objectMapper.readValue(
        decoder.decode(padBase64Url(parts[0])),
        new TypeReference<Map<String, Object>>() {}
    );
    if (!"HS256".equals(String.valueOf(header.get("alg")))) {
      throw new IllegalArgumentException("unsupported jwt alg");
    }

    String signingInput = parts[0] + "." + parts[1];
    Mac mac = Mac.getInstance("HmacSHA256");
    SecretKey key = new SecretKeySpec(jwtSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    mac.init(key);
    byte[] expected = mac.doFinal(signingInput.getBytes(StandardCharsets.UTF_8));
    byte[] actual = decoder.decode(padBase64Url(parts[2]));
    if (!MessageDigest.isEqual(expected, actual)) {
      throw new IllegalArgumentException("invalid jwt signature");
    }

    Map<String, Object> claims = objectMapper.readValue(
        decoder.decode(padBase64Url(parts[1])),
        new TypeReference<Map<String, Object>>() {}
    );
    long now = Instant.now().getEpochSecond();
    long exp = numberValue(claims.get("exp"), 0L);
    if (exp > 0 && exp < now) throw new IllegalArgumentException("jwt expired");
    long nbf = numberValue(claims.get("nbf"), 0L);
    if (nbf > 0 && nbf > now) throw new IllegalArgumentException("jwt not active");
    return claims;
  }

  private static String padBase64Url(String value) {
    int remainder = value.length() % 4;
    return remainder == 0 ? value : value + "=".repeat(4 - remainder);
  }

  public void requireRole(AuthUser user, String... allowed) {
    if (user == null) throw ApiException.unauthorized("请先登录");
    if (user.isAdmin() || user.hasAnyRole(allowed)) return;
    throw ApiException.forbidden("无权限");
  }

  private AuthUser hydrateUser(long userId, List<Long> roleIds, List<String> roleCodes, String sid) {
    List<AuthUser> users = jdbc.query(
        "SELECT id, email, role FROM users WHERE id = ? LIMIT 1",
        (rs, rowNum) -> new AuthUser(
            rs.getLong("id"),
            rs.getString("email"),
            normalize(rs.getString("role")),
            roleIds,
            roleCodes,
            sid
        ),
        userId
    );
    return users.isEmpty() ? null : users.get(0);
  }

  private static String readToken(HttpServletRequest request) {
    String authorization = request.getHeader("Authorization");
    if (authorization != null) {
      if (authorization.startsWith("Bearer ")) return authorization.substring("Bearer ".length()).trim();
      int space = authorization.indexOf(' ');
      if (space > 0 && space + 1 < authorization.length()) return authorization.substring(space + 1).trim();
    }
    if (request.getCookies() != null) {
      for (Cookie cookie : request.getCookies()) {
        String name = cookie.getName();
        if ("access_token".equals(name) || "token".equals(name) || "Authorization".equals(name)) {
          return cookie.getValue();
        }
      }
    }
    return null;
  }

  private static List<Long> longList(Object raw) {
    List<Long> out = new ArrayList<>();
    if (raw instanceof Iterable<?> items) {
      for (Object item : items) {
        long value = numberValue(item, 0L);
        if (value > 0) out.add(value);
      }
    }
    return out;
  }

  @SuppressWarnings("unchecked")
  private static List<String> roleCodes(Object raw) {
    List<String> out = new ArrayList<>();
    if (raw instanceof Iterable<?> items) {
      for (Object item : items) {
        if (item instanceof java.util.Map<?, ?> map) {
          String code = normalize(stringValue(map.get("code")));
          if (code != null && !code.isBlank()) out.add(code);
        } else {
          String code = normalize(stringValue(item));
          if (code != null && !code.isBlank()) out.add(code);
        }
      }
    } else if (raw instanceof java.util.Map<?, ?> map) {
      String code = normalize(stringValue(map.get("code")));
      if (code != null && !code.isBlank()) out.add(code);
    } else {
      String code = normalize(stringValue(raw));
      if (code != null && !code.isBlank()) out.add(code);
    }
    return out;
  }

  private static long numberValue(Object raw, long fallback) {
    if (raw instanceof Number n) return n.longValue();
    if (raw == null) return fallback;
    try {
      return Long.parseLong(String.valueOf(raw));
    } catch (Exception ignored) {
      return fallback;
    }
  }

  private static String stringValue(Object raw) {
    return raw == null ? null : String.valueOf(raw);
  }

  private static String normalize(String value) {
    return value == null ? null : value.trim().toLowerCase();
  }
}
