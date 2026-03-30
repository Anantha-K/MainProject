package com.mainf.window.controller;

import com.mainf.window.service.ExecutionWindowService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class HealthController {

    private final ExecutionWindowService executionWindowService;

    public HealthController(ExecutionWindowService executionWindowService) {
        this.executionWindowService = executionWindowService;
    }

    @GetMapping("/actuator-like/health")
    public Map<String, Object> health() {
        return executionWindowService.health();
    }
}
