package com.example.demo.service;

import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.ec2.Ec2Client;
import software.amazon.awssdk.services.ec2.model.Ec2Exception;
import software.amazon.awssdk.services.ec2.model.StartInstancesRequest;
import software.amazon.awssdk.services.ec2.model.StartInstancesResponse;
import software.amazon.awssdk.services.ec2.model.StopInstancesRequest;
import software.amazon.awssdk.services.ec2.model.StopInstancesResponse;

import java.util.HashMap;
import java.util.Map;

@Service
public class Ec2Service {

    private final Ec2Client ec2Client;

    public Ec2Service(Ec2Client ec2Client) {
        this.ec2Client = ec2Client;
    }

    public Map<String, Object> startInstance(String instanceId) {
        try {
            StartInstancesRequest request = StartInstancesRequest.builder()
                    .instanceIds(instanceId)
                    .build();

            StartInstancesResponse response = ec2Client.startInstances(request);

            Map<String, Object> result = new HashMap<>();
            result.put("instanceId", instanceId);
            result.put("action", "start");
            result.put("status", "requested");

            if (!response.startingInstances().isEmpty()) {
                result.put("currentState", response.startingInstances().get(0).currentState().nameAsString());
                result.put("previousState", response.startingInstances().get(0).previousState().nameAsString());
            }

            return result;
        } catch (Ec2Exception ex) {
            throw new RuntimeException("Failed to start instance " + instanceId + ": " + ex.awsErrorDetails().errorMessage(), ex);
        }
    }

    public Map<String, Object> stopInstance(String instanceId) {
        try {
            StopInstancesRequest request = StopInstancesRequest.builder()
                    .instanceIds(instanceId)
                    .build();

            StopInstancesResponse response = ec2Client.stopInstances(request);

            Map<String, Object> result = new HashMap<>();
            result.put("instanceId", instanceId);
            result.put("action", "stop");
            result.put("status", "requested");

            if (!response.stoppingInstances().isEmpty()) {
                result.put("currentState", response.stoppingInstances().get(0).currentState().nameAsString());
                result.put("previousState", response.stoppingInstances().get(0).previousState().nameAsString());
            }

            return result;
        } catch (Ec2Exception ex) {
            throw new RuntimeException("Failed to stop instance " + instanceId + ": " + ex.awsErrorDetails().errorMessage(), ex);
        }
    }
}
