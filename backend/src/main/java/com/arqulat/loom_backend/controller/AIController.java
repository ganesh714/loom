package com.arqulat.loom_backend.controller;

import com.arqulat.loom_backend.dto.AIGenerateRequest;
import com.arqulat.loom_backend.dto.AIGenerateResponse;
import com.arqulat.loom_backend.dto.AIEditRequest;
import com.arqulat.loom_backend.dto.AIAgentRequest;
import com.arqulat.loom_backend.service.AIService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/ai")
public class AIController {

    private static final Logger logger = LoggerFactory.getLogger(AIController.class);
    private final AIService aiService;
    private final ObjectMapper objectMapper;

    public AIController(AIService aiService, ObjectMapper objectMapper) {
        this.aiService = aiService;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/generate")
    public ResponseEntity<?> generate(@RequestBody AIGenerateRequest request) {
        try {
            if (request.getPrompt() == null || request.getPrompt().trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Prompt cannot be empty");
            }
            
            String jsonTree = aiService.generateDiagramNodes(request.getPrompt(), request.getImageBase64());
            
            AIGenerateResponse response = new AIGenerateResponse(jsonTree, "Fallback-Ring-Resolved");
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to generate AI visual: " + e.getMessage());
        }
    }

    @PostMapping("/edit")
    public ResponseEntity<?> edit(@RequestBody AIEditRequest request) {
        try {
            if (request.getPrompt() == null || request.getPrompt().trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Prompt cannot be empty");
            }
            if (request.getContextNodes() == null) {
                return ResponseEntity.badRequest().body("Context nodes cannot be null");
            }
            
            String contextNodesJson = objectMapper.writeValueAsString(request.getContextNodes());
            String jsonTree = aiService.editDiagramNodes(request.getPrompt(), contextNodesJson, request.getImageBase64());
            
            AIGenerateResponse response = new AIGenerateResponse(jsonTree, "Fallback-Ring-Resolved");
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to edit AI visual: " + e.getMessage());
        }
    }

    /**
     * Agent endpoint — returns SSE stream for live progress updates.
     * The 3-pass agent loop runs asynchronously on the backend and
     * streams progress/step/done/error events to the frontend.
     */
    @PostMapping(value = "/agent", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter agent(@RequestBody AIAgentRequest request) {
        // 10 minute timeout for agent runs (rate limiting can cause delays)
        SseEmitter emitter = new SseEmitter(600_000L);

        if (request.getPrompt() == null || request.getPrompt().trim().isEmpty()) {
            try {
                emitter.send(SseEmitter.event().name("error").data("{\"type\":\"error\",\"message\":\"Prompt cannot be empty\"}"));
                emitter.complete();
            } catch (Exception ignored) {}
            return emitter;
        }

        String contextNodes = request.getContextNodes() != null ? request.getContextNodes() : "[]";

        // Run the orchestration asynchronously
        new Thread(() -> {
            try {
                aiService.agentOrchestrate(request.getPrompt(), contextNodes, emitter);
            } catch (Exception e) {
                logger.error("[Agent Controller] Orchestration failed: {}", e.getMessage(), e);
                try {
                    emitter.send(SseEmitter.event().name("error")
                            .data("{\"type\":\"error\",\"message\":\"" + e.getMessage().replace("\"", "'") + "\"}"));
                    emitter.completeWithError(e);
                } catch (Exception ignored) {}
            }
        }, "agent-orchestrator").start();

        emitter.onCompletion(() -> logger.info("[Agent Controller] SSE connection completed"));
        emitter.onTimeout(() -> logger.warn("[Agent Controller] SSE connection timed out"));
        emitter.onError(e -> logger.error("[Agent Controller] SSE connection error: {}", e.getMessage()));

        return emitter;
    }
}
