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
  const paramName = params.get("name") || "";
  const { user } = useAuth();

  const [server, setServer] = useState(
    paramName ? { id: serverId, name: paramName } : null
  );
  const [loading, setLoading] = useState(!paramName);
  const [activeNav, setActiveNav] = useState(params.get("tab") || "overview"); // "overview" | "erlc" | "members"
  const [apiKey, setApiKey] = useState("");
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferMsg, setTransferMsg] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingServer, setDeletingServer] = useState(false);

  useEffect(() => {
    if (!serverId) {
      setLoading(false);
      return;
    }

    // Try finding in localStorage first
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("waylo_servers_")) {
          const list = JSON.parse(localStorage.getItem(key) || "[]");
          const found = list.find((s) => s.id === serverId);
          if (found) {
            setServer(found);
            setLoading(false);
            return;
          }
        }
      }
    } catch {
      /* ignore */
    }

    fetch(`/api/servers`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const found = data?.servers?.find((s) => s.id === serverId);
        if (found) {
          setServer(found);
        } else if (!server) {
          setServer({ id: serverId, name: paramName || "My Server" });
        }
      })
      .catch(() => {
        if (!server) {
          setServer({ id: serverId, name: paramName || "My Server" });
        }
      })
      .finally(() => setLoading(false));
  }, [serverId, paramName]);

  const handleSaveKey = async (e) => {
    e.preventDefault();
    setSaved(true);
    setIsEditingKey(false);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleTransferOwnership = async (e) => {
    e.preventDefault();
    if (!transferTargetId.trim()) return;
    if (!confirm(`Are you sure you want to transfer ownership of "${displayName}" to Discord user ID ${transferTargetId}? You will lose owner access.`)) {
      return;
    }
    setTransferring(true);
    setTransferMsg("");
    try {
      const res = await fetch("/api/servers/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ serverId, newOwnerId: transferTargetId.trim() }),
      });
      if (res.ok) {
        setTransferMsg("Ownership transferred successfully! Redirecting...");
        setTimeout(() => {
          window.location.href = "/servers";
        }, 1500);
      } else {
        const d = await res.json();
        setTransferMsg(d?.error || "Failed to transfer ownership.");
      }
    } catch {
      setTransferMsg("Network error transferring ownership.");
    } finally {
      setTransferring(false);
    }
  };

  const handleDeleteServer = async () => {
    setDeletingServer(true);
    try {
      await fetch("/api/servers/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ serverId }),
      });
    } catch {}

    // Remove from localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("waylo_servers")) {
          const list = JSON.parse(localStorage.getItem(key) || "[]");
          const filtered = list.filter((s) => s.id !== serverId);
          localStorage.setItem(key, JSON.stringify(filtered));
        }
      }
    } catch {}

    window.location.href = "/servers";
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
      {/* Sidebar with blue theme */}
      <aside className="dash-sidebar" aria-label="Dashboard navigation">
        <div className="dash-sidebar__server">
          <Link to="/servers" className="dash-sidebar__back">
            ← All Servers
          </Link>
          <div className="dash-sidebar__ident">
            <div className="dash-sidebar__avatar">
              {server?.icon ? (
                <img
                  src={server.icon}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                displayName.slice(0, 2).toUpperCase()
              )}
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
            className={`dash-sidebar__item${activeNav === "overview" ? " is-active" : ""}`}
            onClick={() => setActiveNav("overview")}
          >
            <IconDashboard />
            <span>Overview</span>
          </button>

          <Link
            to={`/map?server=${encodeURIComponent(serverId)}${server?.name ? `&name=${encodeURIComponent(server.name)}` : ""}`}
            className="dash-sidebar__item dash-sidebar__item--map"
          >
            <IconMap />
            <span>Map</span>
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
          <Link
            to={`/map?server=${encodeURIComponent(serverId)}${server?.name ? `&name=${encodeURIComponent(server.name)}` : ""}`}
            className="btn btn--primary btn--small"
          >
            <IconMap /> Launch Map <ArrowRight />
          </Link>
        </div>

        {/* ER:LC Integration View */}
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
                      className="modal-input modal-input--blue-focus"
                      placeholder="Paste your in-game Server API Key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      required
                    />
                  </label>
                  <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
                    <button type="submit" className="btn btn--primary btn--small">
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
                  className="btn btn--primary btn--small"
                  onClick={() => setIsEditingKey(true)}
                >
                  <IconCrown /> Manage linked servers
                </button>
              )}

              {saved && <p className="text-success" style={{ marginTop: "0.75rem" }}>API Key saved successfully!</p>}
            </div>

            <div className="dash-view__footer-link">
              <span>Learn more about </span>
              <a href="#help" className="text-link-blue">
                Server Configuration →
              </a>
            </div>
          </div>
        )}

        {/* Overview View */}
        {activeNav === "overview" && (
          <div className="dash-view">
            <div className="dash-view__header">
              <h2 className="dash-view__title">Server Overview</h2>
              <p className="dash-view__subtitle">Manage settings, ownership, and operations for {displayName}</p>
            </div>

            {/* Quick Map & Status Card */}
            <div className="dash-card" style={{ marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "10px",
                      overflow: "hidden",
                      background: "rgba(47, 107, 255, 0.15)",
                      display: "grid",
                      placeItems: "center",
                      fontSize: "1rem",
                      fontWeight: 700,
                      color: "var(--blue-400)",
                      border: "1px solid rgba(47, 107, 255, 0.3)",
                      flexShrink: 0,
                    }}
                  >
                    {server?.icon ? (
                      <img src={server.icon} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      displayName.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3 style={{ margin: "0 0 0.25rem", fontSize: "1.1rem", color: "#fff" }}>{displayName}</h3>
                    <span style={{ fontSize: "0.82rem", color: "var(--text-soft)" }}>
                      Discord ID: <code style={{ color: "#fff", background: "rgba(255,255,255,0.06)", padding: "0.1rem 0.35rem", borderRadius: "4px" }}>{server?.discordServerId || serverId}</code>
                    </span>
                  </div>
                </div>
                <Link
                  to={`/map?server=${encodeURIComponent(serverId)}${server?.name ? `&name=${encodeURIComponent(server.name)}` : ""}`}
                  className="btn btn--primary btn--small"
                >
                  <IconMap /> Launch Map <ArrowRight />
                </Link>
              </div>
            </div>

            {/* Transfer Ownership Card */}
            <div className="dash-card" style={{ marginBottom: "1.25rem" }}>
              <h3 className="dash-card__title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <IconCrown style={{ color: "var(--blue-400)", width: "18px", height: "18px" }} /> Transfer Ownership
              </h3>
              <p className="dash-card__desc">
                Transfer full control of this server to another member. Once transferred, you will become a standard member.
              </p>
              {transferMsg && (
                <p style={{ fontSize: "0.85rem", color: transferMsg.includes("success") ? "#4ade80" : "#ef4444", marginBottom: "0.75rem" }}>
                  {transferMsg}
                </p>
              )}
              <form onSubmit={handleTransferOwnership} style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", maxWidth: "520px" }}>
                <input
                  type="text"
                  className="modal-input modal-input--blue-focus"
                  placeholder="Enter new owner's Discord User ID"
                  value={transferTargetId}
                  onChange={(e) => setTransferTargetId(e.target.value)}
                  style={{ flex: 1, minWidth: "220px", height: "38px" }}
                />
                <button
                  type="submit"
                  className="btn btn--ghost btn--small"
                  disabled={transferring || !transferTargetId.trim()}
                  style={{ height: "38px" }}
                >
                  {transferring ? "Transferring…" : "Transfer Ownership"}
                </button>
              </form>
            </div>

            {/* Danger Zone: Delete Server */}
            <div className="dash-card" style={{ border: "1px solid rgba(239, 68, 68, 0.25)" }}>
              <h3 className="dash-card__title" style={{ color: "#ef4444" }}>
                Danger Zone
              </h3>
              <p className="dash-card__desc">
                Permanently delete this server. This will remove all local data, maps, and integration keys.
              </p>
              <button
                type="button"
                className="btn btn--small"
                onClick={() => setShowDeleteModal(true)}
                style={{
                  background: "rgba(239, 68, 68, 0.15)",
                  color: "#ef4444",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                }}
              >
                Delete Server
              </button>
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

        {/* Delete Server Modal */}
        {showDeleteModal && (
          <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
            <div
              className="modal-box"
              style={{ maxWidth: "440px" }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#ef4444", margin: "0 0 0.75rem" }}>
                Delete Server?
              </h2>
              <p style={{ fontSize: "0.88rem", color: "var(--text-soft)", lineHeight: 1.5, margin: "0 0 1.5rem" }}>
                Are you sure you want to permanently delete <strong>{displayName}</strong>? All associated configuration, API keys, and maps will be removed. This action cannot be undone.
              </p>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deletingServer}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={handleDeleteServer}
                  disabled={deletingServer}
                  style={{
                    background: "#dc2626",
                    color: "#fff",
                    border: 0,
                  }}
                >
                  {deletingServer ? "Deleting…" : "Permanently Delete Server"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
