package com.mainf.router.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.Map;

public final class RoutingModels {

    private RoutingModels() {
    }

    public record RoutingRequest(
            @NotBlank String tenantId,
            @NotBlank String functionName,
            @NotEmpty Map<String, Object> payload,
            Map<String, Object> metadata
    ) {
    }

    public record RoutingDecision(String routeKey, String dedupeKey, String cacheKey, String canonicalRequest) {
    }
}
