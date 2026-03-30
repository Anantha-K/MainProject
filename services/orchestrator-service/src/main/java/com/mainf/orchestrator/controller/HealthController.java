package com.mainf.orchestrator.controller;

import com.mainf.orchestrator.service.OrchestrationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class HealthController {

    private final OrchestrationService orchestrationService;

    public HealthController(OrchestrationService orchestrationService) {
        this.orchestrationService = orchestrationService;
    }

    @GetMapping("/actuator-like/health")
    public Map<String, Object> health() {
        return orchestrationService.health();
    }
}
