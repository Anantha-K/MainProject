# Serverless Function Orchestrator with Microservices

This repository is the FDN-style serverless orchestration project.

It is built to deduplicate identical requests, batch them inside a short execution window, invoke the serverless function only once, cache the result, and fan the same response back to every waiting caller.

## What The Project Does

- accepts concurrent identical requests through an API Gateway
- normalizes and fingerprints requests in a Request Router service
- groups identical requests inside an Execution Window Manager
- elects one leader request and prevents duplicate FaaS invocation
- invokes the execution layer exactly once for the grouped key
- writes results to a Redis-backed cache service
- returns cached responses immediately for later duplicates
- exposes a frontend console for health checks, burst testing, and live response inspection

## Architecture

### Spring Boot Control Plane

- `services/api-gateway`
  Public entry point, health aggregation, and cache reset passthrough.
- `services/orchestrator-service`
  Central brain for routing, cache lookup, window coordination, invocation, and shared result delivery.
- `services/request-router-service`
  Canonical request normalization and deterministic `dedupeKey` generation.
- `services/execution-window-service`
  Single-flight coordination for leader/follower execution windows.

### Node.js Execution Plane

- `services/faas-invoker-service`
  Encapsulates FaaS execution and currently simulates Lambda-style invocation deterministically.
- `services/result-cache-service`
  Uses Redis when available and falls back to memory for local development.
- `services/worker-service`
  Reserved for future event-driven execution with Kafka.

### Frontend

- `fdn-ui`
  Live architecture console with:
  - service health view
  - cold burst testing
  - warm-cache burst testing
  - cache flush
  - response inspection

## Request Flow

1. Client sends `POST /api/v1/orchestration/execute` to the API Gateway.
2. Gateway forwards the request to the Orchestrator.
3. Orchestrator asks the Request Router to generate a canonical `dedupeKey` and `cacheKey`.
4. Orchestrator checks the Result Cache.
5. If the result exists, return immediately from cache.
6. If the result does not exist, acquire an execution window from the Execution Window Manager.
7. If the caller is the leader:
   - wait for the batching window
   - invoke the FaaS Invoker once
   - write the result to cache
   - complete the shared window
8. If the caller is a follower:
   - wait for the leader’s shared result
   - return the same payload without invoking FaaS again

## Services And Ports

- frontend: `4173`
- api gateway: `8088`
- orchestrator: `8080`
- request router: `8081`
- execution window: `8082`
- faas invoker: `8090`
- result cache: `8091`
- redis: `6379`

## API Contracts

### Gateway

- `POST /api/v1/orchestration/execute`
- `GET /api/v1/system/health`
- `POST /api/v1/system/cache/flush`

### Request Router

- `POST /api/v1/routes/resolve`

### Execution Window Manager

- `POST /api/v1/windows/acquire`
- `GET /api/v1/windows/{windowId}/await?waitMs=5000`
- `POST /api/v1/windows/{windowId}/complete`
- `POST /api/v1/windows/{windowId}/fail`

### Result Cache

- `GET /api/v1/cache/{cacheKey}`
- `PUT /api/v1/cache/{cacheKey}`
- `POST /api/v1/cache/flush`

### FaaS Invoker

- `POST /api/v1/invocations`

## Run The Project

### Recommended

```bash
docker compose up --build
```

Then open:

- frontend: [http://localhost:4173](http://localhost:4173)

### Smoke Test

```bash
bash scripts/smoke-test.sh
```

## Project Files

### Core Services

- `services/api-gateway`
- `services/orchestrator-service`
- `services/request-router-service`
- `services/execution-window-service`
- `services/faas-invoker-service`
- `services/result-cache-service`

### Runtime Files

- `docker-compose.yml`
- `Makefile`
- `scripts/smoke-test.sh`
- `scripts/run-local-notes.md`

## Concurrency Design

- request identity is derived from normalized payload + tenant + function name
- only one leader is allowed per `dedupeKey` during the active window
- followers long-poll the execution window rather than invoking again
- cached results short-circuit the whole flow
- the current project uses in-memory active window state in the window service
- the next production hardening step is moving window ownership to Redis or Kafka-backed coordination

## What Is Finished Now

- complete service split for the FDN/orchestrator scope
- live frontend tied to backend APIs
- Dockerfiles for every service
- `docker-compose` wiring for the full stack
- cache flushing for repeatable demos
- smoke test script
- health aggregation
- basic tests for request fingerprinting and leader election logic

## What Can Still Be Improved Later

- distributed lock ownership in Redis for multi-instance execution window safety
- real AWS Lambda invocation instead of deterministic local simulation
- JWT auth and tenant-aware rate limiting
- OpenTelemetry traces and metrics export
- Kafka worker integration for async execution
- CI/CD pipeline and infrastructure as code
