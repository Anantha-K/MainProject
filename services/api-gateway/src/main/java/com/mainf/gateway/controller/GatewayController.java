package com.mainf.gateway.controller;

import com.mainf.gateway.client.CacheGatewayClient;
import com.mainf.gateway.client.OrchestratorGatewayClient;
import com.mainf.gateway.model.ExecutionRequest;
import com.mainf.gateway.model.OrchestrationResponse;
import com.mainf.gateway.model.SystemHealthResponse;
import com.mainf.gateway.service.SystemHealthService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class GatewayController {

    private final OrchestratorGatewayClient orchestratorGatewayClient;
    private final CacheGatewayClient cacheGatewayClient;
    private final SystemHealthService systemHealthService;

    public GatewayController(OrchestratorGatewayClient orchestratorGatewayClient,
                             CacheGatewayClient cacheGatewayClient,
                             SystemHealthService systemHealthService) {
        this.orchestratorGatewayClient = orchestratorGatewayClient;
        this.cacheGatewayClient = cacheGatewayClient;
        this.systemHealthService = systemHealthService;
    }

    @PostMapping("/orchestration/execute")
    public OrchestrationResponse execute(@Valid @RequestBody ExecutionRequest request) {
        return orchestratorGatewayClient.execute(request);
    }

    @GetMapping("/system/health")
    public SystemHealthResponse health() {
        return systemHealthService.health();
    }

    @PostMapping("/system/cache/flush")
    public void flushCache() {
        cacheGatewayClient.flush();
    }
}
