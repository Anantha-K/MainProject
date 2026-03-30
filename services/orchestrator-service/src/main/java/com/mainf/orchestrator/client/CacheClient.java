package com.mainf.orchestrator.client;

import com.mainf.orchestrator.config.ServiceProperties;
import com.mainf.orchestrator.model.Contracts.CacheLookupResponse;
import com.mainf.orchestrator.model.Contracts.CacheWriteRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Component
public class CacheClient {

    private final RestClient restClient;

    public CacheClient(RestClient.Builder builder, ServiceProperties properties) {
        this.restClient = builder.baseUrl(properties.cache().baseUrl()).build();
    }

    public CacheLookupResponse lookup(String cacheKey) {
        try {
            return restClient.get()
                    .uri("/api/v1/cache/{cacheKey}", cacheKey)
                    .retrieve()
                    .body(CacheLookupResponse.class);
        } catch (RestClientResponseException exception) {
            if (exception.getStatusCode() == HttpStatus.NOT_FOUND) {
                return new CacheLookupResponse(false, cacheKey, null, null);
            }
            throw exception;
        }
    }

    public void put(String cacheKey, CacheWriteRequest request) {
        restClient.put()
                .uri("/api/v1/cache/{cacheKey}", cacheKey)
                .body(request)
                .retrieve()
                .toBodilessEntity();
    }
}
