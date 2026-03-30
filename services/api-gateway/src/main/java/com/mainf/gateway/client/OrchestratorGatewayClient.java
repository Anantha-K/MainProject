package com.mainf.gateway.client;

import com.mainf.gateway.config.GatewayProperties;
import com.mainf.gateway.model.ExecutionRequest;
import com.mainf.gateway.model.OrchestrationResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class OrchestratorGatewayClient {

    private final RestClient restClient;

    public OrchestratorGatewayClient(RestClient.Builder builder, GatewayProperties properties) {
        this.restClient = builder.baseUrl(properties.orchestratorBaseUrl()).build();
    }

    public OrchestrationResponse execute(ExecutionRequest request) {
        return restClient.post()
                .uri("/api/v1/orchestration/execute")
                .body(request)
                .retrieve()
                .body(OrchestrationResponse.class);
    }
}
