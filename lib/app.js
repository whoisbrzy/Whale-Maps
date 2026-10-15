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
  const me = await meRes.json();

  let guilds = [];
  try {
    const guildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (guildsRes.ok) {
      const list = await guildsRes.json();
      guilds = (list || []).map((g) => ({
        id: String(g.id),
        name: String(g.name || ""),
        icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64` : null,
        owner: Boolean(g.owner),
      }));
      guilds.sort((a, b) => (b.owner ? 1 : 0) - (a.owner ? 1 : 0));
    }
  } catch (err) {
    console.error("Fetching user guilds failed (non-fatal):", err.message);
  }

  return { me, guilds };
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
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: "identify guilds email",
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
    const { me: u, guilds } = await discordUser(code);
    if (!/^\d{5,25}$/.test(String(u.id))) throw new Error("unexpected profile");
    const profile = {
      id: String(u.id),
      username: String(u.username || "").slice(0, 64),
      name: String(u.global_name || u.username || "User").slice(0, 64),
      avatar: avatarUrl(u),
      email: u.email || null,
      guilds,
    };
    // Import the Discord profile, email and guilds into database
    let roblox = null;
    try {
      const doc = await store.upsertProfile(profile);
      if (doc?.roblox?.id) roblox = { id: String(doc.roblox.id), name: doc.roblox.name || null };
    } catch (err) {
      console.error("Saving profile failed (continuing without database):", err.message);
    }
    store.setCachedGuilds(profile.id, guilds);
    setSession(res, { id: profile.id, name: profile.name, avatar: profile.avatar, roblox, guilds });
    return redirect(res, "/servers");
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
    const error =
      err.status && err.status < 500
        ? err.message
        : "Couldn't start verification with Dock. Try again shortly.";
    return json(res, status, { error, retryAfter: err.retryAfter });
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

async function listServers(req, res) {
  const user = sessionUser(req);
  if (!user) return json(res, 401, { error: "Please log in first." });
  const servers = await store.getServersForUser(user.id);
  return json(res, 200, { servers });
}

async function parseBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "object") return req.body;
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  let body = "";
  try {
    for await (const chunk of req) body += chunk;
    return body ? JSON.parse(body) : {};
  } catch {
    return {};
  }
}

async function createOneServer(req, res) {
  const user = sessionUser(req);
  if (!user) return json(res, 401, { error: "Please log in first." });
  const data = await parseBody(req);
  const name = String(data?.name || "").trim();
  if (name.length < 2) {
    return json(res, 400, { error: "Server name is required (min 2 characters)." });
  }
  const srv = await store.createServer({
    name,
    banner: data?.banner || "",
    ownerId: user.id,
    erlcApiKey: data?.erlcApiKey || "",
    discordServerId: data?.discordServerId || "",
    discordServerName: data?.discordServerName || "",
  });
  return json(res, 201, { server: srv });
}

async function listDiscordGuilds(req, res) {
  const user = sessionUser(req);
  if (!user) return json(res, 401, { error: "Log in with Discord first." });
  let guilds = user.guilds || [];
  if (!guilds.length) {
    guilds = await store.getGuilds(user.id);
  }
  return json(res, 200, { guilds });
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
    case "/api/servers":
      if (req.method === "GET") await listServers(req, res);
      else if (req.method === "POST") await createOneServer(req, res);
      else need("GET");
      break;
    case "/api/discord/guilds":
      if (need("GET")) await listDiscordGuilds(req, res);
      break;
    default:
      json(res, 404, { error: "not_found" });
  }
  return true;
}

