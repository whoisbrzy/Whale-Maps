/* Stateless signed-cookie sessions (HMAC-SHA256). Nothing is stored server-side for a session. */
import crypto from "node:crypto";
import { AUTH_ON, SESSION_COOKIE, SESSION_DAYS, SESSION_SECRET } from "./config.js";
import { addCookie, parseCookies } from "./http.js";

const mac = (body) => crypto.createHmac("sha256", SESSION_SECRET).update(body).digest();

export function sign(obj) {
  const body = Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${body}.${mac(body).toString("base64url")}`;
}

export function verify(token) {
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

export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* The logged-in user, or null. roblox is {id, name} once verified. */
export function sessionUser(req) {
  const s = verify(parseCookies(req)[SESSION_COOKIE]);
  if (!s) return null;
  return { id: s.id, name: s.name, avatar: s.avatar, roblox: s.roblox || null };
}

export function setSession(res, user) {
  const payload = {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
    exp: Date.now() + SESSION_DAYS * 86_400_000,
  };
  if (user.roblox) payload.roblox = { id: String(user.roblox.id), name: user.roblox.name || null };
  addCookie(res, SESSION_COOKIE, sign(payload), SESSION_DAYS * 86_400);
}

export const clearSession = (res) => addCookie(res, SESSION_COOKIE, "", 0);
