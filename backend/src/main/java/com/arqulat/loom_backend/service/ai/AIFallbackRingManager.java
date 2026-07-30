package com.arqulat.loom_backend.service.ai;

import com.arqulat.loom_backend.service.AIService;
import com.arqulat.loom_backend.service.ai.providers.AIProvider;
import com.arqulat.loom_backend.service.ai.providers.AbstractAIProvider;
import com.arqulat.loom_backend.service.ai.providers.GeminiProvider;
import com.arqulat.loom_backend.service.ai.providers.GroqProvider;
import com.arqulat.loom_backend.service.ai.providers.OpenRouterProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Arrays;
import java.util.List;

@Service
public class AIFallbackRingManager implements AIService {

    private static final Logger logger = LoggerFactory.getLogger(AIFallbackRingManager.class);
    
    private final List<AIProvider> fallbackRing;
    private final AgentOrchestrator agentOrchestrator;

    public AIFallbackRingManager(GeminiProvider geminiProvider, GroqProvider groqProvider,
                                  OpenRouterProvider openRouterProvider, AgentOrchestrator agentOrchestrator) {
        // Defines the exact fallback order: Gemini -> Groq -> OpenRouter
        this.fallbackRing = Arrays.asList(geminiProvider, groqProvider, openRouterProvider);
        this.agentOrchestrator = agentOrchestrator;
    }

    @Override
    public String generateDiagramNodes(String prompt, String imageBase64) throws Exception {
        for (AIProvider provider : fallbackRing) {
            try {
                if (imageBase64 != null && !imageBase64.isEmpty() && !(provider instanceof GeminiProvider)) {
                    logger.info("Skipping provider {} because it does not support Vision. Routing to Gemini.", provider.getProviderName());
                    continue;
                }
                
                logger.info("Attempting AI generation (Pass 1 - SLD) using provider: {}", provider.getProviderName());
                String sld = provider.generate(prompt, AIPrompts.PASS1_SLD_PROMPT, imageBase64);
                
                logger.info("Successfully generated SLD using {}. Now attempting Pass 2 (JSON)...", provider.getProviderName());
                String pass2Prompt = "SLD Blueprint:\n" + sld + "\n\nOriginal Request Context:\n" + prompt;
                String jsonResult = provider.generate(pass2Prompt, AIPrompts.PASS2_STYLE_PROMPT, null);
                
                jsonResult = VirtualCanvasApplicator.applyDynamicSizingToCanvas(jsonResult);
                
                logger.info("Successfully completed two-pass diagram generation using {}", provider.getProviderName());
                return jsonResult;
                
            } catch (Exception e) {
                logger.warn("Provider {} failed during two-pass generation. Reason: {}. Falling back to next provider...", provider.getProviderName(), e.getMessage());
            }
        }
        
        logger.error("All AI providers in the fallback ring have failed.");
        throw new Exception("Unable to generate diagram nodes. All configured AI providers failed.");
    }

    @Override
    public String editDiagramNodes(String prompt, String contextNodes, String imageBase64) throws Exception {
        for (AIProvider provider : fallbackRing) {
            try {
                if (imageBase64 != null && !imageBase64.isEmpty() && !(provider instanceof GeminiProvider)) {
                    logger.info("Skipping provider {} because it does not support Vision. Routing to Gemini.", provider.getProviderName());
                    continue;
                }
                
                logger.info("Attempting AI edit using provider: {}", provider.getProviderName());
                String jsonResult = provider.edit(prompt, contextNodes, imageBase64);
                
                jsonResult = VirtualCanvasApplicator.applyDynamicSizingToCanvas(jsonResult);
                
                logger.info("Successfully edited diagram nodes using {}", provider.getProviderName());
                return jsonResult;
                
            } catch (Exception e) {
                logger.warn("Provider {} failed during edit generation. Reason: {}. Falling back...", provider.getProviderName(), e.getMessage());
            }
        }
        
        logger.error("All AI providers failed for edit operation.");
        throw new Exception("Unable to edit diagram nodes. All configured AI providers failed.");
    }

    // ─── Agent 3-Pass Methods ───

    /**
     * Pass 1: Semantic analysis — LLM thinks freely about entities and relationships.
     * Returns extracted JSON from <RESULT> tags.
     */
    public String agentSemanticPass(String prompt) throws Exception {
        for (AIProvider provider : fallbackRing) {
            try {
                logger.info("[Agent Pass 1 - Semantic] Using provider: {}", provider.getProviderName());
                String rawResponse = provider.agentFreeCall(prompt, AIAgentPrompts.SEMANTIC_PROMPT);
                String extracted = AbstractAIProvider.extractResultTag(rawResponse);
                logger.info("[Agent Pass 1 - Semantic] Success with {}. Extracted {} chars.", provider.getProviderName(), extracted.length());
                return extracted;
            } catch (Exception e) {
                logger.warn("[Agent Pass 1 - Semantic] {} failed: {}. Falling back...", provider.getProviderName(), e.getMessage());
            }
        }
        throw new Exception("All providers failed at Agent Pass 1 (Semantic).");
    }

    /**
     * Pass 2: Layout strategy — LLM picks the best visual structure.
     * Returns extracted JSON from <RESULT> tags.
     */
    public String agentLayoutPass(String semanticResult, String originalPrompt) throws Exception {
        String layoutPromptInput = "SEMANTIC ANALYSIS:\n" + semanticResult + "\n\nORIGINAL USER REQUEST:\n" + originalPrompt;
        
        for (AIProvider provider : fallbackRing) {
            try {
                logger.info("[Agent Pass 2 - Layout] Using provider: {}", provider.getProviderName());
                String rawResponse = provider.agentFreeCall(layoutPromptInput, AIAgentPrompts.LAYOUT_PROMPT);
                String extracted = AbstractAIProvider.extractResultTag(rawResponse);
                logger.info("[Agent Pass 2 - Layout] Success with {}. Extracted {} chars.", provider.getProviderName(), extracted.length());
                return extracted;
            } catch (Exception e) {
                logger.warn("[Agent Pass 2 - Layout] {} failed: {}. Falling back...", provider.getProviderName(), e.getMessage());
            }
        }
        throw new Exception("All providers failed at Agent Pass 2 (Layout).");
    }

    /**
     * Pass 3: Single execution step — LLM emits tool calls for the next batch.
     * Returns raw JSON with toolCalls array.
     */
    public String agentExecuteStep(String blueprint, String layoutPlan, String canvasState, int step) throws Exception {
        String stepPrompt = "STEP: " + step + "\n\n" +
                "SEMANTIC BLUEPRINT:\n" + blueprint + "\n\n" +
                "LAYOUT PLAN:\n" + layoutPlan + "\n\n" +
                "CURRENT CANVAS STATE:\n" + canvasState;

        for (AIProvider provider : fallbackRing) {
            try {
                logger.info("[Agent Pass 3 - Execute Step {}] Using provider: {}", step, provider.getProviderName());
                String result = provider.agentCall(stepPrompt, AIAgentPrompts.EXECUTE_PROMPT, canvasState);
                logger.info("[Agent Pass 3 - Execute Step {}] Success with {}. Result: {} chars.", step, provider.getProviderName(), result.length());
                return result;
            } catch (Exception e) {
                logger.warn("[Agent Pass 3 - Execute Step {}] {} failed: {}. Falling back...", step, provider.getProviderName(), e.getMessage());
            }
        }
        throw new Exception("All providers failed at Agent Pass 3 (Execute Step " + step + ").");
    }

    @Override
    public void agentOrchestrate(String prompt, String contextNodes, SseEmitter emitter) throws Exception {
        agentOrchestrator.orchestrate(prompt, contextNodes, this, emitter);
    }
}
