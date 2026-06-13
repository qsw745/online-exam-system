package com.qsw.onlineexam.workflow;

import java.util.List;
import java.util.Map;

final class FlowableBpmnBuilder {
  private FlowableBpmnBuilder() {}

  static String processKey(long templateId, int version) {
    return "oes_template_" + templateId + "_v" + version;
  }

  static String candidateVariable(String nodeId) {
    StringBuilder out = new StringBuilder("node");
    for (char ch : String.valueOf(nodeId).toCharArray()) {
      if (Character.isLetterOrDigit(ch)) out.append(ch);
      else out.append('_');
    }
    out.append("CandidateUsers");
    return out.toString();
  }

  static String build(String processKey, String processName, Map<String, Object> definition) {
    List<Map<String, Object>> nodes = Jsons.listOfMaps(definition.get("nodes"));
    List<Map<String, Object>> edges = Jsons.listOfMaps(definition.get("edges"));
    StringBuilder xml = new StringBuilder();
    xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    xml.append("<definitions xmlns=\"http://www.omg.org/spec/BPMN/20100524/MODEL\" ");
    xml.append("xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" ");
    xml.append("xmlns:flowable=\"http://flowable.org/bpmn\" ");
    xml.append("targetNamespace=\"https://online-exam-system.local/workflows\">\n");
    xml.append("  <process id=\"").append(escape(processKey)).append("\" name=\"").append(escape(processName)).append("\" isExecutable=\"true\">\n");
    for (Map<String, Object> node : nodes) {
      String id = escape(id(node));
      String name = escape(name(node));
      String type = String.valueOf(node.getOrDefault("type", "approval"));
      switch (type) {
        case "start" -> xml.append("    <startEvent id=\"").append(id).append("\" name=\"").append(name).append("\" />\n");
        case "end" -> xml.append("    <endEvent id=\"").append(id).append("\" name=\"").append(name).append("\" />\n");
        default -> {
          String variable = candidateVariable(id(node));
          xml.append("    <userTask id=\"")
              .append(id)
              .append("\" name=\"")
              .append(name)
              .append("\" flowable:candidateUsers=\"${")
              .append(escape(variable))
              .append("}\" />\n");
        }
      }
    }
    int seq = 1;
    for (Map<String, Object> edge : edges) {
      String from = Jsons.string(edge.get("from"));
      String to = Jsons.string(edge.get("to"));
      if (from == null || to == null || from.isBlank() || to.isBlank()) continue;
      xml.append("    <sequenceFlow id=\"flow_")
          .append(seq++)
          .append("\" sourceRef=\"")
          .append(escape(from))
          .append("\" targetRef=\"")
          .append(escape(to))
          .append("\" />\n");
    }
    xml.append("  </process>\n");
    xml.append("</definitions>\n");
    return xml.toString();
  }

  private static String id(Map<String, Object> node) {
    return String.valueOf(node.getOrDefault("id", "node"));
  }

  private static String name(Map<String, Object> node) {
    Object name = node.get("name");
    return name == null || String.valueOf(name).isBlank() ? id(node) : String.valueOf(name);
  }

  private static String escape(String value) {
    if (value == null) return "";
    return value
        .replace("&", "&amp;")
        .replace("\"", "&quot;")
        .replace("<", "&lt;")
        .replace(">", "&gt;");
  }
}
