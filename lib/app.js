/* API + login router. Used by server.js (local/self-hosted) and api/[...path].js (Vercel).
 * route(req, res) returns true when it handled the request, false for anything else (static files).
 *
 *   GET  /api/health
 *   GET  /api/me                      current user (+ Roblox link)
 *   GET  /auth/login                  start Discord login
 *   GET  /auth/callback               finish Discord login, import profile + name
 *   POST /auth/logout
 *   POST /api/roblox/start            start Dock verification, returns the Dock URL
 *   GET  /api/roblox/status?sid=...   long-poll the Dock session; links the account when done
 *   POST /api/roblox/unlink
 */
import crypto from "node:crypto";
import {
  AUTH_ON, CLIENT_ID, CLIENT_SECRET, DISCORD_API, REDIRECT_URI, ROBLOX_ON, STATE_COOKIE,
} from "./config.js";
import { addCookie, json, limited, parseCookies, redirect, securityHeaders, send } from "./http.js";
import { clearSession, safeEqual, setSession, sessionUser, sign, verify } from "./session.js";
import * as dock from "./dock.js";
import * as store from "./store.js";

/* ---- Discord ---- */
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
  if (typeof u.avatar === "string" && /^\w+$/.test(u.avatar)) {
    return `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64`;
  }
  return `https://cdn.discordapp.com/embed/avatars/${(BigInt(u.id) >> 22n) % 6n}.png`;
}

/* ---- route handlers ---- */
function login(req, res) {
  if (!AUTH_ON) return send(res, 503, "Discord login is not configured on this server.");
  if (limited(req, "auth")) return send(res, 429, "Too many requests. Try again in a minute.");
  const state = crypto.randomBytes(16).toString("base64url");
  addCookie(res, STATE_COOKIE, sign({ s: state, exp: Date.now() + 10 * 60_000 }), 600);
  // No prompt=none: the first-ever login must be able to show Discord's consent
  // screen; Discord auto-approves repeat logins once the app is authorized.
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: "identify",
    state,
  });
  return redirect(res, `https://discord.com/oauth2/authorize?${p}`);
}

async function callback(req, res, params) {
  if (!AUTH_ON) return send(res, 503, "Discord login is not configured on this server.");
  if (limited(req, "auth")) return send(res, 429, "Too many requests. Try again in a minute.");
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
    const profile = {
      id: String(u.id),
      username: String(u.username || "").slice(0, 64),
      name: String(u.global_name || u.username || "User").slice(0, 64),
      avatar: avatarUrl(u),
    };
    // Import the Discord profile and name into the database; pick up an existing Roblox link.
    let roblox = null;
    try {
      const doc = await store.upsertProfile(profile);
      if (doc?.roblox?.id) roblox = { id: String(doc.roblox.id), name: doc.roblox.name || null };
    } catch (err) {
      console.error("Saving profile failed (continuing without database):", err.message);
    }
    setSession(res, { ...profile, roblox });
    return redirect(res, "/");
  } catch (err) {
    console.error("Discord login failed:", err.message);
    return redirect(res, "/?login=failed");
  }
}

async function robloxStart(req, res) {
  const user = sessionUser(req);
  if (!user) return json(res, 401, { error: "Log in with Discord first." });
  if (!ROBLOX_ON) return json(res, 503, { error: "Roblox verification is not set up yet." });
  if (limited(req, "roblox-start", 10)) return json(res, 429, { error: "Too many attempts. Try again in a minute." });
  try {
    const s = await dock.createSession(user.id);
    if (!s.id || !s.verifyUrl || new URL(s.verifyUrl).protocol !== "https:") throw new Error("unexpected Dock response");
    return json(res, 200, { sid: s.id, verifyUrl: s.verifyUrl, expiresAt: s.expiresAt });
  } catch (err) {
    console.error("Dock createSession failed:", err.status || "", err.message);
    const status = err.status === 429 ? 429 : 502;
    return json(res, status, { error: "Couldn't start verification with Dock. Try again shortly.", retryAfter: err.retryAfter });
  }
}

async function robloxStatus(req, res, params) {
  const user = sessionUser(req);
  if (!user) return json(res, 401, { error: "Log in with Discord first." });
  if (!ROBLOX_ON) return json(res, 503, { error: "Roblox verification is not set up yet." });
  const sid = params.get("sid") || "";
  if (!/^[\w-]{6,100}$/.test(sid)) return json(res, 400, { error: "Bad session." });
  if (limited(req, "roblox-status", 60)) return json(res, 429, { error: "Too many requests.", retryAfter: 10 });

  let s;
  try {
    s = await dock.getSession(sid, 15);
  } catch (err) {
    if (err.status === 404) return json(res, 200, { status: "expired" });
    if (err.status === 429) return json(res, 429, { error: "Slow down a little.", retryAfter: err.retryAfter || 5 });
    console.error("Dock getSession failed:", err.status || "", err.message);
    return json(res, 502, { error: "Couldn't reach Dock. Try again shortly." });
  }
  if (s.status !== "completed") return json(res, 200, { status: s.status });

  // Only accept a result that Dock verified for THIS Discord account.
  const r = s.result || {};
  if (!r.robloxId || String(r.discordId) !== user.id || (s.clientId && s.clientId !== user.id)) {
    return json(res, 403, { status: "mismatch", error: "That verification belongs to a different Discord account." });
  }
  const link = { id: String(r.robloxId), name: await dock.robloxName(r.robloxId), verifiedAt: new Date(), via: "dock" };
  try {
    await store.setRoblox(user.id, link);
  } catch (err) {
    if (err.message === "ROBLOX_TAKEN") {
      return json(res, 409, { status: "taken", error: "That Roblox account is already linked to another Waylo account." });
    }
    console.error("Saving Roblox link failed (continuing with cookie only):", err.message);
  }
  setSession(res, { ...user, roblox: { id: link.id, name: link.name } });
  return json(res, 200, { status: "completed", roblox: { id: link.id, name: link.name } });
}

async function robloxUnlink(req, res) {
  const user = sessionUser(req);
  if (!user) return json(res, 401, { error: "Log in with Discord first." });
  try {
    await store.clearRoblox(user.id);
  } catch (err) {
    console.error("Removing Roblox link failed:", err.message);
    return json(res, 502, { error: "Couldn't remove the link. Try again." });
  }
  setSession(res, { ...user, roblox: null });
  res.writeHead(204, { "Cache-Control": "no-store" });
  return res.end();
}

/* ---- router ---- */
export async function route(req, res) {
  securityHeaders(res);
  const raw = req.url || "/";
  const q = raw.indexOf("?");
  let pathname = q < 0 ? raw : raw.slice(0, q);
  const params = new URLSearchParams(q < 0 ? "" : raw.slice(q + 1));
  if (!pathname.startsWith("/")) return send(res, 400, "Bad request"), true;
  if (pathname.startsWith("/api/auth/")) pathname = pathname.slice(4); // Vercel rewrite: /auth/x -> /api/auth/x

  if (!pathname.startsWith("/api/") && !pathname.startsWith("/auth/")) return false;

  const need = (method) => {
    if (req.method === method) return true;
    send(res, 405, "Method not allowed", { Allow: method });
    return false;
  };
  // Browsers mark cross-site requests; refuse state-changing ones.
  if (req.method === "POST" && req.headers["sec-fetch-site"] === "cross-site") {
    send(res, 403, "Forbidden");
    return true;
  }

  switch (pathname) {
    case "/api/health":
      json(res, 200, { ok: true });
      break;
    case "/api/me":
      json(res, 200, { user: sessionUser(req), authEnabled: AUTH_ON, robloxEnabled: ROBLOX_ON });
      break;
    case "/auth/login":
      if (need("GET")) login(req, res);
      break;
    case "/auth/callback":
      if (need("GET")) await callback(req, res, params);
      break;
    case "/auth/logout":
      if (need("POST")) {
        clearSession(res);
        res.writeHead(204, { "Cache-Control": "no-store" });
        res.end();
      }
      break;
    case "/api/roblox/start":
      if (need("POST")) await robloxStart(req, res);
      break;
    case "/api/roblox/status":
      if (need("GET")) await robloxStatus(req, res, params);
      break;
    case "/api/roblox/unlink":
      if (need("POST")) await robloxUnlink(req, res);
      break;
    default:
      json(res, 404, { error: "not_found" });
  }
  return true;
}

