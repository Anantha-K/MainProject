package com.mainf.window.model;

import java.time.Instant;
import java.util.Map;

public final class WindowContracts {

    private WindowContracts() {
    }

    public record WindowAcquireRequest(String dedupeKey, String cacheKey, long windowMs) {
    }

    public record WindowAcquireResponse(String windowId, boolean leader, long windowMs, Instant expiresAt) {
    }

    public record WindowCompleteRequest(String cacheKey, Map<String, Object> responsePayload) {
    }

    public record WindowFailRequest(String errorMessage) {
    }

    public record WindowAwaitResponse(boolean completed, String status, String windowId, Map<String, Object> responsePayload, String errorMessage) {
    }
}
