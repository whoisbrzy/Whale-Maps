/* Waylo local / self-hosted server.
 *
 * On Vercel this file is NOT used: Vercel serves dist/ itself and runs api/[...path].js.
 * Use this for development and for hosting on any plain Node server (Node 22).
 *
 *   npm run build && npm start
 *
 * It serves the built site from ./dist (SPA fallback for /terms, /verify, ...) and mounts
 * the same API + login router as the Vercel function (lib/app.js). */
import http from "node:http";
import crypto from "node:crypto";
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { AUTH_ON, HOST, PORT, REDIRECT_URI, ROBLOX_ON, ROOT, MONGODB_URI } from "./lib/config.js";
import { route } from "./lib/app.js";
import { securityHeaders, send } from "./lib/http.js";

const DIST = path.join(ROOT, "dist");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};
const COMPRESSIBLE = new Set([".html", ".js", ".css", ".json", ".txt", ".svg"]);
const cache = new Map(); // absolute path -> { mtimeMs, size, body, gz, etag }

async function loadFile(abs, st, ext) {
  let e = cache.get(abs);
  if (e && e.mtimeMs === st.mtimeMs && e.size === st.size) return e;
  const body = await fs.promises.readFile(abs);
  e = {
    mtimeMs: st.mtimeMs,
    size: st.size,
    body,
    gz: COMPRESSIBLE.has(ext) && body.length > 512 ? zlib.gzipSync(body, { level: 9 }) : null,
    etag: `W/"${crypto.createHash("sha1").update(body).digest("base64url").slice(0, 16)}"`,
  };
  cache.set(abs, e);
  return e;
}

async function serveStatic(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(res, 405, "Method not allowed", { Allow: "GET, HEAD" });
  }
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return send(res, 400, "Bad request");
  }
  if (rel.includes("\0")) return send(res, 400, "Bad request");

  let abs = path.join(DIST, path.normalize(rel));
  if (abs !== DIST && !abs.startsWith(DIST + path.sep)) return send(res, 403, "Forbidden");

  let st = await fs.promises.stat(abs).catch(() => null);
  if (st && st.isDirectory()) {
    abs = path.join(abs, "index.html");
    st = await fs.promises.stat(abs).catch(() => null);
  }
  if (!st) {
    // A missing file with an extension is a real 404; anything else is a page route.
    if (path.extname(rel)) return send(res, 404, "Not found");
    abs = path.join(DIST, "index.html");
    st = await fs.promises.stat(abs).catch(() => null);
    if (!st) return send(res, 503, "The site has not been built yet. Run npm run build.");
  }

  const ext = path.extname(abs).toLowerCase();
  const f = await loadFile(abs, st, ext);
  const headers = {
    "Content-Type": TYPES[ext] || "application/octet-stream",
    "Cache-Control":
      ext === ".html"
        ? "no-cache"
        : rel.startsWith("/assets/") || rel.startsWith("/maps/")
          ? "public, max-age=31536000, immutable"
          : "public, max-age=86400",
    ETag: f.etag,
    Vary: "Accept-Encoding",
  };
  if (req.headers["if-none-match"] === f.etag) {
    res.writeHead(304, headers);
    return res.end();
  }
  let body = f.body;
  if (f.gz && /\bgzip\b/.test(req.headers["accept-encoding"] || "")) {
    body = f.gz;
    headers["Content-Encoding"] = "gzip";
  }
  headers["Content-Length"] = body.length;
  res.writeHead(200, headers);
  res.end(req.method === "HEAD" ? undefined : body);
}

const server = http.createServer(async (req, res) => {
  try {
    if (await route(req, res)) return;
    securityHeaders(res);
    const raw = req.url || "/";
    const q = raw.indexOf("?");
    await serveStatic(req, res, q < 0 ? raw : raw.slice(0, q));
  } catch (err) {
    console.error("Request failed:", err);
    if (!res.headersSent) send(res, 500, "Something went wrong.");
    else res.end();
  }
});

server.on("error", (err) => {
  console.error(err.code === "EADDRINUSE" ? `Port ${PORT} is already in use.` : err);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`Waylo listening on ${HOST}:${PORT}`);
  console.log(
    AUTH_ON
      ? `Discord login is ON. Redirect URI to register in the Discord portal: ${REDIRECT_URI}`
      : "Discord login is OFF (set DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET and a SESSION_SECRET of 16+ characters)."
  );
  console.log(`Roblox verification (Dock) is ${ROBLOX_ON ? "ON" : "OFF (needs login plus DOCK_API_KEY and DOCK_PID)"}.`);
  console.log(`Database: ${MONGODB_URI ? "MongoDB configured" : "none (accounts live in the login cookie only)"}.`);
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    console.warn("Warning: dist/index.html not found. Run `npm run build`.");
  }
});

for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
