package com.mainf.orchestrator.client;

import com.mainf.orchestrator.config.ServiceProperties;
import com.mainf.orchestrator.model.Contracts.FaasInvocationRequest;
import com.mainf.orchestrator.model.Contracts.FaasInvocationResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class FaasInvokerClient {

    private final RestClient restClient;

    public FaasInvokerClient(RestClient.Builder builder, ServiceProperties properties) {
        this.restClient = builder.baseUrl(properties.faasInvoker().baseUrl()).build();
    }

    public FaasInvocationResponse invoke(FaasInvocationRequest request) {
        return restClient.post()
                .uri("/api/v1/invocations")
                .body(request)
                .retrieve()
                .body(FaasInvocationResponse.class);
    }
}
