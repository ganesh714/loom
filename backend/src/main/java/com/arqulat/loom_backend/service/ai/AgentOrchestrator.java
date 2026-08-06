package com.arqulat.loom_backend.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.HashMap;
import java.util.Map;

/**
 * Core orchestrator for the 3-pass AI Agent architecture.
 *
 * Pass 1 (Semantic):  LLM analyzes entities, relationships, groups — free-form thinking
 * Pass 2 (Layout):    LLM picks visual structure (flowchart, hierarchy, etc.) — guided choice
 * Pass 3 (Execute):   LLM emits tool calls in a loop — constrained output
 *
 * The loop runs on the backend. Each step's result is streamed to the frontend via SSE
 * so the user sees live canvas updates.
 */
@Service
public class AgentOrchestrator {

    private static final Logger logger = LoggerFactory.getLogger(AgentOrchestrator.class);
    private static final int MAX_STEPS = 7;

    private final VirtualCanvasApplicator canvasApplicator;
    private final ObjectMapper objectMapper;

    public AgentOrchestrator(VirtualCanvasApplicator canvasApplicator, ObjectMapper objectMapper) {
        this.canvasApplicator = canvasApplicator;
        this.objectMapper = objectMapper;
    }

    /**
     * Runs the full 3-pass orchestration loop.
     *
     * @param prompt         The user's original prompt
     * @param contextNodes   The current canvas state as JSON string
     * @param fallbackRing   The AIFallbackRingManager that handles provider fallback
     * @param emitter        SSE emitter for streaming progress events
     */
    public void orchestrate(String prompt, String contextNodes, AIFallbackRingManager fallbackRing, SseEmitter emitter) {
        try {
            // ─── PASS 1: Semantic Understanding ───
            sendProgress(emitter, "planning", "semantic", "Analyzing entities and relationships...");
            logger.info("[Agent Orchestrator] Starting Pass 1 — Semantic Analysis");

            String semanticResult;
            try {
                semanticResult = fallbackRing.agentSemanticPass(prompt);
                logger.info("[Agent Orchestrator] Pass 1 complete. Semantic blueprint: {}", 
                        semanticResult.substring(0, Math.min(200, semanticResult.length())));
                sendPlan(emitter, "semantic", semanticResult);
            } catch (Exception e) {
                logger.error("[Agent Orchestrator] Pass 1 failed: {}", e.getMessage());
                sendError(emitter, "Failed to analyze diagram structure: " + e.getMessage(), contextNodes);
                return;
            }

            // ─── PASS 2: Layout Strategy ───
            sendProgress(emitter, "planning", "layout", "Choosing layout structure...");
            logger.info("[Agent Orchestrator] Starting Pass 2 — Layout Strategy");

            String layoutResult;
            try {
                layoutResult = fallbackRing.agentLayoutPass(semanticResult, prompt);
                logger.info("[Agent Orchestrator] Pass 2 complete. Layout plan: {}",
                        layoutResult.substring(0, Math.min(200, layoutResult.length())));
                sendPlan(emitter, "layout", layoutResult);
            } catch (Exception e) {
                logger.error("[Agent Orchestrator] Pass 2 failed: {}", e.getMessage());
                sendError(emitter, "Failed to plan layout: " + e.getMessage(), contextNodes);
                return;
            }

            // ─── PASS 3: Execution Loop ───
            logger.info("[Agent Orchestrator] Starting Pass 3 — Execution Loop (max {} steps)", MAX_STEPS);
            String currentCanvas = contextNodes;
            int totalToolCallsApplied = 0;

            for (int step = 1; step <= MAX_STEPS; step++) {
                // Delay between steps to avoid rate limiting (skip delay for first step)
                if (step > 1) {
                    logger.info("[Agent Orchestrator] Waiting 3s before step {} to avoid rate limits...", step);
                    try { Thread.sleep(3000); } catch (InterruptedException ignored) {}
                }

                sendProgress(emitter, "executing", "step_" + step, "Building step " + step + " of " + MAX_STEPS + "...");
                logger.info("[Agent Orchestrator] Executing step {}/{}", step, MAX_STEPS);

                String stepResult;
                try {
                    stepResult = fallbackRing.agentExecuteStep(semanticResult, layoutResult, currentCanvas, step);
                } catch (Exception e) {
                    logger.error("[Agent Orchestrator] Step {} failed: {}", step, e.getMessage());
                    // Don't fail the whole run — return whatever we have so far
                    sendDone(emitter, currentCanvas, step - 1, "Completed " + (step - 1) + " steps. Step " + step + " failed: " + e.getMessage());
                    return;
                }

                // Parse the step result
                try {
                    JsonNode stepJson = objectMapper.readTree(stepResult);
                    String explanation = stepJson.path("explanation").asText("Step " + step);
                    boolean isDone = stepJson.path("isDone").asBoolean(false);
                    JsonNode toolCalls = stepJson.path("toolCalls");

                    if (toolCalls.isArray() && !toolCalls.isEmpty()) {
                        // Apply tool calls to virtual canvas
                        currentCanvas = canvasApplicator.applyToolCalls(toolCalls, currentCanvas);
                        totalToolCallsApplied += toolCalls.size();

                        logger.info("[Agent Orchestrator] Step {} applied {} tool calls. Total: {}. Explanation: {}",
                                step, toolCalls.size(), totalToolCallsApplied, explanation);

                        // Send step event to frontend with current canvas preview
                        sendStep(emitter, step, MAX_STEPS, explanation, toolCalls.size(), currentCanvas);
                    } else {
                        logger.info("[Agent Orchestrator] Step {} returned no tool calls. Treating as done.", step);
                        isDone = true;
                    }

                    if (isDone) {
                        logger.info("[Agent Orchestrator] LLM signaled isDone=true at step {}. Total tool calls: {}", step, totalToolCallsApplied);
                        sendDone(emitter, currentCanvas, step, "Built diagram with " + totalToolCallsApplied + " operations in " + step + " steps.");
                        return;
                    }

                } catch (Exception e) {
                    logger.error("[Agent Orchestrator] Failed to parse step {} result: {}. Raw: {}", step, e.getMessage(),
                            stepResult.substring(0, Math.min(200, stepResult.length())));
                    // Try to continue with what we have
                    sendDone(emitter, currentCanvas, step, "Partially completed. Parse error at step " + step + ": " + e.getMessage());
                    return;
                }
            }

            // Max steps reached
            logger.info("[Agent Orchestrator] Max steps ({}) reached. Total tool calls: {}", MAX_STEPS, totalToolCallsApplied);
            sendDone(emitter, currentCanvas, MAX_STEPS, "Completed max " + MAX_STEPS + " steps with " + totalToolCallsApplied + " operations.");

        } catch (Exception e) {
            logger.error("[Agent Orchestrator] Unexpected error: {}", e.getMessage(), e);
            try {
                sendError(emitter, "Unexpected error: " + e.getMessage(), contextNodes);
            } catch (Exception ignored) {}
        }
    }

    // ─── SSE Event Helpers ───

    private void sendProgress(SseEmitter emitter, String phase, String step, String message) {
        try {
            Map<String, Object> data = new HashMap<>();
            data.put("type", "progress");
            data.put("phase", phase);
            data.put("step", step);
            data.put("message", message);
            emitter.send(SseEmitter.event().name("progress").data(objectMapper.writeValueAsString(data)));
        } catch (Exception e) {
            logger.warn("Failed to send SSE progress event: {}", e.getMessage());
        }
    }

    private void sendPlan(SseEmitter emitter, String type, String result) {
        try {
            Map<String, Object> data = new HashMap<>();
            data.put("type", "plan");
            data.put("planType", type); // 'semantic' or 'layout'
            data.put("result", result);
            emitter.send(SseEmitter.event().name("plan").data(objectMapper.writeValueAsString(data)));
        } catch (Exception e) {
            logger.warn("Failed to send SSE plan event: {}", e.getMessage());
        }
    }

    private void sendStep(SseEmitter emitter, int step, int maxSteps, String explanation, int toolCallCount, String currentCanvas) {
        try {
            Map<String, Object> data = new HashMap<>();
            data.put("type", "step");
            data.put("phase", "executing");
            data.put("step", step);
            data.put("maxSteps", maxSteps);
            data.put("explanation", explanation);
            data.put("toolCallsApplied", toolCallCount);
            data.put("currentCanvas", objectMapper.readTree(currentCanvas));
            emitter.send(SseEmitter.event().name("step").data(objectMapper.writeValueAsString(data)));
        } catch (Exception e) {
            logger.warn("Failed to send SSE step event: {}", e.getMessage());
        }
    }

    private void sendDone(SseEmitter emitter, String finalCanvas, int totalSteps, String summary) {
        try {
            Map<String, Object> data = new HashMap<>();
            data.put("type", "done");
            data.put("finalNodes", objectMapper.readTree(finalCanvas));
            data.put("totalSteps", totalSteps);
            data.put("summary", summary);
            emitter.send(SseEmitter.event().name("done").data(objectMapper.writeValueAsString(data)));
            emitter.complete();
        } catch (Exception e) {
            logger.warn("Failed to send SSE done event: {}", e.getMessage());
        }
    }

    private void sendError(SseEmitter emitter, String message, String partialCanvas) {
        try {
            Map<String, Object> data = new HashMap<>();
            data.put("type", "error");
            data.put("message", message);
            if (partialCanvas != null && !partialCanvas.isBlank()) {
                data.put("partialCanvas", objectMapper.readTree(partialCanvas));
            }
            emitter.send(SseEmitter.event().name("error").data(objectMapper.writeValueAsString(data)));
            emitter.completeWithError(new RuntimeException(message));
        } catch (Exception e) {
            logger.warn("Failed to send SSE error event: {}", e.getMessage());
        }
    }
}
