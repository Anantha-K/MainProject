package com.mainf.router.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.mainf.router.model.RoutingModels.RoutingDecision;
import com.mainf.router.model.RoutingModels.RoutingRequest;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Service
public class RequestFingerprintService {

    private final ObjectMapper objectMapper;

    public RequestFingerprintService() {
        this.objectMapper = new ObjectMapper()
                .configure(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY, true)
                .configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true);
    }

    public RoutingDecision resolve(RoutingRequest request) {
        Map<String, Object> canonical = new LinkedHashMap<>();
        canonical.put("tenantId", request.tenantId().trim().toLowerCase(Locale.ROOT));
        canonical.put("functionName", request.functionName().trim().toLowerCase(Locale.ROOT));
        canonical.put("payload", request.payload());

        String canonicalRequest = toCanonicalJson(canonical);
        String routeKey = canonical.get("tenantId") + ":" + canonical.get("functionName");
        String dedupeKey = "sha256:" + sha256(canonicalRequest);
        String cacheKey = "cache:" + routeKey + ":" + dedupeKey;

        return new RoutingDecision(routeKey, dedupeKey, cacheKey, canonicalRequest);
    }

    private String toCanonicalJson(Map<String, Object> value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Could not canonicalize request payload.", exception);
        }
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("Missing SHA-256 support.", exception);
        }
    }
}
