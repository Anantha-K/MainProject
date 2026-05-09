import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 14173);
const apiOrigin = process.env.API_ORIGIN || "http://127.0.0.1:18088";
const distDir = path.resolve("dist");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    const target = new URL(url.pathname + url.search, apiOrigin);
    const body = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });

    const proxied = await fetch(target, {
      method: req.method,
      headers: Object.fromEntries(
        Object.entries(req.headers).filter(([key]) => key.toLowerCase() !== "host")
      ),
      body: ["GET", "HEAD"].includes(req.method || "GET") ? undefined : body,
    });

    res.writeHead(proxied.status, Object.fromEntries(proxied.headers.entries()));
    const buffer = Buffer.from(await proxied.arrayBuffer());
    res.end(buffer);
    return;
  }

  let filePath = path.join(distDir, url.pathname === "/" ? "index.html" : url.pathname);
  if (!filePath.startsWith(distDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, "index.html");
  }

  try {
    const ext = path.extname(filePath);
    const contentType = contentTypes[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(error instanceof Error ? error.message : "Internal server error");
  }
});

server.listen(port, host, () => {
  console.log(`fdn-ui static server listening on http://${host}:${port}`);
});
