package com.example.demo.service;

import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class Ec2LifecycleManager {

    private static final Logger log = LoggerFactory.getLogger(Ec2LifecycleManager.class);

    private final Ec2Service ec2Service;
    private final boolean autoManage;
    private final String managedInstanceId;

    public Ec2LifecycleManager(
            Ec2Service ec2Service,
            @Value("${ec2.auto-manage-instance:false}") boolean autoManage,
            @Value("${ec2.managed-instance-id:}") String managedInstanceId) {
        this.ec2Service = ec2Service;
        this.autoManage = autoManage;
        this.managedInstanceId = managedInstanceId;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        if (!autoManage) {
            log.info("EC2 lifecycle auto-management is disabled.");
            return;
        }

        if (managedInstanceId == null || managedInstanceId.isBlank()) {
            log.warn("ec2.managed-instance-id is empty. Skipping startup start request.");
            return;
        }

        try {
            log.info("Starting EC2 instance on app startup: {}", managedInstanceId);
            ec2Service.startInstance(managedInstanceId);
        } catch (RuntimeException ex) {
            log.error("Failed to auto-start EC2 instance {}", managedInstanceId, ex);
        }
    }

    @PreDestroy
    public void onShutdown() {
        if (!autoManage) {
            return;
        }

        if (managedInstanceId == null || managedInstanceId.isBlank()) {
            return;
        }

        try {
            log.info("Stopping EC2 instance on app shutdown: {}", managedInstanceId);
            ec2Service.stopInstance(managedInstanceId);
        } catch (RuntimeException ex) {
            log.error("Failed to auto-stop EC2 instance {}", managedInstanceId, ex);
        }
    }
}
