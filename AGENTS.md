# AGENTS.md: handoff notes for AI assistants and developers

Read this first. It says what Whale Maps is, what exists, what does not, and how to work on it safely.
Last updated: 2026-10-13. If you change how something works, update this file in the same commit.

## What this is

**Whale Maps** is a website and web app for ER:LC (Emergency Response: Liberty County, a Roblox game).
It is a roleplay companion: a live map with location sharing, routes and camera alerts, fed by the
ER:LC API. Visual references the owner gave: anchr.gg, uplinkrblx.xyz, chirper.app (dark, polished,
app-like). Owner: GitHub `whoisbrzy`. Repo: `whoisbrzy/Whale-Maps` (the owner also commits directly to `main`, so
`git pull` before you push).

## Status

| Area | State |
| --- | --- |
| Design system (tokens, SF Pro, buttons, nav, hero) | Done |
| Landing page: hero, features, FAQ, footer | Done |
| Terms of Service, Privacy Policy, 404 | Done (templates, see "Legal") |
| `server.js`: static hosting, SPA fallback, security headers | Done |
| Discord login (OAuth2 `identify`) and `/api/me` | Done. Tested against a fake Discord, **not yet with real credentials** |
| Map app (Liberty County map, markers) | **Not started** |
| Location sharing (WebSockets, sessions) | **Not started** |
| ER:LC API connection (server keys, polling) | **Not started** |
| Routes, camera alerts | **Not started** |
| Onboarding / setup wizard | **Not started.** The owner has no assets yet, design it from scratch |

The "Get Started" hero button points at `#map`, which does not exist yet. The Features cards are marked
"Coming soon" except Discord login; flip a card to `live` in `src/components/Features.jsx` only when it ships.

## Stack and layout

- Frontend: React 18 + Vite 5 + react-router-dom 6, plain CSS (no Tailwind, no UI kit).
- Backend: `server.js`, **zero dependencies**, Node 18+ (uses built-in `fetch`). Keep it dependency-free
  unless there is a strong reason; the host has limited resources (see Deploy).
- No database yet. Sessions are signed cookies, so nothing is stored server-side.

```
server.js              backend (static files + Discord auth + /api)
index.html             Vite entry
public/                fonts/ (SF Pro woff2), logo.png, hero.jpg, favicon.png, _redirects
src/main.jsx           router + AuthProvider
src/App.jsx            route table (all pages render inside components/Layout.jsx)
src/auth.jsx           AuthProvider / useAuth(): { user, ready, logout }
src/config.js          site name, year, contact email, legal "last updated" date
src/components/        Navbar, Hero, Features, Faq, Footer, Layout, LegalPage, Icons, ScrollManager
src/pages/             Home, Terms, Privacy, NotFound
src/styles/            tokens.css (variables) -> base.css -> components.css -> pages.css
.env.example           every environment variable the server reads
```

## Design rules

- Everything pulls from CSS variables in `src/styles/tokens.css`. Do not hard-code colors.
- Brand: rich vivid blue `--blue-500: #2f6bff` on near-black surfaces; white text. Map/status colors:
  online `#34d399`, route `#22d3ee`, camera `#f59e0b`, danger `#f43f5e`.
- Font: SF Pro Display, self-hosted from `public/fonts/` (only Regular, Medium, Bold upright exist;
  600 to 800 map to Bold). **Licensing:** Apple's SF Pro license is meant for mockups, not public sites.
  If that matters, swap the three `@font-face` blocks for Inter; nothing else changes.
- The logo (`public/logo.png`) is a white silhouette on transparent. It is drawn with a CSS mask in
  `.whale-mark` so it takes `currentColor`. Use `<WhaleMark />`, not an `<img>`.
- Hero background is `public/hero.jpg` (943px wide, so it looks soft; the owner may supply a bigger one).
- Mobile matters (people use it on a second screen). Check at 390px wide and make sure nothing scrolls sideways.

## server.js

Routes:

| Route | Behavior |
| --- | --- |
| `GET /api/health` | `{ok:true}` |
| `GET /api/me` | `{user: {id,name,avatar} or null, authEnabled}` |
| `GET /auth/login` | sets a signed single-use `state` cookie, redirects to Discord authorize |
| `GET /auth/callback` | verifies state, exchanges the code, reads the profile, sets a 7-day session cookie, redirects to `/` |
| `POST /auth/logout` | clears the session cookie (204) |
| anything else | file from `dist/`; unknown page routes get `index.html` (SPA); missing files with an extension 404 |

Details worth knowing:
- Auth is on only if `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` and a `SESSION_SECRET` of 16+ chars are set.
  Otherwise the site still serves and `/auth/login` answers 503.
- Scope is `identify` only. We do **not** store Discord's access token; only `id`, display name and an avatar URL
  go into the cookie, signed with HMAC-SHA256 (`HttpOnly`, `SameSite=Lax`, `Secure` + `__Host-` prefix when `PUBLIC_URL` is https).
- A CSP is set in `securityHeaders()`. **When you add the map, extend `img-src` (tile/map images), and `connect-src`
  for WebSockets (`wss:`)**, or the browser will block them. `style-src` keeps `'unsafe-inline'` because React sets inline styles.
- `/auth/*` has a small per-IP rate limit (60/min). Set `TRUST_PROXY=1` when behind a reverse proxy.
- `DISCORD_API` env var exists only so tests can point at a fake Discord. Never set it in production.
- Static files are cached in memory and re-read when their mtime changes; `/assets/*` is cached for a year (Vite hashes the names).

## Environment variables

See `.env.example`. `PUBLIC_URL` must be the exact public address (no trailing slash). The Discord redirect URI
registered in the Discord developer portal must be `PUBLIC_URL + /auth/callback`; the server prints it on startup.
**Never commit real secrets**, and never ask the user to paste a client secret into chat; they set it in their host's panel.

## Run it

```bash
npm install
npm run build        # builds the site into dist/
npm start            # node server.js  (http://localhost:3000)

# development with hot reload: run both
npm start            # terminal 1 (API + login)
npm run dev          # terminal 2 (Vite on :5173, proxies /api and /auth to :3000)
                     # for login in dev set PUBLIC_URL=http://localhost:5173 and register that redirect URI
```

## Deploy (owner uses Wispbyte)

Wispbyte runs a program from a Docker image, with a startup command, environment variables and a file manager
(SFTP is premium only). Its docs did not say how a public URL/port or custom domain works, so confirm that in the panel.

1. `npm run build` on a computer.
2. Upload to the server: `dist/`, `server.js` and a `package.json` containing at least
   `{"type":"module","scripts":{"start":"node server.js"}}` (the server needs no `npm install`).
3. Set env vars in the panel (see `.env.example`). Startup command: `node server.js`. Needs Node 18+.
4. To update: rebuild, upload `dist/` over the old one, restart. (Content changes show without a restart, but restart anyway after a deploy.)

The server reads `PORT`, then `SERVER_PORT` (set by some panels), then 3000.
It also works on any host that can run Node; static-only hosts work for the pages but not for login.

## Legal pages

`src/pages/Terms.jsx` and `Privacy.jsx` are plain-language **templates, not legal advice.** They describe the planned
design (server key stored only on the backend, no long-term location history, no selling of data). Keep them true:
if the app starts doing something different (analytics, storing positions, new data sources), update the Privacy page.
`SITE.contactEmail` in `src/config.js` is empty, so Contact links are hidden until the owner sets one.

## ER:LC API: what is known and what is not

- Not verified against official docs. A third-party doc (Sonoran) shows players with `Player`, `Permission`,
  `Callsign`, `Team` and `Location` (`LocationX/Y/Z`), and a rate limit around 27 requests/minute per key.
  Postal code, street name and vehicle data were **not confirmed**. Check the official ER:LC API docs before building on them.
- Planned design: the server owner pastes their ER:LC server key in a wizard; the backend validates and stores it
  (encrypted), polls **once per server** (not once per user) and pushes updates to clients over WebSockets.
  The key never goes to a browser. In-game X/Z coordinates must be mapped to map pixels with a calibration step.
- Open question for the owner: one central key, or each server owner adds their own (the usual choice, and what the
  Terms/Privacy text assumes).

## Roadmap (suggested order)

1. Real-credential test of Discord login, then deploy.
2. Map page: Leaflet with a custom image map (needs a Liberty County map image the owner is allowed to use;
   do not invent one), zoom/pan, labels.
3. ER:LC connection + setup wizard (validate key, store it, poll).
4. Sessions and live location sharing over WebSockets (can be added to `server.js` with the built-in `http` upgrade
   or the `ws` package).
5. Camera markers with alert radius; routes (manual waypoints first, road-graph routing later).
6. Add a database (SQLite is enough) for servers, keys, cameras. Then settings page.

## Conventions

- Keep it small and dependency-light. Ask before adding a framework or database.
- Verify before claiming: build (`npm run build`), load the pages at 1440px and 390px, check the browser console is clean.
- Commit messages: short imperative summary. Do not commit `dist/`, `node_modules/` or `.env` (all gitignored).
- Don't present planned features as live in the UI or the legal text.
