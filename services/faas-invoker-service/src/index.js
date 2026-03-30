import cors from "cors";
import express from "express";
import crypto from "node:crypto";

const app = express();
const port = Number(process.env.PORT || 8090);
const simulatedDelayMs = Number(process.env.SIMULATED_DELAY_MS || 250);

app.use(cors());
app.use(express.json());

const categoryForScore = (score) => {
  if (score >= 75) return "HEAVY";
  if (score >= 45) return "MODERATE";
  return "LOW";
};

const deterministicScore = (dedupeKey, location = "unknown") => {
  const hash = crypto.createHash("sha256").update(`${dedupeKey}:${location}`).digest("hex");
  return Number.parseInt(hash.slice(0, 8), 16) % 100;
};

app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "faas-invoker-service" });
});

app.post("/api/v1/invocations", async (request, response) => {
  const startedAt = Date.now();
  const { dedupeKey, functionName, payload = {}, metadata = {} } = request.body ?? {};
  const location = String(payload.location || "unknown").trim().toLowerCase();
  const score = deterministicScore(dedupeKey || functionName || "fallback", location);

  await new Promise((resolve) => setTimeout(resolve, simulatedDelayMs));

  response.json({
    invocationId: crypto.randomUUID(),
    provider: process.env.PROVIDER || "local-simulator",
    functionName,
    completedAt: new Date().toISOString(),
    responsePayload: {
      location,
      score,
      category: categoryForScore(score),
      metadataEcho: metadata,
      processingTimeMs: Date.now() - startedAt,
      optimizedExecution: true
    }
  });
});

app.listen(port, () => {
  console.log(`faas-invoker-service listening on ${port}`);
});
