package com.mainf.window.service;

import jakarta.annotation.PreDestroy;
import com.mainf.window.model.WindowContracts.WindowAcquireRequest;
import com.mainf.window.model.WindowContracts.WindowAcquireResponse;
import com.mainf.window.model.WindowContracts.WindowAwaitResponse;
import com.mainf.window.model.WindowContracts.WindowCompleteRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class ExecutionWindowService {

    private final ConcurrentHashMap<String, WindowSlot> activeWindowsByKey = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, WindowSlot> windowsById = new ConcurrentHashMap<>();
    private final ScheduledExecutorService cleanupScheduler = new ScheduledThreadPoolExecutor(1, runnable -> {
        Thread thread = new Thread(runnable, "window-cleanup");
        thread.setDaemon(true);
        return thread;
    });

    public ExecutionWindowService() {
        cleanupScheduler.scheduleAtFixedRate(this::purgeExpiredWindows, 1, 1, TimeUnit.SECONDS);
    }

    public WindowAcquireResponse acquire(WindowAcquireRequest request) {
        final boolean[] leader = {false};

        WindowSlot slot = activeWindowsByKey.compute(request.dedupeKey(), (key, existing) -> {
            if (existing == null || existing.isTerminal()) {
                leader[0] = true;
                WindowSlot created = WindowSlot.open(key, request.cacheKey(), request.windowMs());
                windowsById.put(created.windowId, created);
                return created;
            }

            existing.followerCount.incrementAndGet();
            return existing;
        });

        return new WindowAcquireResponse(slot.windowId, leader[0], slot.windowMs, slot.expiresAt);
    }

    public void complete(String windowId, WindowCompleteRequest request) {
        WindowSlot slot = requireWindow(windowId);
        slot.status = "COMPLETED";
        slot.completion.complete(new WindowPayload(slot.windowId, slot.status, request.responsePayload(), null));
        cleanup(slot);
    }

    public void fail(String windowId, String errorMessage) {
        WindowSlot slot = requireWindow(windowId);
        slot.status = "FAILED";
        slot.completion.complete(new WindowPayload(slot.windowId, slot.status, null, errorMessage));
        cleanup(slot);
    }

    public WindowAwaitResponse await(String windowId, long waitMs) {
        WindowSlot slot = requireWindow(windowId);

        try {
            WindowPayload payload = slot.completion.get(waitMs, TimeUnit.MILLISECONDS);
            return new WindowAwaitResponse(true, payload.status(), payload.windowId(), payload.responsePayload(), payload.errorMessage());
        } catch (TimeoutException timeoutException) {
            return new WindowAwaitResponse(false, slot.status, slot.windowId, null, null);
        } catch (Exception exception) {
            throw new IllegalStateException("Could not await execution window completion.", exception);
        }
    }

    private WindowSlot requireWindow(String windowId) {
        WindowSlot slot = windowsById.get(windowId);
        if (slot == null) {
            throw new IllegalArgumentException("Unknown execution window: " + windowId);
        }
        return slot;
    }

    private void cleanup(WindowSlot slot) {
        activeWindowsByKey.remove(slot.dedupeKey, slot);
        cleanupScheduler.schedule(() -> windowsById.remove(slot.windowId, slot), 30, TimeUnit.SECONDS);
    }

    public Map<String, Object> health() {
        return Map.of(
                "status", "UP",
                "service", "execution-window-service",
                "activeWindows", activeWindowsByKey.size(),
                "trackedWindows", windowsById.size()
        );
    }

    private void purgeExpiredWindows() {
        Instant now = Instant.now();
        windowsById.values().removeIf(slot -> slot.isTerminal() && slot.expiresAt.plusSeconds(30).isBefore(now));
    }

    @PreDestroy
    void shutdown() {
        cleanupScheduler.shutdownNow();
    }

    private record WindowPayload(String windowId, String status, Map<String, Object> responsePayload, String errorMessage) {
    }

    private static final class WindowSlot {
        private final String windowId;
        private final String dedupeKey;
        private final String cacheKey;
        private final long windowMs;
        private final Instant expiresAt;
        private final CompletableFuture<WindowPayload> completion;
        private final AtomicInteger followerCount;
        private volatile String status;

        private WindowSlot(String windowId,
                           String dedupeKey,
                           String cacheKey,
                           long windowMs,
                           Instant expiresAt,
                           CompletableFuture<WindowPayload> completion,
                           AtomicInteger followerCount,
                           String status) {
            this.windowId = windowId;
            this.dedupeKey = dedupeKey;
            this.cacheKey = cacheKey;
            this.windowMs = windowMs;
            this.expiresAt = expiresAt;
            this.completion = completion;
            this.followerCount = followerCount;
            this.status = status;
        }

        private static WindowSlot open(String dedupeKey, String cacheKey, long windowMs) {
            return new WindowSlot(
                    UUID.randomUUID().toString(),
                    dedupeKey,
                    cacheKey,
                    windowMs,
                    Instant.now().plusMillis(windowMs),
                    new CompletableFuture<>(),
                    new AtomicInteger(0),
                    "OPEN"
            );
        }

        private boolean isTerminal() {
            return "COMPLETED".equals(status) || "FAILED".equals(status);
        }
    }
}
