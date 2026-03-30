package com.mainf.gateway.client;

import com.mainf.gateway.config.GatewayProperties;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class CacheGatewayClient {

    private final RestClient restClient;

    public CacheGatewayClient(RestClient.Builder builder, GatewayProperties properties) {
        this.restClient = builder.baseUrl(properties.cacheBaseUrl()).build();
    }

    public void flush() {
        restClient.post()
                .uri("/api/v1/cache/flush")
                .retrieve()
                .toBodilessEntity();
    }
}
