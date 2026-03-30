package com.mainf.orchestrator.controller;

import com.mainf.orchestrator.model.ExecutionRequest;
import com.mainf.orchestrator.model.OrchestrationResponse;
import com.mainf.orchestrator.service.OrchestrationService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/orchestration")
public class OrchestrationController {

    private final OrchestrationService orchestrationService;

    public OrchestrationController(OrchestrationService orchestrationService) {
        this.orchestrationService = orchestrationService;
    }

    @PostMapping("/execute")
    public OrchestrationResponse execute(@Valid @RequestBody ExecutionRequest request) throws InterruptedException {
        return orchestrationService.orchestrate(request);
    }
}
