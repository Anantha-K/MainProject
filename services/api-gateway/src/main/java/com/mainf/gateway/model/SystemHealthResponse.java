package com.mainf.gateway.model;

import java.time.Instant;
import java.util.Map;

public record SystemHealthResponse(String status, Instant checkedAt, Map<String, Object> services) {
}
