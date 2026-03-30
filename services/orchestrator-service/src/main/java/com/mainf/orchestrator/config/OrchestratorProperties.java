package com.mainf.orchestrator.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "orchestrator")
public record OrchestratorProperties(long executionWindowMs, long followerWaitTimeoutMs) {
}
