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
  IconClose,
  IconUsers,
} from "../components/Icons.jsx";

const LOCAL_STORAGE_KEY = "waylo_servers";

export default function Servers() {
  const { user, ready } = useAuth();
  const [servers, setServers] = useState([]);
  const [discordGuilds, setDiscordGuilds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("grid");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form fields
  const [serverName, setServerName] = useState("");
  const [selectedDiscordId, setSelectedDiscordId] = useState("");
  const [erlcApiKey, setErlcApiKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeMenu, setActiveMenu] = useState(null);

  // Load servers from API + localStorage backup
  const fetchServers = () => {
    if (!ready || !user) {
      setLoading(false);
      return;
    }

    // Read local cache first for instant persistence
    let cached = [];
    try {
      const stored = localStorage.getItem(`${LOCAL_STORAGE_KEY}_${user.id}`);
      if (stored) cached = JSON.parse(stored);
    } catch {
      /* ignore */
    }

    fetch("/api/servers")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const remote = data?.servers || [];
        // Merge remote + local cache
        const map = new Map();
        for (const s of [...cached, ...remote]) {
          map.set(s.id, s);
        }
        const merged = Array.from(map.values());
        setServers(merged);
        try {
          localStorage.setItem(`${LOCAL_STORAGE_KEY}_${user.id}`, JSON.stringify(merged));
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        if (cached.length) setServers(cached);
      })
      .finally(() => setLoading(false));
  };

  // Fetch Discord guilds for dropdown
  const fetchGuilds = () => {
    if (!user) return;
    fetch("/api/discord/guilds")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.guilds) {
          setDiscordGuilds(data.guilds);
        }
      })
      .catch(() => {
        setDiscordGuilds([]);
      });
  };

  useEffect(() => {
    fetchServers();
    fetchGuilds();
  }, [ready, user]);

  const handleCreateServer = async (e) => {
    e.preventDefault();
    if (!serverName.trim()) return;
    setSubmitting(true);
    setErrorMsg("");

    const selectedGuild = discordGuilds.find((g) => g.id === selectedDiscordId);

    const payload = {
      name: serverName.trim(),
      discordServerId: selectedDiscordId,
      discordServerName: selectedGuild ? selectedGuild.name : "",
      erlcApiKey: erlcApiKey.trim(),
    };

    try {
      const res = await fetch("/api/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let created = null;
      if (res.ok) {
        const data = await res.json();
        created = data.server;
      } else {
        // Fallback local save if offline
        created = {
          id: `srv-${Date.now().toString(36)}`,
          name: payload.name,
          discordServerId: payload.discordServerId,
          discordServerName: payload.discordServerName,
          role: "owner",
          players: 0,
        };
      }

      if (created) {
        setServers((prev) => {
          const next = [...prev, created];
          try {
            localStorage.setItem(`${LOCAL_STORAGE_KEY}_${user.id}`, JSON.stringify(next));
          } catch {
            /* ignore */
          }
          return next;
        });
        setShowAddModal(false);
        setServerName("");
        setSelectedDiscordId("");
        setErlcApiKey("");
      }
    } catch {
      setErrorMsg("Failed to save server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuildSelect = (guildId) => {
    setSelectedDiscordId(guildId);
    const g = discordGuilds.find((item) => item.id === guildId);
    if (g && !serverName.trim()) {
      setServerName(g.name);
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
              onClick={() => {
                fetchGuilds();
                setShowAddModal(true);
              }}
            >
              <IconPlus /> Create Server
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

        {/* Empty state */}
        {servers.length === 0 ? (
          <div className="servers__empty-box">
            <div className="servers__empty-icon">
              <IconDashboard />
            </div>
            <h2>No servers linked yet</h2>
            <p>Create your server to connect ER:LC and launch your live tactical map.</p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                fetchGuilds();
                setShowAddModal(true);
              }}
            >
              <IconPlus /> Create New Server
            </button>
          </div>
        ) : (
          <div className={`servers__grid servers__grid--${viewMode}`}>
            {servers.map((srv) => (
              <article key={srv.id} className="server-card">
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
                              to={`/map?server=${encodeURIComponent(srv.id)}&name=${encodeURIComponent(srv.name || "")}`}
                              className="nav__menu-link"
                            >
                              Open Map
                            </Link>
                            <Link
                              to={`/dashboard?server=${encodeURIComponent(srv.id)}&name=${encodeURIComponent(srv.name || "")}`}
                              className="nav__menu-link"
                            >
                              Server Dashboard
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Active players */}
                  <div className="server-card__players">
                    <IconUsers />
                    <span>{srv.players || 0} players</span>
                  </div>

                  {/* Action links: Dashboard & Map */}
                  <nav className="server-card__actions" aria-label="Server actions">
                    <Link
                      to={`/dashboard?server=${encodeURIComponent(srv.id)}&name=${encodeURIComponent(srv.name || "")}`}
                      className="server-card__link server-card__link--dashboard"
                    >
                      <IconDashboard />
                      <span>Dashboard</span>
                    </Link>

                    <Link
                      to={`/map?server=${encodeURIComponent(srv.id)}&name=${encodeURIComponent(srv.name || "")}`}
                      className="server-card__link server-card__link--map"
                    >
                      <IconMap />
                      <span>Map</span>
                    </Link>
                  </nav>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Create New Server Modal with Discord Servers Selector */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div
            className="modal-box modal-box--create"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-header">
              <div>
                <h2 id="modal-title" className="modal-title">
                  Create New Server
                </h2>
                <p className="modal-subtitle">
                  Set up your community, link Discord, and bring your existing logs with you.
                </p>
              </div>
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
              {errorMsg && <p className="panel__error">{errorMsg}</p>}

              <label className="modal-label">
                <span>
                  Server Name <strong className="text-danger">*</strong>
                </span>
                <input
                  type="text"
                  className="modal-input modal-input--blue-focus"
                  placeholder="Give your server a unique name"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  required
                />
              </label>

              <label className="modal-label">
                <span>Link Your Discord Server <small>(optional)</small></span>
                <small className="modal-hint">
                  Don't see your server? Ensure you have administrator permissions in the server you want to link and{" "}
                  <button type="button" className="text-link-blue" onClick={fetchGuilds}>
                    refresh
                  </button>
                  .
                </small>

                {discordGuilds.length > 0 ? (
                  <select
                    className="modal-input modal-input--blue-focus"
                    value={selectedDiscordId}
                    onChange={(e) => handleGuildSelect(e.target.value)}
                  >
                    <option value="">-- Select a Discord server --</option>
                    {discordGuilds.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} {g.owner ? "(Owner)" : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="modal-input modal-input--blue-focus"
                    placeholder="Search or enter discord server"
                    value={selectedDiscordId}
                    onChange={(e) => setSelectedDiscordId(e.target.value)}
                  />
                )}
              </label>

              <label className="modal-label">
                <span>ER:LC Server API Key <small>(optional)</small></span>
                <input
                  type="password"
                  className="modal-input modal-input--blue-focus"
                  placeholder="Paste your in-game Server API Key"
                  value={erlcApiKey}
                  onChange={(e) => setErlcApiKey(e.target.value)}
                />
                <small className="modal-hint">
                  Found in your private server settings in ER:LC. Enables live map player tracking.
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
                  disabled={submitting || !serverName.trim()}
                >
                  {submitting ? "Saving…" : "Create Server"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
