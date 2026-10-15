/* Dock (docksys.xyz) client: hosted Roblox verification sessions.
 *
 * Flow: createSession(discordId) -> send the player to verifyUrl -> getSession(id) until completed.
 * The completed result carries the Roblox ID that Dock verified for a Discord ID.
 *
 * Dock's docs show two API shapes. v2 (openapi-v2.json) is the default; set DOCK_API_VERSION=v1
 * to use the older /api/v1/verify/session paths. Responses from both are normalized below.
 * Docs: https://docs.docksys.xyz/api/introduction
 * NOTE: written from the docs, not yet exercised against the real Dock service. */
import { DOCK, ROBLOX_USERS_API } from "./config.js";

export class DockError extends Error {
  constructor(status, message, retryAfter) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

const PATHS = {
  v2: { create: "/v2/sessions", get: (id) => `/v2/sessions/${encodeURIComponent(id)}` },
  v1: { create: "/api/v1/verify/session", get: (id) => `/api/v1/verify/session/${encodeURIComponent(id)}` },
};

async function call(pathname, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(DOCK.base + pathname, {
      method,
      headers: {
        Authorization: `Bearer ${DOCK.key}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new DockError(0, "Could not reach Dock");
  }
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const err = payload?.error;
    const message = (typeof err === "string" ? err : err?.message) || `Dock returned ${res.status}`;
    const retryAfter =
      Number(
        res.headers.get("retry-after") ||
          payload?.retryAfter ||
          payload?.meta?.rateLimit?.retryAfter ||
          err?.details?.retryAfter
      ) || undefined;
    throw new DockError(res.status, message, retryAfter);
  }
  return payload?.data ?? payload;
}

export async function createSession(clientId) {
  const body = { pid: DOCK.pid, clientId, ...(DOCK.guildId ? { guildId: DOCK.guildId } : {}) };
  const d = await call(PATHS[DOCK.version].create, { method: "POST", body });
  return { id: d.id || d.sid, verifyUrl: d.verifyUrl, expiresAt: d.expiresAt || null };
}

/* wait = seconds to long-poll for a change (Dock allows up to 25). */
export async function getSession(id, wait = 0) {
  const d = await call(PATHS[DOCK.version].get(id) + (wait ? `?wait=${wait}` : ""));
  return {
    clientId: d.clientId || null,
    status: d.status || (d.result ? "completed" : "pending"),
    result: d.result || null,
  };
}

/* Public Roblox username for display. Never throws; null if unavailable. */
export async function robloxName(robloxId) {
  if (!/^\d{1,20}$/.test(String(robloxId))) return null;
  try {
    const res = await fetch(`${ROBLOX_USERS_API}/v1/users/${robloxId}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const { name } = await res.json();
    return typeof name === "string" && /^\w{3,20}$/.test(name) ? name : null;
  } catch {
    return null;
  }
}
