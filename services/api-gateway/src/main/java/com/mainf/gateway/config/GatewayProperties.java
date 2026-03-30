package com.mainf.gateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Map;

@ConfigurationProperties(prefix = "gateway")
public record GatewayProperties(String orchestratorBaseUrl, String cacheBaseUrl, Map<String, String> healthTargets) {
}
