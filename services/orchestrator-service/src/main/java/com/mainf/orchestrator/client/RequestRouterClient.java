package com.mainf.orchestrator.client;

import com.mainf.orchestrator.config.ServiceProperties;
import com.mainf.orchestrator.model.Contracts.RoutingDecision;
import com.mainf.orchestrator.model.ExecutionRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class RequestRouterClient {

    private final RestClient restClient;

    public RequestRouterClient(RestClient.Builder builder, ServiceProperties properties) {
        this.restClient = builder.baseUrl(properties.requestRouter().baseUrl()).build();
    }

    public RoutingDecision resolve(ExecutionRequest request) {
        return restClient.post()
                .uri("/api/v1/routes/resolve")
                .body(request)
                .retrieve()
                .body(RoutingDecision.class);
    }
}
