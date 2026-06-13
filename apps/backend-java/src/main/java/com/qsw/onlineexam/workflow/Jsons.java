package com.qsw.onlineexam.workflow;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

final class Jsons {
  static final ObjectMapper MAPPER = new ObjectMapper();

  private Jsons() {}

  static String write(Object value) {
    if (value == null) return null;
    try {
      return MAPPER.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalArgumentException("JSON serialize failed", e);
    }
  }

  static Object parse(String value) {
    if (value == null || value.isBlank()) return null;
    try {
      return MAPPER.readValue(value, Object.class);
    } catch (Exception ignored) {
      return null;
    }
  }

  @SuppressWarnings("unchecked")
  static Map<String, Object> map(Object value) {
    if (value instanceof Map<?, ?> raw) return (Map<String, Object>) raw;
    if (value instanceof String text) {
      Object parsed = parse(text);
      if (parsed instanceof Map<?, ?> raw) return (Map<String, Object>) raw;
    }
    return Collections.emptyMap();
  }

  @SuppressWarnings("unchecked")
  static List<Map<String, Object>> listOfMaps(Object value) {
    Object source = value;
    if (source instanceof String text) source = parse(text);
    if (!(source instanceof List<?> list)) return Collections.emptyList();
    List<Map<String, Object>> out = new ArrayList<>();
    for (Object item : list) {
      if (item instanceof Map<?, ?> raw) out.add((Map<String, Object>) raw);
    }
    return out;
  }

  static List<String> stringList(Object value) {
    Object source = value;
    if (source instanceof String text) source = parse(text);
    if (!(source instanceof List<?> list)) return Collections.emptyList();
    List<String> out = new ArrayList<>();
    for (Object item : list) {
      if (item != null) out.add(String.valueOf(item));
    }
    return out;
  }

  static List<Long> longList(Object value) {
    Object source = value;
    if (source instanceof String text) source = parse(text);
    if (!(source instanceof List<?> list)) return Collections.emptyList();
    List<Long> out = new ArrayList<>();
    for (Object item : list) {
      long n = longValue(item, 0);
      if (n > 0) out.add(n);
    }
    return out;
  }

  static long longValue(Object value, long fallback) {
    if (value instanceof Number n) return n.longValue();
    if (value == null) return fallback;
    try {
      return Long.parseLong(String.valueOf(value));
    } catch (Exception ignored) {
      return fallback;
    }
  }

  static int intValue(Object value, int fallback) {
    if (value instanceof Number n) return n.intValue();
    if (value == null) return fallback;
    try {
      return Integer.parseInt(String.valueOf(value));
    } catch (Exception ignored) {
      return fallback;
    }
  }

  static String string(Object value) {
    return value == null ? null : String.valueOf(value);
  }

  static <T> T convert(Object value, TypeReference<T> type) {
    return MAPPER.convertValue(value, type);
  }
}
