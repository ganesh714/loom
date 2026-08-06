package com.arqulat.loom_backend.service.ai.providers;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

public class ApiKeyManager {
    private final List<String> apiKeys;
    private final AtomicInteger currentIndex = new AtomicInteger(0);
    private final String providerName;

    public ApiKeyManager(String prefix, String defaultKey, String providerName) {
        this.providerName = providerName;
        List<String> keys = new ArrayList<>();
        
        // Find all environment variables starting with the prefix + "_"
        // e.g. for prefix "GEMINI_API_KEY", we look for "GEMINI_API_KEY_1", "GEMINI_API_KEY_2", etc.
        String lookupPrefix = prefix + "_";
        Map<String, String> env = System.getenv();
        
        List<String> envKeys = new ArrayList<>(env.keySet());
        Collections.sort(envKeys); // Sort to ensure _1, _2 order if possible
        
        for (String envKey : envKeys) {
            if (envKey.startsWith(lookupPrefix)) {
                String key = env.get(envKey);
                if (key != null && !key.trim().isEmpty() && !key.equals("dummy-key")) {
                    keys.add(key.trim());
                }
            }
        }
        
        // Fallback: If no dynamic keys are found, use the default key from @Value
        if (keys.isEmpty() && defaultKey != null && !defaultKey.trim().isEmpty() && !defaultKey.equals("dummy-key")) {
            keys.add(defaultKey.trim());
        }

        this.apiKeys = keys;
    }

    public String getNextKey() {
        if (apiKeys.isEmpty()) {
            throw new IllegalStateException(providerName + " API keys are not configured. Please provide " + providerName.toUpperCase() + "_API_KEY_1, etc.");
        }
        int index = currentIndex.getAndUpdate(i -> (i + 1) % apiKeys.size());
        return apiKeys.get(index);
    }
    
    public int getKeyCount() {
        return apiKeys.size();
    }
}
