import { useState, useRef, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LogoMark, IconDashboard, IconClose } from "../components/Icons.jsx";

const MAP_URLS = {
  fall: {
    blank: "https://api.erlc.gg/maps/fall_blank.png",
    postals: "https://api.erlc.gg/maps/fall_postals.png",
  },
};

export default function MapPage() {
  const [params] = useSearchParams();
  const serverId = params.get("server") || "";

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

  // Fetch real units for this server if an API is connected
  useEffect(() => {
    if (!serverId) return;
    setLoadingUnits(true);
    fetch(`/api/servers/${encodeURIComponent(serverId)}/patrol`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.players) {
          setActiveUnits(data.players);
        }
      })
      .catch(() => {
        setActiveUnits([]);
      })
      .finally(() => setLoadingUnits(false));
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
              {serverId ? serverId.replace(/-/g, " ").toUpperCase() : "LIBERTY COUNTY"}
            </span>
          </Link>
          <span className="badge badge--live">LIVE MAP</span>
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
            <Link to={`/dashboard?server=${serverId}`} className="btn btn--ghost btn--small">
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
            {selectedUnit.team && <p className="tactical-unit-card__name">{selectedUnit.team}</p>}
            {selectedUnit.status && <span className="badge badge--live">{selectedUnit.status}</span>}
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
