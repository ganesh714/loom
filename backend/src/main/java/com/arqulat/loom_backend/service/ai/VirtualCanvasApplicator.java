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
        Map<String, String> newIdMap = new HashMap<>(); // $$NEW_0$$ -> actual UUID
        int newCounter = 0;

        // Track how many connections each (nodeId, anchor-side) has, for inline offset calculation
        // Key: "nodeId:anchor" -> count of connections already placed on that side
        Map<String, Integer> anchorCounts = buildAnchorCounts(canvasArray);
        
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
                            baseHeight = 40;
                        } else if (nodeType.equals("diamond")) {
                            baseWidth = 160;
                            baseHeight = 80;
                        }
                        
                        int charCount = content.length();
                        double calcWidth = Math.max(baseWidth, Math.min(280, charCount * 8.0 + 40));
                        int lines = (int) Math.ceil((charCount * 8.0) / Math.max(1, calcWidth - 40));
                        if (lines == 0) lines = 1;
                        double paddingVert = baseHeight - 20.0; // Dynamic padding based on baseHeight (assumes 20px per line)
                        double calcHeight = Math.max(baseHeight, lines * 20.0 + paddingVert);
                        
                        double w = args.has("width") ? args.path("width").asDouble() : calcWidth;
                        double h = args.has("height") ? args.path("height").asDouble() : calcHeight;
                        
                        // If LLM blindly used default sizes, override with our smart calc
                        if ((w == 160 && h == 60) || (w == 220 && h == 90) || (w == 150 && h == 60) || (w == 130 && h == 50) || (w == 130 && h == 40) || (w == 160 && h == 80) || (w == 200 && h == 80)) {
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

                        // Deduplicate: skip if this exact edge (or its reverse) already exists
                        String edgeFwd = sourceId + "->" + targetNodeId;
                        String edgeRev = targetNodeId + "->" + sourceId;
                        if (seenEdges.contains(edgeFwd) || seenEdges.contains(edgeRev)) {
                            logger.info("Skipping duplicate/reverse edge: {}", edgeFwd);
                            break;
                        }
                        seenEdges.add(edgeFwd);

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
                            Set<String> srcOccupied = getOccupiedSides(anchorCounts, sourceId);
                            Set<String> tgtOccupied = getOccupiedSides(anchorCounts, targetNodeId);
                            String[] bestAnchors = selectSmartAnchors(
                                srcCenterX, srcCenterY, tgtCenterX, tgtCenterY,
                                srcOccupied, tgtOccupied
                            );
                            if (sourceAnchor.equals("closest")) sourceAnchor = bestAnchors[0];
                            if (targetAnchor.equals("closest")) targetAnchor = bestAnchors[1];
                        }

                        // Get current count for this (node, side) BEFORE incrementing — this is our slot index
                        String srcKey = sourceId + ":" + sourceAnchor;
                        String tgtKey = targetNodeId + ":" + targetAnchor;
                        int srcSlot = anchorCounts.getOrDefault(srcKey, 0);
                        int tgtSlot = anchorCounts.getOrDefault(tgtKey, 0);
                        // Increment counts for subsequent connections
                        anchorCounts.put(srcKey, srcSlot + 1);
                        anchorCounts.put(tgtKey, tgtSlot + 1);

                        // Calculate actual start and end points with inline offset
                        double startPtX = getAnchorX(srcX, srcW, sourceAnchor, srcSlot);
                        double startPtY = getAnchorY(srcY, srcH, sourceAnchor, srcSlot);
                        double endPtX = getAnchorX(tgtX, tgtW, targetAnchor, tgtSlot);
                        double endPtY = getAnchorY(tgtY, tgtH, targetAnchor, tgtSlot);

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

                        String[] edgeColors = { "#1976D2", "#388E3C", "#D32F2F", "#FBC02D", "#8E24AA", "#F57C00", "#0097A7", "#455A64" };
                        String randomColor = edgeColors[new java.util.Random().nextInt(edgeColors.length)];
                        ObjectNode styleNode = objectMapper.createObjectNode();
                        styleNode.put("borderColor", randomColor);
                        edge.set("style", styleNode);

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

        // Spreading disabled — overlapping lines at center look cleaner than barcode-spread parallel lines
        // canvasArray = spreadOverlappingAnchors(canvasArray);

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

    private static final double ANCHOR_GAP = 20.0; // pixels between connection points on the same side

    /**
     * Calculates the X position of an anchor point on a node, with slot-based offset.
     * Slot 0 = center, slot 1 = center+gap, slot 2 = center-gap, slot 3 = center+2*gap, etc.
     */
    private double getAnchorX(double nodeX, double nodeW, String anchor, int slot) {
        switch (anchor) {
            case "left": return nodeX;
            case "right": return nodeX + nodeW;
            case "top":
            case "bottom":
            default: {
                double center = nodeX + nodeW / 2;
                double offset = getSlotOffset(slot);
                return center + offset;
            }
        }
    }

    /**
     * Calculates the Y position of an anchor point on a node, with slot-based offset.
     */
    private double getAnchorY(double nodeY, double nodeH, String anchor, int slot) {
        switch (anchor) {
            case "top": return nodeY;
            case "bottom": return nodeY + nodeH;
            case "left":
            case "right":
            default: {
                double center = nodeY + nodeH / 2;
                double offset = getSlotOffset(slot);
                return center + offset;
            }
        }
    }

    /**
     * Converts a slot index to a pixel offset from center.
     * Slot 0 = 0 (center), slot 1 = +gap, slot 2 = -gap, slot 3 = +2*gap, slot 4 = -2*gap, ...
     * This zigzag pattern spreads connections evenly around the center.
     */
    private double getSlotOffset(int slot) {
        if (slot == 0) return 0;
        int level = (slot + 1) / 2; // 1,1,2,2,3,3,...
        int sign = (slot % 2 == 1) ? 1 : -1; // +,-,+,-,...
        return sign * level * ANCHOR_GAP;
    }

    /**
     * Builds a count of connections per (nodeId, anchor-side) from existing edges.
     */
    private Map<String, Integer> buildAnchorCounts(ArrayNode canvasArray) {
        Map<String, Integer> counts = new HashMap<>();
        for (JsonNode item : canvasArray) {
            String type = item.path("type").asText("");
            if (!"arrow".equals(type) && !"line".equals(type)) continue;

            String startNodeId = item.path("startConnection").path("nodeId").asText("");
            String startAnchor = item.path("startConnection").path("anchor").asText("");
            String endNodeId = item.path("endConnection").path("nodeId").asText("");
            String endAnchor = item.path("endConnection").path("anchor").asText("");

            if (!startNodeId.isEmpty() && !startAnchor.isEmpty() && !startAnchor.equals("closest")) {
                String key = startNodeId + ":" + startAnchor;
                counts.put(key, counts.getOrDefault(key, 0) + 1);
            }
            if (!endNodeId.isEmpty() && !endAnchor.isEmpty() && !endAnchor.equals("closest")) {
                String key = endNodeId + ":" + endAnchor;
                counts.put(key, counts.getOrDefault(key, 0) + 1);
            }
        }
        return counts;
    }

    /**
     * Extracts which anchor sides are occupied for a given nodeId (for smart anchor selection).
     */
    private Set<String> getOccupiedSides(Map<String, Integer> anchorCounts, String nodeId) {
        Set<String> sides = new HashSet<>();
        for (String anchor : new String[]{"top", "bottom", "left", "right"}) {
            if (anchorCounts.getOrDefault(nodeId + ":" + anchor, 0) > 0) {
                sides.add(anchor);
            }
        }
        return sides;
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
     * Helper for symmetric spread: gets the fixed X coordinate for an anchor, applying dx if it spreads along X.
     */
    private double getAnchorX(JsonNode node, String anchor, double dx) {
        double x = node.path("position").path("x").asDouble(0);
        double w = node.path("dimensions").path("width").asDouble(160);
        switch (anchor) {
            case "left": return x;
            case "right": return x + w;
            case "top":
            case "bottom":
            default: return x + w / 2.0 + dx;
        }
    }

    /**
     * Helper for symmetric spread: gets the fixed Y coordinate for an anchor, applying dy if it spreads along Y.
     */
    private double getAnchorY(JsonNode node, String anchor, double dy) {
        double y = node.path("position").path("y").asDouble(0);
        double h = node.path("dimensions").path("height").asDouble(60);
        switch (anchor) {
            case "top": return y;
            case "bottom": return y + h;
            case "left":
            case "right":
            default: return y + h / 2.0 + dy;
        }
    }

    /**
     * Post-processing pass: when multiple edges share the same (nodeId, anchor side),
     * spread their connection points evenly. By calculating a dominant dx/dy and applying it
     * symmetrically, we prevent orthogonal routers from drawing jagged steps.
     */
    private ArrayNode spreadOverlappingAnchors(ArrayNode canvasArray) {
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

        Map<Integer, Double> edgeDx = new HashMap<>();
        Map<Integer, Double> edgeDy = new HashMap<>();
        Map<Integer, Integer> edgeDxGroupSize = new HashMap<>();
        Map<Integer, Integer> edgeDyGroupSize = new HashMap<>();

        for (Map.Entry<String, List<int[]>> entry : groups.entrySet()) {
            List<int[]> edgeRefs = entry.getValue();
            int n = edgeRefs.size();
            if (n <= 1) continue;

            String anchor = entry.getKey().split(":")[1];
            double gap = 20.0;
            double startOffset = -(n - 1) * gap / 2.0;

            for (int idx = 0; idx < n; idx++) {
                int edgeIdx = edgeRefs.get(idx)[0];
                double offset = startOffset + idx * gap;

                if (anchor.equals("top") || anchor.equals("bottom")) {
                    if (n > edgeDxGroupSize.getOrDefault(edgeIdx, 0)) {
                        edgeDx.put(edgeIdx, offset);
                        edgeDxGroupSize.put(edgeIdx, n);
                    }
                } else {
                    if (n > edgeDyGroupSize.getOrDefault(edgeIdx, 0)) {
                        edgeDy.put(edgeIdx, offset);
                        edgeDyGroupSize.put(edgeIdx, n);
                    }
                }
            }
        }

        for (int i = 0; i < canvasArray.size(); i++) {
            JsonNode item = canvasArray.get(i);
            if (!"arrow".equals(item.path("type").asText()) && !"line".equals(item.path("type").asText())) continue;

            ObjectNode edge = (ObjectNode) item;
            String startAnchor = edge.path("startConnection").path("anchor").asText("");
            String endAnchor = edge.path("endConnection").path("anchor").asText("");

            String startNodeId = edge.path("startConnection").path("nodeId").asText("");
            String endNodeId = edge.path("endConnection").path("nodeId").asText("");

            JsonNode startNode = findNode(canvasArray, startNodeId);
            JsonNode endNode = findNode(canvasArray, endNodeId);
            if (startNode == null || endNode == null) continue;

            double dx = edgeDx.getOrDefault(i, 0.0);
            double dy = edgeDy.getOrDefault(i, 0.0);

            ObjectNode startPt = objectMapper.createObjectNode();
            startPt.put("x", getAnchorX(startNode, startAnchor, dx));
            startPt.put("y", getAnchorY(startNode, startAnchor, dy));
            edge.set("startPoint", startPt);

            ObjectNode endPt = objectMapper.createObjectNode();
            endPt.put("x", getAnchorX(endNode, endAnchor, dx));
            endPt.put("y", getAnchorY(endNode, endAnchor, dy));
            edge.set("endPoint", endPt);

            double sx = startPt.path("x").asDouble();
            double sy = startPt.path("y").asDouble();
            double ex = endPt.path("x").asDouble();
            double ey = endPt.path("y").asDouble();

            ObjectNode pos = objectMapper.createObjectNode();
            pos.put("x", Math.min(sx, ex));
            pos.put("y", Math.min(sy, ey));
            edge.set("position", pos);

            ObjectNode dim = objectMapper.createObjectNode();
            dim.put("width", Math.max(15, Math.abs(ex - sx)));
            dim.put("height", Math.max(15, Math.abs(ey - sy)));
            edge.set("dimensions", dim);
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
                    baseHeight = 40;
                } else if (type.equals("diamond")) {
                    baseWidth = 160;
                    baseHeight = 80;
                }
                
                int charCount = content.length();
                double calcWidth = Math.max(baseWidth, Math.min(280, charCount * 8.0 + 40));
                int lines = (int) Math.ceil((charCount * 8.0) / Math.max(1, calcWidth - 40));
                if (lines == 0) lines = 1;
                double paddingVert = baseHeight - 20.0;
                double calcHeight = Math.max(baseHeight, lines * 20.0 + paddingVert);
                
                if ((w == 160 && h == 60) || (w == 220 && h == 90) || (w == 150 && h == 60) || (w == 130 && h == 50) || (w == 130 && h == 40) || (w == 160 && h == 80) || (w == 200 && h == 80)) {
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
