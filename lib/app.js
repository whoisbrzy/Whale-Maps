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

const erlcCache = new Map(); // key -> { timestamp, data }

async function fetchErlcCached(endpoint, key, ttlMs = 1800) {
  const cacheKey = `${key}:${endpoint}`;
  const now = Date.now();
  const cached = erlcCache.get(cacheKey);
  if (cached && now - cached.timestamp < ttlMs) {
    return { ok: true, status: 200, data: cached.data, cached: true };
  }

  try {
    const res = await fetch(`${ERLC_API_BASE}${endpoint}`, {
      headers: { "server-key": key },
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 429 && cached?.data) {
      return { ok: true, status: 200, data: cached.data, rateLimited: true };
    }
    if (res.status === 403) {
      return { ok: false, status: 403, error: "INVALID_KEY", message: "Server key is invalid or expired." };
    }
    if (res.status === 422) {
      return { ok: true, status: 422, offline: true, data: { CurrentPlayers: 0, MaxPlayers: 0, Players: [] } };
    }
    if (!res.ok) {
      if (cached?.data) return { ok: true, status: 200, data: cached.data, fallback: true };
      return { ok: false, status: res.status, error: "API_ERROR", message: `ER:LC API status ${res.status}` };
    }

    const data = await res.json();
    erlcCache.set(cacheKey, { timestamp: now, data });
    return { ok: true, status: 200, data };
  } catch (err) {
    if (cached?.data) return { ok: true, status: 200, data: cached.data, networkError: true };
    return { ok: false, status: 502, error: "NETWORK_ERROR", message: err.message };
  }
}

async function erlcSaveKeyHandler(req, res) {
  const user = sessionUser(req) || { id: "anonymous", name: "Guest" };
  const data = await parseBody(req);
  const serverId = String(data?.serverId || "").trim();
  const erlcApiKey = String(data?.erlcApiKey || "").trim();
  if (!serverId) return json(res, 400, { error: "serverId is required." });

  try {
    await store.updateServerKey(serverId, user.id, erlcApiKey);
    if (erlcApiKey) {
      fetchErlcCached("/server", erlcApiKey, 0)
        .then((r) => {
          if (r.ok && r.data?.Name) {
            store.getServer(serverId).then((srv) => {
              if (srv && (srv.name === "Liberty County Server" || !srv.name)) {
                srv.name = r.data.Name;
              }
            });
          }
        })
        .catch(() => {});
    }
    return json(res, 200, { ok: true });
  } catch (err) {
    return json(res, 200, { ok: true });
  }
}

async function erlcTestKeyHandler(req, res) {
  const data = await parseBody(req);
  let key = String(data?.erlcApiKey || "").trim();
  const serverId = String(data?.serverId || "").trim();

  if (!key && serverId) {
    const srv = await store.getServer(serverId);
    key = srv?.erlcApiKey || "";
  }

  if (!key) {
    return json(res, 400, { error: "No ER:LC API Key provided to test." });
  }

  const result = await fetchErlcCached("/server", key, 1000);
  if (!result.ok) {
    return json(res, result.status || 400, { ok: false, error: result.message || "Invalid Server Key" });
  }
  if (result.offline) {
    return json(res, 200, { ok: true, offline: true, message: "Valid Server Key! Note: Private server is currently empty / offline." });
  }
  return json(res, 200, { ok: true, data: result.data });
}

const robloxAvatarCache = new Map();

async function fetchRobloxThumbnails(userIds) {
  const missing = userIds.filter((id) => id && !robloxAvatarCache.has(String(id)));
  if (missing.length > 0) {
    try {
      for (let i = 0; i < missing.length; i += 50) {
        const chunk = missing.slice(i, i + 50);
        const res = await fetch(
          `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${chunk.join(",")}&size=150x150&format=Png&isCircular=false`,
          { signal: AbortSignal.timeout(4000) }
        );
        if (res.ok) {
          const body = await res.json();
          for (const item of body?.data || []) {
            if (item.targetId && item.imageUrl) {
              robloxAvatarCache.set(String(item.targetId), item.imageUrl);
            }
          }
        }
      }
    } catch (err) {
      console.warn("Roblox avatar headshot fetch warning:", err.message);
    }
  }

  const result = {};
  for (const id of userIds) {
    const sId = String(id);
    result[sId] =
      robloxAvatarCache.get(sId) ||
      `https://www.roblox.com/headshot-thumbnail/image?userId=${sId}&width=150&height=150&format=png`;
  }
  return result;
}

async function erlcStatusHandler(req, res, params) {
  const user = sessionUser(req);
  const serverId = params.get("serverId") || "";
  const clientKey = req.headers["x-erlc-key"] || params.get("key") || "";
  if (!serverId && !clientKey) return json(res, 400, { error: "serverId is required." });

  let srv = serverId ? await store.getServer(serverId, user?.id) : null;
  if (!srv && serverId) srv = await store.getServer(serverId);

  if (!srv && serverId && clientKey) {
    await store.updateServerKey(serverId, user?.id || "anonymous", clientKey);
    srv = await store.getServer(serverId);
  }

  const DEFAULT_ERLC_KEY = "CptBebykvqrbzMppfjYA-XGAcBUeiXfAZhLYunSESsHjCTKemKffmxtEbxlBp";
  const key = clientKey || srv?.erlcApiKey || DEFAULT_ERLC_KEY;
  if (!key) {
    return json(res, 200, { ok: false, configured: false, error: "NO_KEY", message: "No ER:LC Server Key configured." });
  }

  const query = new URLSearchParams({
    Players: "true",
    Vehicles: "true",
    Staff: "true",
    JoinLogs: "true",
    KillLogs: "true",
    CommandLogs: "true",
    Queue: "true",
  });

  const result = await fetchErlcCached(`/server?${query}`, key, 1800);
  if (!result.ok) {
    return json(res, 200, { ok: false, configured: true, error: result.error, message: result.message });
  }

  const data = result.data || {};
  const rawPlayers = data?.Players || [];
  const userIds = [];
  for (const p of rawPlayers) {
    const parts = String(p.Player || "").split(":");
    const robloxId = parts[1] || "";
    if (robloxId && /^\d+$/.test(robloxId)) userIds.push(robloxId);
  }
  const avatars = await fetchRobloxThumbnails(userIds);

  if (Array.isArray(data.Players)) {
    data.Players = data.Players.map((p) => {
      const parts = String(p.Player || "").split(":");
      const robloxUsername = parts[0] || "Unknown";
      const robloxId = parts[1] || "";
      return {
        ...p,
        robloxUsername,
        robloxId,
        robloxAvatar: avatars[robloxId] || `https://www.roblox.com/headshot-thumbnail/image?userId=${robloxId}&width=150&height=150&format=png`,
        robloxProfileUrl: robloxId ? `https://www.roblox.com/users/${robloxId}/profile` : "",
      };
    });
  }

  return json(res, 200, { ok: true, configured: true, server: data });
}

async function erlcCommandHandler(req, res) {
  const user = sessionUser(req);
  const data = await parseBody(req);
  const serverId = String(data?.serverId || "").trim();
  const command = String(data?.command || "").trim();
  if (!serverId || !command) return json(res, 400, { error: "serverId and command are required." });

  let srv = await store.getServer(serverId, user?.id);
  if (!srv) srv = await store.getServer(serverId);
  const key = srv?.erlcApiKey || req.headers["x-erlc-key"] || "";
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
  const clientKey = req.headers["x-erlc-key"] || params.get("key") || "";

  let srv = serverId ? await store.getServer(serverId) : null;
  if (!srv && serverId && clientKey) {
    await store.updateServerKey(serverId, "anonymous", clientKey);
    srv = await store.getServer(serverId);
  }

  const mapSettings = srv?.mapSettings || {
    civilianVisibility: "all",
    leoVisibility: "all",
    showAvatarsOnBlips: true,
    showCallsigns: true,
    showPostalNumbers: true,
    showWantedStars: true,
  };

  const DEFAULT_ERLC_KEY = "CptBebykvqrbzMppfjYA-XGAcBUeiXfAZhLYunSESsHjCTKemKffmxtEbxlBp";
  const key = clientKey || srv?.erlcApiKey || DEFAULT_ERLC_KEY;
  if (!key) {
    return json(res, 200, { players: [], mapSettings });
  }

  const result = await fetchErlcCached("/server?Players=true", key, 1800);
  if (!result.ok && !result.data) {
    return json(res, 200, { players: [], mapSettings });
  }

  const data = result.data || {};
  const rawPlayers = data?.Players || [];
  const userIds = [];
  for (const p of rawPlayers) {
    const parts = String(p.Player || "").split(":");
    const robloxId = parts[1] || "";
    if (robloxId && /^\d+$/.test(robloxId)) userIds.push(robloxId);
  }
  const avatars = await fetchRobloxThumbnails(userIds);

  let units = rawPlayers.map((p, idx) => {
    const parts = String(p.Player || "").split(":");
    const username = parts[0] || `Player ${idx + 1}`;
    const playerId = parts[1] || String(idx + 1);
    const loc = p.Location || {};
    const locX = Number(loc.LocationX) || 0;
    const locZ = Number(loc.LocationZ) || 0;
    let px = locX;
    let py = locZ;
    if (locX < 0 || locZ < 0) {
      px = 2677.5 + locX;
      py = 2677.5 + locZ;
    }
    px = Math.max(0, Math.min(5355, Math.round(px)));
    py = Math.max(0, Math.min(5355, Math.round(py)));
    const percentX = Number(((px / 5355) * 100).toFixed(4));
    const percentY = Number(((py / 5355) * 100).toFixed(4));

    return {
      id: playerId,
      robloxId: playerId,
      name: username,
      robloxUsername: username,
      robloxAvatar: avatars[playerId] || `https://www.roblox.com/headshot-thumbnail/image?userId=${playerId}&width=150&height=150&format=png`,
      robloxProfileUrl: playerId ? `https://www.roblox.com/users/${playerId}/profile` : "",
      team: p.Team || "Civilian",
      callsign: p.Callsign || "",
      wantedStars: p.WantedStars || 0,
      postal: loc.PostalCode || "",
      street: loc.StreetName || "",
      building: loc.BuildingNumber || "",
      x: px,
      y: py,
      percentX,
      percentY,
      color: teamColor(p.Team),
    };
  });

  // Server visibility rules (defaults to "all" so everyone is visible)
  if (mapSettings.civilianVisibility === "wanted_only") {
    units = units.filter((u) => {
      const isCiv = u.team.toLowerCase().includes("civilian");
      if (isCiv && u.wantedStars === 0) return false;
      return true;
    });
  } else if (mapSettings.civilianVisibility === "hide_all") {
    units = units.filter((u) => !u.team.toLowerCase().includes("civilian"));
  }

  if (mapSettings.leoVisibility === "leo_only") {
    units = units.filter((u) => {
      const t = u.team.toLowerCase();
      return t.includes("police") || t.includes("sheriff") || t.includes("fire") || t.includes("ems");
    });
  }

  return json(res, 200, { players: units, mapSettings });
}

async function getMapSettingsHandler(req, res, params) {
  const user = sessionUser(req);
  if (!user) return json(res, 401, { error: "Please log in first." });
  const serverId = params.get("serverId") || "";
  if (!serverId) return json(res, 400, { error: "serverId is required." });

  const srv = await store.getServer(serverId, user.id);
  if (!srv) return json(res, 404, { error: "Server not found." });

  const defaultSettings = {
    civilianVisibility: "all", // "all" | "wanted_only" | "hide_all"
    leoVisibility: "all", // "all" | "leo_only"
    showAvatarsOnBlips: true,
    showCallsigns: true,
    showPostalNumbers: true,
    showWantedStars: true,
    mapSeason: "fall", // "fall" | "snow"
  };

  return json(res, 200, { settings: { ...defaultSettings, ...(srv.mapSettings || {}) } });
}

async function saveMapSettingsHandler(req, res) {
  const user = sessionUser(req);
  if (!user) return json(res, 401, { error: "Please log in first." });
  const data = await parseBody(req);
  const serverId = String(data?.serverId || "").trim();
  const settings = data?.settings || {};
  if (!serverId) return json(res, 400, { error: "serverId is required." });

  try {
    const updated = await store.updateMapSettings(serverId, user.id, settings);
    return json(res, 200, { ok: true, settings: updated });
  } catch (err) {
    return json(res, 403, { error: err.message });
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
    case "/api/servers/map-settings":
      if (req.method === "GET") await getMapSettingsHandler(req, res, params);
      else if (req.method === "POST") await saveMapSettingsHandler(req, res);
      else need("GET");
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

