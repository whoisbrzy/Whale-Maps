import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import {
  LogoMark,
  IconDashboard,
  IconCamera,
  IconUsers,
  IconClose,
} from "../components/Icons.jsx";

const DEMO_UNITS = [
  { id: "u1", callsign: "1-ADAM-12", name: "Officer Miller", dept: "police", color: "#3b82f6", status: "10-8 Available", x: 420, y: 280 },
  { id: "u2", callsign: "2-LINCOLN-4", name: "Deputy Vance", dept: "sheriff", color: "#eab308", status: "10-97 On Scene", x: 680, y: 390 },
  { id: "u3", callsign: "MEDIC-1", name: "Paramedic Diaz", dept: "ems", color: "#ef4444", status: "10-8 Available", x: 310, y: 520 },
  { id: "u4", callsign: "DOT-8", name: "Unit Kowalski", dept: "dot", color: "#f97316", status: "10-6 Busy", x: 820, y: 240 },
  { id: "u5", callsign: "CIV-902", name: "Alex Rover", dept: "civ", color: "#a855f7", status: "Active", x: 550, y: 460 },
];

const CAMERAS = [
  { id: "c1", name: "Cam 101 - Main St / Elm", limit: "45 MPH", x: 490, y: 310 },
  { id: "c2", name: "Cam 104 - Highway 1 North", limit: "65 MPH", x: 740, y: 210 },
  { id: "c3", name: "Cam 202 - County Line Blvd", limit: "50 MPH", x: 620, y: 480 },
];

export default function MapPage() {
  const [params] = useSearchParams();
  const serverId = params.get("server") || "sydney-rp";
  const { user } = useAuth();

  const [units, setUnits] = useState(DEMO_UNITS);
  const [filterDept, setFilterDept] = useState("all");
  const [showCameras, setShowCameras] = useState(true);
  const [showPostals, setShowPostals] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [search, setSearch] = useState("");

  const containerRef = useRef(null);

  // Subtle simulated patrol movement for demo mode
  useEffect(() => {
    const interval = setInterval(() => {
      setUnits((prev) =>
        prev.map((u) => ({
          ...u,
          x: Math.max(100, Math.min(1000, u.x + (Math.random() * 8 - 4))),
          y: Math.max(100, Math.min(700, u.y + (Math.random() * 8 - 4))),
        }))
      );
    }, 2500);
    return () => clearInterval(interval);
  }, []);

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

  const filteredUnits = units.filter((u) => {
    if (filterDept !== "all" && u.dept !== filterDept) return false;
    if (search && !u.callsign.toLowerCase().includes(search.toLowerCase()) && !u.name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="tactical-map">
      {/* Floating HUD Bar */}
      <header className="tactical-hud">
        <div className="tactical-hud__left">
          <Link to="/servers" className="tactical-hud__brand" title="Back to Servers">
            <LogoMark />
            <span className="tactical-hud__server-name">
              {serverId.replace("-rp", "").replace("-", " ").toUpperCase()} ROLEPLAY
            </span>
          </Link>
          <span className="badge badge--live">LIVE PATROL</span>
        </div>

        {/* Filter buttons */}
        <div className="tactical-hud__filters">
          {["all", "police", "sheriff", "ems", "dot"].map((dept) => (
            <button
              key={dept}
              type="button"
              className={`tactical-filter${filterDept === dept ? " is-active" : ""}`}
              onClick={() => setFilterDept(dept)}
            >
              {dept.toUpperCase()}
            </button>
          ))}
          <button
            type="button"
            className={`tactical-filter${showCameras ? " is-active" : ""}`}
            onClick={() => setShowCameras((c) => !c)}
          >
            <IconCamera /> CAMS
          </button>
        </div>

        <div className="tactical-hud__actions">
          <Link to={`/dashboard?server=${serverId}`} className="btn btn--ghost btn--small">
            <IconDashboard /> Dashboard
          </Link>
          <button
            type="button"
            className={`btn btn--ghost btn--small${drawerOpen ? " is-active" : ""}`}
            onClick={() => setDrawerOpen((o) => !o)}
          >
            <IconUsers /> Units ({filteredUnits.length})
          </button>
        </div>
      </header>

      {/* Map Canvas / Workspace */}
      <main
        className="tactical-canvas-wrap"
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="tactical-canvas"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* Tactical Grid Background */}
          <div className="tactical-grid" />

          {/* District / Postal Zones */}
          {showPostals && (
            <div className="tactical-postals" aria-hidden="true">
              <span className="tactical-zone" style={{ top: 220, left: 340 }}>
                DISTRICT 1 · POSTAL 102
              </span>
              <span className="tactical-zone" style={{ top: 380, left: 620 }}>
                LIBERTY HIGHWAY · POSTAL 408
              </span>
              <span className="tactical-zone" style={{ top: 560, left: 400 }}>
                DOWNTOWN PLAZA · POSTAL 205
              </span>
            </div>
          )}

          {/* Speed Cameras */}
          {showCameras &&
            CAMERAS.map((cam) => (
              <div
                key={cam.id}
                className="tactical-blip tactical-blip--cam"
                style={{ left: cam.x, top: cam.y }}
                title={`${cam.name} (${cam.limit})`}
              >
                <div className="tactical-cam-radius" />
                <IconCamera />
              </div>
            ))}

          {/* Active Units */}
          {filteredUnits.map((unit) => (
            <div
              key={unit.id}
              className={`tactical-blip tactical-blip--unit${selectedUnit?.id === unit.id ? " is-selected" : ""}`}
              style={{
                left: unit.x,
                top: unit.y,
                "--unit-color": unit.color,
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedUnit(unit);
              }}
            >
              <div className="tactical-blip__pulse" />
              <div className="tactical-blip__dot" />
              <div className="tactical-blip__label">{unit.callsign}</div>
            </div>
          ))}
        </div>

        {/* Selected Unit Tooltip Popover */}
        {selectedUnit && (
          <div
            className="tactical-unit-card"
            style={{
              left: Math.min(window.innerWidth - 320, selectedUnit.x * zoom + pan.x + 20),
              top: Math.min(window.innerHeight - 200, selectedUnit.y * zoom + pan.y - 20),
            }}
          >
            <div className="tactical-unit-card__header">
              <strong>{selectedUnit.callsign}</strong>
              <button
                type="button"
                className="tactical-unit-card__close"
                onClick={() => setSelectedUnit(null)}
              >
                <IconClose />
              </button>
            </div>
            <p className="tactical-unit-card__name">{selectedUnit.name}</p>
            <span className="badge badge--live">{selectedUnit.status}</span>
            <p className="tactical-unit-card__coords">
              Coord: X: {Math.round(selectedUnit.x * 2.5)}, Z: {Math.round(selectedUnit.y * 2.5)}
            </p>
          </div>
        )}

        {/* Map View Controls (Zoom) */}
        <div className="tactical-controls">
          <button
            type="button"
            className="tactical-ctrl-btn"
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="tactical-ctrl-btn"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="tactical-ctrl-btn"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            aria-label="Reset view"
          >
            ⟲
          </button>
        </div>
      </main>

      {/* Collapsible Active Units Drawer */}
      {drawerOpen && (
        <aside className="tactical-drawer" aria-label="Active patrol units">
          <div className="tactical-drawer__header">
            <h3>Active Patrol Units</h3>
            <span className="badge">{filteredUnits.length}</span>
          </div>

          <div className="tactical-drawer__search">
            <input
              type="text"
              placeholder="Search units or callsigns…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="tactical-drawer__list">
            {filteredUnits.map((u) => (
              <div
                key={u.id}
                className={`tactical-drawer__item${selectedUnit?.id === u.id ? " is-active" : ""}`}
                onClick={() => {
                  setSelectedUnit(u);
                  setPan({ x: -u.x * zoom + window.innerWidth / 2, y: -u.y * zoom + window.innerHeight / 2 });
                }}
              >
                <div
                  className="tactical-drawer__indicator"
                  style={{ background: u.color }}
                />
                <div className="tactical-drawer__info">
                  <div className="tactical-drawer__row">
                    <strong>{u.callsign}</strong>
                    <span className="tactical-drawer__status">{u.status}</span>
                  </div>
                  <p className="tactical-drawer__name">{u.name}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}
