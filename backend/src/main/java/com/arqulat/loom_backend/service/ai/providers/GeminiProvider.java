package com.arqulat.loom_backend.service.ai.providers;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.arqulat.loom_backend.service.ai.AIPrompts;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class GeminiProvider extends AbstractAIProvider {

    private final ApiKeyManager apiKeyManager;
    private final RestTemplate restTemplate;

    public GeminiProvider(RestTemplate restTemplate, ObjectMapper objectMapper,
            @Value("${ai.gemini.api-key:dummy-key}") String defaultKey) {
        super(objectMapper);
        this.restTemplate = restTemplate;
        this.apiKeyManager = new ApiKeyManager("GEMINI_API_KEY", defaultKey, "Gemini");
    }

    @Override
    public String generate(String prompt, String systemPrompt, String imageBase64) throws Exception {
        int maxAttempts = Math.max(1, apiKeyManager.getKeyCount());
        Exception lastException = null;

        for (int i = 0; i < maxAttempts; i++) {
            String currentKey = apiKeyManager.getNextKey();
            try {
                return attemptGenerationWithKey(prompt, systemPrompt, imageBase64, currentKey);
            } catch (Exception e) {
                lastException = e;
                System.err.println("Gemini generate attempt failed with key ending in " +
                        (currentKey.length() > 4 ? currentKey.substring(currentKey.length() - 4) : "...") +
                        ": " + e.getMessage() + ". Trying next key if available...");
            }
        }
        throw new RuntimeException("All Gemini API keys failed for generate. Last error: " + lastException.getMessage(),
                lastException);
    }

    private String attemptGenerationWithKey(String prompt, String systemPrompt, String imageBase64, String apiKey)
            throws Exception {
        try {
            return callGeminiApi(prompt, systemPrompt, "gemini-2.5-pro", imageBase64, apiKey);
        } catch (Exception e) {
            System.err.println("Gemini 2.5 Pro failed (" + e.getMessage() + "). Falling back to Gemini 2.0 Flash...");
            return callGeminiApi(prompt, systemPrompt, "gemini-2.0-flash", imageBase64, apiKey);
        }
    }

    private String callGeminiApi(String prompt, String systemPrompt, String model, String imageBase64, String apiKey)
            throws Exception {
        String url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key="
                + apiKey;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> requestBody = new HashMap<>();

        Map<String, Object> systemPart = new HashMap<>();
        systemPart.put("text", systemPrompt);
        Map<String, Object> systemInstruction = new HashMap<>();
        systemInstruction.put("parts", List.of(systemPart));
        requestBody.put("system_instruction", systemInstruction);

        Map<String, Object> part = new HashMap<>();
        part.put("text", prompt);
        Map<String, Object> content = new HashMap<>();
        if (imageBase64 != null && !imageBase64.isEmpty()) {
            Map<String, Object> imagePart = new HashMap<>();
            Map<String, String> inlineData = new HashMap<>();
            inlineData.put("mimeType", "image/png"); // Defaulting to PNG, browsers typically send png or jpeg base64,
                                                     // we can strip prefix
            String base64Data = imageBase64.contains(",") ? imageBase64.split(",")[1] : imageBase64;
            inlineData.put("data", base64Data);
            imagePart.put("inlineData", inlineData);
            content.put("parts", List.of(part, imagePart));
        } else {
            content.put("parts", List.of(part));
        }
        requestBody.put("contents", List.of(content));

        if (systemPrompt.contains("JSON")) {
            Map<String, Object> generationConfig = new HashMap<>();
            generationConfig.put("responseMimeType", "application/json");
            if (systemPrompt.contains("toolCalls")) {
                generationConfig.put("responseSchema", getAgentResponseSchema());
            } else {
                generationConfig.put("responseSchema", getDiagramResponseSchema());
            }
            requestBody.put("generationConfig", generationConfig);
        }

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new RuntimeException("Gemini API call failed with status " + response.getStatusCode());
        }

        JsonNode root = objectMapper.readTree(response.getBody());
        JsonNode candidates = root.path("candidates");
        if (candidates.isArray() && !candidates.isEmpty()) {
            JsonNode parts = candidates.get(0).path("content").path("parts");
            if (parts.isArray() && !parts.isEmpty()) {
                String text = parts.get(0).path("text").asText();
                boolean expectsJson = systemPrompt.contains("JSON");
                return expectsJson ? cleanAndValidateJsonResponse(text) : text;
            }
        }

        throw new RuntimeException("Failed to parse Gemini response: " + response.getBody());
    }

    @Override
    public String edit(String prompt, String contextNodes, String imageBase64) throws Exception {
        int maxAttempts = Math.max(1, apiKeyManager.getKeyCount());
        Exception lastException = null;

        for (int i = 0; i < maxAttempts; i++) {
            String currentKey = apiKeyManager.getNextKey();
            try {
                return callGeminiEditApi(prompt, contextNodes, imageBase64, currentKey);
            } catch (Exception e) {
                lastException = e;
                System.err.println("Gemini edit attempt failed with key ending in " +
                        (currentKey.length() > 4 ? currentKey.substring(currentKey.length() - 4) : "...") +
                        ": " + e.getMessage() + ". Trying next key if available...");
            }
        }
        throw new RuntimeException("All Gemini API keys failed for edit. Last error: " + lastException.getMessage(),
                lastException);
    }

    private String callGeminiEditApi(String prompt, String contextNodes, String imageBase64, String apiKey)
            throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> requestBody = new HashMap<>();

        Map<String, Object> systemPart = new HashMap<>();
        systemPart.put("text", AIPrompts.EDIT_SYSTEM_PROMPT);
        Map<String, Object> systemInstruction = new HashMap<>();
        systemInstruction.put("parts", List.of(systemPart));
        requestBody.put("system_instruction", systemInstruction);

        Map<String, Object> part1 = new HashMap<>();
        part1.put("text", "CURRENT DIAGRAM JSON:\n" + contextNodes);
        Map<String, Object> part2 = new HashMap<>();
        part2.put("text", "USER REQUEST:\n" + prompt);

        Map<String, Object> content = new HashMap<>();
        if (imageBase64 != null && !imageBase64.isEmpty()) {
            Map<String, Object> imagePart = new HashMap<>();
            Map<String, String> inlineData = new HashMap<>();
            inlineData.put("mimeType", "image/png");
            String base64Data = imageBase64.contains(",") ? imageBase64.split(",")[1] : imageBase64;
            inlineData.put("data", base64Data);
            imagePart.put("inlineData", inlineData);
            content.put("parts", List.of(part1, part2, imagePart));
        } else {
            content.put("parts", List.of(part1, part2));
        }
        requestBody.put("contents", List.of(content));

        Map<String, Object> generationConfig = new HashMap<>();
        generationConfig.put("responseMimeType", "application/json");
        generationConfig.put("responseSchema", getDiagramResponseSchema());
        requestBody.put("generationConfig", generationConfig);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        String url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key="
                + apiKey;
        ResponseEntity<JsonNode> response = restTemplate.exchange(url, HttpMethod.POST, entity, JsonNode.class);
        JsonNode root = response.getBody();

        if (root == null) {
            throw new RuntimeException("Empty response from Gemini");
        }

        JsonNode candidates = root.path("candidates");
        if (candidates.isArray() && !candidates.isEmpty()) {
            JsonNode parts = candidates.get(0).path("content").path("parts");
            if (parts.isArray() && !parts.isEmpty()) {
                String text = parts.get(0).path("text").asText();
                return cleanAndValidateJsonResponse(text);
            }
        }

        throw new RuntimeException("Failed to parse Gemini response: " + response.getBody());
    }

    private Map<String, Object> getDiagramResponseSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "ARRAY");
        schema.put("description", "Array of diagram nodes with visual layout details and connection edges");

        Map<String, Object> nodeProperties = new HashMap<>();
        nodeProperties.put("id", Map.of("type", "STRING", "description", "Unique identifier for the node"));
        nodeProperties.put("type", Map.of("type", "STRING", "description",
                "Shape type (e.g. box, database, cylinder, server, cloud, queue, decision-merge, browser, mobile, line, arrow)"));

        Map<String, Object> positionProperties = new HashMap<>();
        positionProperties.put("x", Map.of("type", "NUMBER"));
        positionProperties.put("y", Map.of("type", "NUMBER"));
        nodeProperties.put("position", Map.of(
                "type", "OBJECT",
                "properties", positionProperties,
                "required", List.of("x", "y")));

        Map<String, Object> dimensionsProperties = new HashMap<>();
        dimensionsProperties.put("width", Map.of("type", "NUMBER"));
        dimensionsProperties.put("height", Map.of("type", "NUMBER"));
        nodeProperties.put("dimensions", Map.of(
                "type", "OBJECT",
                "properties", dimensionsProperties,
                "required", List.of("width", "height")));

        nodeProperties.put("content",
                Map.of("type", "STRING", "description", "Title, label or body text displayed inside the node"));

        Map<String, Object> styleProperties = new HashMap<>();
        styleProperties.put("fillColor", Map.of("type", "STRING", "description", "Hex color string (e.g. #0c8ce9)"));
        styleProperties.put("strokeColor", Map.of("type", "STRING", "description", "Hex color string"));
        nodeProperties.put("style", Map.of(
                "type", "OBJECT",
                "properties", styleProperties));

        nodeProperties.put("rotation", Map.of("type", "NUMBER"));

        Map<String, Object> pointProperties = new HashMap<>();
        pointProperties.put("x", Map.of("type", "NUMBER"));
        pointProperties.put("y", Map.of("type", "NUMBER"));
        Map<String, Object> pointSchema = Map.of(
                "type", "OBJECT",
                "properties", pointProperties,
                "required", List.of("x", "y"));

        nodeProperties.put("startPoint", pointSchema);
        nodeProperties.put("endPoint", pointSchema);

        Map<String, Object> connectionProperties = new HashMap<>();
        connectionProperties.put("nodeId", Map.of("type", "STRING"));
        connectionProperties.put("portId", Map.of("type", "STRING"));
        Map<String, Object> connectionSchema = Map.of(
                "type", "OBJECT",
                "properties", connectionProperties);

        nodeProperties.put("startConnection", connectionSchema);
        nodeProperties.put("endConnection", connectionSchema);
        nodeProperties.put("lineStyle", Map.of("type", "STRING", "description", "solid, dashed, dotted, double"));
        nodeProperties.put("lineCurve", Map.of("type", "STRING", "description", "straight, curved"));
        nodeProperties.put("arrowType", Map.of("type", "STRING", "description", "none, single, double"));
        nodeProperties.put("points", Map.of("type", "ARRAY", "items", pointSchema));

        nodeProperties.put("label", Map.of("type", "STRING"));
        nodeProperties.put("groupId", Map.of("type", "STRING"));

        schema.put("items", Map.of(
                "type", "OBJECT",
                "properties", nodeProperties,
                "required", List.of("id", "type", "position", "dimensions", "content")));

        return schema;
    }

    private Map<String, Object> getAgentResponseSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "OBJECT");

        Map<String, Object> properties = new HashMap<>();
        properties.put("explanation", Map.of("type", "STRING"));

        Map<String, Object> toolCallProperties = new HashMap<>();
        toolCallProperties.put("tool", Map.of("type", "STRING"));

        Map<String, Object> anyArgs = new HashMap<>();
        anyArgs.put("type", "OBJECT");

        Map<String, Object> argProperties = new HashMap<>();
        argProperties.put("type", Map.of("type", "STRING"));
        argProperties.put("content", Map.of("type", "STRING"));
        argProperties.put("tag", Map.of("type", "STRING"));
        argProperties.put("x", Map.of("type", "NUMBER"));
        argProperties.put("y", Map.of("type", "NUMBER"));
        argProperties.put("width", Map.of("type", "NUMBER"));
        argProperties.put("height", Map.of("type", "NUMBER"));
        argProperties.put("backgroundColor", Map.of("type", "STRING"));
        argProperties.put("borderColor", Map.of("type", "STRING"));
        argProperties.put("textColor", Map.of("type", "STRING"));
        argProperties.put("nodeId", Map.of("type", "STRING"));
        argProperties.put("fontSize", Map.of("type", "STRING"));
        argProperties.put("fontWeight", Map.of("type", "STRING"));
        argProperties.put("borderRadius", Map.of("type", "STRING"));
        argProperties.put("opacity", Map.of("type", "STRING"));
        argProperties.put("sourceId", Map.of("type", "STRING"));
        argProperties.put("targetId", Map.of("type", "STRING"));
        argProperties.put("label", Map.of("type", "STRING"));
        argProperties.put("lineStyle", Map.of("type", "STRING"));
        argProperties.put("arrowHead", Map.of("type", "STRING"));
        argProperties.put("arrowTail", Map.of("type", "STRING"));
        argProperties.put("routing", Map.of("type", "STRING"));
        argProperties.put("edgeId", Map.of("type", "STRING"));
        argProperties.put("nodeIds", Map.of("type", "ARRAY", "items", Map.of("type", "STRING")));
        argProperties.put("alignment", Map.of("type", "STRING"));
        argProperties.put("groupTitle", Map.of("type", "STRING"));
        argProperties.put("groupColor", Map.of("type", "STRING"));

        anyArgs.put("properties", argProperties);
        toolCallProperties.put("args", anyArgs);

        Map<String, Object> toolCallSchema = Map.of(
                "type", "OBJECT",
                "properties", toolCallProperties,
                "required", List.of("tool", "args"));

        properties.put("toolCalls", Map.of("type", "ARRAY", "items", toolCallSchema));

        schema.put("properties", properties);
        schema.put("required", List.of("explanation", "toolCalls"));
        return schema;
    }

    /**
     * Free-form agent call — NO JSON schema, NO responseMimeType enforcement.
     * Used for Pass 1 (semantic) and Pass 2 (layout) where the LLM should
     * think freely in natural language and output a <RESULT>...</RESULT> block.
     */
    @Override
    public String agentFreeCall(String prompt, String systemPrompt) throws Exception {
        int maxAttempts = Math.max(1, apiKeyManager.getKeyCount());
        Exception lastException = null;

        for (int i = 0; i < maxAttempts; i++) {
            String currentKey = apiKeyManager.getNextKey();
            try {
                return callGeminiFreeApi(prompt, systemPrompt, currentKey);
            } catch (Exception e) {
                lastException = e;
                System.err.println("Gemini agentFreeCall attempt failed with key ending in " +
                        (currentKey.length() > 4 ? currentKey.substring(currentKey.length() - 4) : "...") +
                        ": " + e.getMessage() + ". Trying next key if available...");
            }
        }
        throw new RuntimeException(
                "All Gemini API keys failed for agentFreeCall. Last error: " + lastException.getMessage(),
                lastException);
    }

    /**
     * Calls Gemini API without any JSON schema — returns raw text.
     * Falls back from Pro to Flash internally.
     */
    private String callGeminiFreeApi(String prompt, String systemPrompt, String apiKey) throws Exception {
        try {
            return callGeminiFreeApiWithModel(prompt, systemPrompt, "gemini-2.0-flash", apiKey);
        } catch (Exception e) {
            System.err.println("Gemini 2.0 Flash free call failed (" + e.getMessage() + "). Trying Pro...");
            return callGeminiFreeApiWithModel(prompt, systemPrompt, "gemini-2.5-pro", apiKey);
        }
    }

    private String callGeminiFreeApiWithModel(String prompt, String systemPrompt, String model, String apiKey)
            throws Exception {
        String url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key="
                + apiKey;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> requestBody = new HashMap<>();

        Map<String, Object> systemPart = new HashMap<>();
        systemPart.put("text", systemPrompt);
        Map<String, Object> systemInstruction = new HashMap<>();
        systemInstruction.put("parts", List.of(systemPart));
        requestBody.put("system_instruction", systemInstruction);

        Map<String, Object> part = new HashMap<>();
        part.put("text", prompt);
        Map<String, Object> content = new HashMap<>();
        content.put("parts", List.of(part));
        requestBody.put("contents", List.of(content));

        // NO generationConfig with responseMimeType — let LLM think freely

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
        ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new RuntimeException("Gemini API call failed with status " + response.getStatusCode());
        }

        JsonNode root = objectMapper.readTree(response.getBody());
        JsonNode candidates = root.path("candidates");
        if (candidates.isArray() && !candidates.isEmpty()) {
            JsonNode parts = candidates.get(0).path("content").path("parts");
            if (parts.isArray() && !parts.isEmpty()) {
                return parts.get(0).path("text").asText();
            }
        }

        throw new RuntimeException("Failed to parse Gemini free response: " + response.getBody());
    }

    @Override
    public String getProviderName() {
        return "Gemini";
    }
}
