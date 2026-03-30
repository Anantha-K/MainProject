package com.mainf.orchestrator.client;

import com.mainf.orchestrator.config.ServiceProperties;
import com.mainf.orchestrator.model.Contracts.WindowAcquireRequest;
import com.mainf.orchestrator.model.Contracts.WindowAcquireResponse;
import com.mainf.orchestrator.model.Contracts.WindowAwaitResponse;
import com.mainf.orchestrator.model.Contracts.WindowCompleteRequest;
import com.mainf.orchestrator.model.Contracts.WindowFailRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class ExecutionWindowClient {

    private final RestClient restClient;

    public ExecutionWindowClient(RestClient.Builder builder, ServiceProperties properties) {
        this.restClient = builder.baseUrl(properties.executionWindow().baseUrl()).build();
    }

    public WindowAcquireResponse acquire(WindowAcquireRequest request) {
        return restClient.post()
                .uri("/api/v1/windows/acquire")
                .body(request)
                .retrieve()
                .body(WindowAcquireResponse.class);
    }

    public WindowAwaitResponse await(String windowId, long waitMs) {
        return restClient.get()
                .uri(uriBuilder -> uriBuilder.path("/api/v1/windows/{windowId}/await")
                        .queryParam("waitMs", waitMs)
                        .build(windowId))
                .retrieve()
                .body(WindowAwaitResponse.class);
    }

    public void complete(String windowId, WindowCompleteRequest request) {
        restClient.post()
                .uri("/api/v1/windows/{windowId}/complete", windowId)
                .body(request)
                .retrieve()
                .toBodilessEntity();
    }

    public void fail(String windowId, String errorMessage) {
        restClient.post()
                .uri("/api/v1/windows/{windowId}/fail", windowId)
                .body(new WindowFailRequest(errorMessage))
                .retrieve()
                .toBodilessEntity();
    }
}
