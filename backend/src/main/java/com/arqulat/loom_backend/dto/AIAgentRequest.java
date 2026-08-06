package com.arqulat.loom_backend.dto;

public class AIAgentRequest {
    private String prompt;
    private String contextNodes;
    private String toolDefinitions;

    public AIAgentRequest() {
    }

    public String getPrompt() {
        return prompt;
    }

    public void setPrompt(String prompt) {
        this.prompt = prompt;
    }

    public String getContextNodes() {
        return contextNodes;
    }

    public void setContextNodes(String contextNodes) {
        this.contextNodes = contextNodes;
    }

    public String getToolDefinitions() {
        return toolDefinitions;
    }

    public void setToolDefinitions(String toolDefinitions) {
        this.toolDefinitions = toolDefinitions;
    }
}
