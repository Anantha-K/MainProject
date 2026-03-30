# Local Run Notes

Preferred path:

1. `docker compose up --build`
2. Open `http://localhost:4173`
3. Use the frontend to:
   - refresh system health
   - run a cold burst
   - warm cache then burst
4. Optionally run `bash scripts/smoke-test.sh`

Default ports:

- frontend: `4173`
- api gateway: `8088`
- orchestrator: `8080`
- request router: `8081`
- execution window: `8082`
- faas invoker: `8090`
- result cache: `8091`
- redis: `6379`
