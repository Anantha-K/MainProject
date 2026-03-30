package com.mainf.orchestrator.model;

import java.time.Instant;
import java.util.Map;

public final class Contracts {

    private Contracts() {
    }

    public record RoutingDecision(String routeKey, String dedupeKey, String cacheKey, String canonicalRequest) {
    }

    public record CacheLookupResponse(boolean hit, String cacheKey, Map<String, Object> responsePayload, Long ttlSeconds) {
    }

    public record CacheWriteRequest(Map<String, Object> responsePayload, long ttlSeconds) {
    }

    public record WindowAcquireRequest(String dedupeKey, String cacheKey, long windowMs) {
    }

    public record WindowAcquireResponse(String windowId, boolean leader, long windowMs, Instant expiresAt) {
    }

    public record WindowAwaitResponse(boolean completed, String status, String windowId, Map<String, Object> responsePayload, String errorMessage) {
    }

    public record WindowCompleteRequest(String cacheKey, Map<String, Object> responsePayload) {
    }

    public record WindowFailRequest(String errorMessage) {
    }

    public record FaasInvocationRequest(String dedupeKey, String routeKey, String functionName, Map<String, Object> payload, Map<String, Object> metadata) {
    }

    public record FaasInvocationResponse(String invocationId, String provider, String functionName, Map<String, Object> responsePayload, Instant completedAt) {
    }
}
