import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import {
  Discord,
  IconDashboard,
  IconMap,
  IconCrown,
  IconGrid,
  IconList,
  IconDots,
  IconPlus,
  IconShield,
  IconClose,
  IconUsers,
} from "../components/Icons.jsx";

export default function Servers() {
  const { user, ready } = useAuth();
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "list"
  const [showAddModal, setShowAddModal] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [newServerBanner, setNewServerBanner] = useState("");
  const [newServerKey, setNewServerKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);

  useEffect(() => {
    if (!ready || !user) {
      setLoading(false);
      return;
    }
    fetch("/api/servers")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setServers(data.servers || []);
      })
      .catch(() => {
        // Fallback default servers
        setServers([
          {
            id: "sydney-rp",
            name: "Sydney Roleplay",
            banner: "/hero/slide-1.jpg",
            players: 0,
            uniqueWeekly: 7,
            role: "owner",
            sparkline: [2, 3, 3, 4, 3, 5, 7],
            hasBanner: true,
          },
          {
            id: "tennessee-rp",
            name: "Tennessee State Roleplay",
            banner: "",
            players: 0,
            uniqueWeekly: 14,
            role: "owner",
            sparkline: [5, 8, 7, 10, 9, 12, 14],
            hasBanner: false,
          },
          {
            id: "georgia-rp",
            name: "Georgia State Roleplay",
            banner: "",
            players: 0,
            uniqueWeekly: 9,
            role: "owner",
            sparkline: [3, 4, 6, 5, 8, 7, 9],
            hasBanner: false,
          },
        ]);
      })
      .finally(() => setLoading(false));
  }, [ready, user]);

  const handleCreateServer = async (e) => {
    e.preventDefault();
    if (!newServerName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newServerName.trim(),
          banner: newServerBanner.trim(),
          erlcApiKey: newServerKey.trim(),
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setServers((prev) => [...prev, d.server]);
        setShowAddModal(false);
        setNewServerName("");
        setNewServerBanner("");
        setNewServerKey("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready || loading) {
    return (
      <section className="page">
        <div className="container">
          <p className="panel__muted">Loading servers…</p>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="page page--center">
        <div className="container container--narrow">
          <p className="eyebrow">Waylo Patrol</p>
          <h1 className="page__title">My Servers & Departments</h1>
          <p className="page__lead">
            Connect with Discord to access the tactical map and dashboards for your servers.
          </p>
          <a className="btn btn--primary" href="/auth/login">
            <Discord /> Connect with Discord
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="page page--servers">
      <div className="container">
        {/* Header */}
        <div className="servers__header">
          <div>
            <h1 className="servers__title">My Servers & Departments</h1>
            <p className="servers__subtitle">
              Here are the servers and departments that you are a member of.
            </p>
          </div>

          <div className="servers__controls">
            <button
              type="button"
              className="btn btn--primary btn--small"
              onClick={() => setShowAddModal(true)}
            >
              <IconPlus /> Add Server
            </button>
            <div className="servers__view-toggle" role="group" aria-label="View mode">
              <button
                type="button"
                className={`servers__view-btn${viewMode === "grid" ? " is-active" : ""}`}
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
              >
                <IconGrid />
              </button>
              <button
                type="button"
                className={`servers__view-btn${viewMode === "list" ? " is-active" : ""}`}
                onClick={() => setViewMode("list")}
                aria-label="List view"
              >
                <IconList />
              </button>
            </div>
          </div>
        </div>

        {/* Server Cards Grid / List */}
        <div className={`servers__grid servers__grid--${viewMode}`}>
          {servers.map((srv) => {
            const hasBanner = Boolean(srv.banner);
            return (
              <article key={srv.id} className="server-card">
                {hasBanner && (
                  <div
                    className="server-card__banner"
                    style={{ backgroundImage: `url(${srv.banner})` }}
                  >
                    <div className="server-card__banner-fade" />
                  </div>
                )}

                <div className="server-card__body">
                  {/* Title row */}
                  <div className="server-card__top">
                    <div className="server-card__ident">
                      <div className="server-card__avatar">
                        {srv.name.slice(0, 2).toUpperCase()}
                      </div>
                      <h2 className="server-card__name">{srv.name}</h2>
                    </div>

                    <div className="server-card__meta-icons">
                      {srv.role === "owner" && (
                        <span className="server-card__crown" title="Server Owner">
                          <IconCrown />
                        </span>
                      )}
                      <div className="nav__dd">
                        <button
                          type="button"
                          className="server-card__dots"
                          aria-label="Server options"
                          onClick={() =>
                            setActiveMenu((m) => (m === srv.id ? null : srv.id))
                          }
                        >
                          <IconDots />
                        </button>
                        {activeMenu === srv.id && (
                          <div className="nav__menu" role="menu">
                            <Link
                              to={`/map?server=${srv.id}`}
                              className="nav__menu-link"
                            >
                              Open Live Map
                            </Link>
                            <Link
                              to={`/dashboard?server=${srv.id}`}
                              className="nav__menu-link"
                            >
                              Server Dashboard
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Player count */}
                  <div className="server-card__players">
                    <IconUsers />
                    <span>{srv.players} players</span>
                  </div>

                  {/* Action links */}
                  <nav className="server-card__actions" aria-label="Server links">
                    <Link
                      to={`/dashboard?server=${srv.id}`}
                      className="server-card__link server-card__link--dashboard"
                    >
                      <IconDashboard />
                      <span>Dashboard</span>
                    </Link>

                    <Link
                      to={`/map?server=${srv.id}`}
                      className="server-card__link server-card__link--map"
                    >
                      <IconMap />
                      <span>Map</span>
                    </Link>

                    {srv.role === "owner" && (
                      <Link
                        to={`/dashboard?server=${srv.id}&tab=moderator`}
                        className="server-card__link server-card__link--moderator"
                      >
                        <IconShield />
                        <span>Moderator panel</span>
                      </Link>
                    )}
                  </nav>

                  {/* Bottom metrics / sparkline */}
                  <div className="server-card__bottom">
                    <p className="server-card__stat">
                      {srv.uniqueWeekly} unique players this week
                    </p>
                    <svg
                      className="server-card__sparkline"
                      viewBox="0 0 160 28"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <polyline
                        fill="none"
                        stroke="#f97316"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points="0,24 25,24 65,24 90,24 110,18 135,16 160,22"
                      />
                    </svg>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Add Server Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-header">
              <h2 id="modal-title" className="modal-title">
                Add Server & Department
              </h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowAddModal(false)}
                aria-label="Close"
              >
                <IconClose />
              </button>
            </div>

            <form onSubmit={handleCreateServer} className="modal-form">
              <label className="modal-label">
                <span>Server Name</span>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="e.g. Sydney Roleplay"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  required
                />
              </label>

              <label className="modal-label">
                <span>Banner Image URL (optional)</span>
                <input
                  type="url"
                  className="modal-input"
                  placeholder="https://.../banner.jpg"
                  value={newServerBanner}
                  onChange={(e) => setNewServerBanner(e.target.value)}
                />
              </label>

              <label className="modal-label">
                <span>ER:LC Server API Key (optional)</span>
                <input
                  type="password"
                  className="modal-input"
                  placeholder="Paste your server API key"
                  value={newServerKey}
                  onChange={(e) => setNewServerKey(e.target.value)}
                />
                <small className="modal-hint">
                  Found in your private server settings in ER:LC. Keeps your server location map synced.
                </small>
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn--primary btn--small"
                  disabled={submitting || !newServerName.trim()}
                >
                  {submitting ? "Adding…" : "Add Server"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
