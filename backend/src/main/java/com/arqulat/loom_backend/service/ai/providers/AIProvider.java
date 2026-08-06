package com.arqulat.loom_backend.service.ai.providers;

public interface AIProvider {
    /**
     * Attempts to generate a JSON response for the given prompt using the specific AI provider.
     * @param prompt The user's input prompt.
     * @param systemPrompt The system instructions.
     * @return The JSON string of nodes or raw text.
     * @throws Exception if this provider fails to generate or returns invalid data.
     */
    String generate(String prompt, String systemPrompt, String imageBase64) throws Exception;

    /**
     * Edits an existing JSON structure based on a prompt.
     * @param prompt The edit request.
     * @param contextNodes The existing JSON elements.
     * @param imageBase64 Optional base64 encoded image to provide as context.
     * @return The updated JSON string.
     * @throws Exception if generation fails.
     */
    String edit(String prompt, String contextNodes, String imageBase64) throws Exception;

    /**
     * Executes an agent turn with function calling (strict JSON output).
     * Used for Pass 3 of the agent loop where output must be tool calls.
     * @param prompt The user prompt
     * @param systemPrompt The system prompt
     * @param contextNodes The canvas context
     * @return The JSON string of tool calls
     * @throws Exception if generation fails
     */
    String agentCall(String prompt, String systemPrompt, String contextNodes) throws Exception;

    /**
     * Free-form agent call — no JSON schema enforcement.
     * Used for Pass 1 (semantic) and Pass 2 (layout) where the LLM should
     * think freely in natural language and output a <RESULT>...</RESULT> block.
     * Works on medium-tier models because there's no schema constraint.
     *
     * @param prompt The user prompt with context
     * @param systemPrompt The system instructions
     * @return Raw text response (caller extracts <RESULT> block)
     * @throws Exception if generation fails
     */
    String agentFreeCall(String prompt, String systemPrompt) throws Exception;

    /**
     * @return The name of this provider for logging/response tracking.
     */
    String getProviderName();
}
