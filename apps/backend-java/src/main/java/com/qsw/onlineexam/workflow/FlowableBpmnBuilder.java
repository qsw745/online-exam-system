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
        case "gateway" ->
            // 条件网关：Flowable 仅作镜像（真实排他路由由 WorkflowService 按 edge.condition 求值），
            // 此处取首条出边即可，不写条件表达式以避免 JUEL 风险
            xml.append("    <exclusiveGateway id=\"").append(id).append("\" name=\"").append(name).append("\" />\n");
        case "cc" ->
            // 抄送：暂作自动通过的直通节点（抄送知会/记录留作后续）
            xml.append("    <serviceTask id=\"")
                .append(id)
                .append("\" name=\"")
                .append(name)
                .append("\" flowable:expression=\"${true}\" />\n");
        default -> appendApprovalTask(xml, id, name, id(node), node);
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

  /**
   * 审批节点 → userTask。mode 决定多实例语义：
   *  - single（默认/单人）：直接 candidateUsers，不用多实例
   *  - and（会签）：多实例并行，全部完成才通过
   *  - or（或签）：多实例并行，任一完成即通过（completionCondition）
   *  - sequential（依次）：多实例串行
   * 候选/审批人集合来自启动实例时注入的变量 nodeXxxCandidateUsers（List）。
   */
  private static void appendApprovalTask(
      StringBuilder xml, String id, String name, String nodeId, Map<String, Object> node) {
    String variable = candidateVariable(nodeId);
    String mode = String.valueOf(node.getOrDefault("mode", "single"));
    boolean multi = mode.equals("and") || mode.equals("or") || mode.equals("sequential");

    if (!multi) {
      xml.append("    <userTask id=\"").append(id).append("\" name=\"").append(name)
          .append("\" flowable:candidateUsers=\"${").append(escape(variable)).append("}\" />\n");
      return;
    }

    boolean sequential = mode.equals("sequential");
    xml.append("    <userTask id=\"").append(id).append("\" name=\"").append(name)
        .append("\" flowable:assignee=\"${assignee}\">\n");
    xml.append("      <multiInstanceLoopCharacteristics isSequential=\"")
        .append(sequential)
        .append("\" flowable:collection=\"${").append(escape(variable))
        .append("}\" flowable:elementVariable=\"assignee\">\n");
    if (mode.equals("or")) {
      // 或签：任一通过即完成
      xml.append("        <completionCondition>${nrOfCompletedInstances &gt;= 1}</completionCondition>\n");
    }
    xml.append("      </multiInstanceLoopCharacteristics>\n");
    xml.append("    </userTask>\n");
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
