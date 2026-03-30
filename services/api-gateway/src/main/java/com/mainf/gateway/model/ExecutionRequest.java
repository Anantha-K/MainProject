package com.mainf.gateway.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.Map;

public record ExecutionRequest(
        @NotBlank String tenantId,
        @NotBlank String functionName,
        @NotEmpty Map<String, Object> payload,
        Map<String, Object> metadata
) {
}
