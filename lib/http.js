/* Small HTTP helpers shared by server.js (local) and the Vercel function. */
import { CSP, SECURE, TRUST_PROXY } from "./config.js";

export function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", ...headers });
  res.end(body);
}

export const json = (res, status, obj) =>
  send(res, status, JSON.stringify(obj), {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });

export function redirect(res, location) {
  res.writeHead(302, { Location: location, "Cache-Control": "no-store" });
  res.end();
}

export function securityHeaders(res) {
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  if (SECURE) res.setHeader("Strict-Transport-Security", "max-age=15552000");
}

export function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

export function addCookie(res, name, value, maxAgeSeconds) {
  const c = `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${SECURE ? "; Secure" : ""}`;
  res.setHeader("Set-Cookie", [].concat(res.getHeader("Set-Cookie") || [], c));
}

/* Per-IP rate limit. In-memory, so on serverless it is per instance (best effort). */
const hits = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
}, 60_000).unref();

export function limited(req, bucket, max = 60) {
  let ip = req.socket?.remoteAddress || "?";
  if (TRUST_PROXY && req.headers["x-forwarded-for"]) {
    ip = String(req.headers["x-forwarded-for"]).split(",")[0].trim();
  }
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const e = hits.get(key);
  if (!e || now > e.reset) {
    hits.set(key, { n: 1, reset: now + 60_000 });
    return false;
  }
  return ++e.n > max;
}
