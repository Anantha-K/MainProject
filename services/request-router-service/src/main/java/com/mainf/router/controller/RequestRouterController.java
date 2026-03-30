package com.mainf.router.controller;

import com.mainf.router.model.RoutingModels.RoutingDecision;
import com.mainf.router.model.RoutingModels.RoutingRequest;
import com.mainf.router.service.RequestFingerprintService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/routes")
public class RequestRouterController {

    private final RequestFingerprintService requestFingerprintService;

    public RequestRouterController(RequestFingerprintService requestFingerprintService) {
        this.requestFingerprintService = requestFingerprintService;
    }

    @PostMapping("/resolve")
    public RoutingDecision resolve(@Valid @RequestBody RoutingRequest request) {
        return requestFingerprintService.resolve(request);
    }
}
