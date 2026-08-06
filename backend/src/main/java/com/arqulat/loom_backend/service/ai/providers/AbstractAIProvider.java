package com.arqulat.loom_backend.service.ai.providers;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public abstract class AbstractAIProvider implements AIProvider {

    protected final ObjectMapper objectMapper;
    private static final Pattern RESULT_TAG_PATTERN = Pattern.compile(
            "<RESULT>\\s*(\\{[\\s\\S]*?\\})\\s*</RESULT>",
            Pattern.CASE_INSENSITIVE
    );

    protected AbstractAIProvider(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Default agentCall — delegates to generate() with the system prompt.
     * Subclasses can override for provider-specific JSON mode.
     */
    @Override
    public String agentCall(String prompt, String systemPrompt, String contextNodes) throws Exception {
        return generate(prompt, systemPrompt, null);
    }

    /**
     * Default agentFreeCall — delegates to generate() WITHOUT JSON enforcement.
     * Returns raw text. Subclasses should override to ensure no JSON schema is forced.
     */
    @Override
    public String agentFreeCall(String prompt, String systemPrompt) throws Exception {
        return generate(prompt, systemPrompt, null);
    }

    /**
     * Extracts the JSON content from <RESULT>...</RESULT> tags in the LLM response.
     * Falls back to trying to parse the entire response as JSON if no tags found.
     *
     * @param response The raw LLM response text
     * @return The extracted JSON string
     * @throws Exception if no valid JSON can be extracted
     */
    public static String extractResultTag(String response) throws Exception {
        if (response == null || response.isBlank()) {
            throw new Exception("Empty response from LLM");
        }

        // Try to find <RESULT>...</RESULT> tags
        Matcher matcher = RESULT_TAG_PATTERN.matcher(response);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }

        // Fallback: try to find a JSON object in the response
        String trimmed = response.trim();
        
        // Remove markdown code blocks if present
        if (trimmed.startsWith("```json")) {
            trimmed = trimmed.substring(7);
        } else if (trimmed.startsWith("```")) {
            trimmed = trimmed.substring(3);
        }
        if (trimmed.endsWith("```")) {
            trimmed = trimmed.substring(0, trimmed.length() - 3);
        }
        trimmed = trimmed.trim();

        // Try to find a JSON object (first { to last })
        int firstBrace = trimmed.indexOf('{');
        int lastBrace = trimmed.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
            return trimmed.substring(firstBrace, lastBrace + 1);
        }

        throw new Exception("No <RESULT> tag or JSON object found in LLM response. Raw: " +
                response.substring(0, Math.min(200, response.length())));
    }

    /**
     * Cleans the markdown wrapping from the response and validates that it's a valid JSON array.
     * Throws an exception if invalid, which triggers the fallback ring.
     */
    protected String cleanAndValidateJsonResponse(String responseText) throws Exception {
        String clean = responseText.trim();
        
        // Remove markdown formatting
        if (clean.startsWith("```json")) {
            clean = clean.substring(7);
        } else if (clean.startsWith("```")) {
            clean = clean.substring(3);
        }
        if (clean.endsWith("```")) {
            clean = clean.substring(0, clean.length() - 3);
        }
        
        clean = clean.trim();

        // Validate that it is actually a JSON array (so hallucinations fail properly)
        try {
            JsonNode root = objectMapper.readTree(clean);
            if (root.isObject()) {
                if (root.has("nodes") && root.get("nodes").isArray()) {
                    return clean;
                } else if (root.has("updatedNodes") && root.get("updatedNodes").isArray()) {
                    return clean;
                } else if (root.has("addedNodes") && root.get("addedNodes").isArray()) {
                    return clean;
                } else if (root.has("deletedNodeIds") && root.get("deletedNodeIds").isArray()) {
                    return clean;
                } else if (root.has("toolCalls") && root.get("toolCalls").isArray()) {
                    return clean;
                } else if (root.has("elements") && root.get("elements").isArray()) {
                    return clean;
                } else if (root.has("diagram") && root.get("diagram").isArray()) {
                    return clean;
                } else if (root.has("data") && root.get("data").isArray()) {
                    return clean;
                } else {
                    throw new IllegalArgumentException("AI returned an object without a recognized array field.");
                }
            } else if (!root.isArray()) {
                throw new IllegalArgumentException("AI returned valid JSON, but it is not a JSON Array.");
            }
            return clean;
        } catch (Exception e) {
            throw new Exception("AI returned invalid JSON: " + e.getMessage() + " | Raw: " + clean.substring(0, Math.min(100, clean.length())));
        }
    }
}
