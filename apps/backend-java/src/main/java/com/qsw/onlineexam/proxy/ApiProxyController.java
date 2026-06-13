package com.qsw.onlineexam.proxy;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Collections;
import java.util.Enumeration;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StreamUtils;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ConditionalOnProperty(prefix = "online-exam.proxy", name = "enabled", havingValue = "true", matchIfMissing = true)
public class ApiProxyController {
  private static final Set<String> HOP_BY_HOP_HEADERS = Set.of(
      "connection",
      "content-length",
      "date",
      "expect",
      "from",
      "host",
      "keep-alive",
      "proxy-authenticate",
      "proxy-authorization",
      "te",
      "trailer",
      "transfer-encoding",
      "upgrade"
  );

  private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
  private final String nodeBackendUrl;

  public ApiProxyController(@Value("${online-exam.node-backend-url}") String nodeBackendUrl) {
    this.nodeBackendUrl = nodeBackendUrl == null ? "" : nodeBackendUrl.replaceAll("/+$", "");
  }

  @RequestMapping("/api/**")
  public ResponseEntity<byte[]> proxy(HttpServletRequest request) throws Exception {
    String uri = request.getRequestURI();
    String query = request.getQueryString();
    String target = nodeBackendUrl + uri + (query == null || query.isBlank() ? "" : "?" + query);
    byte[] body = StreamUtils.copyToByteArray(request.getInputStream());
    HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(target)).timeout(Duration.ofSeconds(60));
    copyHeaders(request, builder);
    builder.method(request.getMethod(), body.length == 0 ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofByteArray(body));
    HttpResponse<byte[]> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofByteArray());
    HttpHeaders headers = new HttpHeaders();
    response.headers().map().forEach((key, values) -> {
      if (isHopByHop(key)) return;
      headers.put(key, values);
    });
    return new ResponseEntity<>(response.body(), headers, HttpStatusCode.valueOf(response.statusCode()));
  }

  private void copyHeaders(HttpServletRequest request, HttpRequest.Builder builder) {
    Enumeration<String> names = request.getHeaderNames();
    if (names == null) names = Collections.emptyEnumeration();
    while (names.hasMoreElements()) {
      String name = names.nextElement();
      if (isHopByHop(name)) continue;
      Enumeration<String> values = request.getHeaders(name);
      while (values.hasMoreElements()) {
        builder.header(name, values.nextElement());
      }
    }
  }

  private static boolean isHopByHop(String header) {
    return header != null && HOP_BY_HOP_HEADERS.contains(header.toLowerCase());
  }
}
