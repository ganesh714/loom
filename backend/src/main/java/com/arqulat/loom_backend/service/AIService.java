package com.arqulat.loom_backend.service;

import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

public interface AIService {
    /**
     * Generates a JSON tree of diagram nodes based on the prompt.
     * @param prompt The user's input prompt.
     * @param imageBase64 Optional base64 encoded image to provide as context.
     * @return A JSON string representing the generated nodes.
     * @throws Exception if generation fails across all fallback providers.
     */
    String generateDiagramNodes(String prompt, String imageBase64) throws Exception;

    /**
     * Edits the existing diagram nodes based on the prompt and context.
     * @param prompt The user's edit instruction.
     * @param contextNodes The current nodes in JSON format.
     * @param imageBase64 Optional base64 encoded image.
     * @return A JSON string representing the updated nodes.
     * @throws Exception if generation fails.
     */
    String editDiagramNodes(String prompt, String contextNodes, String imageBase64) throws Exception;

    /**
     * Orchestrates the full 3-pass agent flow with SSE streaming.
     * Pass 1: Semantic understanding (entities, relationships, groups)
     * Pass 2: Layout strategy (visual structure, spacing, colors)
     * Pass 3: Execution loop (tool calls applied batch by batch)
     *
     * @param prompt The user's prompt.
     * @param contextNodes The current canvas state as JSON.
     * @param emitter SSE emitter for streaming progress events to the frontend.
     * @throws Exception if the orchestration fails.
     */
    void agentOrchestrate(String prompt, String contextNodes, SseEmitter emitter) throws Exception;
}
