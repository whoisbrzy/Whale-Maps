import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import {
  IconDashboard,
  IconMap,
  IconUsers,
  IconCamera,
  IconShield,
  IconLink,
  ArrowRight,
} from "../components/Icons.jsx";

export default function Dashboard() {
  const [params] = useSearchParams();
  const serverId = params.get("server") || "sydney-rp";
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("overview");
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);

  const serverName = serverId
    .replace("-rp", "")
    .replace("-", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase()) + " Roleplay";

  const handleSaveKey = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <section className="page page--servers">
      <div className="container">
        {/* Server Top Header */}
        <div className="dash-hero">
          <div className="dash-hero__info">
            <div className="dash-hero__avatar">{serverName.slice(0, 2)}</div>
            <div>
              <div className="dash-hero__title-row">
                <h1 className="dash-hero__title">{serverName}</h1>
                <span className="badge badge--live">ONLINE</span>
              </div>
              <p className="dash-hero__subtitle">
                ER:LC Roleplay Community · Waylo Tactical CAD & Map
              </p>
            </div>
          </div>

          <div className="dash-hero__actions">
            <Link to={`/map?server=${serverId}`} className="btn btn--primary">
              <IconMap /> Launch Tactical Map <ArrowRight />
            </Link>
          </div>
        </div>

        {/* Dashboard Tabs */}
        <div className="dash-tabs" role="tablist">
          <button
            type="button"
            className={`dash-tab${activeTab === "overview" ? " is-active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <IconDashboard /> Overview
          </button>
          <button
            type="button"
            className={`dash-tab${activeTab === "roster" ? " is-active" : ""}`}
            onClick={() => setActiveTab("roster")}
          >
            <IconUsers /> Active Roster
          </button>
          <button
            type="button"
            className={`dash-tab${activeTab === "settings" ? " is-active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            <IconLink /> ER:LC API Key
          </button>
        </div>

        {/* Tab: Overview */}
        {activeTab === "overview" && (
          <div className="dash-content">
            <div className="dash-stats">
              <div className="dash-stat-card">
                <div className="dash-stat-card__top">
                  <span className="dash-stat-card__label">Active Units</span>
                  <IconUsers />
                </div>
                <div className="dash-stat-card__val">5</div>
                <p className="dash-stat-card__sub">Patrol in progress</p>
              </div>

              <div className="dash-stat-card">
                <div className="dash-stat-card__top">
                  <span className="dash-stat-card__label">Speed Cameras</span>
                  <IconCamera />
                </div>
                <div className="dash-stat-card__val">3</div>
                <p className="dash-stat-card__sub">Active road monitors</p>
              </div>

              <div className="dash-stat-card">
                <div className="dash-stat-card__top">
                  <span className="dash-stat-card__label">ER:LC Status</span>
                  <IconShield />
                </div>
                <div className="dash-stat-card__val" style={{ color: "var(--status-online)" }}>
                  Connected
                </div>
                <p className="dash-stat-card__sub">Syncing player locations</p>
              </div>
            </div>

            <div className="dash-panel">
              <h2 className="dash-panel__title">Quick Actions</h2>
              <div className="dash-quick-links">
                <Link to={`/map?server=${serverId}`} className="dash-quick-card">
                  <div className="dash-quick-card__icon" style={{ color: "#22d3ee" }}>
                    <IconMap />
                  </div>
                  <div>
                    <strong>Open Tactical Live Map</strong>
                    <p>Track patrol vehicles, dispatch calls, and cameras in real-time.</p>
                  </div>
                </Link>

                <button
                  type="button"
                  className="dash-quick-card"
                  onClick={() => setActiveTab("settings")}
                >
                  <div className="dash-quick-card__icon" style={{ color: "var(--blue-400)" }}>
                    <IconLink />
                  </div>
                  <div>
                    <strong>Configure ER:LC Server Key</strong>
                    <p>Update your server API key to keep member positions synced automatically.</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Roster */}
        {activeTab === "roster" && (
          <div className="dash-panel">
            <h2 className="dash-panel__title">Active Patrol Roster</h2>
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Callsign</th>
                    <th>Officer</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Last Location</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>1-ADAM-12</strong></td>
                    <td>Officer Miller</td>
                    <td>Police Department</td>
                    <td><span className="badge badge--live">10-8 Available</span></td>
                    <td>Postal 102 · Main St</td>
                  </tr>
                  <tr>
                    <td><strong>2-LINCOLN-4</strong></td>
                    <td>Deputy Vance</td>
                    <td>Sheriff's Office</td>
                    <td><span className="badge" style={{ color: "#eab308" }}>10-97 On Scene</span></td>
                    <td>Postal 408 · Hwy 1</td>
                  </tr>
                  <tr>
                    <td><strong>MEDIC-1</strong></td>
                    <td>Paramedic Diaz</td>
                    <td>Fire / EMS</td>
                    <td><span className="badge badge--live">10-8 Available</span></td>
                    <td>Postal 205 · Downtown</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: Settings */}
        {activeTab === "settings" && (
          <div className="dash-panel">
            <h2 className="dash-panel__title">ER:LC Server Connection</h2>
            <p className="dash-panel__desc">
              Connect your ER:LC private server to automatically broadcast live player positions and status to Waylo's tactical map.
            </p>
            <form onSubmit={handleSaveKey} className="modal-form" style={{ maxWidth: 520, marginTop: "1rem" }}>
              <label className="modal-label">
                <span>ER:LC Server API Key</span>
                <input
                  type="password"
                  className="modal-input"
                  placeholder="Paste your server API key here"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  required
                />
              </label>
              <button type="submit" className="btn btn--primary btn--small">
                {saved ? "Saved Successfully!" : "Save & Verify Connection"}
              </button>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}
