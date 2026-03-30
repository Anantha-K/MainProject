import { useEffect, useState } from "react";
import "./App.css";

const architectureLayers = [
  {
    layer: "Entry",
    services: ["API Gateway"],
    detail: "Accepts external traffic, applies auth and rate limits, and forwards orchestration requests."
  },
  {
    layer: "Control Plane",
    services: [
      "Orchestrator Service",
      "Request Router Service",
      "Execution Window Manager Service"
    ],
    detail:
      "Normalizes requests, checks cache, groups duplicates, elects a single leader, and manages shared responses."
  },
  {
    layer: "Execution Plane",
    services: ["FaaS Invoker Service", "Result Cache Service", "Worker Service (future)"],
    detail:
      "Executes Lambda workloads, stores reusable results in Redis, and provides a path to async Kafka workers."
  }
];

const serviceBreakdown = [
  {
    name: "API Gateway",
    stack: "Spring Boot",
    responsibility: "External entry point, health aggregation, request forwarding, and a place for auth and rate limiting."
  },
  {
    name: "Orchestrator Service",
    stack: "Spring Boot",
    responsibility: "Central control brain that performs cache lookup, window acquisition, FaaS execution, and result fan-out."
  },
  {
    name: "Request Router Service",
    stack: "Spring Boot",
    responsibility: "Generates canonical route, dedupe, and cache keys from normalized request payloads."
  },
  {
    name: "Execution Window Manager Service",
    stack: "Spring Boot",
    responsibility: "Guarantees single-leader execution for identical requests arriving in the same batching window."
  },
  {
    name: "FaaS Invoker Service",
    stack: "Node.js + Express",
    responsibility: "Wraps Lambda invocation logic and isolates cloud execution concerns from orchestration."
  },
  {
    name: "Result Cache Service",
    stack: "Node.js + Express + Redis",
    responsibility: "Reads and writes execution results with TTL so later duplicates return immediately."
  }
];

const apiContracts = [
  {
    service: "Gateway",
    method: "POST",
    path: "/api/v1/orchestration/execute",
    purpose: "Primary entry point for clients issuing deduplicated function requests."
  },
  {
    service: "Gateway",
    method: "GET",
    path: "/api/v1/system/health",
    purpose: "Aggregated health across the platform."
  },
  {
    service: "Request Router",
    method: "POST",
    path: "/api/v1/routes/resolve",
    purpose: "Builds canonical request fingerprints and cache keys."
  },
  {
    service: "Execution Window Manager",
    method: "POST",
    path: "/api/v1/windows/acquire",
    purpose: "Opens or joins a batching window and elects a leader."
  },
  {
    service: "Result Cache",
    method: "GET",
    path: "/api/v1/cache/{cacheKey}",
    purpose: "Returns cached responses when a result already exists."
  },
  {
    service: "FaaS Invoker",
    method: "POST",
    path: "/api/v1/invocations",
    purpose: "Executes the underlying serverless function once per dedupe window."
  }
];

const improvements = [
  "Replace local window state with a Redis-backed distributed lock and completion channel for horizontal scale.",
  "Publish ExecutionRequested and ExecutionCompleted events to Kafka for async workers, retries, and backpressure.",
  "Add JWT auth, per-tenant throttling, and API keys at the gateway boundary.",
  "Export traces, metrics, and logs with OpenTelemetry so every grouped execution can be followed end to end.",
  "Add IaC for AWS deployment using ECS Fargate, ElastiCache, Lambda, CloudWatch, and managed Kafka."
];

const createRequestPayload = (location) => ({
  tenantId: "team-a",
  functionName: "traffic-score",
  payload: {
    location: location.trim().toLowerCase()
  },
  metadata: {
    source: "frontend-console"
  }
});

const buildSimulation = ({ duplicates, cacheWarm, windowMs }) => {
  const requestCount = Math.max(1, duplicates);

  if (cacheWarm) {
    return {
      requestCount,
      faasInvocations: 0,
      sharedResponses: requestCount,
      savings: requestCount,
      latency: 12,
      mode: "CACHE_HIT",
      steps: [
        "Router computes the same dedupe key for every request.",
        "Cache lookup succeeds immediately.",
        "All requests receive the previously computed response.",
        "No execution window or FaaS invocation is needed."
      ]
    };
  }

  return {
    requestCount,
    faasInvocations: 1,
    sharedResponses: requestCount,
    savings: Math.max(0, requestCount - 1),
    latency: windowMs + 250,
    mode: "WINDOW_SHARED",
    steps: [
      "Request Router computes one shared dedupe key.",
      `Execution Window Manager groups arrivals for ${windowMs} ms.`,
      "Exactly one leader invokes the FaaS layer.",
      "Followers wait on the shared window result and all receive the same payload."
    ]
  };
};

const formatJson = (value) => JSON.stringify(value, null, 2);

function App() {
  const [duplicates, setDuplicates] = useState(6);
  const [windowMs, setWindowMs] = useState(200);
  const [cacheWarm, setCacheWarm] = useState(false);
  const [location, setLocation] = useState("seattle");
  const [simulation, setSimulation] = useState(
    buildSimulation({ duplicates: 6, cacheWarm: false, windowMs: 200 })
  );
  const [systemHealth, setSystemHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState("");
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState("");
  const [runSummary, setRunSummary] = useState(null);
  const [responses, setResponses] = useState([]);
  const [cacheMessage, setCacheMessage] = useState("");

  const rerunSimulation = () => {
    setSimulation(buildSimulation({ duplicates, cacheWarm, windowMs }));
  };

  const fetchHealth = async () => {
    setHealthLoading(true);
    setHealthError("");

    try {
      const response = await fetch("/api/v1/system/health");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Health check failed.");
      }

      setSystemHealth(data);
    } catch (error) {
      setHealthError(error instanceof Error ? error.message : "Health check failed.");
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const flushCache = async () => {
    setCacheMessage("");
    setRunError("");

    try {
      const response = await fetch("/api/v1/system/cache/flush", { method: "POST" });
      if (!response.ok) {
        throw new Error("Cache flush failed.");
      }
      setCacheMessage("Cache cleared.");
      fetchHealth();
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Cache flush failed.");
    }
  };

  const runBurst = async ({ warmCache }) => {
    const safeLocation = location.trim().toLowerCase();
    if (!safeLocation) {
      setRunError("Location is required.");
      return;
    }

    setRunLoading(true);
    setRunError("");
    setRunSummary(null);
    setResponses([]);

    try {
      if (warmCache) {
        await fetch("/api/v1/orchestration/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createRequestPayload(safeLocation))
        });
      }

      const requestCount = Math.max(1, duplicates);
      const startedAt = performance.now();

      const results = await Promise.all(
        Array.from({ length: requestCount }, async (_value, index) => {
          const response = await fetch("/api/v1/orchestration/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...createRequestPayload(safeLocation),
              metadata: {
                source: "frontend-console",
                requestOrdinal: index + 1
              }
            })
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data?.message || `Execution failed for request ${index + 1}.`);
          }

          return data;
        })
      );

      const totalLatency = Math.round(performance.now() - startedAt);
      const uniqueDedupeKeys = new Set(results.map((item) => item.dedupeKey)).size;
      const leaderCount = results.filter((item) => item.executionRole === "LEADER").length;
      const followerCount = results.filter((item) => item.executionRole === "FOLLOWER").length;
      const cacheCount = results.filter((item) => item.servedFrom === "CACHE").length;

      setResponses(results);
      setRunSummary({
        requestCount,
        totalLatency,
        uniqueDedupeKeys,
        leaderCount,
        followerCount,
        cacheCount,
        sampledPayload: results[0]?.responsePayload ?? null
      });
      fetchHealth();
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Execution failed.");
    } finally {
      setRunLoading(false);
    }
  };

  return (
    <main className="appShell">
      <section className="hero">
        <div className="heroText">
          <p className="eyebrow">Distributed Systems Platform</p>
          <h1>Serverless Function Orchestrator with Microservices</h1>
          <p className="heroCopy">
            A production-style platform for batching duplicate requests, preventing redundant
            Lambda invocations, and safely sharing one execution result across concurrent callers.
          </p>
        </div>

        <div className="heroMetrics">
          <article>
            <span>Execution model</span>
            <strong>Single-flight</strong>
          </article>
          <article>
            <span>Windowing</span>
            <strong>Leader + followers</strong>
          </article>
          <article>
            <span>Result reuse</span>
            <strong>Redis-backed cache</strong>
          </article>
        </div>
      </section>

      <section className="twoColumn">
        <article className="sectionCard">
          <div className="sectionHeading">
            <h2>System Health</h2>
            <p>Live status aggregated through the API Gateway.</p>
          </div>

          <div className="toolbar">
            <button type="button" onClick={fetchHealth} disabled={healthLoading}>
              {healthLoading ? "Refreshing..." : "Refresh Health"}
            </button>
            {systemHealth?.status && (
              <span className={`statusBadge ${systemHealth.status === "UP" ? "up" : "degraded"}`}>
                {systemHealth.status}
              </span>
            )}
          </div>

          {healthError && <p className="errorBanner">{healthError}</p>}

          <div className="healthGrid">
            {systemHealth?.services
              ? Object.entries(systemHealth.services).map(([name, details]) => (
                  <article className="healthCard" key={name}>
                    <div className="healthHead">
                      <strong>{name}</strong>
                      <span className={`statusBadge ${details.status === "UP" ? "up" : "down"}`}>
                        {details.status}
                      </span>
                    </div>
                    <pre>{formatJson(details)}</pre>
                  </article>
                ))
              : (
                <p className="mutedBlock">Bring the stack up to see live service health here.</p>
              )}
          </div>
        </article>

        <article className="sectionCard">
          <div className="sectionHeading">
            <h2>Live Duplicate Burst</h2>
            <p>Send concurrent identical requests through the gateway and inspect the grouped outcome.</p>
          </div>

          <div className="controls">
            <label>
              Location
              <input
                type="text"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="seattle"
              />
            </label>
            <label>
              Duplicate requests
              <input
                type="number"
                min="1"
                value={duplicates}
                onChange={(event) => setDuplicates(Number(event.target.value))}
              />
            </label>
            <button type="button" onClick={() => runBurst({ warmCache: false })} disabled={runLoading}>
              {runLoading ? "Running..." : "Run Cold Burst"}
            </button>
            <button type="button" onClick={() => runBurst({ warmCache: true })} disabled={runLoading}>
              {runLoading ? "Running..." : "Warm Cache Then Burst"}
            </button>
            <button type="button" onClick={flushCache} disabled={runLoading}>
              Flush Cache
            </button>
          </div>

          {runError && <p className="errorBanner">{runError}</p>}
          {cacheMessage && <p className="mutedBlock">{cacheMessage}</p>}

          {runSummary && (
            <>
              <div className="simulationMetrics">
                <article>
                  <span>Requests</span>
                  <strong>{runSummary.requestCount}</strong>
                </article>
                <article>
                  <span>Unique dedupe keys</span>
                  <strong>{runSummary.uniqueDedupeKeys}</strong>
                </article>
                <article>
                  <span>Leaders / followers</span>
                  <strong>{runSummary.leaderCount} / {runSummary.followerCount}</strong>
                </article>
                <article>
                  <span>Total burst latency</span>
                  <strong>{runSummary.totalLatency} ms</strong>
                </article>
              </div>

              <p className="savingsBanner">
                Cache-served responses in burst: <strong>{runSummary.cacheCount}</strong>
              </p>

              <div className="responsePanel">
                <p className="responseTitle">Sample response payload</p>
                <pre>{formatJson(runSummary.sampledPayload)}</pre>
              </div>
            </>
          )}
        </article>
      </section>

      <section className="sectionCard">
        <div className="sectionHeading">
          <h2>Architecture</h2>
          <p>Microservices are split into a control plane and an execution plane to keep responsibilities clear.</p>
        </div>

        <div className="layerGrid">
          {architectureLayers.map((layer) => (
            <article className="infoCard" key={layer.layer}>
              <p className="cardEyebrow">{layer.layer}</p>
              <h3>{layer.services.join(" • ")}</h3>
              <p>{layer.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="sectionCard">
        <div className="sectionHeading">
          <h2>Service Breakdown</h2>
          <p>Each service owns one clear boundary so the system stays scalable and loosely coupled.</p>
        </div>

        <div className="serviceGrid">
          {serviceBreakdown.map((service) => (
            <article className="serviceCard" key={service.name}>
              <div className="serviceMeta">
                <h3>{service.name}</h3>
                <span>{service.stack}</span>
              </div>
              <p>{service.responsibility}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="twoColumn">
        <article className="sectionCard">
          <div className="sectionHeading">
            <h2>Duplicate Request Flow</h2>
            <p>The leader-follower model ensures that identical requests only execute once.</p>
          </div>

          <ol className="flowList">
            <li>Gateway forwards the request to the Orchestrator.</li>
            <li>Request Router returns a deterministic dedupe key and cache key.</li>
            <li>Cache is checked first for a previously computed result.</li>
            <li>On a miss, the Execution Window Manager elects one leader.</li>
            <li>The leader waits for the short batching window, then invokes FaaS once.</li>
            <li>The result is written to Redis and released to all followers.</li>
          </ol>
        </article>

        <article className="sectionCard">
          <div className="sectionHeading">
            <h2>Concurrency Safety</h2>
            <p>The core guarantee is one execution per dedupe key inside the active window.</p>
          </div>

          <ul className="plainList">
            <li>Use a shared dedupe key generated from canonicalized request content.</li>
            <li>Elect one leader with an execution window lock, not with best-effort timing.</li>
            <li>Hold followers on long-poll or pub/sub rather than triggering second executions.</li>
            <li>Write the result once to Redis with TTL and return the same payload to every waiter.</li>
            <li>Promote lock ownership to Redis for multi-instance deployment.</li>
          </ul>
        </article>
      </section>

      <section className="twoColumn">
        <article className="sectionCard">
          <div className="sectionHeading">
            <h2>API Contracts</h2>
            <p>REST first, with clear boundaries that can later become Kafka events.</p>
          </div>

          <div className="contractList">
            {apiContracts.map((contract) => (
              <div className="contractRow" key={`${contract.method}-${contract.path}`}>
                <div>
                  <span className="method">{contract.method}</span>
                  <code>{contract.path}</code>
                </div>
                <p>
                  <strong>{contract.service}:</strong> {contract.purpose}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="sectionCard simulatorCard">
          <div className="sectionHeading">
            <h2>Expected Duplicate Behavior</h2>
            <p>Use the simulation panel to reason about batching before you run the live burst.</p>
          </div>

          <div className="controls">
            <label>
              Duplicate requests
              <input
                type="number"
                min="1"
                value={duplicates}
                onChange={(event) => setDuplicates(Number(event.target.value))}
              />
            </label>
            <label>
              Window size (ms)
              <input
                type="number"
                min="50"
                step="50"
                value={windowMs}
                onChange={(event) => setWindowMs(Number(event.target.value))}
              />
            </label>
            <label className="checkboxRow">
              <input
                type="checkbox"
                checked={cacheWarm}
                onChange={(event) => setCacheWarm(event.target.checked)}
              />
              Warm Redis cache
            </label>
            <button type="button" onClick={rerunSimulation}>
              Recalculate
            </button>
          </div>

          <div className="simulationMetrics">
            <article>
              <span>Mode</span>
              <strong>{simulation.mode}</strong>
            </article>
            <article>
              <span>FaaS invocations</span>
              <strong>{simulation.faasInvocations}</strong>
            </article>
            <article>
              <span>Shared responses</span>
              <strong>{simulation.sharedResponses}</strong>
            </article>
            <article>
              <span>Approx latency</span>
              <strong>{simulation.latency} ms</strong>
            </article>
          </div>

          <p className="savingsBanner">
            Duplicate execution savings: <strong>{simulation.savings}</strong>
          </p>

          <ul className="plainList">
            {simulation.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="sectionCard">
        <div className="sectionHeading">
          <h2>Latest Burst Responses</h2>
          <p>These are the actual gateway responses from the most recent live run.</p>
        </div>

        {responses.length === 0 ? (
          <p className="mutedBlock">Run a burst to inspect individual request outcomes.</p>
        ) : (
          <div className="responseGrid">
            {responses.map((item, index) => (
              <article className="responseCard" key={item.requestId ?? index}>
                <div className="healthHead">
                  <strong>Request {index + 1}</strong>
                  <span className={`statusBadge ${item.servedFrom === "CACHE" ? "up" : "degraded"}`}>
                    {item.executionRole}
                  </span>
                </div>
                <pre>{formatJson(item)}</pre>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="sectionCard">
        <div className="sectionHeading">
          <h2>Production Improvements</h2>
          <p>These are the next upgrades once the synchronous REST baseline is running well.</p>
        </div>

        <ul className="plainList">
          {improvements.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export default App;
