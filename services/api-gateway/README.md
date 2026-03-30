# API Gateway

Spring Boot edge service that exposes the public REST interface for the platform.

Responsibilities:

- forward `POST /api/v1/orchestration/execute` to the orchestrator
- aggregate downstream health into `GET /api/v1/system/health`
- centralize auth, rate limiting, request shaping, and trace propagation in future iterations
