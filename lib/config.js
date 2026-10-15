/* Central configuration. Everything comes from environment variables
   (Vercel project settings, or a local .env file during development).
   See .env.example for what each one does. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Optional .env file for local development (existing environment variables win).
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

const env = process.env;

export const PORT = Number(env.PORT || env.SERVER_PORT || 3000);
export const HOST = env.HOST || "0.0.0.0";

// Vercel exposes the production domain (no scheme) as VERCEL_PROJECT_PRODUCTION_URL.
const vercelUrl = env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : "";
export const PUBLIC_URL = (env.PUBLIC_URL || vercelUrl || `http://localhost:${PORT}`).replace(/\/+$/, "");
export const SECURE = PUBLIC_URL.startsWith("https://");
export const TRUST_PROXY = env.TRUST_PROXY === "1" || Boolean(env.VERCEL);

/* ---- Discord login ---- */
export const CLIENT_ID = env.DISCORD_CLIENT_ID || "";
export const CLIENT_SECRET = env.DISCORD_CLIENT_SECRET || "";
export const SESSION_SECRET = env.SESSION_SECRET || "";
export const AUTH_ON = Boolean(CLIENT_ID && CLIENT_SECRET && SESSION_SECRET.length >= 16);
export const REDIRECT_URI = `${PUBLIC_URL}/auth/callback`;
export const SESSION_DAYS = 7;
export const SESSION_COOKIE = `${SECURE ? "__Host-" : ""}wm_session`;
export const STATE_COOKIE = `${SECURE ? "__Host-" : ""}wm_state`;

/* ---- Dock (Roblox verification) ---- */
export const DOCK = {
  key: env.DOCK_API_KEY || "",
  pid: env.DOCK_PID || "",
  guildId: env.DOCK_GUILD_ID || "",
  base: (env.DOCK_API_BASE || "https://api.docksys.xyz").replace(/\/+$/, ""),
  version: env.DOCK_API_VERSION === "v1" ? "v1" : "v2",
};
export const ROBLOX_ON = Boolean(AUTH_ON && DOCK.key && DOCK.pid);

/* ---- MongoDB Atlas (optional; without it logins and links live in the cookie only) ---- */
export const MONGODB_URI = env.MONGODB_URI || "";
export const MONGODB_DB = env.MONGODB_DB || "whalemaps";

/* ---- Test-only overrides: point at fake services. Never set these in production. ---- */
export const DISCORD_API = env.DISCORD_API || "https://discord.com/api/v10";
export const ROBLOX_USERS_API = env.ROBLOX_USERS_API || "https://users.roblox.com";

/* Keep in sync with the "headers" block in vercel.json. */
export const CSP =
  "default-src 'self'; img-src 'self' data: https://cdn.discordapp.com https://api.erlc.gg; " +
  "style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; " +
  "object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
