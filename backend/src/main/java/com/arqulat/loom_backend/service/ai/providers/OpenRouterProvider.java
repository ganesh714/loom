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
public class OpenRouterProvider extends AbstractAIProvider {

    private final ApiKeyManager apiKeyManager;
    private final RestTemplate restTemplate;

    public OpenRouterProvider(RestTemplate restTemplate, ObjectMapper objectMapper, @Value("${ai.openrouter.api-key:dummy-key}") String defaultKey) {
        super(objectMapper);
        this.restTemplate = restTemplate;
        this.apiKeyManager = new ApiKeyManager("OPENROUTER_API_KEY", defaultKey, "OpenRouter");
    }

    @Override
    public String generate(String prompt, String systemPrompt, String imageBase64) throws Exception {
        int maxAttempts = Math.max(1, apiKeyManager.getKeyCount());
        Exception lastException = null;

        for (int i = 0; i < maxAttempts; i++) {
            String currentKey = apiKeyManager.getNextKey();
            try {
                return callOpenRouterApi(prompt, systemPrompt, currentKey);
            } catch (Exception e) {
                lastException = e;
                System.err.println("OpenRouter generate attempt failed with key ending in " + 
                    (currentKey.length() > 4 ? currentKey.substring(currentKey.length() - 4) : "...") + 
                    ": " + e.getMessage() + ". Trying next key if available...");
            }
        }
        throw new RuntimeException("All OpenRouter API keys failed for generate. Last error: " + lastException.getMessage(), lastException);
    }

    private String callOpenRouterApi(String prompt, String systemPrompt, String apiKey) throws Exception {
        String url = "https://openrouter.ai/api/v1/chat/completions";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);
        headers.set("HTTP-Referer", "http://localhost:8081");
        headers.set("X-Title", "Loom AI");

        Map<String, Object> systemMessage = new HashMap<>();
        systemMessage.put("role", "system");
        systemMessage.put("content", systemPrompt);

        Map<String, Object> userMessage = new HashMap<>();
        userMessage.put("role", "user");
        boolean expectsJson = systemPrompt.contains("JSON");
        userMessage.put("content", prompt + (expectsJson ? "\n\nCRITICAL INSTRUCTION: You MUST output ONLY valid JSON. Do not wrap in markdown or include any explanations outside the JSON block." : ""));

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", "meta-llama/llama-3.1-70b-instruct");
        requestBody.put("messages", List.of(systemMessage, userMessage));
        requestBody.put("temperature", 0.7);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new RuntimeException("OpenRouter API call failed with status " + response.getStatusCode());
        }

        JsonNode root = objectMapper.readTree(response.getBody());
        JsonNode choices = root.path("choices");
        if (choices.isArray() && !choices.isEmpty()) {
            String text = choices.get(0).path("message").path("content").asText();
            expectsJson = systemPrompt.contains("JSON");
            return expectsJson ? cleanAndValidateJsonResponse(text) : text;
        }
        
        throw new RuntimeException("Failed to parse OpenRouter response: " + response.getBody());
    }

    @Override
    public String edit(String prompt, String contextNodes, String imageBase64) throws Exception {
        int maxAttempts = Math.max(1, apiKeyManager.getKeyCount());
        Exception lastException = null;

        for (int i = 0; i < maxAttempts; i++) {
            String currentKey = apiKeyManager.getNextKey();
            try {
                return callOpenRouterEditApi(prompt, contextNodes, imageBase64, currentKey);
            } catch (Exception e) {
                lastException = e;
                System.err.println("OpenRouter edit attempt failed with key ending in " + 
                    (currentKey.length() > 4 ? currentKey.substring(currentKey.length() - 4) : "...") + 
                    ": " + e.getMessage() + ". Trying next key if available...");
            }
        }
        throw new RuntimeException("All OpenRouter API keys failed for edit. Last error: " + lastException.getMessage(), lastException);
    }

    private String callOpenRouterEditApi(String prompt, String contextNodes, String imageBase64, String apiKey) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);
        headers.set("HTTP-Referer", "http://localhost:8081");
        headers.set("X-Title", "Loom AI");

        Map<String, Object> systemMessage = new HashMap<>();
        systemMessage.put("role", "system");
        systemMessage.put("content", AIPrompts.EDIT_SYSTEM_PROMPT);

        Map<String, Object> userMessage = new HashMap<>();
        userMessage.put("role", "user");
        userMessage.put("content", "CURRENT DIAGRAM JSON:\n" + contextNodes + "\n\nUSER REQUEST:\n" + prompt + "\n\nCRITICAL INSTRUCTION: You MUST output ONLY a valid JSON array. Do not wrap in markdown or include any explanations.");

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", "meta-llama/llama-3.1-70b-instruct");
        requestBody.put("messages", List.of(systemMessage, userMessage));
        requestBody.put("temperature", 0.7);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        String url = "https://openrouter.ai/api/v1/chat/completions";
        ResponseEntity<JsonNode> response = restTemplate.exchange(url, HttpMethod.POST, entity, JsonNode.class);
        JsonNode root = response.getBody();

        if (root == null) {
            throw new RuntimeException("Empty response from OpenRouter");
        }

        JsonNode choices = root.path("choices");
        if (choices.isArray() && !choices.isEmpty()) {
            String text = choices.get(0).path("message").path("content").asText();
            return cleanAndValidateJsonResponse(text);
        }
        
        throw new RuntimeException("Failed to parse OpenRouter response: " + response.getBody());
    }

    /**
     * Free-form agent call — no JSON enforcement.
     * Used for agent passes 1+2 where LLM thinks freely.
     */
    @Override
    public String agentFreeCall(String prompt, String systemPrompt) throws Exception {
        int maxAttempts = Math.max(1, apiKeyManager.getKeyCount());
        Exception lastException = null;

        for (int i = 0; i < maxAttempts; i++) {
            String currentKey = apiKeyManager.getNextKey();
            try {
                String url = "https://openrouter.ai/api/v1/chat/completions";

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.setBearerAuth(currentKey);
                headers.set("HTTP-Referer", "http://localhost:8081");
                headers.set("X-Title", "Loom AI");

                Map<String, Object> systemMessage = new HashMap<>();
                systemMessage.put("role", "system");
                systemMessage.put("content", systemPrompt);

                Map<String, Object> userMessage = new HashMap<>();
                userMessage.put("role", "user");
                userMessage.put("content", prompt);

                Map<String, Object> requestBody = new HashMap<>();
                requestBody.put("model", "meta-llama/llama-3.1-70b-instruct");
                requestBody.put("messages", List.of(systemMessage, userMessage));
                // NO response_format — let LLM think freely
                requestBody.put("temperature", 0.7);

                HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
                ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);

                if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                    throw new RuntimeException("OpenRouter API call failed with status " + response.getStatusCode());
                }

                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode choices = root.path("choices");
                if (choices.isArray() && !choices.isEmpty()) {
                    return choices.get(0).path("message").path("content").asText();
                }
                throw new RuntimeException("Failed to parse OpenRouter response");
            } catch (Exception e) {
                lastException = e;
                System.err.println("OpenRouter agentFreeCall failed: " + e.getMessage());
            }
        }
        throw new RuntimeException("All OpenRouter API keys failed for agentFreeCall. Last error: " + lastException.getMessage(), lastException);
    }

    @Override
    public String getProviderName() {
        return "OpenRouter";
    }
}
