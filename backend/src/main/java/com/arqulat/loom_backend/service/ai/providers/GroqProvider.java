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
public class GroqProvider extends AbstractAIProvider {

    private final ApiKeyManager apiKeyManager;
    private final RestTemplate restTemplate;

    public GroqProvider(RestTemplate restTemplate, ObjectMapper objectMapper, @Value("${ai.groq.api-key:dummy-key}") String defaultKey) {
        super(objectMapper);
        this.restTemplate = restTemplate;
        this.apiKeyManager = new ApiKeyManager("GROQ_API_KEY", defaultKey, "Groq");
    }

    @Override
    public String generate(String prompt, String systemPrompt, String imageBase64) throws Exception {
        int maxAttempts = Math.max(1, apiKeyManager.getKeyCount());
        Exception lastException = null;

        for (int i = 0; i < maxAttempts; i++) {
            String currentKey = apiKeyManager.getNextKey();
            try {
                return callGroqApi(prompt, systemPrompt, currentKey);
            } catch (Exception e) {
                lastException = e;
                System.err.println("Groq generate attempt failed with key ending in " + 
                    (currentKey.length() > 4 ? currentKey.substring(currentKey.length() - 4) : "...") + 
                    ": " + e.getMessage() + ". Trying next key if available...");
            }
        }
        throw new RuntimeException("All Groq API keys failed for generate. Last error: " + lastException.getMessage(), lastException);
    }

    private String callGroqApi(String prompt, String systemPrompt, String apiKey) throws Exception {
        String url = "https://api.groq.com/openai/v1/chat/completions";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        Map<String, Object> systemMessage = new HashMap<>();
        systemMessage.put("role", "system");
        systemMessage.put("content", systemPrompt);

        Map<String, Object> userMessage = new HashMap<>();
        userMessage.put("role", "user");
        boolean expectsJson = systemPrompt.contains("JSON");
        userMessage.put("content", prompt + (expectsJson ? "\n\nCRITICAL INSTRUCTION: You MUST output ONLY valid JSON. Do not wrap in markdown or include any explanations outside the JSON block." : ""));

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", "llama-3.3-70b-versatile");
        requestBody.put("messages", List.of(systemMessage, userMessage));
        if (expectsJson) {
            requestBody.put("response_format", Map.of("type", "json_object"));
        }
        requestBody.put("temperature", 0.7);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new RuntimeException("Groq API call failed with status " + response.getStatusCode());
        }

        JsonNode root = objectMapper.readTree(response.getBody());
        JsonNode choices = root.path("choices");
        if (choices.isArray() && !choices.isEmpty()) {
            String text = choices.get(0).path("message").path("content").asText();
            expectsJson = systemPrompt.contains("JSON");
            return expectsJson ? cleanAndValidateJsonResponse(text) : text;
        }
        
        throw new RuntimeException("Failed to parse Groq response: " + response.getBody());
    }

    @Override
    public String edit(String prompt, String contextNodes, String imageBase64) throws Exception {
        int maxAttempts = Math.max(1, apiKeyManager.getKeyCount());
        Exception lastException = null;

        for (int i = 0; i < maxAttempts; i++) {
            String currentKey = apiKeyManager.getNextKey();
            try {
                return callGroqEditApi(prompt, contextNodes, imageBase64, currentKey);
            } catch (Exception e) {
                lastException = e;
                System.err.println("Groq edit attempt failed with key ending in " + 
                    (currentKey.length() > 4 ? currentKey.substring(currentKey.length() - 4) : "...") + 
                    ": " + e.getMessage() + ". Trying next key if available...");
            }
        }
        throw new RuntimeException("All Groq API keys failed for edit. Last error: " + lastException.getMessage(), lastException);
    }

    private String callGroqEditApi(String prompt, String contextNodes, String imageBase64, String apiKey) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        Map<String, Object> systemMessage = new HashMap<>();
        systemMessage.put("role", "system");
        systemMessage.put("content", AIPrompts.EDIT_SYSTEM_PROMPT);

        Map<String, Object> userMessage = new HashMap<>();
        userMessage.put("role", "user");
        userMessage.put("content", "CURRENT DIAGRAM JSON:\n" + contextNodes + "\n\nUSER REQUEST:\n" + prompt + "\n\nCRITICAL INSTRUCTION: You MUST output ONLY a valid JSON array. Do not wrap in markdown or include any explanations.");

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", "llama-3.3-70b-versatile");
        requestBody.put("messages", List.of(systemMessage, userMessage));
        requestBody.put("response_format", Map.of("type", "json_object"));
        requestBody.put("temperature", 0.7);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        String url = "https://api.groq.com/openai/v1/chat/completions";
        ResponseEntity<JsonNode> response = restTemplate.exchange(url, HttpMethod.POST, entity, JsonNode.class);
        JsonNode root = response.getBody();

        if (root == null) {
            throw new RuntimeException("Empty response from Groq");
        }

        JsonNode choices = root.path("choices");
        if (choices.isArray() && !choices.isEmpty()) {
            String text = choices.get(0).path("message").path("content").asText();
            return cleanAndValidateJsonResponse(text);
        }
        
        throw new RuntimeException("Failed to parse Groq response: " + response.getBody());
    }

    /**
     * Free-form agent call — NO json_object response format.
     * Used for agent passes 1+2 where LLM thinks freely.
     */
    @Override
    public String agentFreeCall(String prompt, String systemPrompt) throws Exception {
        int maxAttempts = Math.max(1, apiKeyManager.getKeyCount());
        Exception lastException = null;

        for (int i = 0; i < maxAttempts; i++) {
            String currentKey = apiKeyManager.getNextKey();
            try {
                String url = "https://api.groq.com/openai/v1/chat/completions";

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.setBearerAuth(currentKey);

                Map<String, Object> systemMessage = new HashMap<>();
                systemMessage.put("role", "system");
                systemMessage.put("content", systemPrompt);

                Map<String, Object> userMessage = new HashMap<>();
                userMessage.put("role", "user");
                userMessage.put("content", prompt);

                Map<String, Object> requestBody = new HashMap<>();
                requestBody.put("model", "llama-3.3-70b-versatile");
                requestBody.put("messages", List.of(systemMessage, userMessage));
                // NO response_format — let LLM think freely
                requestBody.put("temperature", 0.7);

                HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
                ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);

                if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                    throw new RuntimeException("Groq API call failed with status " + response.getStatusCode());
                }

                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode choices = root.path("choices");
                if (choices.isArray() && !choices.isEmpty()) {
                    return choices.get(0).path("message").path("content").asText();
                }
                throw new RuntimeException("Failed to parse Groq response");
            } catch (Exception e) {
                lastException = e;
                System.err.println("Groq agentFreeCall failed: " + e.getMessage());
            }
        }
        throw new RuntimeException("All Groq API keys failed for agentFreeCall. Last error: " + lastException.getMessage(), lastException);
    }

    @Override
    public String getProviderName() {
        return "Groq (Llama-3.3 70B)";
    }
}
