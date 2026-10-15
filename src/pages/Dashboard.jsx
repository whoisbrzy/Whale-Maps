import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import {
  IconDashboard,
  IconMap,
  IconShield,
  IconLink,
  IconUsers,
  IconCrown,
  ArrowRight,
} from "../components/Icons.jsx";

export default function Dashboard() {
  const [params] = useSearchParams();
  const serverId = params.get("server") || "";
  const { user } = useAuth();

  const [server, setServer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState("erlc"); // "panel" | "erlc" | "members" | "departments"
  const [apiKey, setApiKey] = useState("");
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!serverId) {
      setLoading(false);
      return;
    }
    fetch(`/api/servers`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const found = data?.servers?.find((s) => s.id === serverId);
        if (found) {
          setServer(found);
        } else {
          setServer({ id: serverId, name: serverId.replace(/-/g, " ").toUpperCase() });
        }
      })
      .catch(() => {
        setServer({ id: serverId, name: serverId.replace(/-/g, " ").toUpperCase() });
      })
      .finally(() => setLoading(false));
  }, [serverId]);

  const handleSaveKey = async (e) => {
    e.preventDefault();
    setSaved(true);
    setIsEditingKey(false);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) {
    return (
      <section className="page">
        <div className="container">
          <p className="panel__muted">Loading dashboard…</p>
        </div>
      </section>
    );
  }

  const displayName = server?.name || "Server Dashboard";

  return (
    <div className="dash-container">
      {/* Sidebar matching screenshot 2 */}
      <aside className="dash-sidebar" aria-label="Dashboard navigation">
        <div className="dash-sidebar__server">
          <Link to="/servers" className="dash-sidebar__back">
            ← All Servers
          </Link>
          <div className="dash-sidebar__ident">
            <div className="dash-sidebar__avatar">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <strong className="dash-sidebar__name">{displayName}</strong>
            </div>
          </div>
        </div>

        <nav className="dash-sidebar__nav">
          <div className="dash-sidebar__section-title">General</div>
          <button
            type="button"
            className={`dash-sidebar__item${activeNav === "panel" ? " is-active" : ""}`}
            onClick={() => setActiveNav("panel")}
          >
            <IconDashboard />
            <span>Panel</span>
          </button>

          <Link
            to={`/map?server=${serverId}`}
            className="dash-sidebar__item dash-sidebar__item--map"
          >
            <IconMap />
            <span>Tactical Map</span>
            <ArrowRight className="dash-sidebar__arrow" />
          </Link>

          <button
            type="button"
            className={`dash-sidebar__item${activeNav === "members" ? " is-active" : ""}`}
            onClick={() => setActiveNav("members")}
          >
            <IconUsers />
            <span>Members</span>
          </button>

          <button
            type="button"
            className={`dash-sidebar__item${activeNav === "departments" ? " is-active" : ""}`}
            onClick={() => setActiveNav("departments")}
          >
            <IconShield />
            <span>Departments</span>
          </button>

          <button
            type="button"
            className={`dash-sidebar__item${activeNav === "erlc" ? " is-active" : ""}`}
            onClick={() => setActiveNav("erlc")}
          >
            <IconLink />
            <span>ER:LC Integration</span>
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="dash-main">
        {/* Top bar with Map launch button */}
        <div className="dash-topbar">
          <div>
            <h1 className="dash-topbar__title">{displayName}</h1>
          </div>
          <Link to={`/map?server=${serverId}`} className="btn btn--primary btn--small">
            <IconMap /> Launch Map <ArrowRight />
          </Link>
        </div>

        {/* ER:LC Integration View (matches screenshot 3) */}
        {activeNav === "erlc" && (
          <div className="dash-view">
            <div className="dash-view__header">
              <h2 className="dash-view__title">Server Configuration</h2>
              <p className="dash-view__subtitle">
                Configure your ER:LC server connection and view server information
              </p>
            </div>

            <div className="dash-card">
              <h3 className="dash-card__title">API Configuration</h3>
              <p className="dash-card__desc">
                To get started with this integration you need to add your API Key found in-game.
              </p>

              {isEditingKey ? (
                <form onSubmit={handleSaveKey} className="modal-form" style={{ maxWidth: 460 }}>
                  <label className="modal-label">
                    <span>Server API Key</span>
                    <input
                      type="password"
                      className="modal-input modal-input--orange-focus"
                      placeholder="Paste your in-game Server API Key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      required
                    />
                  </label>
                  <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
                    <button type="submit" className="btn btn--orange btn--small">
                      Save API Key
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      onClick={() => setIsEditingKey(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  className="btn btn--orange btn--small"
                  onClick={() => setIsEditingKey(true)}
                >
                  <IconCrown /> Manage linked servers
                </button>
              )}

              {saved && <p className="text-success" style={{ marginTop: "0.75rem" }}>API Key saved successfully!</p>}
            </div>

            <div className="dash-view__footer-link">
              <span>Learn more about </span>
              <a href="#help" className="text-link-orange">
                Server Configuration →
              </a>
            </div>
          </div>
        )}

        {/* Panel View */}
        {activeNav === "panel" && (
          <div className="dash-view">
            <div className="dash-view__header">
              <h2 className="dash-view__title">Overview Panel</h2>
              <p className="dash-view__subtitle">Real-time status for {displayName}</p>
            </div>

            <div className="dash-card">
              <h3 className="dash-card__title">Live Tactical Map</h3>
              <p className="dash-card__desc">
                View real-time unit positions, postals, and road monitors.
              </p>
              <Link to={`/map?server=${serverId}`} className="btn btn--primary btn--small">
                <IconMap /> Open Map
              </Link>
            </div>
          </div>
        )}

        {/* Members View */}
        {activeNav === "members" && (
          <div className="dash-view">
            <div className="dash-view__header">
              <h2 className="dash-view__title">Members</h2>
              <p className="dash-view__subtitle">Community members linked to this server.</p>
            </div>
            <div className="dash-card">
              <p className="dash-card__desc">No external members registered yet.</p>
            </div>
          </div>
        )}

        {/* Departments View */}
        {activeNav === "departments" && (
          <div className="dash-view">
            <div className="dash-view__header">
              <h2 className="dash-view__title">Departments</h2>
              <p className="dash-view__subtitle">Police, Sheriff, Fire/EMS, and DOT patrol divisions.</p>
            </div>
            <div className="dash-card">
              <p className="dash-card__desc">Default ER:LC patrol divisions enabled.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
