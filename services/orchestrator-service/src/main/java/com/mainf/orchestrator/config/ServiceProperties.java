package com.mainf.orchestrator.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "services")
public record ServiceProperties(ServiceEndpoint requestRouter,
                                ServiceEndpoint executionWindow,
                                ServiceEndpoint cache,
                                ServiceEndpoint faasInvoker) {

    public record ServiceEndpoint(String baseUrl) {
    }
}
