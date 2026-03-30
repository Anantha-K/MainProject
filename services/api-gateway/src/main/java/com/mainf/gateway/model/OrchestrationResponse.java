package com.mainf.gateway.model;

import java.time.Instant;
import java.util.Map;

public record OrchestrationResponse(
        String requestId,
        String dedupeKey,
        String cacheStatus,
        String executionRole,
        String windowId,
        String servedFrom,
        Map<String, Object> responsePayload,
        Instant startedAt,
        Instant completedAt
) {
}
