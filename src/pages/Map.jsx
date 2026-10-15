import { useState, useRef, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LogoMark, IconDashboard, IconClose } from "../components/Icons.jsx";

const MAP_URLS = {
  fall: {
    blank: "/maps/fall_blank.png",
    postals: "/maps/fall_postals.png",
    remoteBlank: "https://api.erlc.gg/maps/fall_blank.png",
    remotePostals: "https://api.erlc.gg/maps/fall_postals.png",
  },
  snow: {
    blank: "/maps/snow_blank.png",
    postals: "/maps/snow_postals.png",
    remoteBlank: "https://api.erlc.gg/maps/snow_blank.png",
    remotePostals: "https://api.erlc.gg/maps/snow_postals.png",
  },
};

export default function MapPage() {
  const [params] = useSearchParams();
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

  // Fetch real units for this server with 2s real-time live interval
  useEffect(() => {
    if (!serverId) return;
    setLoadingUnits(true);

    let localKey = "";
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

    const fetchPatrol = () => {
      fetch(`/api/servers/${encodeURIComponent(serverId)}/patrol`, {
        headers: localKey ? { "x-erlc-key": localKey } : {},
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.players) {
            setActiveUnits(data.players);
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
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
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

        {/* Center Controls: Postals Toggle */}
        <div className="tactical-glass-hud__center">
          <button
            type="button"
            className={`tactical-glass-pill${showPostals ? " is-active" : ""}`}
            onClick={() => setShowPostals((prev) => !prev)}
            aria-pressed={showPostals}
          >
            Postals {showPostals ? "ON" : "OFF"}
          </button>
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

      {/* Map Interactive Canvas */}
      <main
        className="tactical-canvas-wrap"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
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
            onError={(e) => {
              if (!e.currentTarget.dataset.fallback) {
                e.currentTarget.dataset.fallback = "true";
                e.currentTarget.src = showPostals
                  ? seasonUrls.remotePostals
                  : seasonUrls.remoteBlank;
              }
            }}
          />

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
                  "--unit-color": unit.color || "#3b82f6",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedUnit(unit);
                }}
              >
                <div className="tactical-blip__pulse" />
                <div
                  className="tactical-blip__dot"
                  style={{
                    width: showAvatar ? "34px" : "16px",
                    height: showAvatar ? "34px" : "16px",
                    borderRadius: "50%",
                    overflow: "hidden",
                    border: `2px solid ${unit.color || "#3b82f6"}`,
                    background: "#0c0e14",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: `0 0 10px ${unit.color || "#3b82f6"}`,
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
                <div className="tactical-blip__label">
                  {labelText}
                  {mapSettings.showPostalNumbers !== false && unit.postal && (
                    <span style={{ opacity: 0.85, marginLeft: "0.25rem", color: "var(--blue-300)" }}>
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

        {/* Selected Unit Tooltip Popover */}
        {selectedUnit && (
          <div
            className="tactical-unit-card"
            style={{
              left: Math.min(window.innerWidth - 320, 20),
              bottom: 80,
              maxWidth: "300px",
            }}
          >
            <div className="tactical-unit-card__header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                {selectedUnit.robloxAvatar && (
                  <img
                    src={selectedUnit.robloxAvatar}
                    alt={selectedUnit.robloxUsername || selectedUnit.name}
                    referrerPolicy="no-referrer"
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "50%",
                      border: `2px solid ${selectedUnit.color || "var(--blue-400)"}`,
                      background: "#161922",
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}
                <div>
                  <strong style={{ display: "block", fontSize: "0.95rem", color: "#fff" }}>
                    {selectedUnit.callsign || selectedUnit.name}
                  </strong>
                  {selectedUnit.callsign && selectedUnit.name && (
                    <span style={{ fontSize: "0.78rem", color: "var(--text-soft)" }}>
                      {selectedUnit.name}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                className="tactical-unit-card__close"
                onClick={() => setSelectedUnit(null)}
              >
                <IconClose />
              </button>
            </div>

            <div style={{ marginTop: "0.6rem" }}>
              {selectedUnit.team && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem" }}>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      padding: "0.15rem 0.5rem",
                      borderRadius: "999px",
                      background: "rgba(255, 255, 255, 0.08)",
                      color: selectedUnit.color || "#fff",
                      border: `1px solid ${selectedUnit.color || "rgba(255, 255, 255, 0.2)"}`,
                    }}
                  >
                    {selectedUnit.team}
                  </span>
                  {selectedUnit.wantedStars > 0 && (
                    <span style={{ color: "#ef4444", fontSize: "0.8rem", fontWeight: 700 }}>
                      {"★".repeat(selectedUnit.wantedStars)} Wanted
                    </span>
                  )}
                </div>
              )}

              {selectedUnit.postal && (
                <p style={{ margin: "0.25rem 0", fontSize: "0.8rem", color: "var(--text-soft)" }}>
                  Location: <strong style={{ color: "var(--blue-300)" }}>#{selectedUnit.postal}</strong> {selectedUnit.street || ""}
                </p>
              )}

              {selectedUnit.robloxProfileUrl && (
                <a
                  href={selectedUnit.robloxProfileUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    color: "var(--blue-400)",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    textDecoration: "none",
                    marginTop: "0.4rem",
                  }}
                >
                  View Roblox Profile ↗
                </a>
              )}
            </div>
          </div>
        )}

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
                  onClick={() => setSelectedUnit(u)}
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
