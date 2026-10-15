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

  // Pan & Zoom controls
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  const mapImgUrl = showPostals ? MAP_URLS.fall.postals : MAP_URLS.fall.blank;

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

  // Fetch real units for this server if an API is connected with 10s live interval
  useEffect(() => {
    if (!serverId) return;
    setLoadingUnits(true);
    const fetchPatrol = () => {
      fetch(`/api/servers/${encodeURIComponent(serverId)}/patrol`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.players) {
            setActiveUnits(data.players);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingUnits(false));
    };

    fetchPatrol();
    const interval = setInterval(fetchPatrol, 10000);
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
              to={`/dashboard?server=${encodeURIComponent(serverId)}${serverName ? `&name=${encodeURIComponent(serverName)}` : ""}`}
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
          {/* Real ER:LC Fall Map Image */}
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
                  ? MAP_URLS.fall.remotePostals
                  : MAP_URLS.fall.remoteBlank;
              }
            }}
          />

          {/* Real Active Patrol Units */}
          {activeUnits.map((unit) => (
            <div
              key={unit.id || unit.name}
              className={`tactical-blip tactical-blip--unit${selectedUnit?.id === unit.id ? " is-selected" : ""}`}
              style={{
                left: `${unit.x || 0}px`,
                top: `${unit.y || 0}px`,
                "--unit-color": unit.color || "#3b82f6",
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedUnit(unit);
              }}
            >
              <div className="tactical-blip__pulse" />
              <div className="tactical-blip__dot" />
              <div className="tactical-blip__label">{unit.callsign || unit.name}</div>
            </div>
          ))}
        </div>

        {/* Selected Unit Tooltip Popover */}
        {selectedUnit && (
          <div
            className="tactical-unit-card"
            style={{
              left: Math.min(window.innerWidth - 300, 20),
              bottom: 80,
            }}
          >
            <div className="tactical-unit-card__header">
              <strong>{selectedUnit.callsign || selectedUnit.name}</strong>
              <button
                type="button"
                className="tactical-unit-card__close"
                onClick={() => setSelectedUnit(null)}
              >
                <IconClose />
              </button>
            </div>
            {selectedUnit.name && selectedUnit.callsign && (
              <p style={{ margin: "0.2rem 0", fontSize: "0.8rem", color: "#fff" }}>{selectedUnit.name}</p>
            )}
            {selectedUnit.team && <p className="tactical-unit-card__name">{selectedUnit.team}</p>}
            {selectedUnit.postal && (
              <p style={{ margin: "0.3rem 0 0", fontSize: "0.78rem", color: "var(--text-soft)" }}>
                Postal: <strong style={{ color: "var(--blue-300)" }}>#{selectedUnit.postal}</strong> {selectedUnit.street || ""}
              </p>
            )}
            {selectedUnit.wantedStars > 0 && (
              <span style={{ color: "#ef4444", fontSize: "0.85rem", marginTop: "0.2rem", display: "inline-block" }}>
                {"★".repeat(selectedUnit.wantedStars)} Wanted
              </span>
            )}
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
                  <div
                    className="tactical-drawer__indicator"
                    style={{ background: u.color || "#3b82f6" }}
                  />
                  <div className="tactical-drawer__info">
                    <div className="tactical-drawer__row">
                      <strong>{u.callsign || u.name}</strong>
                      <span className="tactical-drawer__status">{u.team || "Active"}</span>
                    </div>
                    {u.postal && (
                      <div style={{ fontSize: "0.75rem", color: "var(--text-soft)", marginTop: "0.15rem" }}>
                        #{u.postal} {u.street || ""}
                      </div>
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
