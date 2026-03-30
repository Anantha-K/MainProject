package com.mainf.router.service;

import com.mainf.router.model.RoutingModels.RoutingDecision;
import com.mainf.router.model.RoutingModels.RoutingRequest;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class RequestFingerprintServiceTest {

    private final RequestFingerprintService service = new RequestFingerprintService();

    @Test
    void identicalRequestsGenerateSameFingerprint() {
        RoutingRequest first = new RoutingRequest("Team-A", "Traffic-Score", Map.of("location", "Seattle"), Map.of());
        RoutingRequest second = new RoutingRequest("team-a", "traffic-score", Map.of("location", "Seattle"), Map.of("ignored", true));

        RoutingDecision firstDecision = service.resolve(first);
        RoutingDecision secondDecision = service.resolve(second);

        assertEquals(firstDecision.dedupeKey(), secondDecision.dedupeKey());
        assertEquals(firstDecision.cacheKey(), secondDecision.cacheKey());
    }
}
