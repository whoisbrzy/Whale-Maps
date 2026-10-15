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
      guilds = (list || [])
        .filter((g) => Boolean(g.owner))
        .map((g) => {
          const ext = g.icon && g.icon.startsWith("a_") ? "gif" : "png";
          return {
            id: String(g.id),
            name: String(g.name || ""),
            icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.${ext}?size=128` : null,
            owner: true,
            admin: false,
          };
        });
    }
  } catch (err) {
    console.error("Fetching user guilds failed (non-fatal):", err.message);
  }

  return { me, guilds, token };
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
    prompt: "consent",
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
    const { me: u, guilds, token } = await discordUser(code);
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
    setSession(res, { id: profile.id, name: profile.name, avatar: profile.avatar, token, roblox, guilds });
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
    icon: data?.icon || data?.discordServerIcon || "",
    ownerId: user.id,
    erlcApiKey: data?.erlcApiKey || "",
    discordServerId: data?.discordServerId || "",
    discordServerName: data?.discordServerName || "",
  });
  return json(res, 201, { server: srv });
}

async function deleteServerHandler(req, res) {
  const user = sessionUser(req);
  if (!user) return json(res, 401, { error: "Please log in first." });
  const data = await parseBody(req);
  const serverId = String(data?.serverId || "").trim();
  if (!serverId) return json(res, 400, { error: "serverId required." });
  await store.deleteServer(serverId, user.id);
  return json(res, 200, { ok: true });
}

async function transferServerHandler(req, res) {
  const user = sessionUser(req);
  if (!user) return json(res, 401, { error: "Please log in first." });
  const data = await parseBody(req);
  const serverId = String(data?.serverId || "").trim();
  const newOwnerId = String(data?.newOwnerId || "").trim();
  if (!serverId || !newOwnerId) return json(res, 400, { error: "serverId and newOwnerId required." });
  if (newOwnerId === user.id) return json(res, 400, { error: "You already own this server." });
  await store.transferServer(serverId, user.id, newOwnerId);
  return json(res, 200, { ok: true });
}

async function deleteAccountHandler(req, res) {
  const user = sessionUser(req);
  if (!user) return json(res, 401, { error: "Please log in first." });
  await store.deleteUser(user.id);
  clearSession(res);
  return json(res, 200, { ok: true });
}

async function listDiscordGuilds(req, res) {
  const user = sessionUser(req);
  if (!user) return json(res, 401, { error: "Log in with Discord first." });
  let guilds = user.guilds || [];
  if (!guilds.length && user.token) {
    try {
      const guildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
        headers: { Authorization: `Bearer ${user.token}` },
        signal: AbortSignal.timeout(6000),
      });
      if (guildsRes.ok) {
        const list = await guildsRes.json();
        guilds = (list || [])
          .filter((g) => Boolean(g.owner))
          .map((g) => {
            const ext = g.icon && g.icon.startsWith("a_") ? "gif" : "png";
            return {
              id: String(g.id),
              name: String(g.name || ""),
              icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.${ext}?size=128` : null,
              owner: true,
              admin: false,
            };
          });
        store.setCachedGuilds(user.id, guilds);
      }
    } catch (err) {
      console.warn("Live guilds fetch failed:", err.message);
    }
  }
  if (!guilds.length) {
    guilds = await store.getGuilds(user.id);
  }
  const ownedGuilds = (guilds || []).filter((g) => Boolean(g.owner));
  return json(res, 200, { guilds: ownedGuilds });
}

/* ---- ER:LC Integration Handlers ---- */
const ERLC_API_BASE = "https://api.erlc.gg/v2";

function teamColor(teamName) {
  const t = String(teamName || "").toLowerCase();
  if (t.includes("police")) return "#2563eb";
  if (t.includes("sheriff")) return "#b45309";
  if (t.includes("fire") || t.includes("ems") || t.includes("medic")) return "#dc2626";
  if (t.includes("dot") || t.includes("transport") || t.includes("public work")) return "#f59e0b";
  return "#64748b";
}

async function erlcSaveKeyHandler(req, res) {
  const user = sessionUser(req);
  if (!user) return json(res, 401, { error: "Please log in first." });
  const data = await parseBody(req);
  const serverId = String(data?.serverId || "").trim();
  const erlcApiKey = String(data?.erlcApiKey || "").trim();
  if (!serverId) return json(res, 400, { error: "serverId is required." });

  try {
    await store.updateServerKey(serverId, user.id, erlcApiKey);
    return json(res, 200, { ok: true });
  } catch (err) {
    return json(res, 403, { error: err.message });
  }
}

async function erlcTestKeyHandler(req, res) {
  const user = sessionUser(req);
  if (!user) return json(res, 401, { error: "Please log in first." });
  const data = await parseBody(req);
  let key = String(data?.erlcApiKey || "").trim();
  const serverId = String(data?.serverId || "").trim();

  if (!key && serverId) {
    const srv = await store.getServer(serverId, user.id);
    key = srv?.erlcApiKey || "";
  }

  if (!key) {
    return json(res, 400, { error: "No ER:LC API Key provided to test." });
  }

  try {
    const apiRes = await fetch(`${ERLC_API_BASE}/server`, {
      headers: { "server-key": key },
      signal: AbortSignal.timeout(8000),
    });

    if (apiRes.status === 403) {
      return json(res, 403, { ok: false, error: "Invalid Server Key (403 Unauthorized). Check your ER:LC key." });
    }
    if (apiRes.status === 422) {
      return json(res, 200, { ok: true, offline: true, message: "Valid Server Key! Note: Private server is currently empty / offline." });
    }
    if (!apiRes.ok) {
      return json(res, apiRes.status, { ok: false, error: `ER:LC API returned error (${apiRes.status})` });
    }

    const info = await apiRes.json();
    return json(res, 200, { ok: true, data: info });
  } catch (err) {
    return json(res, 502, { ok: false, error: `Failed to reach ER:LC API: ${err.message}` });
  }
}

async function erlcStatusHandler(req, res, params) {
  const user = sessionUser(req);
  if (!user) return json(res, 401, { error: "Please log in first." });
  const serverId = params.get("serverId") || "";
  if (!serverId) return json(res, 400, { error: "serverId is required." });

  const srv = await store.getServer(serverId, user.id);
  if (!srv) return json(res, 404, { error: "Server not found or access denied." });

  const key = srv.erlcApiKey || "";
  if (!key) {
    return json(res, 200, { ok: false, configured: false, error: "NO_KEY", message: "No ER:LC Server Key configured." });
  }

  try {
    const query = new URLSearchParams({
      Players: "true",
      Vehicles: "true",
      Staff: "true",
      JoinLogs: "true",
      KillLogs: "true",
      CommandLogs: "true",
      Queue: "true",
    });

    const apiRes = await fetch(`${ERLC_API_BASE}/server?${query}`, {
      headers: { "server-key": key },
      signal: AbortSignal.timeout(10000),
    });

    if (apiRes.status === 403) {
      return json(res, 200, { ok: false, configured: true, error: "INVALID_KEY", message: "Server key is invalid or expired." });
    }
    if (apiRes.status === 422) {
      return json(res, 200, { ok: true, configured: true, offline: true, server: { Name: srv.name, CurrentPlayers: 0, MaxPlayers: 0, Players: [] } });
    }
    if (!apiRes.ok) {
      return json(res, 200, { ok: false, configured: true, error: "API_ERROR", message: `ER:LC API status ${apiRes.status}` });
    }

    const data = await apiRes.json();
    return json(res, 200, { ok: true, configured: true, server: data });
  } catch (err) {
    return json(res, 200, { ok: false, configured: true, error: "NETWORK_ERROR", message: err.message });
  }
}

async function erlcCommandHandler(req, res) {
  const user = sessionUser(req);
  if (!user) return json(res, 401, { error: "Please log in first." });
  const data = await parseBody(req);
  const serverId = String(data?.serverId || "").trim();
  const command = String(data?.command || "").trim();
  if (!serverId || !command) return json(res, 400, { error: "serverId and command are required." });

  const srv = await store.getServer(serverId, user.id);
  if (!srv) return json(res, 404, { error: "Server not found or access denied." });
  if (srv.ownerId !== user.id) return json(res, 403, { error: "Only server owners can execute remote commands." });

  const key = srv.erlcApiKey || "";
  if (!key) return json(res, 400, { error: "No ER:LC Server Key configured for this server." });

  try {
    const apiRes = await fetch(`${ERLC_API_BASE}/server/command`, {
      method: "POST",
      headers: {
        "server-key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ command }),
      signal: AbortSignal.timeout(8000),
    });

    const body = await apiRes.json().catch(() => ({}));
    if (apiRes.status === 422) {
      return json(res, 422, { error: body.message || "The private server is currently empty / offline." });
    }
    if (!apiRes.ok) {
      return json(res, apiRes.status, { error: body.message || `Command failed (${apiRes.status})` });
    }

    return json(res, 200, { ok: true, message: body.message || "Command executed successfully!" });
  } catch (err) {
    return json(res, 502, { error: `Failed to contact ER:LC: ${err.message}` });
  }
}

async function erlcPatrolHandler(req, res, params) {
  const serverId = params.get("serverId") || "";
  if (!serverId) return json(res, 400, { error: "serverId is required." });

  const srv = await store.getServer(serverId);
  if (!srv || !srv.erlcApiKey) {
    return json(res, 200, { players: [] });
  }

  try {
    const apiRes = await fetch(`${ERLC_API_BASE}/server?Players=true`, {
      headers: { "server-key": srv.erlcApiKey },
      signal: AbortSignal.timeout(8000),
    });
    if (!apiRes.ok) return json(res, 200, { players: [] });

    const data = await apiRes.json();
    const rawPlayers = data?.Players || [];
    const units = rawPlayers.map((p, idx) => {
      const parts = String(p.Player || "").split(":");
      const username = parts[0] || `Unit ${idx + 1}`;
      const playerId = parts[1] || String(idx);
      const loc = p.Location || {};
      const locX = Number(loc.LocationX) || 0;
      const locZ = Number(loc.LocationZ) || 0;
      const px = Math.round(2677.5 + locX * 0.584);
      const py = Math.round(2677.5 + locZ * 0.584);

      return {
        id: playerId,
        name: username,
        team: p.Team || "Civilian",
        callsign: p.Callsign || "",
        wantedStars: p.WantedStars || 0,
        postal: loc.PostalCode || "",
        street: loc.StreetName || "",
        building: loc.BuildingNumber || "",
        x: px,
        y: py,
        color: teamColor(p.Team),
      };
    });

    return json(res, 200, { players: units });
  } catch {
    return json(res, 200, { players: [] });
  }
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
    case "/api/servers/delete":
      if (need("POST")) await deleteServerHandler(req, res);
      break;
    case "/api/servers/transfer":
      if (need("POST")) await transferServerHandler(req, res);
      break;
    case "/api/account/delete":
      if (need("POST")) await deleteAccountHandler(req, res);
      break;
    case "/api/discord/guilds":
      if (need("GET")) await listDiscordGuilds(req, res);
      break;
    case "/api/erlc/key":
      if (need("POST")) await erlcSaveKeyHandler(req, res);
      break;
    case "/api/erlc/test":
      if (need("POST")) await erlcTestKeyHandler(req, res);
      break;
    case "/api/erlc/status":
      if (need("GET")) await erlcStatusHandler(req, res, params);
      break;
    case "/api/erlc/command":
      if (need("POST")) await erlcCommandHandler(req, res);
      break;
    case "/api/erlc/patrol":
      if (need("GET")) await erlcPatrolHandler(req, res, params);
      break;
    default:
      if (pathname.startsWith("/api/servers/") && pathname.endsWith("/patrol")) {
        const parts = pathname.split("/");
        const id = decodeURIComponent(parts[3] || "");
        params.set("serverId", id);
        if (need("GET")) await erlcPatrolHandler(req, res, params);
        break;
      }
      json(res, 404, { error: "not_found" });
  }
  return true;
}

