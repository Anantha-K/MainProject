package com.mainf.router.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class HealthController {

    @GetMapping("/actuator-like/health")
    public Map<String, Object> health() {
        return Map.of(
                "status", "UP",
                "service", "request-router-service"
        );
    }
}
