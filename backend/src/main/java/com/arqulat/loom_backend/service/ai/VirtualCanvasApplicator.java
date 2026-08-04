package com.arqulat.loom_backend.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Java-side virtual canvas that applies agent tool calls to an in-memory node list.
 * Mirrors the logic in frontend's agentTools.ts so the backend can track canvas state
 * across multiple agent loop iterations without round-tripping to the frontend.
 */
@Component
public class VirtualCanvasApplicator {

    private static final Logger logger = LoggerFactory.getLogger(VirtualCanvasApplicator.class);
    private final ObjectMapper objectMapper;

    public VirtualCanvasApplicator(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Applies a list of tool calls to the current canvas state and returns the updated canvas JSON.
     * Handles $$NEW_N$$ placeholder resolution for cross-referencing newly created nodes.
     *
     * @param toolCallsNode  The JSON array of tool calls from the LLM
     * @param currentCanvas  The current canvas state as a JSON array string
     * @return The updated canvas state as a JSON array string
     */
    public String applyToolCalls(JsonNode toolCallsNode, String currentCanvas) throws Exception {
        ArrayNode canvasArray = (ArrayNode) objectMapper.readTree(currentCanvas);
        // Track which anchors are already occupied per node for smart anchor selection
        Map<String, Set<String>> occupiedAnchors = buildOccupiedAnchors(canvasArray);
        
        // Track edges to prevent exact duplicates (e.g. 5 lines from Server to Database)
        Set<String> seenEdges = new HashSet<>();
        for (JsonNode item : canvasArray) {
            String type = item.path("type").asText("");
            if ("arrow".equals(type) || "line".equals(type)) {
                String sId = item.path("startConnection").path("nodeId").asText("");
                String tId = item.path("endConnection").path("nodeId").asText("");
                if (!sId.isEmpty() && !tId.isEmpty()) {
                    seenEdges.add(sId + "->" + tId);
                }
            }
        }

        if (!toolCallsNode.isArray()) {
            logger.warn("toolCalls is not an array, returning canvas unchanged");
            return currentCanvas;
        }

        for (JsonNode call : toolCallsNode) {
            String tool = call.path("tool").asText("");
            JsonNode args = call.path("args");

            try {
                switch (tool) {
                    case "add_node":
                        String newId = UUID.randomUUID().toString();
                        newIdMap.put("$$NEW_" + newCounter + "$$", newId);
                        newCounter++;

                        String nodeType = mapNodeTypeAlias(args.path("type").asText("box"));
                        String content = args.path("content").asText("");

                        ObjectNode node = objectMapper.createObjectNode();
                        node.put("id", newId);
                        node.put("type", nodeType);
                        node.put("content", content);

                        ObjectNode position = objectMapper.createObjectNode();
                        position.put("x", args.path("x").asDouble(0));
                        position.put("y", args.path("y").asDouble(0));
                        node.set("position", position);

                        // Smart dimension calculation based on shape type and content length
                        double baseWidth = 160;
                        double baseHeight = 60;
                        
                        if (nodeType.equals("pill") || nodeType.equals("terminator") || nodeType.equals("rectangle")) {
                            baseWidth = 130;
                            baseHeight = 50;
                        } else if (nodeType.equals("diamond")) {
                            baseWidth = 160;
                            baseHeight = 80;
                        }
                        
                        int charCount = content.length();
                        double calcWidth = Math.max(baseWidth, Math.min(280, charCount * 8.0 + 40));
                        int lines = (int) Math.ceil((charCount * 8.0) / Math.max(1, calcWidth - 40));
                        if (lines == 0) lines = 1;
                        double calcHeight = Math.max(baseHeight, lines * 20.0 + 40);
                        
                        double w = args.has("width") ? args.path("width").asDouble() : calcWidth;
                        double h = args.has("height") ? args.path("height").asDouble() : calcHeight;
                        
                        // If LLM blindly used the 160x60 default or 220x90, override with our smart calc
                        if ((w == 160 && h == 60) || (w == 220 && h == 90) || (w == 150 && h == 60) || (w == 130 && h == 50) || (w == 160 && h == 80) || (w == 200 && h == 80)) {
                            w = calcWidth;
                            h = calcHeight;
                        }

                        ObjectNode dimensions = objectMapper.createObjectNode();
                        dimensions.put("width", w);
                        dimensions.put("height", h);
                        node.set("dimensions", dimensions);

                        ObjectNode style = objectMapper.createObjectNode();
                        if (args.has("backgroundColor")) style.put("backgroundColor", args.path("backgroundColor").asText());
                        if (args.has("borderColor")) style.put("borderColor", args.path("borderColor").asText());
                        if (args.has("textColor")) style.put("color", args.path("textColor").asText());
                        node.set("style", style);

                        if (args.has("tag")) node.put("tag", args.path("tag").asText());

                        canvasArray.add(node);
                        logger.debug("add_node: {} '{}' at ({}, {})", args.path("type").asText("box"),
                                args.path("content").asText(""), args.path("x").asDouble(), args.path("y").asDouble());
                        break;

                    case "delete_node": {
                        String targetId = resolveId(args.path("nodeId").asText(), newIdMap);
                        ArrayNode filtered = objectMapper.createArrayNode();
                        for (JsonNode n : canvasArray) {
                            if (!n.path("id").asText().equals(targetId)) {
                                // Also remove edges connected to this node
                                String startConn = n.path("startConnection").path("nodeId").asText("");
                                String endConn = n.path("endConnection").path("nodeId").asText("");
                                if (!startConn.equals(targetId) && !endConn.equals(targetId)) {
                                    filtered.add(n);
                                }
                            }
                        }
                        canvasArray = filtered;
                        logger.debug("delete_node: {}", targetId);
                        break;
                    }

                    case "update_content": {
                        String targetId = resolveId(args.path("nodeId").asText(), newIdMap);
                        for (int i = 0; i < canvasArray.size(); i++) {
                            if (canvasArray.get(i).path("id").asText().equals(targetId)) {
                                ((ObjectNode) canvasArray.get(i)).put("content", args.path("content").asText());
                                break;
                            }
                        }
                        break;
                    }

                    case "move_node": {
                        String targetId = resolveId(args.path("nodeId").asText(), newIdMap);
                        for (int i = 0; i < canvasArray.size(); i++) {
                            if (canvasArray.get(i).path("id").asText().equals(targetId)) {
                                ObjectNode pos = objectMapper.createObjectNode();
                                pos.put("x", args.path("x").asDouble());
                                pos.put("y", args.path("y").asDouble());
                                ((ObjectNode) canvasArray.get(i)).set("position", pos);
                                break;
                            }
                        }
                        break;
                    }

                    case "resize_node": {
                        String targetId = resolveId(args.path("nodeId").asText(), newIdMap);
                        for (int i = 0; i < canvasArray.size(); i++) {
                            if (canvasArray.get(i).path("id").asText().equals(targetId)) {
                                ObjectNode dim = objectMapper.createObjectNode();
                                dim.put("width", args.path("width").asDouble());
                                dim.put("height", args.path("height").asDouble());
                                ((ObjectNode) canvasArray.get(i)).set("dimensions", dim);
                                break;
                            }
                        }
                        break;
                    }

                    case "style_node": {
                        String targetId = resolveId(args.path("nodeId").asText(), newIdMap);
                        for (int i = 0; i < canvasArray.size(); i++) {
                            if (canvasArray.get(i).path("id").asText().equals(targetId)) {
                                ObjectNode existingStyle = canvasArray.get(i).has("style")
                                        ? (ObjectNode) canvasArray.get(i).path("style")
                                        : objectMapper.createObjectNode();
                                if (args.has("backgroundColor")) existingStyle.put("backgroundColor", args.path("backgroundColor").asText());
                                if (args.has("borderColor")) existingStyle.put("borderColor", args.path("borderColor").asText());
                                if (args.has("textColor")) existingStyle.put("color", args.path("textColor").asText());
                                if (args.has("fontSize")) existingStyle.put("fontSize", args.path("fontSize").asText());
                                if (args.has("fontWeight")) existingStyle.put("fontWeight", args.path("fontWeight").asText());
                                if (args.has("borderRadius")) existingStyle.put("borderRadius", args.path("borderRadius").asText());
                                if (args.has("opacity")) existingStyle.put("opacity", args.path("opacity").asText());
                                ((ObjectNode) canvasArray.get(i)).set("style", existingStyle);
                                break;
                            }
                        }
                        break;
                    }

                    case "connect_nodes": {
                        String sourceId = resolveId(args.path("sourceId").asText(), newIdMap);
                        String targetNodeId = resolveId(args.path("targetId").asText(), newIdMap);
                        String edgeId = UUID.randomUUID().toString();
                        newIdMap.put("$$NEW_" + newCounter + "$$", edgeId);
                        newCounter++;

                        // Find source and target node positions for geometry calculation
                        JsonNode sourceNode = findNode(canvasArray, sourceId);
                        JsonNode targetNode = findNode(canvasArray, targetNodeId);

                        ObjectNode edge = objectMapper.createObjectNode();
                        edge.put("id", edgeId);
                        edge.put("type", "arrow");
                        edge.put("content", "");

                        // Calculate anchor points based on node positions
                        String sourceAnchor = args.path("sourceAnchor").asText("closest");
                        String targetAnchor = args.path("targetAnchor").asText("closest");

                        double srcX = 0, srcY = 0, tgtX = 0, tgtY = 0;
                        double srcW = 160, srcH = 60, tgtW = 160, tgtH = 60;

                        if (sourceNode != null) {
                            srcX = sourceNode.path("position").path("x").asDouble(0);
                            srcY = sourceNode.path("position").path("y").asDouble(0);
                            srcW = sourceNode.path("dimensions").path("width").asDouble(160);
                            srcH = sourceNode.path("dimensions").path("height").asDouble(60);
                        }
                        if (targetNode != null) {
                            tgtX = targetNode.path("position").path("x").asDouble(0);
                            tgtY = targetNode.path("position").path("y").asDouble(0);
                            tgtW = targetNode.path("dimensions").path("width").asDouble(160);
                            tgtH = targetNode.path("dimensions").path("height").asDouble(60);
                        }

                        // Auto-detect best anchors based on relative positions
                        double srcCenterX = srcX + srcW / 2;
                        double srcCenterY = srcY + srcH / 2;
                        double tgtCenterX = tgtX + tgtW / 2;
                        double tgtCenterY = tgtY + tgtH / 2;
                        double dx = tgtCenterX - srcCenterX;
                        double dy = tgtCenterY - srcCenterY;

                        if (sourceAnchor.equals("closest") || targetAnchor.equals("closest")) {
                            // Smart anchor selection based on angle and occupied anchors
                            String[] bestAnchors = selectSmartAnchors(
                                srcCenterX, srcCenterY, tgtCenterX, tgtCenterY,
                                occupiedAnchors.getOrDefault(sourceId, new HashSet<>()),
                                occupiedAnchors.getOrDefault(targetNodeId, new HashSet<>())
                            );
                            if (sourceAnchor.equals("closest")) sourceAnchor = bestAnchors[0];
                            if (targetAnchor.equals("closest")) targetAnchor = bestAnchors[1];
                        }
                        // Track occupied anchors for subsequent connections
                        occupiedAnchors.computeIfAbsent(sourceId, k -> new HashSet<>()).add(sourceAnchor);
                        occupiedAnchors.computeIfAbsent(targetNodeId, k -> new HashSet<>()).add(targetAnchor);

                        // Calculate actual start and end points based on anchors
                        double startPtX = getAnchorX(srcX, srcW, sourceAnchor);
                        double startPtY = getAnchorY(srcY, srcH, sourceAnchor);
                        double endPtX = getAnchorX(tgtX, tgtW, targetAnchor);
                        double endPtY = getAnchorY(tgtY, tgtH, targetAnchor);

                        ObjectNode startPoint = objectMapper.createObjectNode();
                        startPoint.put("x", startPtX);
                        startPoint.put("y", startPtY);
                        edge.set("startPoint", startPoint);

                        ObjectNode endPoint = objectMapper.createObjectNode();
                        endPoint.put("x", endPtX);
                        endPoint.put("y", endPtY);
                        edge.set("endPoint", endPoint);

                        // Position is top-left of bounding box
                        double minX = Math.min(startPtX, endPtX);
                        double minY = Math.min(startPtY, endPtY);
                        ObjectNode edgePos = objectMapper.createObjectNode();
                        edgePos.put("x", minX);
                        edgePos.put("y", minY);
                        edge.set("position", edgePos);

                        // Dimensions are the bounding box
                        ObjectNode edgeDim = objectMapper.createObjectNode();
                        edgeDim.put("width", Math.max(15, Math.abs(endPtX - startPtX)));
                        edgeDim.put("height", Math.max(15, Math.abs(endPtY - startPtY)));
                        edge.set("dimensions", edgeDim);

                        ObjectNode startConn = objectMapper.createObjectNode();
                        startConn.put("nodeId", sourceId);
                        startConn.put("anchor", sourceAnchor);
                        edge.set("startConnection", startConn);

                        ObjectNode endConn = objectMapper.createObjectNode();
                        endConn.put("nodeId", targetNodeId);
                        endConn.put("anchor", targetAnchor);
                        edge.set("endConnection", endConn);

                        if (args.has("label")) edge.put("label", args.path("label").asText());
                        edge.put("lineStyle", args.path("lineStyle").asText("solid"));
                        edge.put("arrowHead", args.path("arrowHead").asText("filled"));
                        edge.put("arrowTail", args.path("arrowTail").asText("none"));
                        edge.put("routing", args.path("routing").asText("elbow"));

                        canvasArray.add(edge);
                        logger.debug("connect_nodes: {} -> {} (label: {})", sourceId, targetNodeId,
                                args.path("label").asText(""));
                        break;
                    }

                    case "disconnect_nodes": {
                        String edgeIdToRemove = resolveId(args.path("edgeId").asText(), newIdMap);
                        ArrayNode filtered = objectMapper.createArrayNode();
                        for (JsonNode n : canvasArray) {
                            if (!n.path("id").asText().equals(edgeIdToRemove)) {
                                filtered.add(n);
                            }
                        }
                        canvasArray = filtered;
                        break;
                    }

                    default:
                        logger.warn("Unknown tool: {}", tool);
                        break;
                }
            } catch (Exception e) {
                logger.error("Failed to apply tool '{}': {}", tool, e.getMessage());
            }
        }

        // Post-pass: spread overlapping anchor points on the same side
        canvasArray = spreadOverlappingAnchors(canvasArray);

        return objectMapper.writeValueAsString(canvasArray);
    }

    private String resolveId(String id, Map<String, String> newIdMap) {
        return newIdMap.getOrDefault(id, id);
    }

    /**
     * Counts non-edge nodes in the canvas.
     */
    public int countNodes(String canvasJson) throws Exception {
        JsonNode canvas = objectMapper.readTree(canvasJson);
        int count = 0;
        for (JsonNode node : canvas) {
            String type = node.path("type").asText();
            if (!type.equals("arrow") && !type.equals("line")) {
                count++;
            }
        }
        return count;
    }

    /**
     * Finds a node in the canvas array by ID.
     */
    private JsonNode findNode(ArrayNode canvas, String id) {
        for (JsonNode node : canvas) {
            if (node.path("id").asText("").equals(id)) {
                return node;
            }
        }
        return null;
    }

    /**
     * Calculates the X position of an anchor point on a node.
     */
    private double getAnchorX(double nodeX, double nodeW, String anchor) {
        switch (anchor) {
            case "left": return nodeX;
            case "right": return nodeX + nodeW;
            case "top":
            case "bottom":
            default: return nodeX + nodeW / 2;
        }
    }

    /**
     * Calculates the Y position of an anchor point on a node.
     */
    private double getAnchorY(double nodeY, double nodeH, String anchor) {
        switch (anchor) {
            case "top": return nodeY;
            case "bottom": return nodeY + nodeH;
            case "left":
            case "right":
            default: return nodeY + nodeH / 2;
        }
    }

    /**
     * Builds a map of occupied anchors per node from existing edges in the canvas.
     */
    private Map<String, Set<String>> buildOccupiedAnchors(ArrayNode canvasArray) {
        Map<String, Set<String>> occupied = new HashMap<>();
        for (JsonNode item : canvasArray) {
            String type = item.path("type").asText("");
            if (!"arrow".equals(type) && !"line".equals(type)) continue;

            String startNodeId = item.path("startConnection").path("nodeId").asText("");
            String startAnchor = item.path("startConnection").path("anchor").asText("");
            String endNodeId = item.path("endConnection").path("nodeId").asText("");
            String endAnchor = item.path("endConnection").path("anchor").asText("");

            if (!startNodeId.isEmpty() && !startAnchor.isEmpty() && !startAnchor.equals("closest")) {
                occupied.computeIfAbsent(startNodeId, k -> new HashSet<>()).add(startAnchor);
            }
            if (!endNodeId.isEmpty() && !endAnchor.isEmpty() && !endAnchor.equals("closest")) {
                occupied.computeIfAbsent(endNodeId, k -> new HashSet<>()).add(endAnchor);
            }
        }
        return occupied;
    }

    /**
     * Selects the best (sourceAnchor, targetAnchor) pair based on angle and occupied anchors.
     * Prefers perpendicular pairs (for clean L-shape routing) and avoids reusing occupied sides.
     */
    private String[] selectSmartAnchors(double srcCX, double srcCY, double tgtCX, double tgtCY,
                                         Set<String> srcOccupied, Set<String> tgtOccupied) {
        double dx = tgtCX - srcCX;
        double dy = tgtCY - srcCY;
        double angleToTarget = Math.atan2(dy, dx);
        double angleFromTarget = normalizeAngle(angleToTarget + Math.PI);

        String[] allAnchors = {"right", "bottom", "left", "top"};
        double[] anchorAngles = {0, Math.PI / 2, Math.PI, -Math.PI / 2};

        double bestScore = Double.MAX_VALUE;
        String bestSrc = "bottom";
        String bestTgt = "top";

        for (int i = 0; i < 4; i++) {
            for (int j = 0; j < 4; j++) {
                String srcA = allAnchors[i];
                String tgtA = allAnchors[j];

                // Heavy penalty for occupied anchors (but don't skip — allow reuse as last resort)
                double occupiedPenalty = 0;
                if (srcOccupied.contains(srcA)) occupiedPenalty += 0.4;
                if (tgtOccupied.contains(tgtA)) occupiedPenalty += 0.4;

                // Angular distance: how well does srcA face the target?
                double srcDist = Math.abs(normalizeAngle(angleToTarget - anchorAngles[i]));
                // Angular distance: how well does tgtA face the source?
                double tgtDist = Math.abs(normalizeAngle(angleFromTarget - anchorAngles[j]));

                // Bonus for perpendicular pairs (L-shape routing)
                boolean srcHoriz = srcA.equals("left") || srcA.equals("right");
                boolean tgtHoriz = tgtA.equals("left") || tgtA.equals("right");
                double perpendicularBonus = (srcHoriz != tgtHoriz) ? -0.3 : 0;

                double totalScore = srcDist + tgtDist + perpendicularBonus + occupiedPenalty;

                if (totalScore < bestScore) {
                    bestScore = totalScore;
                    bestSrc = srcA;
                    bestTgt = tgtA;
                }
            }
        }

        return new String[]{bestSrc, bestTgt};
    }

    /**
     * Normalizes an angle to the range [-π, π].
     */
    private double normalizeAngle(double angle) {
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
    }

    /**
     * Post-processing pass: when multiple edges share the same (nodeId, anchor side),
     * spread their connection points evenly along that side instead of all hitting center.
     */
    private ArrayNode spreadOverlappingAnchors(ArrayNode canvasArray) {
        // Group edges by (nodeId, anchor). Value: list of [edgeIndex, 0=startPoint / 1=endPoint]
        Map<String, List<int[]>> groups = new HashMap<>();

        for (int i = 0; i < canvasArray.size(); i++) {
            JsonNode item = canvasArray.get(i);
            String type = item.path("type").asText("");
            if (!"arrow".equals(type) && !"line".equals(type)) continue;

            String startNodeId = item.path("startConnection").path("nodeId").asText("");
            String startAnchor = item.path("startConnection").path("anchor").asText("");
            String endNodeId = item.path("endConnection").path("nodeId").asText("");
            String endAnchor = item.path("endConnection").path("anchor").asText("");

            if (!startNodeId.isEmpty() && !startAnchor.isEmpty() && !startAnchor.equals("closest")) {
                groups.computeIfAbsent(startNodeId + ":" + startAnchor, k -> new ArrayList<>())
                      .add(new int[]{i, 0});
            }
            if (!endNodeId.isEmpty() && !endAnchor.isEmpty() && !endAnchor.equals("closest")) {
                groups.computeIfAbsent(endNodeId + ":" + endAnchor, k -> new ArrayList<>())
                      .add(new int[]{i, 1});
            }
        }

        // Spread groups with more than 1 edge
        for (Map.Entry<String, List<int[]>> entry : groups.entrySet()) {
            List<int[]> edgeRefs = entry.getValue();
            if (edgeRefs.size() <= 1) continue;

            String[] parts = entry.getKey().split(":");
            String nodeId = parts[0];
            String anchor = parts[1];

            JsonNode node = findNode(canvasArray, nodeId);
            if (node == null) continue;

            double nodeX = node.path("position").path("x").asDouble(0);
            double nodeY = node.path("position").path("y").asDouble(0);
            double nodeW = node.path("dimensions").path("width").asDouble(160);
            double nodeH = node.path("dimensions").path("height").asDouble(60);

            double centerX = nodeX + nodeW / 2.0;
            double centerY = nodeY + nodeH / 2.0;
            double gap = 20.0;

            int n = edgeRefs.size();
            double startOffset = -(n - 1) * gap / 2.0;

            for (int idx = 0; idx < n; idx++) {
                int edgeIdx = edgeRefs.get(idx)[0];
                int pointType = edgeRefs.get(idx)[1]; // 0=start, 1=end
                ObjectNode edge = (ObjectNode) canvasArray.get(edgeIdx);

                double offset = startOffset + idx * gap;
                double newX, newY;

                switch (anchor) {
                    case "top":
                        newX = centerX + offset;
                        newY = nodeY;
                        break;
                    case "bottom":
                        newX = centerX + offset;
                        newY = nodeY + nodeH;
                        break;
                    case "left":
                        newX = nodeX;
                        newY = centerY + offset;
                        break;
                    case "right":
                        newX = nodeX + nodeW;
                        newY = centerY + offset;
                        break;
                    default:
                        continue;
                }

                String pointField = (pointType == 0) ? "startPoint" : "endPoint";
                ObjectNode point = objectMapper.createObjectNode();
                point.put("x", newX);
                point.put("y", newY);
                edge.set(pointField, point);

                // Recalculate bounding box
                double sx = edge.path("startPoint").path("x").asDouble();
                double sy = edge.path("startPoint").path("y").asDouble();
                double ex = edge.path("endPoint").path("x").asDouble();
                double ey = edge.path("endPoint").path("y").asDouble();

                ObjectNode pos = objectMapper.createObjectNode();
                pos.put("x", Math.min(sx, ex));
                pos.put("y", Math.min(sy, ey));
                edge.set("position", pos);

                ObjectNode dim = objectMapper.createObjectNode();
                dim.put("width", Math.max(15, Math.abs(ex - sx)));
                dim.put("height", Math.max(15, Math.abs(ey - sy)));
                edge.set("dimensions", dim);
            }
        }

        return canvasArray;
    }

    /**
     * Gracefully maps LLM hallucinated node types to correct frontend types.
     */
    public static String mapNodeTypeAlias(String type) {
        if (type == null) return "box";
        switch (type.toLowerCase().trim()) {
            case "rhombus":
            case "decision":
            case "condition":
                return "diamond";
            case "capsule":
            case "ellipse":
            case "oval":
            case "start":
            case "end":
                return "pill";
            case "rectangle":
            case "action":
            case "process":
                return "box";
            case "database":
            case "db":
                return "database";
            case "document":
            case "doc":
                return "document";
            default:
                return type;
        }
    }

    /**
     * Helper to clean markdown JSON blocks.
     */
    private static String extractJson(String text) {
        if (text == null) return "[]";
        text = text.trim();
        if (text.startsWith("```json")) {
            text = text.substring(7);
        } else if (text.startsWith("```")) {
            text = text.substring(3);
        }
        if (text.endsWith("```")) {
            text = text.substring(0, text.length() - 3);
        }
        return text.trim();
    }

    /**
     * Processes a direct JSON array string (from 2-step AI) and applies smart resizing to all nodes.
     */
    public static String applyDynamicSizingToCanvas(String jsonTree) {
        try {
            jsonTree = extractJson(jsonTree);
            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(jsonTree);
            if (!root.isArray()) return jsonTree;

            ArrayNode canvasArray = (ArrayNode) root;
            for (JsonNode n : canvasArray) {
                if (!n.isObject()) continue;
                ObjectNode node = (ObjectNode) n;
                String type = node.path("type").asText("box");
                if (type.equals("arrow") || type.equals("line")) continue;

                // Fix hallucinated types
                type = mapNodeTypeAlias(type);
                node.put("type", type);

                String content = node.path("content").asText("");
                double w = 220;
                double h = 90;
                if (node.has("dimensions")) {
                    w = node.path("dimensions").path("width").asDouble(220);
                    h = node.path("dimensions").path("height").asDouble(90);
                }

                double baseWidth = 160;
                double baseHeight = 60;
                if (type.equals("pill") || type.equals("terminator") || type.equals("rectangle")) {
                    baseWidth = 130;
                    baseHeight = 50;
                } else if (type.equals("diamond")) {
                    baseWidth = 160;
                    baseHeight = 80;
                }

                int charCount = content.length();
                double calcWidth = Math.max(baseWidth, Math.min(280, charCount * 8.0 + 40));
                int lines = (int) Math.ceil((charCount * 8.0) / Math.max(1, calcWidth - 40));
                if (lines == 0) lines = 1;
                double calcHeight = Math.max(baseHeight, lines * 20.0 + 40);

                if ((w == 160 && h == 60) || (w == 220 && h == 90) || (w == 150 && h == 60) || (w == 130 && h == 50) || (w == 160 && h == 80) || (w == 200 && h == 80)) {
                    w = calcWidth;
                    h = calcHeight;
                }

                ObjectNode dimensions = mapper.createObjectNode();
                dimensions.put("width", w);
                dimensions.put("height", h);
                node.set("dimensions", dimensions);
            }
            return mapper.writeValueAsString(canvasArray);
        } catch (Exception e) {
            return jsonTree;
        }
    }
}
