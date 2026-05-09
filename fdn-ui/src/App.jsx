import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const tabs = [
  { name: "Dashboard", icon: "▦" },
  { name: "Requests", icon: "↯" },
  { name: "Cache", icon: "▣" },
  { name: "Functions", icon: "◈" },
  { name: "Health", icon: "✓" },
  { name: "Logs", icon: "▤" },
];

const createPayload = (location, ordinal = 1) => ({
  tenantId: "team-a",
  functionName: "traffic-score",
  payload: { location: location.trim().toLowerCase() },
  metadata: {
    source: "ops-panel",
    requestOrdinal: ordinal,
  },
});

const pretty = (value) => JSON.stringify(value, null, 2);
const formatClock = (value = new Date()) => value.toLocaleTimeString([], { hour12: false });
const healthyServiceCount = (health) =>
  health?.services ? Object.values(health.services).filter((service) => service.status === "UP").length : 0;
const totalServiceCount = (health) => (health?.services ? Object.keys(health.services).length : 0);

const metricConfigs = {
  traffic: {
    title: "Global Traffic",
    key: "requestCount",
    unit: "req",
    description: "Identical requests received per burst",
    tone: "cyan",
  },
  services: {
    title: "Active Services",
    key: "activeServices",
    unit: "svc",
    description: "Healthy services seen by the gateway",
    tone: "emerald",
  },
  latency: {
    title: "Burst Latency",
    key: "latencyMs",
    unit: "ms",
    description: "End-to-end time measured at the frontend",
    tone: "amber",
  },
  avoided: {
    title: "Avoided Invocations",
    key: "avoidedExecutions",
    unit: "saved",
    description: "Executions avoided via followers plus cache hits",
    tone: "purple",
  },
};

const buildCacheEntries = (responses, cacheBackend, cacheVersion) => {
  const grouped = new Map();

  responses.forEach((response) => {
    if (!response?.dedupeKey) {
      return;
    }

    const key = `cache:team-a:${response.responsePayload?.location || "traffic-score"}:${response.dedupeKey.slice(0, 12)}`;
    const existing = grouped.get(key);
    const preview = response.responsePayload
      ? {
          location: response.responsePayload.location,
          score: response.responsePayload.score,
          category: response.responsePayload.category,
        }
      : null;

    if (existing) {
      existing.hits += 1;
      existing.servedFrom.add(response.servedFrom);
      existing.lastAccessed = response.completedAt || existing.lastAccessed;
    } else {
      grouped.set(key, {
        key,
        type: "JSON",
        hits: 1,
        ttlLabel: response.servedFrom === "CACHE" ? "hot" : "warming",
        backend: cacheBackend || "memory",
        lastAccessed: response.completedAt || null,
        payloadPreview: preview,
        servedFrom: new Set([response.servedFrom]),
      });
    }
  });

  const rows = Array.from(grouped.values()).map((entry) => ({
    ...entry,
    servedFrom: Array.from(entry.servedFrom).join(", "),
    size: `${Math.max(1, JSON.stringify(entry.payloadPreview || {}).length / 1000).toFixed(1)} KB`,
    version: cacheVersion,
  }));

  if (!rows.length) {
    rows.push({
      key: "No cache entries observed yet",
      type: "EMPTY",
      hits: 0,
      ttlLabel: "-",
      backend: cacheBackend || "memory",
      lastAccessed: null,
      payloadPreview: null,
      servedFrom: "-",
      size: "0 KB",
      version: cacheVersion,
    });
  }

  return rows;
};

function Sidebar({ activeTab, setActiveTab }) {
  return (
    <aside className="opsSidebar">
      <div className="sidebarGlow" />

      <div className="brandBlock">
        <div className="brandIcon">⚡</div>
        <div>
          <h1>
            FDN<span>Panel</span>
          </h1>
        </div>
      </div>

      <nav className="navList">
        <p className="navLabel">Navigation</p>
        {tabs.map((tab) => (
          <button
            className={`navItem ${activeTab === tab.name ? "active" : ""}`}
            key={tab.name}
            type="button"
            onClick={() => setActiveTab(tab.name)}
          >
            <span className="navIcon">{tab.icon}</span>
            <span>{tab.name}</span>
            <small>›</small>
          </button>
        ))}
      </nav>

      <div className="userCard">
        <button className="settingsButton" type="button">
          ⚙ Settings
        </button>
        <div className="profileBox">
          <div className="avatar">OP</div>
          <div>
            <strong>Admin</strong>
            <p>Online</p>
          </div>
          <span className="onlineDot" />
        </div>
      </div>
    </aside>
  );
}

function Header({ eyebrow, title, children }) {
  return (
    <header className="viewHeader">
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <div className="headerActions">{children}</div>
    </header>
  );
}

function StatCard({ title, value, change, tone = "cyan" }) {
  return (
    <article className={`statCard ${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{change}</small>
    </article>
  );
}

function Dashboard({ health, runSummary, refreshHealth, runColdBurst, sessionHistory, activityFeed }) {
  const [activeMetric, setActiveMetric] = useState("traffic");
  const [activeRange, setActiveRange] = useState("LIVE");
  const healthyCount = healthyServiceCount(health);
  const servicesCount = totalServiceCount(health);

  const rangeSizes = { LIVE: 12, "7D": 24, "30D": 40 };
  const chartPoints = useMemo(() => {
    const config = metricConfigs[activeMetric];
    const sliced = sessionHistory.slice(-rangeSizes[activeRange]);
    if (!sliced.length) {
      return [];
    }
    const max = Math.max(...sliced.map((point) => point[config.key] ?? 0), 1);
    return sliced.map((point, index) => ({
      id: `${point.timeLabel}-${index}`,
      value: point[config.key] ?? 0,
      label: point.timeLabel,
      detail: point.detail,
      height: Math.max(10, Math.round(((point[config.key] ?? 0) / max) * 100)),
    }));
  }, [activeMetric, activeRange, sessionHistory]);

  const latestPoint = chartPoints.at(-1);
  const averageLatency = sessionHistory.length
    ? Math.round(sessionHistory.reduce((sum, point) => sum + point.latencyMs, 0) / sessionHistory.length)
    : 0;
  const totalRequests = sessionHistory.reduce((sum, point) => sum + point.requestCount, 0);
  const totalAvoided = sessionHistory.reduce((sum, point) => sum + point.avoidedExecutions, 0);

  return (
    <section className="viewShell">
      <Header eyebrow="Overview" title="Service metrics">
        <button className="ghostButton" type="button" onClick={refreshHealth}>
          ↻ Sync
        </button>
        <button className="primaryButton" type="button" onClick={runColdBurst}>
          Run Burst
        </button>
      </Header>

      <main className="contentGrid">
        <div className="statGrid">
          <button type="button" onClick={() => setActiveMetric("traffic")}>
            <StatCard title="Global Traffic" value={`${totalRequests || runSummary?.requestCount || 0} req`} change={`${sessionHistory.length} session samples`} tone="cyan" />
          </button>
          <button type="button" onClick={() => setActiveMetric("services")}>
            <StatCard title="Active Services" value={`${healthyCount}/${servicesCount || 5}`} change={health?.status || "Pending"} tone="emerald" />
          </button>
          <button type="button" onClick={() => setActiveMetric("latency")}>
            <StatCard title="Burst Latency" value={`${runSummary?.totalLatency ?? averageLatency ?? 0}ms`} change="Measured from gateway response" tone="amber" />
          </button>
          <button type="button" onClick={() => setActiveMetric("avoided")}>
            <StatCard title="Avoided Invocations" value={totalAvoided || runSummary?.avoidedExecutions || 0} change="Followers + cache hits" tone="purple" />
          </button>
        </div>

        <div className="panelGrid">
          <article className="widePanel">
            <div className="panelHead">
              <div>
                <h3>{metricConfigs[activeMetric].title}</h3>
                <p>{metricConfigs[activeMetric].description}</p>
              </div>
              <div className="rangePills">
                {Object.keys(rangeSizes).map((range) => (
                  <button
                    key={range}
                    className={activeRange === range ? "active" : ""}
                    type="button"
                    onClick={() => setActiveRange(range)}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
            <div className="barChart">
              {chartPoints.length === 0 ? (
                <div className="chartEmpty">Run bursts or refresh health to build a real chart.</div>
              ) : chartPoints.map((point) => (
                <div className="barWrap" key={point.id}>
                  <div
                    className={`chartBar ${metricConfigs[activeMetric].tone}`}
                    style={{ height: `${point.height}%` }}
                    title={`${point.label} • ${point.value} ${metricConfigs[activeMetric].unit} • ${point.detail}`}
                  />
                  <small>{point.label}</small>
                </div>
              ))}
            </div>
            <div className="chartMeta">
              <span>Latest: {latestPoint ? `${latestPoint.value} ${metricConfigs[activeMetric].unit}` : "No data"}</span>
              <span>View: {activeRange}</span>
            </div>
          </article>

          <article className="eventsPanel">
            <div className="panelHead compact">
              <h3>Recent Events</h3>
              <span>⋯</span>
            </div>
            {activityFeed.slice(0, 6).map((event) => (
              <div className="eventRow" key={event.id}>
                <span className={event.tone} />
                <div>
                  <small>{event.time}</small>
                  <p>{event.message}</p>
                </div>
              </div>
            ))}
          </article>
        </div>
      </main>
    </section>
  );
}

function Requests({ duplicates, setDuplicates, location, setLocation, runColdBurst, runWarmBurst, runSummary, responses, loading }) {
  const groupedRows = responses.length
    ? responses.map((item, index) => ({
        id: `REQ-${String(index + 1).padStart(4, "0")}`,
        role: item.executionRole,
        servedFrom: item.servedFrom,
        key: item.dedupeKey?.slice(0, 18) || "-",
        status: item.cacheStatus,
      }))
    : [
        { id: "REQ-9042", role: "LEADER", servedFrom: "FAAS", key: "sha256:pending", status: "MISS" },
        { id: "REQ-9043", role: "FOLLOWER", servedFrom: "SHARED_WINDOW", key: "sha256:pending", status: "MISS" },
      ];

  return (
    <section className="viewShell">
      <Header eyebrow="Requests" title="Duplicate burst control">
        <button className="primaryButton" type="button" onClick={runColdBurst} disabled={loading}>
          {loading ? "Running..." : "Run Cold Burst"}
        </button>
      </Header>

      <main className="viewContent">
        <div className="controlPanel">
          <label>
            Location
            <input value={location} onChange={(event) => setLocation(event.target.value)} />
          </label>
          <label>
            Duplicate requests
            <input type="number" min="1" value={duplicates} onChange={(event) => setDuplicates(Number(event.target.value))} />
          </label>
          <button type="button" onClick={runColdBurst} disabled={loading}>Cold burst</button>
          <button type="button" onClick={runWarmBurst} disabled={loading}>Warm cache burst</button>
        </div>

        <div className="similarPanel">
          <h3>Similar Requests</h3>
          <p>{runSummary ? `${runSummary.requestCount} requests collapsed into ${runSummary.uniqueDedupeKeys} dedupe key.` : "Run a burst to see grouped requests."}</p>
          <div className="miniCards">
            <div><span>Leaders</span><strong>{runSummary?.leaderCount ?? "-"}</strong></div>
            <div><span>Followers</span><strong>{runSummary?.followerCount ?? "-"}</strong></div>
            <div><span>Cache served</span><strong>{runSummary?.cacheCount ?? "-"}</strong></div>
          </div>
        </div>

        <div className="dataTable">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Role</th>
                <th>Served From</th>
                <th>Dedupe Key</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td><span className={`badge ${row.role === "LEADER" ? "leader" : "follower"}`}>{row.role}</span></td>
                  <td>{row.servedFrom}</td>
                  <td>{row.key}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </section>
  );
}

function Cache({ flushCache, cacheMessage, runSummary, cacheEntries, cacheBackend }) {
  const selectedEntry = cacheEntries[0];

  return (
    <section className="viewShell">
      <Header eyebrow="Cache" title="Redis result cache">
        <button className="dangerButton" type="button" onClick={flushCache}>Clear cache</button>
      </Header>
      <main className="viewContent">
        {cacheMessage && <div className="notice">{cacheMessage}</div>}
        <div className="statGrid">
          <StatCard title="Backend" value={cacheBackend === "redis" ? "Redis" : "Memory"} change={cacheBackend === "redis" ? "Primary cache" : "Fallback mode"} tone="cyan" />
          <StatCard title="Hit Rate" value={runSummary ? `${runSummary.cacheCount}/${runSummary.requestCount}` : "0/0"} change="Latest burst" tone="emerald" />
          <StatCard title="TTL" value="60s" change="Configurable" tone="amber" />
          <StatCard title="Stampede Guard" value="On" change="Window manager" tone="purple" />
        </div>
        <div className="cacheInsightGrid">
          <article className="cachePreviewCard">
            <div className="panelHead compact">
              <h3>Selected Cache Entry</h3>
              <span>{selectedEntry?.backend?.toUpperCase() || "MEMORY"}</span>
            </div>
            <div className="cacheMetaList">
              <div><span>Key</span><strong>{selectedEntry?.key}</strong></div>
              <div><span>Type</span><strong>{selectedEntry?.type}</strong></div>
              <div><span>Hits</span><strong>{selectedEntry?.hits}</strong></div>
              <div><span>TTL State</span><strong>{selectedEntry?.ttlLabel}</strong></div>
              <div><span>Last Accessed</span><strong>{selectedEntry?.lastAccessed ? new Date(selectedEntry.lastAccessed).toLocaleTimeString([], { hour12: false }) : "-"}</strong></div>
              <div><span>Served From</span><strong>{selectedEntry?.servedFrom}</strong></div>
            </div>
            <div className="payloadCard">
              <p>Cached Payload Preview</p>
              <pre>{pretty(selectedEntry?.payloadPreview || { message: "Run a burst to populate the cache." })}</pre>
            </div>
          </article>
        </div>
        <div className="dataTable">
          <table>
            <thead>
              <tr><th>Cache Key</th><th>Size</th><th>Type</th><th>Hits</th><th>TTL</th><th>Served From</th></tr>
            </thead>
            <tbody>
              {cacheEntries.map((row) => (
                <tr key={row.key}>
                  <td>{row.key}</td>
                  <td>{row.size}</td>
                  <td>{row.type}</td>
                  <td>{row.hits}</td>
                  <td>{row.ttlLabel}</td>
                  <td>{row.servedFrom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </section>
  );
}

function Functions({ runSummary, responses, cacheBackend }) {
  const latestResponse = responses[0]?.responsePayload || null;
  const functions = [
    {
      id: "traffic-score",
      trigger: "HTTP/API Gateway",
      avg: runSummary ? `${runSummary.totalLatency}ms` : "250ms",
      warm: "local",
      invocations: runSummary?.leaderCount ?? 0,
      status: "Healthy",
      purpose: "Primary FaaS business function. Only the elected leader should invoke this on a cold burst.",
      input: {
        tenantId: "team-a",
        functionName: "traffic-score",
        payload: { location: responses[0]?.responsePayload?.location || "seattle" },
      },
      output: latestResponse || {
        location: "seattle",
        score: 11,
        category: "LOW",
      },
    },
    {
      id: "result-cache-write",
      trigger: "Orchestrator",
      avg: "8ms",
      warm: cacheBackend || "memory",
      invocations: runSummary?.requestCount ?? 0,
      status: "Healthy",
      purpose: "Persists reusable execution results so later identical requests can skip invocation entirely.",
      input: {
        cacheKey: responses[0]?.dedupeKey ? `cache:team-a:${responses[0].dedupeKey.slice(0, 12)}` : "cache:team-a:sha256:...",
        ttlSeconds: 60,
      },
      output: {
        cacheStatus: runSummary?.cacheCount ? "HIT_REUSE_ACTIVE" : "READY_FOR_REUSE",
        writesObserved: runSummary?.leaderCount ?? 0,
      },
    },
  ];

  return (
    <section className="viewShell">
      <Header eyebrow="Functions" title="FaaS execution layer" />
      <main className="viewContent">
        <div className="statGrid">
          <StatCard title="Leader Invocations" value={runSummary?.leaderCount ?? 0} change="Cold path only" tone="cyan" />
          <StatCard title="Follower Reuses" value={runSummary?.followerCount ?? 0} change="Shared window fan-out" tone="emerald" />
          <StatCard title="Cache Reuses" value={runSummary?.cacheCount ?? 0} change="Warm path" tone="amber" />
          <StatCard title="Runtime Backend" value={cacheBackend === "redis" ? "Redis" : "Memory"} change="Cache storage mode" tone="purple" />
        </div>

        <div className="functionGrid">
          {functions.map((fn) => (
            <article className="functionCard" key={fn.id}>
              <div>
                <h3>{fn.id}</h3>
                <span>{fn.trigger}</span>
              </div>
              <span className="badge leader">{fn.status}</span>
              <p className="functionDescription">{fn.purpose}</p>
              <div className="functionMetrics">
                <div><small>Avg latency</small><strong>{fn.avg}</strong></div>
                <div><small>Runtime</small><strong>{fn.warm}</strong></div>
                <div><small>Invocations</small><strong>{fn.invocations}</strong></div>
              </div>
              <div className="functionIO">
                <div className="functionPayloadCard">
                  <p>Input shape</p>
                  <pre>{pretty(fn.input)}</pre>
                </div>
                <div className="functionPayloadCard">
                  <p>Latest output</p>
                  <pre>{pretty(fn.output)}</pre>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
    </section>
  );
}

function Health({ health, refreshHealth }) {
  const services = health?.services ? Object.entries(health.services) : [];

  return (
    <section className="viewShell">
      <Header eyebrow="Health" title="Service health">
        <button className="ghostButton" type="button" onClick={refreshHealth}>Refresh</button>
      </Header>
      <main className="viewContent">
        <div className="healthGrid">
          {services.length === 0 ? (
            <div className="notice">Start the backend stack to see live service health.</div>
          ) : services.map(([name, details]) => (
            <article className="healthNode" key={name}>
              <div>
                <h3>{name}</h3>
                <span className={`statusDot ${details.status === "UP" ? "up" : "down"}`}>{details.status}</span>
              </div>
              <small>Latency</small>
              <div className="meter"><span style={{ width: details.status === "UP" ? "26%" : "88%" }} /></div>
              <pre>{pretty(details)}</pre>
            </article>
          ))}
        </div>
      </main>
    </section>
  );
}

function Logs({ logEntries }) {
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logEntries]);

  return (
    <section className="viewShell">
      <Header eyebrow="Logs" title="Live orchestration logs" />
      <main className="viewContent">
        <div className="logsPanel">
          {logEntries.map((log, index) => (
            <details className="logLine" key={`${log.id}-${index}`} open={index < 2}>
              <summary>
                <span>{new Date().toLocaleTimeString([], { hour12: false })}</span>
                <b className={log.level.toLowerCase()}>{log.level}</b>
                <code>[{log.id}]</code>
                <p>{log.msg}</p>
              </summary>
              <pre>{pretty(log.payload)}</pre>
            </details>
          ))}
          <div ref={logEndRef} />
        </div>
      </main>
    </section>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [duplicates, setDuplicates] = useState(6);
  const [location, setLocation] = useState("seattle");
  const [health, setHealth] = useState(null);
  const [responses, setResponses] = useState([]);
  const [runSummary, setRunSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cacheMessage, setCacheMessage] = useState("");
  const [sessionHistory, setSessionHistory] = useState([]);
  const [activityFeed, setActivityFeed] = useState([
    { id: "boot", time: formatClock(), message: "Ops panel booted and waiting for gateway telemetry", tone: "cyan" },
  ]);
  const [logEntries, setLogEntries] = useState([
    {
      level: "INFO",
      id: "fdn",
      msg: "Ops panel initialized",
      payload: { source: "frontend", startedAt: new Date().toISOString() },
    },
  ]);

  const appendLog = (entry) => {
    setLogEntries((previous) => [
      {
        id: entry.id || `${Date.now()}-${Math.random()}`,
        level: entry.level || "INFO",
        msg: entry.msg,
        payload: entry.payload || {},
      },
      ...previous,
    ].slice(0, 80));
  };

  const addActivity = (message, tone = "cyan") => {
    setActivityFeed((previous) => [
      { id: `${Date.now()}-${Math.random()}`, time: formatClock(), message, tone },
      ...previous,
    ].slice(0, 20));
  };

  const addHistoryPoint = (point) => {
    setSessionHistory((previous) => [...previous, point].slice(-40));
  };

  const refreshHealth = async () => {
    try {
      const response = await fetch("/api/v1/system/health");
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Health check failed.");
      setHealth(data);
      const cacheBackendName = data?.services?.["result-cache"]?.details?.backend || "memory";
      const activeServices = healthyServiceCount(data);
      const allServices = totalServiceCount(data);
      addHistoryPoint({
        timeLabel: formatClock().slice(0, 5),
        requestCount: runSummary?.requestCount ?? 0,
        latencyMs: runSummary?.totalLatency ?? 0,
        activeServices,
        avoidedExecutions: runSummary?.avoidedExecutions ?? 0,
        detail: `Gateway sees ${activeServices}/${allServices} services healthy`,
      });
      addActivity(`Gateway health refreshed: ${activeServices}/${allServices} services are UP`, "cyan");
      appendLog({
        level: "INFO",
        id: "health",
        msg: `Gateway health refresh succeeded`,
        payload: {
          status: data.status,
          activeServices,
          allServices,
          cacheBackend: cacheBackendName,
        },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Health check failed.");
      addActivity("Gateway health refresh failed", "amber");
      appendLog({
        level: "ERROR",
        id: "health",
        msg: "Gateway health refresh failed",
        payload: { error: caught instanceof Error ? caught.message : "Health check failed." },
      });
    }
  };

  useEffect(() => {
    refreshHealth();
  }, []);

  const flushCache = async () => {
    setCacheMessage("");
    setError("");
    try {
      const response = await fetch("/api/v1/system/cache/flush", { method: "POST" });
      if (!response.ok) throw new Error("Cache flush failed.");
      setCacheMessage("Cache cleared successfully.");
      setRunSummary(null);
      setResponses([]);
      addActivity(`Cache cleared for subsequent cold bursts`, "amber");
      appendLog({
        level: "WARN",
        id: "cache",
        msg: "Cache flush requested from UI",
        payload: { action: "flush", scope: "all visible keys" },
      });
      refreshHealth();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cache flush failed.");
      appendLog({
        level: "ERROR",
        id: "cache",
        msg: "Cache flush failed",
        payload: { error: caught instanceof Error ? caught.message : "Cache flush failed." },
      });
    }
  };

  const runBurst = async (warmCache = false) => {
    const safeLocation = location.trim().toLowerCase();
    if (!safeLocation) {
      setError("Location is required.");
      return;
    }

    setLoading(true);
    setError("");
    setCacheMessage("");
    appendLog({
      level: "INFO",
      id: "burst",
      msg: `${warmCache ? "Warm" : "Cold"} burst started`,
      payload: { location: safeLocation, duplicates, mode: warmCache ? "warm" : "cold" },
    });

    try {
      if (warmCache) {
        await fetch("/api/v1/orchestration/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createPayload(safeLocation)),
        });
      }

      const count = Math.max(1, duplicates);
      const startedAt = performance.now();
      const result = await Promise.all(
        Array.from({ length: count }, async (_, index) => {
          const response = await fetch("/api/v1/orchestration/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(createPayload(safeLocation, index + 1)),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data?.message || `Request ${index + 1} failed.`);
          return data;
        })
      );

      const totalLatency = Math.round(performance.now() - startedAt);
      const leaderCount = result.filter((item) => item.executionRole === "LEADER").length;
      const followerCount = result.filter((item) => item.executionRole === "FOLLOWER").length;
      const cacheCount = result.filter((item) => item.servedFrom === "CACHE").length;
      const avoidedExecutions = followerCount + cacheCount;
      const dedupeKeys = new Set(result.map((item) => item.dedupeKey)).size;
      setResponses(result);
      const summary = {
        requestCount: count,
        totalLatency,
        uniqueDedupeKeys: dedupeKeys,
        leaderCount,
        followerCount,
        cacheCount,
        avoidedExecutions,
      };
      setRunSummary(summary);
      result.forEach((response, index) => {
        const level = response.servedFrom === "CACHE" ? "INFO" : response.executionRole === "LEADER" ? "WARN" : "DEBUG";
        const message =
          response.servedFrom === "CACHE"
            ? `Request ${index + 1} returned from cache`
            : response.executionRole === "LEADER"
              ? `Request ${index + 1} became leader and invoked FaaS`
              : `Request ${index + 1} waited as follower for shared result`;

        appendLog({
          level,
          id: response.requestId?.slice(0, 8) || `req-${index + 1}`,
          msg: message,
          payload: {
            cacheStatus: response.cacheStatus,
            executionRole: response.executionRole,
            servedFrom: response.servedFrom,
            dedupeKey: response.dedupeKey,
            windowId: response.windowId,
            responsePayload: response.responsePayload,
          },
        });
      });
      appendLog({
        level: "INFO",
        id: "burst-summary",
        msg: `${warmCache ? "Warm" : "Cold"} burst completed`,
        payload: summary,
      });
      addHistoryPoint({
        timeLabel: formatClock().slice(0, 5),
        requestCount: count,
        latencyMs: totalLatency,
        activeServices: healthyServiceCount(health),
        avoidedExecutions,
        detail: `${warmCache ? "Warm" : "Cold"} burst for ${safeLocation}: ${leaderCount} leader, ${followerCount} followers, ${cacheCount} cache hits`,
      });
      addActivity(
        `${warmCache ? "Warm" : "Cold"} burst at ${safeLocation}: ${leaderCount} leader, ${followerCount} followers, ${cacheCount} cache hits`,
        cacheCount === count ? "emerald" : leaderCount > 0 ? "cyan" : "amber"
      );
      refreshHealth();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Execution failed.");
      addActivity("Burst execution failed", "amber");
      appendLog({
        level: "ERROR",
        id: "burst",
        msg: "Burst execution failed",
        payload: { error: caught instanceof Error ? caught.message : "Execution failed." },
      });
    } finally {
      setLoading(false);
    }
  };

  const cacheBackend = health?.services?.["result-cache"]?.details?.backend || "memory";
  const cacheEntries = useMemo(
    () => buildCacheEntries(responses, cacheBackend, sessionHistory.length),
    [responses, cacheBackend, sessionHistory.length]
  );

  const view = useMemo(() => {
    const props = {
      health,
      runSummary,
      responses,
      error,
      loading,
      duplicates,
      setDuplicates,
      location,
      setLocation,
      cacheMessage,
      cacheBackend,
      cacheEntries,
      logEntries,
      refreshHealth,
      flushCache,
      sessionHistory,
      activityFeed,
      runColdBurst: () => runBurst(false),
      runWarmBurst: () => runBurst(true),
    };

    if (activeTab === "Requests") return <Requests {...props} />;
    if (activeTab === "Cache") return <Cache {...props} />;
    if (activeTab === "Functions") return <Functions {...props} />;
    if (activeTab === "Health") return <Health {...props} />;
    if (activeTab === "Logs") return <Logs {...props} />;
    return <Dashboard {...props} />;
  }, [activeTab, health, runSummary, responses, error, loading, duplicates, location, cacheMessage, sessionHistory, activityFeed, cacheBackend, cacheEntries, logEntries]);

  return (
    <main className="opsShell">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="opsMain">
        {error && <div className="globalError">{error}</div>}
        {view}
      </div>
    </main>
  );
}

export default App;
