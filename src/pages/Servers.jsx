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

function getStoredServers() {
  const map = new Map();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("waylo_servers")) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              for (const s of list) {
                if (s && s.id && s.name) map.set(s.id, s);
              }
            }
          } catch {
            /* ignore */
          }
        }
      }
    }
  } catch {
    /* ignore */
  }
  return Array.from(map.values());
}

function saveStoredServers(list, userId) {
  try {
    const valid = (list || []).filter((s) => s && s.id && s.name);
    const jsonStr = JSON.stringify(valid);
    localStorage.setItem(LOCAL_STORAGE_KEY, jsonStr);
    if (userId) {
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_${userId}`, jsonStr);
    }
  } catch {
    /* ignore */
  }
}

export default function Servers() {
  const { user, ready } = useAuth();
  const [servers, setServers] = useState(getStoredServers);
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

  // Load servers from localStorage cache + API merge
  const fetchServers = async () => {
    const local = getStoredServers();
    if (local.length > 0) {
      setServers(local);
    }

    try {
      const res = await fetch("/api/servers", { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        const remote = data?.servers || [];
        const map = new Map();
        // Retain local servers so newly created or offline servers are never lost
        for (const s of local) {
          if (s?.id && s?.name) map.set(s.id, s);
        }
        // Merge remote servers from DB
        for (const s of remote) {
          if (s?.id && s?.name) map.set(s.id, s);
        }
        const merged = Array.from(map.values());
        if (merged.length > 0) {
          setServers(merged);
          saveStoredServers(merged, user?.id);
        }
      }
    } catch {
      /* offline/network error - local servers remain active */
    } finally {
      setLoading(false);
    }
  };

  // Fetch Discord guilds for dropdown
  const fetchGuilds = () => {
    if (!user) return;
    fetch("/api/discord/guilds", { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.guilds && data.guilds.length > 0) {
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
    const selectedGuild = discordGuilds.find((g) => g.id === selectedDiscordId);
    const cleanName = (serverName.trim() || selectedGuild?.name || selectedDiscordId.trim() || "").trim();
    if (!cleanName) {
      setErrorMsg("Please enter a server name or select a Discord server.");
      return;
    }
    setSubmitting(true);
    setErrorMsg("");

    const tempId = `srv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    const newServer = {
      id: tempId,
      name: cleanName,
      discordServerId: selectedDiscordId || "",
      discordServerName: selectedGuild ? selectedGuild.name : (cleanName || ""),
      erlcApiKey: erlcApiKey.trim(),
      role: "owner",
      players: 0,
    };

    // 1. Immediately update UI state & persist to localStorage so it is instantly visible
    setServers((prev) => {
      const next = [newServer, ...prev.filter((s) => s.id !== newServer.id)];
      saveStoredServers(next, user?.id);
      return next;
    });

    // 2. Reset modal inputs & close dialog
    setShowAddModal(false);
    setServerName("");
    setSelectedDiscordId("");
    setErlcApiKey("");
    setSubmitting(false);

    // 3. Persist to server backend asynchronously
    try {
      const res = await fetch("/api/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name: newServer.name,
          discordServerId: newServer.discordServerId,
          discordServerName: newServer.discordServerName,
          erlcApiKey: newServer.erlcApiKey,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.server) {
          setServers((prev) => {
            const updated = prev.map((s) => (s.id === tempId ? data.server : s));
            saveStoredServers(updated, user?.id);
            return updated;
          });
        }
      }
    } catch (err) {
      console.warn("Server backend persist non-fatal warning (preserved locally):", err);
    }
  };

  const handleGuildSelect = (guildId) => {
    setSelectedDiscordId(guildId);
    const g = discordGuilds.find((item) => item.id === guildId);
    if (g) {
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
            Connect with Discord to access the map and dashboards for your servers.
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
            <p>Create your server to connect ER:LC and launch your map.</p>
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
                        {(srv.name || "Server").slice(0, 2).toUpperCase()}
                      </div>
                      <h2 className="server-card__name">{srv.name || "Server"}</h2>
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
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    <input
                      type="text"
                      className="modal-input modal-input--blue-focus"
                      placeholder="Search or enter discord server"
                      value={selectedDiscordId}
                      onChange={(e) => setSelectedDiscordId(e.target.value)}
                    />
                    <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                      <a
                        href="/auth/login"
                        className="btn btn--primary btn--small"
                        style={{ fontSize: "0.78rem", height: "30px", padding: "0 0.8rem" }}
                      >
                        <Discord /> Connect & Pull Discord Servers
                      </a>
                      <button
                        type="button"
                        className="btn btn--ghost btn--small"
                        style={{ fontSize: "0.78rem", height: "30px" }}
                        onClick={fetchGuilds}
                      >
                        Refresh
                      </button>
                    </div>
                  </div>
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
                  disabled={submitting}
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
