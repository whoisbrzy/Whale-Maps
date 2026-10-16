import { useState, useRef, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LogoMark, IconDashboard, IconClose } from "../components/Icons.jsx";
import DesktopTitlebar from "../components/DesktopTitlebar.jsx";
import { DESKTOP_DOWNLOAD_URL } from "../config.js";

const MAP_URLS = {
  fall: {
    blank: "/maps/fall_blank.webp",
    postals: "/maps/fall_postals.webp",
  },
  snow: {
    blank: "/maps/snow_blank.webp",
    postals: "/maps/snow_postals.webp",
  },
};

/* Live tracking flows through our patrol endpoint. That is not optional: the
   ER:LC API rejects CORS preflights for the server-key header (403), so server
   keys cannot be used from a browser at all — the key must stay server-side.
   The cost is still small: the server polls ER:LC once per key (1.8s cache
   shared by every viewer), responses are ETagged (304 = no body when nothing
   moved) and edge-compressed, and polling pauses in background tabs. */

const isDesktopApp = () => Boolean(window.wayloDesktop?.isDesktop);

/* The live map runs in the desktop app; on the website this page is a download
   prompt. In the app, tracking goes straight from the user's PC to ER:LC. */
function DownloadDesktop() {
  return (
    <div className="tactical-map tactical-map--download">
      <DesktopTitlebar />
      <div className="download-hero">
        <LogoMark />
        <h1 className="download-hero__title">The map lives in the Waylo desktop app</h1>
        <p className="download-hero__lead">
          Live tracking in the app runs straight from your PC to the ER:LC API at full
          speed - no browser limits, nothing in between. Log in with Discord, verify
          with Dock, and your servers are right there.
        </p>
        <a className="btn btn--primary" href={DESKTOP_DOWNLOAD_URL} download="Waylo-Setup.exe">
          Download the desktop app
        </a>
      </div>
    </div>
  );
}

export default function MapPage() {
  const [params] = useSearchParams();
  if (!isDesktopApp()) return <DownloadDesktop />;
  const serverId = params.get("server") || "";
  const paramName = params.get("name") || "";
  const [serverName, setServerName] = useState(paramName);

  // Map display settings
  const [showPostals, setShowPostals] = useState(true);
  const [activeUnits, setActiveUnits] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [mapSettings, setMapSettings] = useState({
    showAvatarsOnBlips: true,
    showCallsigns: true,
    showPostalNumbers: true,
    showWantedStars: true,
    mapSeason: "fall",
  });

  // Pan & Zoom controls
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  const currentSeason = mapSettings.mapSeason === "snow" ? "snow" : "fall";
  const seasonUrls = MAP_URLS[currentSeason] || MAP_URLS.fall;
  const mapImgUrl = showPostals ? seasonUrls.postals : seasonUrls.blank;

  // Resolve human-readable server name
  useEffect(() => {
    if (!serverId) return;
    if (paramName) {
      setServerName(paramName);
      return;
    }

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("waylo_servers_")) {
          const list = JSON.parse(localStorage.getItem(key) || "[]");
          const found = list.find((s) => s.id === serverId);
          if (found?.name) {
            setServerName(found.name);
            return;
          }
        }
      }
    } catch {
      /* ignore */
    }

    fetch("/api/servers")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const found = data?.servers?.find((s) => s.id === serverId);
        if (found?.name) {
          setServerName(found.name);
        }
      })
      .catch(() => {});
  }, [serverId, paramName]);

  const hasCenteredRef = useRef(false);
  const etagRef = useRef(null);

  // Routes: click two points on the map to draw a route; saved per server.
  const routesKey = `waylo_routes_${serverId || "default"}`;
  const [routes, setRoutes] = useState([]);
  const [routesOpen, setRoutesOpen] = useState(false);
  const [placing, setPlacing] = useState(null); // null | "start" | "end"
  const [draft, setDraft] = useState(null); // { start: {x, y} }
  const didPanRef = useRef(false);
  const downPosRef = useRef(null);

  useEffect(() => {
    try {
      setRoutes(JSON.parse(localStorage.getItem(routesKey) || "[]"));
    } catch {
      setRoutes([]);
    }
    setPlacing(null);
    setDraft(null);
  }, [routesKey]);

  const saveRoutes = (list) => {
    setRoutes(list);
    try {
      localStorage.setItem(routesKey, JSON.stringify(list));
    } catch {}
  };

  const handleMapClick = (e) => {
    if (!placing) return;
    if (didPanRef.current) {
      didPanRef.current = false;
      return; // that was a drag, not a click
    }
    const img = e.currentTarget.querySelector(".tactical-map-img");
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    const point = { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) };
    if (placing === "start") {
      setDraft({ start: point });
      setPlacing("end");
    } else if (draft) {
      saveRoutes([
        ...routes,
        { id: Date.now().toString(36), name: `Route ${routes.length + 1}`, start: draft.start, end: point },
      ]);
      setDraft(null);
      setPlacing(null);
    }
  };

  const focusUnit = (u) => {
    if (!u) return;
    const targetX = (u.percentX != null ? u.percentX : ((u.x || 0) / 5355) * 100) * 20.48;
    const targetY = (u.percentY != null ? u.percentY : ((u.y || 0) / 5355) * 100) * 20.48;
    setPan({ x: Math.round(1024 - targetX), y: Math.round(1024 - targetY) });
    setZoom(1.15);
    setSelectedUnit(u);
  };

  // Fetch real units for this server with 2s real-time live interval
  useEffect(() => {
    setLoadingUnits(true);

    let localKey = "";
    if (serverId) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("waylo_servers")) {
            const list = JSON.parse(localStorage.getItem(k) || "[]");
            const s = list.find((x) => x.id === serverId);
            if (s?.erlcApiKey) {
              localKey = s.erlcApiKey;
              break;
            }
          }
        }
      } catch {}
    }

    const keyToSend = localKey || "CptBebykvqrbzMppfjYA-XGAcBUeiXfAZhLYunSESsHjCTKemKffmxtEbxlBp";
    const patrolUrl = serverId
      ? `/api/servers/${encodeURIComponent(serverId)}/patrol`
      : "/api/erlc/patrol";

    // Desktop app: the Electron main process polls ER:LC directly from this PC
    // (no CORS there, no Waylo server in the path, interval 0 — requests fire
    // back-to-back and ER:LC's own 429 rate limit is the only throttle) and
    // pushes updates over IPC the moment they land.
    if (window.wayloDesktop?.isDesktop) {
      const off = window.wayloDesktop.onPatrol((data) => {
        if (serverId && data.serverId !== serverId) return;
        if (data.players) {
          setActiveUnits(data.players);
          if (data.players.length > 0 && !hasCenteredRef.current) {
            hasCenteredRef.current = true;
            focusUnit(data.players[0]);
          }
        }
        setLoadingUnits(false);
      });
      window.wayloDesktop.watch(keyToSend, serverId);
      return () => {
        off();
        window.wayloDesktop.unwatch();
      };
    }

    const fetchPatrol = () => {
      if (document.hidden) return; // background tab: skip polling entirely
      fetch(patrolUrl, {
        headers: {
          "x-erlc-key": keyToSend,
          ...(etagRef.current ? { "If-None-Match": etagRef.current } : {}),
        },
      })
        .then((res) => {
          if (res.status === 304) return null; // nothing changed since the last poll
          const etag = res.headers.get("etag");
          if (etag) etagRef.current = etag;
          return res.ok ? res.json() : null;
        })
        .then((data) => {
          if (data?.players) {
            setActiveUnits(data.players);
            if (data.players.length > 0 && !hasCenteredRef.current) {
              hasCenteredRef.current = true;
              focusUnit(data.players[0]);
            }
          }
          if (data?.mapSettings) {
            setMapSettings((prev) => ({ ...prev, ...data.mapSettings }));
          }
        })
        .catch(() => {})
        .finally(() => setLoadingUnits(false));
    };

    fetchPatrol();
    const interval = setInterval(fetchPatrol, 2000);
    return () => clearInterval(interval);
  }, [serverId]);

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    downPosRef.current = { x: e.clientX, y: e.clientY };
    didPanRef.current = false;
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    const d = downPosRef.current;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) didPanRef.current = true;
    setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY * -0.0015;
    setZoom((prev) => Math.min(4, Math.max(0.4, prev + delta)));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="tactical-map">
      <DesktopTitlebar />
      {/* Floating Glass Matte HUD (matches hero & navbar design) */}
      <header className="tactical-glass-hud">
        <div className="tactical-glass-hud__brand-wrap">
          <Link to="/servers" className="tactical-glass-hud__brand" title="Back to My Servers">
            <LogoMark />
            <span className="tactical-glass-hud__title">
              {serverName ? serverName.toUpperCase() : "LIBERTY COUNTY"}
            </span>
          </Link>
        </div>

        {/* Center Controls: Postals Toggle & Unit Focus */}
        <div className="tactical-glass-hud__center">
          <button
            type="button"
            className={`tactical-glass-pill${showPostals ? " is-active" : ""}`}
            onClick={() => setShowPostals((prev) => !prev)}
            aria-pressed={showPostals}
          >
            Postals {showPostals ? "ON" : "OFF"}
          </button>
          {activeUnits.length > 0 && (
            <button
              type="button"
              className="tactical-glass-pill is-active"
              onClick={() => focusUnit(activeUnits[0])}
              title="Center on unit"
            >
              🎯 Center on {activeUnits[0].robloxUsername || activeUnits[0].name}
            </button>
          )}
        </div>

        {/* Right Actions */}
        <div className="tactical-glass-hud__actions">
          {serverId && (
            <Link
              to={`/dashboard?server=${encodeURIComponent(serverId)}${serverName ? `&name=${encodeURIComponent(serverName)}` : ""}&tab=overview`}
              className="btn btn--ghost btn--small"
            >
              <IconDashboard /> Dashboard
            </Link>
          )}
          <button
            type="button"
            className={`btn btn--ghost btn--small${drawerOpen ? " is-active" : ""}`}
            onClick={() => setDrawerOpen((o) => !o)}
          >
            Units ({activeUnits.length})
          </button>
        </div>
      </header>

      {/* Routes panel */}
      <div className="tactical-routes">
        <button type="button" className="tactical-routes__toggle" onClick={() => setRoutesOpen((v) => !v)}>
          Routes
          {routes.length > 0 && <span className="tactical-routes__count">{routes.length}</span>}
        </button>
        {routesOpen && (
          <div className="tactical-routes__panel">
            {placing ? (
              <p className="tactical-routes__hint">
                Click the map to set the {placing} point…
                <button type="button" className="tactical-routes__cancel" onClick={() => { setPlacing(null); setDraft(null); }}>
                  Cancel
                </button>
              </p>
            ) : (
              <button type="button" className="tactical-routes__add" onClick={() => setPlacing("start")}>
                + New route
              </button>
            )}
            {routes.map((r) => (
              <div key={r.id} className="tactical-routes__row">
                <span className="tactical-routes__name">{r.name}</span>
                <button
                  type="button"
                  className="tactical-routes__del"
                  title="Delete route"
                  onClick={() => saveRoutes(routes.filter((x) => x.id !== r.id))}
                >
                  ×
                </button>
              </div>
            ))}
            {routes.length === 0 && !placing && (
              <p className="tactical-routes__hint">Click + New route, then click two points on the map.</p>
            )}
          </div>
        )}
      </div>

      {/* Map Interactive Canvas */}
      <main
        className="tactical-canvas-wrap"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleMapClick}
      >
        <div
          className="tactical-canvas-layer"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* Map Image */}
          <img
            src={mapImgUrl}
            alt="Liberty County Map"
            className="tactical-map-img"
            draggable={false}
            loading="eager"
          />

          {/* Saved routes */}
          <svg
            className="tactical-routes-svg"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {routes.map((r) => (
              <g key={r.id}>
                <line
                  x1={r.start.x}
                  y1={r.start.y}
                  x2={r.end.x}
                  y2={r.end.y}
                  className="tactical-route-line"
                  vectorEffect="non-scaling-stroke"
                />
                <circle cx={r.start.x} cy={r.start.y} r="0.45" className="tactical-route-dot" />
                <circle cx={r.end.x} cy={r.end.y} r="0.45" className="tactical-route-dot" />
              </g>
            ))}
            {draft && (
              <circle
                cx={draft.start.x}
                cy={draft.start.y}
                r="0.55"
                className="tactical-route-dot tactical-route-dot--draft"
              />
            )}
          </svg>

          {/* Real Active Patrol Units with Roblox Headshots */}
          {activeUnits.map((unit) => {
            const showAvatar = mapSettings.showAvatarsOnBlips !== false && Boolean(unit.robloxAvatar);
            const labelText = mapSettings.showCallsigns !== false ? (unit.callsign || unit.name) : unit.name;
            const leftPercent = unit.percentX != null ? unit.percentX : ((unit.x || 0) / 5355) * 100;
            const topPercent = unit.percentY != null ? unit.percentY : ((unit.y || 0) / 5355) * 100;

            return (
              <div
                key={unit.id || unit.name}
                className={`tactical-blip tactical-blip--unit${selectedUnit?.id === unit.id ? " is-selected" : ""}`}
                style={{
                  left: `${leftPercent}%`,
                  top: `${topPercent}%`,
                  "--unit-color": "#2f6bff",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedUnit(unit);
                }}
              >
                <div
                  className="tactical-blip__pulse"
                  style={{
                    background: "#2f6bff",
                    boxShadow: "0 0 16px #2f6bff",
                  }}
                />
                <div
                  className="tactical-blip__dot"
                  style={{
                    width: showAvatar ? "36px" : "18px",
                    height: showAvatar ? "36px" : "18px",
                    borderRadius: "50%",
                    overflow: "hidden",
                    border: "2.5px solid #2f6bff",
                    background: "#0c0e14",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 0 14px rgba(47, 107, 255, 0.85), 0 2px 8px rgba(0,0,0,0.8)",
                  }}
                >
                  {showAvatar ? (
                    <img
                      src={unit.robloxAvatar}
                      alt={unit.robloxUsername || unit.name}
                      referrerPolicy="no-referrer"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      onError={(e) => {
                        e.currentTarget.src = `https://www.roblox.com/headshot-thumbnail/image?userId=${unit.robloxId || 1}&width=150&height=150&format=png`;
                      }}
                    />
                  ) : null}
                </div>
                <div
                  className="tactical-blip__label"
                  style={{
                    border: "1px solid rgba(47, 107, 255, 0.4)",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.8)",
                  }}
                >
                  {labelText}
                  {mapSettings.showPostalNumbers !== false && unit.postal && (
                    <span style={{ opacity: 0.9, marginLeft: "0.25rem", color: "#60a5fa", fontWeight: 700 }}>
                      #{unit.postal}
                    </span>
                  )}
                  {mapSettings.showWantedStars !== false && unit.wantedStars > 0 && (
                    <span style={{ color: "#ef4444", marginLeft: "0.25rem" }}>
                      {"★".repeat(unit.wantedStars)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Zoom Controls */}
        <div className="tactical-controls">
          <button
            type="button"
            className="tactical-ctrl-btn"
            onClick={() => setZoom((z) => Math.min(4, z + 0.3))}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="tactical-ctrl-btn"
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.3))}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="tactical-ctrl-btn"
            onClick={resetView}
            aria-label="Reset map view"
          >
            ⟲
          </button>
        </div>
      </main>

      {/* Side Units Drawer */}
      {drawerOpen && (
        <aside className="tactical-drawer" aria-label="Patrol units roster">
          <div className="tactical-drawer__header">
            <h3>Active Patrol Units</h3>
            <button
              type="button"
              className="tactical-drawer__close"
              onClick={() => setDrawerOpen(false)}
            >
              <IconClose />
            </button>
          </div>

          <div className="tactical-drawer__list">
            {activeUnits.length === 0 ? (
              <div className="tactical-drawer__empty">
                <p>No active units on patrol.</p>
                <small>Connect your ER:LC server key in Dashboard to stream real-time unit blips.</small>
              </div>
            ) : (
              activeUnits.map((u) => (
                <div
                  key={u.id || u.name}
                  className={`tactical-drawer__item${selectedUnit?.id === u.id ? " is-active" : ""}`}
                  onClick={() => focusUnit(u)}
                >
                  {u.robloxAvatar ? (
                    <img
                      src={u.robloxAvatar}
                      alt={u.name}
                      referrerPolicy="no-referrer"
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        border: `1.5px solid ${u.color || "#3b82f6"}`,
                        background: "#161922",
                        objectFit: "cover",
                        flexShrink: 0,
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div
                      className="tactical-drawer__indicator"
                      style={{ background: u.color || "#3b82f6" }}
                    />
                  )}
                  <div className="tactical-drawer__info">
                    <div className="tactical-drawer__row">
                      <strong>{u.callsign || u.name}</strong>
                      <span className="tactical-drawer__status" style={{ color: u.color || "inherit" }}>
                        {u.team || "Active"}
                      </span>
                    </div>
                    {u.callsign && u.name && (
                      <div style={{ fontSize: "0.75rem", color: "#fff", opacity: 0.85 }}>
                        {u.name}
                      </div>
                    )}
                    {u.postal && (
                      <div style={{ fontSize: "0.72rem", color: "var(--text-soft)", marginTop: "0.1rem" }}>
                        #{u.postal} {u.street || ""}
                      </div>
                    )}
                    {u.robloxProfileUrl && (
                      <a
                        href={u.robloxProfileUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ fontSize: "0.7rem", color: "var(--blue-400)", textDecoration: "none" }}
                      >
                        Profile ↗
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
