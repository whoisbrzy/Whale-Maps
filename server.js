/* Whale Maps server. Zero dependencies, Node 18+.
 *
 *   - Serves the built site from ./dist (with SPA fallback for /terms, /privacy, ...)
 *   - Discord login (OAuth2 "identify" scope) with a signed, stateless session cookie
 *   - Tiny JSON API: GET /api/me, GET /api/health
 *
 * Run:  npm run build && node server.js
 * Env:  see .env.example (panel environment variables or a .env file both work).
 * Docs: AGENTS.md explains the design and how to extend it.
 */
import http from "node:http";
import crypto from "node:crypto";
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, "dist");

/* ---- optional .env file (existing environment variables win) ------------- */
try {
  for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
} catch {
  /* no .env file, that's fine */
}

/* ---- config --------------------------------------------------------------- */
const PORT = Number(process.env.PORT || process.env.SERVER_PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "";
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
// Only overridden by tests so the login flow can run against a fake Discord.
const DISCORD_API = process.env.DISCORD_API || "https://discord.com/api/v10";

const AUTH_ON = Boolean(CLIENT_ID && CLIENT_SECRET && SESSION_SECRET.length >= 16);
const SECURE = PUBLIC_URL.startsWith("https://");
const REDIRECT_URI = `${PUBLIC_URL}/auth/callback`;
const SESSION_DAYS = 7;
const SESSION_COOKIE = `${SECURE ? "__Host-" : ""}wm_session`;
const STATE_COOKIE = `${SECURE ? "__Host-" : ""}wm_state`;

/* ---- signed tokens (stateless sessions) ------------------------------------ */
const mac = (body) => crypto.createHmac("sha256", SESSION_SECRET).update(body).digest();

function sign(obj) {
  const body = Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${body}.${mac(body).toString("base64url")}`;
}

function verify(token) {
  if (!AUTH_ON || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const given = Buffer.from(parts[1], "base64url");
  const want = mac(parts[0]);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return null;
  try {
    const obj = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    return obj && obj.exp > Date.now() ? obj : null;
  } catch {
    return null;
  }
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* ---- cookies / responses ---------------------------------------------------- */
function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function addCookie(res, name, value, maxAgeSeconds) {
  const c = `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${SECURE ? "; Secure" : ""}`;
  res.setHeader("Set-Cookie", [].concat(res.getHeader("Set-Cookie") || [], c));
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", ...headers });
  res.end(body);
}
const json = (res, status, obj) =>
  send(res, status, JSON.stringify(obj), {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
function redirect(res, location) {
  res.writeHead(302, { Location: location, "Cache-Control": "no-store" });
  res.end();
}

const CSP =
  "default-src 'self'; img-src 'self' data: https://cdn.discordapp.com; " +
  "style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; " +
  "object-src 'none'; base-uri 'self'; frame-ancestors 'none'";

function securityHeaders(res) {
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  if (SECURE) res.setHeader("Strict-Transport-Security", "max-age=15552000");
}

/* ---- small per-IP rate limit for /auth/* (protects our Discord app) ---------- */
const hits = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
}, 60_000).unref();

function limited(req, max = 60) {
  let ip = req.socket.remoteAddress || "?";
  if (TRUST_PROXY && req.headers["x-forwarded-for"]) {
    ip = String(req.headers["x-forwarded-for"]).split(",")[0].trim();
  }
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now > e.reset) {
    hits.set(ip, { n: 1, reset: now + 60_000 });
    return false;
  }
  return ++e.n > max;
}

/* ---- Discord ---------------------------------------------------------------- */
async function discordUser(code) {
  const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!tokenRes.ok) throw new Error(`token exchange failed (${tokenRes.status})`);
  const { access_token: token } = await tokenRes.json();
  const meRes = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!meRes.ok) throw new Error(`profile fetch failed (${meRes.status})`);
  return meRes.json();
}

function avatarUrl(u) {
  if (typeof u.avatar === "string" && /^[\w]+$/.test(u.avatar)) {
    return `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64`;
  }
  return `https://cdn.discordapp.com/embed/avatars/${(BigInt(u.id) >> 22n) % 6n}.png`;
}

const sessionUser = (req) => {
  const s = verify(parseCookies(req)[SESSION_COOKIE]);
  return s ? { id: s.id, name: s.name, avatar: s.avatar } : null;
};

/* ---- static files ----------------------------------------------------------- */
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
    if (!st) return send(res, 503, "The site has not been built yet. Upload the dist folder.");
  }

  const ext = path.extname(abs).toLowerCase();
  const f = await loadFile(abs, st, ext);
  const headers = {
    "Content-Type": TYPES[ext] || "application/octet-stream",
    "Cache-Control":
      ext === ".html"
        ? "no-cache"
        : rel.startsWith("/assets/")
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

/* ---- routing ------------------------------------------------------------------ */
async function handle(req, res) {
  securityHeaders(res);
  const raw = req.url || "/";
  const q = raw.indexOf("?");
  const pathname = q < 0 ? raw : raw.slice(0, q);
  const params = new URLSearchParams(q < 0 ? "" : raw.slice(q + 1));
  if (!pathname.startsWith("/")) return send(res, 400, "Bad request");

  if (pathname === "/api/health") return json(res, 200, { ok: true });

  if (pathname === "/api/me") {
    return json(res, 200, { user: sessionUser(req), authEnabled: AUTH_ON });
  }

  if (pathname === "/auth/login") {
    if (req.method !== "GET") return send(res, 405, "Method not allowed", { Allow: "GET" });
    if (!AUTH_ON) return send(res, 503, "Discord login is not configured on this server.");
    if (limited(req)) return send(res, 429, "Too many requests. Try again in a minute.");
    const state = crypto.randomBytes(16).toString("base64url");
    addCookie(res, STATE_COOKIE, sign({ s: state, exp: Date.now() + 10 * 60_000 }), 600);
    const p = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      scope: "identify",
      state,
      prompt: "none",
    });
    return redirect(res, `https://discord.com/oauth2/authorize?${p}`);
  }

  if (pathname === "/auth/callback") {
    if (req.method !== "GET") return send(res, 405, "Method not allowed", { Allow: "GET" });
    if (!AUTH_ON) return send(res, 503, "Discord login is not configured on this server.");
    if (limited(req)) return send(res, 429, "Too many requests. Try again in a minute.");
    const saved = verify(parseCookies(req)[STATE_COOKIE]);
    addCookie(res, STATE_COOKIE, "", 0); // single use
    if (params.get("error")) return redirect(res, "/?login=cancelled");
    const code = params.get("code");
    const state = params.get("state");
    if (!saved || !code || !state || code.length > 512 || !safeEqual(saved.s, state)) {
      return send(res, 400, "Login expired or invalid. Go back and try again.");
    }
    try {
      const u = await discordUser(code);
      if (!/^\d{5,25}$/.test(String(u.id))) throw new Error("unexpected profile");
      const session = {
        id: u.id,
        name: String(u.global_name || u.username || "User").slice(0, 64),
        avatar: avatarUrl(u),
        exp: Date.now() + SESSION_DAYS * 86_400_000,
      };
      addCookie(res, SESSION_COOKIE, sign(session), SESSION_DAYS * 86_400);
      return redirect(res, "/");
    } catch (err) {
      console.error("Discord login failed:", err.message);
      return redirect(res, "/?login=failed");
    }
  }

  if (pathname === "/auth/logout") {
    if (req.method !== "POST") return send(res, 405, "Method not allowed", { Allow: "POST" });
    addCookie(res, SESSION_COOKIE, "", 0);
    res.writeHead(204, { "Cache-Control": "no-store" });
    return res.end();
  }

  if (pathname.startsWith("/api/") || pathname.startsWith("/auth/")) {
    return json(res, 404, { error: "not_found" });
  }

  return serveStatic(req, res, pathname);
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error("Request failed:", err);
    if (!res.headersSent) send(res, 500, "Something went wrong.");
    else res.end();
  });
});

server.on("error", (err) => {
  console.error(err.code === "EADDRINUSE" ? `Port ${PORT} is already in use.` : err);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`Whale Maps listening on ${HOST}:${PORT}`);
  console.log(
    AUTH_ON
      ? `Discord login is ON. Redirect URI to register in the Discord portal: ${REDIRECT_URI}`
      : "Discord login is OFF (set DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET and a SESSION_SECRET of 16+ characters)."
  );
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    console.warn("Warning: dist/index.html not found. Run `npm run build` or upload the dist folder.");
  }
});

for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
