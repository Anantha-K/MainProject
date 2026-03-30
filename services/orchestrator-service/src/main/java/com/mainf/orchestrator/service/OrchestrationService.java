package com.mainf.orchestrator.service;

import com.mainf.orchestrator.client.CacheClient;
import com.mainf.orchestrator.client.ExecutionWindowClient;
import com.mainf.orchestrator.client.FaasInvokerClient;
import com.mainf.orchestrator.client.RequestRouterClient;
import com.mainf.orchestrator.config.OrchestratorProperties;
import com.mainf.orchestrator.model.Contracts.CacheLookupResponse;
import com.mainf.orchestrator.model.Contracts.CacheWriteRequest;
import com.mainf.orchestrator.model.Contracts.FaasInvocationRequest;
import com.mainf.orchestrator.model.Contracts.FaasInvocationResponse;
import com.mainf.orchestrator.model.Contracts.RoutingDecision;
import com.mainf.orchestrator.model.Contracts.WindowAcquireRequest;
import com.mainf.orchestrator.model.Contracts.WindowAcquireResponse;
import com.mainf.orchestrator.model.Contracts.WindowAwaitResponse;
import com.mainf.orchestrator.model.Contracts.WindowCompleteRequest;
import com.mainf.orchestrator.model.ExecutionRequest;
import com.mainf.orchestrator.model.OrchestrationResponse;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
public class OrchestrationService {

    private static final long DEFAULT_CACHE_TTL_SECONDS = 60;

    private final RequestRouterClient requestRouterClient;
    private final CacheClient cacheClient;
    private final ExecutionWindowClient executionWindowClient;
    private final FaasInvokerClient faasInvokerClient;
    private final OrchestratorProperties properties;

    public OrchestrationService(RequestRouterClient requestRouterClient,
                                CacheClient cacheClient,
                                ExecutionWindowClient executionWindowClient,
                                FaasInvokerClient faasInvokerClient,
                                OrchestratorProperties properties) {
        this.requestRouterClient = requestRouterClient;
        this.cacheClient = cacheClient;
        this.executionWindowClient = executionWindowClient;
        this.faasInvokerClient = faasInvokerClient;
        this.properties = properties;
    }

    public OrchestrationResponse orchestrate(ExecutionRequest request) throws InterruptedException {
        Instant startedAt = Instant.now();
        String requestId = UUID.randomUUID().toString();

        RoutingDecision routingDecision = requestRouterClient.resolve(request);
        CacheLookupResponse cacheLookup = cacheClient.lookup(routingDecision.cacheKey());

        if (cacheLookup.hit()) {
            return new OrchestrationResponse(
                    requestId,
                    routingDecision.dedupeKey(),
                    "HIT",
                    "NONE",
                    null,
                    "CACHE",
                    cacheLookup.responsePayload(),
                    startedAt,
                    Instant.now()
            );
        }

        WindowAcquireResponse window = executionWindowClient.acquire(
                new WindowAcquireRequest(
                        routingDecision.dedupeKey(),
                        routingDecision.cacheKey(),
                        properties.executionWindowMs()
                )
        );

        if (!window.leader()) {
            WindowAwaitResponse awaitResponse =
                    executionWindowClient.await(window.windowId(), properties.followerWaitTimeoutMs());

            if (!awaitResponse.completed()) {
                throw new IllegalStateException("Follower timed out waiting for leader result.");
            }

            if (!"COMPLETED".equals(awaitResponse.status())) {
                throw new IllegalStateException(awaitResponse.errorMessage());
            }

            return new OrchestrationResponse(
                    requestId,
                    routingDecision.dedupeKey(),
                    "MISS",
                    "FOLLOWER",
                    window.windowId(),
                    "SHARED_WINDOW",
                    awaitResponse.responsePayload(),
                    startedAt,
                    Instant.now()
            );
        }

        try {
            Thread.sleep(window.windowMs());

            FaasInvocationResponse invocationResponse = faasInvokerClient.invoke(
                    new FaasInvocationRequest(
                            routingDecision.dedupeKey(),
                            routingDecision.routeKey(),
                            request.functionName(),
                            request.payload(),
                            request.metadata()
                    )
            );

            cacheClient.put(
                    routingDecision.cacheKey(),
                    new CacheWriteRequest(invocationResponse.responsePayload(), DEFAULT_CACHE_TTL_SECONDS)
            );

            executionWindowClient.complete(
                    window.windowId(),
                    new WindowCompleteRequest(routingDecision.cacheKey(), invocationResponse.responsePayload())
            );

            return new OrchestrationResponse(
                    requestId,
                    routingDecision.dedupeKey(),
                    "MISS",
                    "LEADER",
                    window.windowId(),
                    "FAAS",
                    invocationResponse.responsePayload(),
                    startedAt,
                    Instant.now()
            );
        } catch (RuntimeException exception) {
            executionWindowClient.fail(window.windowId(), exception.getMessage() == null ? "Invocation failed." : exception.getMessage());
            throw exception;
        }
    }

    public Map<String, Object> health() {
        return Map.of(
                "status", "UP",
                "service", "orchestrator-service",
                "dependencies", Map.of(
                        "requestRouter", "configured",
                        "cache", "configured",
                        "executionWindow", "configured",
                        "faasInvoker", "configured"
                )
        );
    }
}
