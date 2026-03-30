package com.example.demo.controller;

import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@CrossOrigin
public class TrafficController {

    @GetMapping("/traffic")
    public Map<String, Object> getTraffic(@RequestParam String location) {

        long requestReceivedTime = System.currentTimeMillis();

        // Convert to ZonedDateTime
        ZonedDateTime now = ZonedDateTime.ofInstant(
                Instant.ofEpochMilli(requestReceivedTime),
                ZoneId.systemDefault());

        // 1-minute time bucket
        int minuteBucket = now.getMinute();

        long startProcessing = System.currentTimeMillis();

        // Simulate heavy computation
        try {
            Thread.sleep(1000); // 1 second
        } catch (InterruptedException e) {
            e.printStackTrace();
        }

        // Simple pattern logic
        String congestion;
        int hash = Math.abs(location.hashCode());

        if (hash % 3 == 0) {
            congestion = "Heavy";
        } else if (hash % 3 == 1) {
            congestion = "Moderate";
        } else {
            congestion = "Low";
        }

        System.out.println(congestion);

        long endProcessing = System.currentTimeMillis();

        long processingTime = endProcessing - startProcessing;

        Map<String, Object> response = new HashMap<>();
        response.put("location", location);
        response.put("congestion", congestion);
        response.put("requestReceivedAt", requestReceivedTime);
        response.put("minuteBucket", minuteBucket);
        response.put("processingTimeMs", processingTime);

        return response;
    }
}
