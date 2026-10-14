# AGENTS.md: handoff notes for AI assistants and developers

Read this first. It says what Waylo is, what exists, what does not, and how to work on it safely.
Last updated: 2026-10-14. If you change how something works, update this file in the same commit.

## What this is

**Waylo** is a website and web app for ER:LC (Emergency Response: Liberty County, a Roblox game): a roleplay
companion with a live map, location sharing, routes and camera alerts, fed by the ER:LC API. Visual references from
the owner: anchr.gg, uplinkrblx.xyz, chirper.app (dark, polished, app-like). Owner: GitHub `whoisbrzy`.
Repo: `whoisbrzy/Whale-Maps`. The owner also commits to `main`, so `git pull` before you push.
**Hosting: Vercel** (frontend + one serverless function). Database: MongoDB Atlas. Roblox verification: Dock.

## Status

| Area | State |
| --- | --- |
| Design system, landing page (hero, features, FAQ, footer), Terms, Privacy, 404 | Done |
| Discord login (OAuth2 `identify`), profile + name imported into MongoDB | Done. Login verified with real credentials locally (2026-10-14); MongoDB storage still untested |
| Roblox verification via Dock (`/verify` page, `/api/roblox/*`) | Done. Tested against a fake Dock that follows its docs, **not yet against the real Dock** |
| Vercel config (`vercel.json`, `api/[...path].js`) | Deployed and working (production: `waylorblx.vercel.app`, project `waylosys`, scope `egyptianalis-projects`, GitHub-connected). NOTE: `/auth/*` and `/api/*` rewrites must target the function directly (`/api/[...path]`) — routing them to `/api/auth/:path*` makes Vercel's router 404 multi-segment API paths |
| Map app, location sharing, ER:LC API connection, routes, camera alerts, setup wizard | **Not started** |

The hero "Get Started" button points at `#map`, which does not exist yet. In `src/components/Features.jsx`, only the
login/verify card is `live`; flip others only when they ship. Don't present planned features as live (UI or legal text).

## Stack and layout

React 18 + Vite 5 + react-router-dom 6, plain CSS. Backend = Node ESM, dependency-light (only `mongodb`).

```
api/[...path].js       Vercel serverless entry: every /api/* and /auth/* request -> lib/app.js
vercel.json            rewrites (/auth/* -> /api/auth/*, SPA fallback), function maxDuration 30s, security headers/CSP
server.js              LOCAL / self-hosted entry: serves dist/ + the same router. NOT used on Vercel
lib/app.js             the router and all handlers (Discord login, Roblox verify)
lib/config.js          all env vars, CSP string, .env loader (local)
lib/http.js            send/json/redirect, security headers, cookies, per-IP rate limit
lib/session.js         HMAC-signed stateless session cookie
lib/dock.js            Dock client (v2 default, v1 fallback) + Roblox username lookup
lib/store.js           MongoDB users collection (no-op without MONGODB_URI)
src/auth.jsx           AuthProvider / useAuth(): { user, ready, robloxEnabled, refresh, logout }
src/pages/             Home, Verify, Terms, Privacy, NotFound
src/components/        Navbar, Hero, Features, Faq, Footer, Layout, LegalPage, Icons, ScrollManager
src/styles/            tokens.css (variables) -> base.css -> components.css -> pages.css
src/config.js          site name, contact email (empty = Contact links hidden), legal "last updated" date
public/                fonts (SF Pro, Pacifico woff2), logo.png, favicon.png, hero/ (slideshow images)
.env.example           every environment variable
```

## API

| Route | Behavior |
| --- | --- |
| `GET /api/health` | `{ok:true}` |
| `GET /api/me` | `{user: {id,name,avatar,roblox:{id,name}\|null}\|null, authEnabled, robloxEnabled}` |
| `GET /auth/login` | signed single-use `state` cookie, redirect to Discord (scope `identify`) |
| `GET /auth/callback` | verify state, exchange code, read profile, **upsert profile into MongoDB**, load any Roblox link, set 7-day session cookie |
| `POST /auth/logout` | clear cookie (204) |
| `POST /api/roblox/start` | creates a Dock session (`clientId` = Discord ID), returns `{sid, verifyUrl}` (https only) |
| `GET /api/roblox/status?sid=` | long-polls Dock (15s). On `completed` it **requires `result.discordId` == the logged-in user** (and `clientId`), looks up the public Roblox username, saves the link to MongoDB, refreshes the cookie. Statuses: `pending`, `completed`, `expired`, `cancelled`, `mismatch` (403), `taken` (409) |
| `POST /api/roblox/unlink` | removes the link (DB + cookie), 204 |

Security notes: cookies are `HttpOnly; SameSite=Lax` (`Secure` + `__Host-` prefix when `PUBLIC_URL` is https); POSTs with
`Sec-Fetch-Site: cross-site` are refused; Discord's access token is never stored; the Dock key never leaves the server;
one Roblox account can link to only one Waylo account (unique sparse index on `roblox.id`). Rate limits are in memory,
so on Vercel they are per instance (best effort).
**CSP lives in two places that must match: `lib/config.js` (`CSP`) and `vercel.json` (`headers`).** When you add the map,
extend `img-src` (map images) and `connect-src` (WebSockets / API hosts) in both.

## Data (MongoDB Atlas, db `whalemaps`, collection `users`)

```
{ _id: <discord id>, username, name, avatar, createdAt, updatedAt, lastLoginAt,
  roblox?: { id, name, verifiedAt, via: "dock" } }
```
Without `MONGODB_URI` everything still works but the Roblox link only lives in the cookie (re-verify after 7 days).
Not tested against a real Atlas cluster (only a fake collection exposing the same calls).

## Dock (Roblox verification) facts

Docs: https://docs.docksys.xyz/api/introduction (full page list at `/llms.txt`, OpenAPI at `/api/openapi-v2.json`).
Base `https://api.docksys.xyz`, header `Authorization: Bearer <key>`. Needs a **PID** (project) created in the Dock dashboard.
- v2: `POST /v2/sessions {pid, clientId, guildId?}` -> `{id, verifyUrl, status, ...}`; `GET /v2/sessions/{id}?wait=0..25`
  -> `status` + `result {discordId, robloxId, ...}`.
- v1 (older doc pages): `POST /api/v1/verify/session`, `GET /api/v1/verify/session/{sid}`. Set `DOCK_API_VERSION=v1` to use it.
- Limits: sessions last 5 min, poll at most every 2s, long-poll max 25s; key quota ~1 req/s (daily caps on free/premium).
- Dock docs conflict between v1 and v2 and show no sample responses, so field names are normalized defensively in `lib/dock.js`.
  The completed result has **no username**, so we fetch it from `users.roblox.com`. If real Dock behaves differently, fix `lib/dock.js` only.
- Dock docs do not mention a return/redirect URL, so the `/verify` page opens Dock in a new tab and polls.

## Deploy on Vercel (what the owner must do)

1. Import the GitHub repo in Vercel (framework preset: Vite; build `npm run build`; output `dist`).
2. Add the env vars from `.env.example` (Discord, `SESSION_SECRET`, `PUBLIC_URL` = the production domain, Dock key + PID, `MONGODB_URI`).
3. Discord developer portal -> OAuth2 -> add redirect `PUBLIC_URL + /auth/callback`. Login only works on that exact domain (not preview URLs).
4. MongoDB Atlas: free cluster, create a DB user, Network Access must allow Vercel (IPs are dynamic, so `0.0.0.0/0` with a strong password), copy the connection string into `MONGODB_URI`.
5. Dock: create an API key and a PID in the dashboard, put them in env vars.
Never commit secrets and never ask the owner to paste secrets into chat.

## Local development

```bash
npm install
npm run build && npm start      # http://localhost:3000 (server.js: static + API)
# hot reload: npm start in one terminal, npm run dev in another (Vite :5173 proxies /api and /auth;
# for login in dev set PUBLIC_URL=http://localhost:5173 and register that redirect URI)
```
`server.js` also works for self-hosting on any Node 22 host. `DISCORD_API`, `ROBLOX_USERS_API`, `DOCK_API_BASE` env vars
exist so tests can point at fakes; never set them in production.

## Design rules

- Everything pulls from CSS variables in `src/styles/tokens.css`; no hard-coded colors. Brand: vivid blue `#2f6bff` on near-black.
  Map/status colors: online `#34d399`, route `#22d3ee`, camera `#f59e0b`, danger `#f43f5e`.
- Font: SF Pro Display (Regular, Medium, Bold only) self-hosted. **Apple's license is meant for mockups, not public sites**;
  swap the `@font-face` blocks for Inter if that matters.
- Brand name is **Waylo** (renamed from Whale Maps on 2026-10-14; the GitHub repo, `package.json` name and MongoDB db `whalemaps` keep the old name on purpose, so existing data and links keep working).
- Logo is `public/logo.png` (dark rounded square, white map pin, 150px), shown with `<LogoMark />`; `favicon.png` is the same icon.
- Topbar (`src/components/Navbar.jsx`): a blue announcement strip (text in `BANNER_TEXT`, currently "Releasing soon"; dismissal is remembered in localStorage under `BANNER_KEY`, change the key to show a new message again) above a rounded black navbar with centered links and a Resources dropdown; below 860px it collapses to a hamburger. `--topbar-h` (tokens.css) is the strip + navbar height and drops to the navbar alone once the strip is dismissed (`html[data-banner="off"]`), so page padding and anchor offsets must use `--topbar-h`, not `--nav-h`.
- Wordmark: `public/wordmark.png` (white lettering, transparent), shown with `<Wordmark />` next to the logo in the navbar, footer and hero headline (plain text name "Waylo" is still used in body copy).
- Hero: "Navigate" is set in Pacifico (a curly script, SIL OFL, `public/fonts/pacifico-regular.woff2`, class `.hero__script`); the background is a crossfading slideshow of `public/hero/slide-*.jpg` (list in `src/components/Hero.jsx`, 6.5s per slide, dots to jump, no autoplay with reduced motion).
- Mobile matters (second-screen use): check 390px wide, nothing may scroll sideways.

## Legal pages

Terms and Privacy are plain-language **templates, not legal advice**. They already cover Discord login, Dock, Vercel,
MongoDB Atlas and the stored Roblox link. Keep them true when behavior changes. `SITE.contactEmail` is empty (Contact hidden)
until the owner sets one; privacy rules often expect a contact address.

## ER:LC API (not built yet)

Not verified against official docs. A third-party doc (Sonoran) shows players with `Player`, `Permission`, `Callsign`, `Team`,
`Location` (`LocationX/Y/Z`) and ~27 requests/min per key; postal/street/vehicle data unconfirmed. Plan: server owners paste
their server key in a wizard; backend validates and stores it (encrypted), polls **once per server**, pushes to clients over
WebSockets (note: Vercel functions cannot hold WebSockets, so use a separate realtime service or polling/SSE). Map X/Z to
pixels with a calibration step. Open question for the owner: one central key or per-server keys (Terms/Privacy assume per-server).

## Roadmap

1. Real-credential test of Discord login + Dock on a Vercel deploy; fix `lib/dock.js` if Dock's real responses differ.
2. Map page (Leaflet, custom image; needs a Liberty County image the owner may use; do not invent one).
3. ER:LC connection + setup wizard. 4. Live sharing (decide realtime approach for Vercel). 5. Cameras, routes. 6. Settings.

## Conventions

- Keep it small; ask before adding a framework or another service. Verify before claiming: `npm run build`, check 1440px and
  390px, console clean. Short imperative commit messages. Don't commit `dist/`, `node_modules/` or `.env`.
