package com.mainf.window.controller;

import com.mainf.window.model.WindowContracts.WindowAcquireRequest;
import com.mainf.window.model.WindowContracts.WindowAcquireResponse;
import com.mainf.window.model.WindowContracts.WindowAwaitResponse;
import com.mainf.window.model.WindowContracts.WindowCompleteRequest;
import com.mainf.window.model.WindowContracts.WindowFailRequest;
import com.mainf.window.service.ExecutionWindowService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/windows")
public class ExecutionWindowController {

    private final ExecutionWindowService executionWindowService;

    public ExecutionWindowController(ExecutionWindowService executionWindowService) {
        this.executionWindowService = executionWindowService;
    }

    @PostMapping("/acquire")
    public WindowAcquireResponse acquire(@RequestBody WindowAcquireRequest request) {
        return executionWindowService.acquire(request);
    }

    @GetMapping("/{windowId}/await")
    public WindowAwaitResponse await(@PathVariable String windowId, @RequestParam(defaultValue = "2000") long waitMs) {
        return executionWindowService.await(windowId, waitMs);
    }

    @PostMapping("/{windowId}/complete")
    public void complete(@PathVariable String windowId, @RequestBody WindowCompleteRequest request) {
        executionWindowService.complete(windowId, request);
    }

    @PostMapping("/{windowId}/fail")
    public void fail(@PathVariable String windowId, @RequestBody WindowFailRequest request) {
        executionWindowService.fail(windowId, request.errorMessage());
    }
}
