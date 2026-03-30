package com.mainf.gateway.service;

import com.mainf.gateway.config.GatewayProperties;
import com.mainf.gateway.model.SystemHealthResponse;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class SystemHealthService {

    private final RestClient.Builder restClientBuilder;
    private final GatewayProperties properties;

    public SystemHealthService(RestClient.Builder restClientBuilder, GatewayProperties properties) {
        this.restClientBuilder = restClientBuilder;
        this.properties = properties;
    }

    public SystemHealthResponse health() {
        Map<String, Object> services = new LinkedHashMap<>();
        boolean allUp = true;

        for (Map.Entry<String, String> target : properties.healthTargets().entrySet()) {
            try {
                Object response = restClientBuilder.build()
                        .get()
                        .uri(target.getValue())
                        .retrieve()
                        .body(Object.class);
                services.put(target.getKey(), Map.of("status", "UP", "details", response));
            } catch (Exception exception) {
                allUp = false;
                services.put(target.getKey(), Map.of("status", "DOWN", "error", exception.getMessage()));
            }
        }

        return new SystemHealthResponse(allUp ? "UP" : "DEGRADED", Instant.now(), services);
    }
}
