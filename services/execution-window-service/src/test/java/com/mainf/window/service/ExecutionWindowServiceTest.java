package com.mainf.window.service;

import com.mainf.window.model.WindowContracts.WindowAcquireRequest;
import com.mainf.window.model.WindowContracts.WindowAcquireResponse;
import com.mainf.window.model.WindowContracts.WindowAwaitResponse;
import com.mainf.window.model.WindowContracts.WindowCompleteRequest;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ExecutionWindowServiceTest {

    @Test
    void onlyOneCallerBecomesLeaderForSameDedupeKey() throws ExecutionException, InterruptedException {
        ExecutionWindowService service = new ExecutionWindowService();
        ExecutorService executor = Executors.newFixedThreadPool(4);

        Callable<WindowAcquireResponse> task = () -> service.acquire(new WindowAcquireRequest("dedupe-1", "cache-1", 200));
        List<Future<WindowAcquireResponse>> futures = executor.invokeAll(List.of(task, task, task, task));

        long leaders = 0;
        String windowId = null;
        for (Future<WindowAcquireResponse> future : futures) {
            WindowAcquireResponse response = future.get();
            if (response.leader()) {
                leaders++;
            }
            if (windowId == null) {
                windowId = response.windowId();
            }
            assertEquals(windowId, response.windowId());
        }

        assertEquals(1, leaders);
        executor.shutdownNow();
    }

    @Test
    void followersCanAwaitLeaderCompletion() {
        ExecutionWindowService service = new ExecutionWindowService();
        WindowAcquireResponse leader = service.acquire(new WindowAcquireRequest("dedupe-2", "cache-2", 100));
        service.acquire(new WindowAcquireRequest("dedupe-2", "cache-2", 100));

        service.complete(leader.windowId(), new WindowCompleteRequest("cache-2", Map.of("score", 52)));
        WindowAwaitResponse awaited = service.await(leader.windowId(), 50);

        assertEquals(true, awaited.completed());
        assertEquals("COMPLETED", awaited.status());
        assertEquals(52, awaited.responsePayload().get("score"));
    }
}
