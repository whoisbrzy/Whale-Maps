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

  // ER:LC Integration state
  const [erlcLoading, setErlcLoading] = useState(false);
  const [erlcData, setErlcData] = useState(null);
  const [erlcError, setErlcError] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [testingKey, setTestingKey] = useState(false);
  const [commandInput, setCommandInput] = useState("");
  const [commandRunning, setCommandRunning] = useState(false);
  const [commandFeedback, setCommandFeedback] = useState(null);
  const [activeLogTab, setActiveLogTab] = useState("players");
  const [showKeyText, setShowKeyText] = useState(false);

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
            if (found.erlcApiKey) setApiKey(found.erlcApiKey);
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
          if (found.erlcApiKey) setApiKey(found.erlcApiKey);
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

  const fetchErlcStatus = async () => {
    if (!serverId) return;
    setErlcLoading(true);
    setErlcError("");
    try {
      const res = await fetch(`/api/erlc/status?serverId=${encodeURIComponent(serverId)}`, {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (data.ok && data.server) {
        setErlcData(data.server);
      } else if (data.error === "NO_KEY") {
        setErlcData(null);
      } else {
        setErlcError(data.message || data.error || "Unable to fetch ER:LC server data.");
      }
    } catch {
      setErlcError("Network error connecting to ER:LC API.");
    } finally {
      setErlcLoading(false);
    }
  };

  useEffect(() => {
    if (activeNav === "erlc" && serverId) {
      fetchErlcStatus();
    }
  }, [activeNav, serverId]);

  const handleSaveKey = async (e) => {
    e.preventDefault();
    if (!serverId) return;
    setSaved(false);
    setErlcError("");
    try {
      const res = await fetch("/api/erlc/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ serverId, erlcApiKey: apiKey.trim() }),
      });
      if (res.ok) {
        setSaved(true);
        setIsEditingKey(false);
        setServer((prev) => (prev ? { ...prev, erlcApiKey: apiKey.trim() } : prev));
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("waylo_servers")) {
              const list = JSON.parse(localStorage.getItem(key) || "[]");
              const updated = list.map((s) => (s.id === serverId ? { ...s, erlcApiKey: apiKey.trim() } : s));
              localStorage.setItem(key, JSON.stringify(updated));
            }
          }
        } catch {}
        fetchErlcStatus();
        setTimeout(() => setSaved(false), 3500);
      } else {
        const d = await res.json();
        setErlcError(d?.error || "Failed to save API key.");
      }
    } catch {
      setErlcError("Network error saving API key.");
    }
  };

  const handleTestKey = async () => {
    setTestingKey(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/erlc/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ serverId, erlcApiKey: apiKey.trim() }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    } finally {
      setTestingKey(false);
    }
  };

  const handleSendCommand = async (cmdToSend) => {
    const cmd = (cmdToSend || commandInput).trim();
    if (!cmd || !serverId) return;
    setCommandRunning(true);
    setCommandFeedback(null);
    try {
      const res = await fetch("/api/erlc/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ serverId, command: cmd }),
      });
      const data = await res.json();
      if (res.ok) {
        setCommandFeedback({ success: true, message: data.message || "Command executed successfully in-game!" });
        setCommandInput("");
        setTimeout(() => setCommandFeedback(null), 4000);
      } else {
        setCommandFeedback({ success: false, message: data.error || "Command execution failed." });
      }
    } catch (err) {
      setCommandFeedback({ success: false, message: err.message });
    } finally {
      setCommandRunning(false);
    }
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
            <div className="dash-view__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <h2 className="dash-view__title">ER:LC Server Integration</h2>
                <p className="dash-view__subtitle">
                  Real-time sync with Police Roleplay Community Private Server API (v2)
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={fetchErlcStatus}
                  disabled={erlcLoading}
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
                >
                  <span style={{ display: "inline-block", transform: erlcLoading ? "rotate(180deg)" : "none", transition: "transform 0.4s ease" }}>⟳</span>
                  {erlcLoading ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            </div>

            {/* API Key Configuration Card */}
            <div className="dash-card" style={{ marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <h3 className="dash-card__title" style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <IconLink style={{ color: "var(--blue-400)", width: "18px", height: "18px" }} />
                  Private Server API Key
                </h3>
                {apiKey && !isEditingKey && (
                  <span
                    style={{
                      background: "rgba(74, 222, 128, 0.15)",
                      color: "#4ade80",
                      border: "1px solid rgba(74, 222, 128, 0.3)",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "0.15rem 0.55rem",
                      borderRadius: "999px",
                    }}
                  >
                    ● Key Stored
                  </span>
                )}
              </div>

              <p className="dash-card__desc" style={{ marginBottom: "1rem" }}>
                Connect your in-game Server API Key to enable live player GPS tracking, staff rosters, vehicle logs, and remote command execution.
              </p>

              {(!apiKey || isEditingKey) ? (
                <form onSubmit={handleSaveKey} style={{ maxWidth: "600px" }}>
                  <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                    <div style={{ position: "relative", flex: 1, minWidth: "260px" }}>
                      <input
                        type={showKeyText ? "text" : "password"}
                        className="modal-input modal-input--blue-focus"
                        placeholder="Paste in-game Server API Key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        required
                        style={{ width: "100%", height: "40px", paddingRight: "65px" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowKeyText((v) => !v)}
                        style={{
                          position: "absolute",
                          right: "10px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "transparent",
                          border: 0,
                          color: "var(--text-soft)",
                          fontSize: "0.75rem",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        {showKeyText ? "Hide" : "Show"}
                      </button>
                    </div>

                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      onClick={handleTestKey}
                      disabled={testingKey || !apiKey.trim()}
                      style={{ height: "40px" }}
                    >
                      {testingKey ? "Testing…" : "Test Key"}
                    </button>

                    <button type="submit" className="btn btn--primary btn--small" style={{ height: "40px" }}>
                      Save Key
                    </button>

                    {isEditingKey && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--small"
                        onClick={() => setIsEditingKey(false)}
                        style={{ height: "40px" }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                  <div
                    style={{
                      background: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      padding: "0.45rem 0.85rem",
                      borderRadius: "8px",
                      fontFamily: "monospace",
                      fontSize: "0.85rem",
                      color: "var(--text-soft)",
                      letterSpacing: "2px",
                    }}
                  >
                    ••••••••••••••••••••••••••••••••
                  </div>
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => setIsEditingKey(true)}
                  >
                    Change Key
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={handleTestKey}
                    disabled={testingKey}
                  >
                    {testingKey ? "Testing…" : "Test Connection"}
                  </button>
                </div>
              )}

              {/* Test Connection Results */}
              {testResult && (
                <div
                  style={{
                    marginTop: "0.85rem",
                    padding: "0.65rem 0.85rem",
                    borderRadius: "8px",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    background: testResult.ok ? "rgba(74, 222, 128, 0.12)" : "rgba(239, 68, 68, 0.12)",
                    border: `1px solid ${testResult.ok ? "rgba(74, 222, 128, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                    color: testResult.ok ? "#4ade80" : "#ef4444",
                  }}
                >
                  {testResult.ok ? (
                    <span>
                      ✓ Connection verified! Server: <strong>{testResult.data?.Name || "Valid"}</strong> ({testResult.data?.CurrentPlayers || 0} players online)
                    </span>
                  ) : (
                    <span>✕ {testResult.error || "Connection failed. Please check your key."}</span>
                  )}
                </div>
              )}

              {saved && (
                <p className="text-success" style={{ marginTop: "0.75rem", fontSize: "0.85rem", fontWeight: 600 }}>
                  ✓ Server API Key saved successfully!
                </p>
              )}

              {erlcError && (
                <p style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "#ef4444", fontWeight: 600 }}>
                  ✕ {erlcError}
                </p>
              )}

              <p style={{ fontSize: "0.78rem", color: "var(--text-soft)", margin: "0.75rem 0 0" }}>
                Need help finding your key? In your ER:LC private server, open Server Settings → scroll to <strong>Server Key</strong> or visit{" "}
                <a href="https://erlc.link/sk" target="_blank" rel="noreferrer" style={{ color: "var(--blue-400)" }}>
                  erlc.link/sk ↗
                </a>
              </p>
            </div>

            {/* Live Server Stats Panel (when connected) */}
            {erlcData && (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "1rem",
                    marginBottom: "1.25rem",
                  }}
                >
                  {/* Status & Players */}
                  <div className="dash-card" style={{ padding: "1.1rem" }}>
                    <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "var(--text-soft)" }}>
                      Server Status
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.35rem" }}>
                      <span
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          background: erlcData.CurrentPlayers > 0 ? "#4ade80" : "#f59e0b",
                          boxShadow: erlcData.CurrentPlayers > 0 ? "0 0 10px #4ade80" : "none",
                        }}
                      />
                      <strong style={{ fontSize: "1.1rem", color: "#fff" }}>
                        {erlcData.CurrentPlayers > 0 ? "Online" : "Empty / Idle"}
                      </strong>
                    </div>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-soft)", marginTop: "0.25rem", display: "block" }}>
                      {erlcData.CurrentPlayers || 0} / {erlcData.MaxPlayers || 32} Players
                    </span>
                  </div>

                  {/* Join Key */}
                  <div className="dash-card" style={{ padding: "1.1rem" }}>
                    <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "var(--text-soft)" }}>
                      Join Code
                    </span>
                    <div style={{ marginTop: "0.35rem" }}>
                      <code style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--blue-300)", background: "rgba(47, 107, 255, 0.15)", padding: "0.15rem 0.5rem", borderRadius: "6px" }}>
                        {erlcData.JoinKey || "None"}
                      </code>
                    </div>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-soft)", marginTop: "0.25rem", display: "block" }}>
                      In-game private server code
                    </span>
                  </div>

                  {/* Team Balance */}
                  <div className="dash-card" style={{ padding: "1.1rem" }}>
                    <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "var(--text-soft)" }}>
                      Team Balance
                    </span>
                    <div style={{ marginTop: "0.35rem" }}>
                      <strong style={{ fontSize: "1.1rem", color: "#fff" }}>
                        {erlcData.TeamBalance ? "Active" : "Disabled"}
                      </strong>
                    </div>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-soft)", marginTop: "0.25rem", display: "block" }}>
                      {erlcData.TeamBalance ? "Auto-balances teams" : "Players can freely choose teams"}
                    </span>
                  </div>

                  {/* Account Verification */}
                  <div className="dash-card" style={{ padding: "1.1rem" }}>
                    <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "var(--text-soft)" }}>
                      Account Verification
                    </span>
                    <div style={{ marginTop: "0.35rem" }}>
                      <strong style={{ fontSize: "1.05rem", color: "#fff" }}>
                        {erlcData.AccVerifiedReq || "Disabled"}
                      </strong>
                    </div>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-soft)", marginTop: "0.25rem", display: "block" }}>
                      Required Roblox account status
                    </span>
                  </div>
                </div>

                {/* Remote In-Game Management Console */}
                <div className="dash-card" style={{ marginBottom: "1.25rem" }}>
                  <h3 className="dash-card__title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <IconShield style={{ color: "var(--blue-400)", width: "18px", height: "18px" }} />
                    Virtual Management Console
                  </h3>
                  <p className="dash-card__desc" style={{ marginBottom: "0.85rem" }}>
                    Send remote server announcements, moderator hints, or management commands directly into your live ER:LC game.
                  </p>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendCommand();
                    }}
                    style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", maxWidth: "680px", marginBottom: "0.75rem" }}
                  >
                    <div style={{ position: "relative", flex: 1, minWidth: "260px" }}>
                      <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--blue-400)", fontWeight: 700 }}>
                        &gt;
                      </span>
                      <input
                        type="text"
                        className="modal-input modal-input--blue-focus"
                        placeholder="e.g. :m Server restart in 10 minutes or :h Welcome to patrol!"
                        value={commandInput}
                        onChange={(e) => setCommandInput(e.target.value)}
                        style={{ width: "100%", height: "40px", paddingLeft: "28px" }}
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn btn--primary btn--small"
                      disabled={commandRunning || !commandInput.trim()}
                      style={{ height: "40px" }}
                    >
                      {commandRunning ? "Sending…" : "Execute"}
                    </button>
                  </form>

                  {/* Quick Command Chips */}
                  <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-soft)", marginRight: "0.25rem" }}>Quick shortcuts:</span>
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      style={{ height: "28px", fontSize: "0.75rem", padding: "0 0.6rem" }}
                      onClick={() => setCommandInput(":m ")}
                    >
                      :m Announcement
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      style={{ height: "28px", fontSize: "0.75rem", padding: "0 0.6rem" }}
                      onClick={() => setCommandInput(":h Shift starting now. Join voice!")}
                    >
                      :h Shift Alert
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      style={{ height: "28px", fontSize: "0.75rem", padding: "0 0.6rem" }}
                      onClick={() => handleSendCommand(":heal all")}
                      disabled={commandRunning}
                    >
                      :heal all
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      style={{ height: "28px", fontSize: "0.75rem", padding: "0 0.6rem" }}
                      onClick={() => handleSendCommand(":weather sunny")}
                      disabled={commandRunning}
                    >
                      :weather sunny
                    </button>
                  </div>

                  {commandFeedback && (
                    <div
                      style={{
                        marginTop: "0.75rem",
                        padding: "0.6rem 0.85rem",
                        borderRadius: "8px",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        background: commandFeedback.success ? "rgba(74, 222, 128, 0.12)" : "rgba(239, 68, 68, 0.12)",
                        border: `1px solid ${commandFeedback.success ? "rgba(74, 222, 128, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                        color: commandFeedback.success ? "#4ade80" : "#ef4444",
                      }}
                    >
                      {commandFeedback.message}
                    </div>
                  )}
                </div>

                {/* Real-time Data Explorer Tabs */}
                <div className="dash-card">
                  <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "0.85rem", marginBottom: "1.2rem", flexWrap: "wrap" }}>
                    {[
                      { id: "players", label: `Active Players (${erlcData.Players?.length || 0})` },
                      { id: "vehicles", label: `Vehicles (${erlcData.Vehicles?.length || 0})` },
                      { id: "staff", label: "Server Staff" },
                      { id: "joins", label: `Join Logs (${erlcData.JoinLogs?.length || 0})` },
                      { id: "kills", label: `Kill Logs (${erlcData.KillLogs?.length || 0})` },
                      { id: "commands", label: `Command Logs (${erlcData.CommandLogs?.length || 0})` },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveLogTab(tab.id)}
                        className={`btn btn--small ${activeLogTab === tab.id ? "btn--primary" : "btn--ghost"}`}
                        style={{ height: "32px", fontSize: "0.8rem", borderRadius: "8px" }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Players Tab */}
                  {activeLogTab === "players" && (
                    <div>
                      {(!erlcData.Players || erlcData.Players.length === 0) ? (
                        <p className="dash-card__desc">No players currently in this private server.</p>
                      ) : (
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)", color: "var(--text-soft)" }}>
                                <th style={{ padding: "0.6rem 0.8rem" }}>Player</th>
                                <th style={{ padding: "0.6rem 0.8rem" }}>Team</th>
                                <th style={{ padding: "0.6rem 0.8rem" }}>Callsign</th>
                                <th style={{ padding: "0.6rem 0.8rem" }}>Postal / Street</th>
                                <th style={{ padding: "0.6rem 0.8rem" }}>Permission</th>
                              </tr>
                            </thead>
                            <tbody>
                              {erlcData.Players.map((p, idx) => {
                                const parts = String(p.Player || "").split(":");
                                const username = parts[0] || "Unknown";
                                const team = p.Team || "Civilian";
                                const isLeo = team.toLowerCase().includes("police") || team.toLowerCase().includes("sheriff");
                                const isFire = team.toLowerCase().includes("fire") || team.toLowerCase().includes("ems");
                                const isDot = team.toLowerCase().includes("dot");

                                return (
                                  <tr key={idx} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                                    <td style={{ padding: "0.65rem 0.8rem", fontWeight: 600, color: "#fff" }}>
                                      {username}
                                      {p.WantedStars > 0 && (
                                        <span style={{ color: "#ef4444", marginLeft: "0.4rem" }}>
                                          {"★".repeat(p.WantedStars)}
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ padding: "0.65rem 0.8rem" }}>
                                      <span
                                        style={{
                                          fontSize: "0.72rem",
                                          fontWeight: 700,
                                          padding: "0.15rem 0.5rem",
                                          borderRadius: "999px",
                                          background: isLeo ? "rgba(37, 99, 235, 0.2)" : isFire ? "rgba(220, 38, 38, 0.2)" : isDot ? "rgba(245, 158, 11, 0.2)" : "rgba(255, 255, 255, 0.08)",
                                          color: isLeo ? "#60a5fa" : isFire ? "#f87171" : isDot ? "#fbbf24" : "var(--text-soft)",
                                          border: `1px solid ${isLeo ? "rgba(37, 99, 235, 0.4)" : isFire ? "rgba(220, 38, 38, 0.4)" : isDot ? "rgba(245, 158, 11, 0.4)" : "rgba(255, 255, 255, 0.15)"}`,
                                        }}
                                      >
                                        {team}
                                      </span>
                                    </td>
                                    <td style={{ padding: "0.65rem 0.8rem", color: "var(--text-soft)" }}>
                                      {p.Callsign ? <code style={{ color: "#fff" }}>{p.Callsign}</code> : "—"}
                                    </td>
                                    <td style={{ padding: "0.65rem 0.8rem", color: "var(--text-soft)" }}>
                                      {p.Location?.PostalCode ? (
                                        <span>
                                          <strong style={{ color: "var(--blue-300)" }}>#{p.Location.PostalCode}</strong> {p.Location.StreetName || ""}
                                        </span>
                                      ) : "Unknown"}
                                    </td>
                                    <td style={{ padding: "0.65rem 0.8rem", color: "var(--text-soft)", fontSize: "0.78rem" }}>
                                      {p.Permission || "Normal"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Vehicles Tab */}
                  {activeLogTab === "vehicles" && (
                    <div>
                      {(!erlcData.Vehicles || erlcData.Vehicles.length === 0) ? (
                        <p className="dash-card__desc">No vehicles currently spawned in the server.</p>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0.75rem" }}>
                          {erlcData.Vehicles.map((v, idx) => (
                            <div
                              key={idx}
                              style={{
                                background: "rgba(255, 255, 255, 0.03)",
                                border: "1px solid rgba(255, 255, 255, 0.06)",
                                padding: "0.85rem",
                                borderRadius: "8px",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <strong style={{ color: "#fff", fontSize: "0.9rem" }}>{v.Name}</strong>
                                {v.ColorHex && (
                                  <span
                                    style={{
                                      width: "14px",
                                      height: "14px",
                                      borderRadius: "50%",
                                      background: v.ColorHex,
                                      border: "1px solid rgba(255, 255, 255, 0.2)",
                                    }}
                                    title={v.ColorName || v.ColorHex}
                                  />
                                )}
                              </div>
                              <div style={{ marginTop: "0.4rem", fontSize: "0.8rem", color: "var(--text-soft)" }}>
                                <div>Owner: <span style={{ color: "#fff" }}>{v.Owner || "Unknown"}</span></div>
                                <div>Plate: <code style={{ color: "var(--blue-300)" }}>{v.Plate || "N/A"}</code></div>
                                {v.Texture && <div>Livery: {v.Texture}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Staff Tab */}
                  {activeLogTab === "staff" && (
                    <div>
                      {erlcData.Staff ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
                          <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                            <h4 style={{ margin: "0 0 0.5rem", color: "#60a5fa", fontSize: "0.9rem" }}>Administrators</h4>
                            {Object.entries(erlcData.Staff.Admins || {}).length === 0 ? (
                              <p style={{ fontSize: "0.8rem", color: "var(--text-soft)", margin: 0 }}>None</p>
                            ) : (
                              <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.85rem", color: "#fff" }}>
                                {Object.entries(erlcData.Staff.Admins || {}).map(([id, name]) => (
                                  <li key={id}>{name} <span style={{ color: "var(--text-soft)", fontSize: "0.75rem" }}>({id})</span></li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                            <h4 style={{ margin: "0 0 0.5rem", color: "#4ade80", fontSize: "0.9rem" }}>Moderators</h4>
                            {Object.entries(erlcData.Staff.Mods || {}).length === 0 ? (
                              <p style={{ fontSize: "0.8rem", color: "var(--text-soft)", margin: 0 }}>None</p>
                            ) : (
                              <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.85rem", color: "#fff" }}>
                                {Object.entries(erlcData.Staff.Mods || {}).map(([id, name]) => (
                                  <li key={id}>{name} <span style={{ color: "var(--text-soft)", fontSize: "0.75rem" }}>({id})</span></li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                            <h4 style={{ margin: "0 0 0.5rem", color: "#f59e0b", fontSize: "0.9rem" }}>Helpers</h4>
                            {Object.entries(erlcData.Staff.Helpers || {}).length === 0 ? (
                              <p style={{ fontSize: "0.8rem", color: "var(--text-soft)", margin: 0 }}>None</p>
                            ) : (
                              <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.85rem", color: "#fff" }}>
                                {Object.entries(erlcData.Staff.Helpers || {}).map(([id, name]) => (
                                  <li key={id}>{name} <span style={{ color: "var(--text-soft)", fontSize: "0.75rem" }}>({id})</span></li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="dash-card__desc">No staff records available.</p>
                      )}
                    </div>
                  )}

                  {/* Join Logs Tab */}
                  {activeLogTab === "joins" && (
                    <div>
                      {(!erlcData.JoinLogs || erlcData.JoinLogs.length === 0) ? (
                        <p className="dash-card__desc">No join/leave events recorded yet.</p>
                      ) : (
                        <div style={{ maxHeight: "360px", overflowY: "auto" }}>
                          {erlcData.JoinLogs.slice().reverse().map((l, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                padding: "0.5rem 0",
                                borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                                fontSize: "0.82rem",
                              }}
                            >
                              <div>
                                <span style={{ color: l.Join ? "#4ade80" : "#ef4444", fontWeight: 700, marginRight: "0.5rem" }}>
                                  {l.Join ? "→ JOINED" : "← LEFT"}
                                </span>
                                <strong style={{ color: "#fff" }}>{l.Player}</strong>
                              </div>
                              <span style={{ color: "var(--text-soft)", fontSize: "0.75rem" }}>
                                {l.Timestamp ? new Date(l.Timestamp * 1000).toLocaleTimeString() : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Kill Logs Tab */}
                  {activeLogTab === "kills" && (
                    <div>
                      {(!erlcData.KillLogs || erlcData.KillLogs.length === 0) ? (
                        <p className="dash-card__desc">No recent kill events in this server.</p>
                      ) : (
                        <div style={{ maxHeight: "360px", overflowY: "auto" }}>
                          {erlcData.KillLogs.slice().reverse().map((k, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                padding: "0.5rem 0",
                                borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                                fontSize: "0.82rem",
                              }}
                            >
                              <div>
                                <span style={{ color: "#ef4444", fontWeight: 700 }}>{k.Killer}</span>
                                <span style={{ color: "var(--text-soft)", margin: "0 0.4rem" }}>killed</span>
                                <span style={{ color: "#fff", fontWeight: 600 }}>{k.Victim}</span>
                                {k.Weapon && (
                                  <span style={{ color: "var(--text-soft)", fontSize: "0.75rem", marginLeft: "0.4rem" }}>
                                    with <code style={{ color: "var(--blue-300)" }}>{k.Weapon}</code>
                                  </span>
                                )}
                              </div>
                              <span style={{ color: "var(--text-soft)", fontSize: "0.75rem" }}>
                                {k.Timestamp ? new Date(k.Timestamp * 1000).toLocaleTimeString() : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Command Logs Tab */}
                  {activeLogTab === "commands" && (
                    <div>
                      {(!erlcData.CommandLogs || erlcData.CommandLogs.length === 0) ? (
                        <p className="dash-card__desc">No in-game admin commands logged recently.</p>
                      ) : (
                        <div style={{ maxHeight: "360px", overflowY: "auto" }}>
                          {erlcData.CommandLogs.slice().reverse().map((c, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                padding: "0.5rem 0",
                                borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                                fontSize: "0.82rem",
                              }}
                            >
                              <div>
                                <strong style={{ color: "#60a5fa", marginRight: "0.5rem" }}>{c.Player}</strong>
                                <code style={{ color: "#fff", background: "rgba(255, 255, 255, 0.06)", padding: "0.15rem 0.35rem", borderRadius: "4px" }}>
                                  {c.Command}
                                </code>
                              </div>
                              <span style={{ color: "var(--text-soft)", fontSize: "0.75rem" }}>
                                {c.Timestamp ? new Date(c.Timestamp * 1000).toLocaleTimeString() : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="dash-view__footer-link" style={{ marginTop: "1.5rem" }}>
              <span>Official documentation & guidelines: </span>
              <a href="https://apidocs.erlc.gg" target="_blank" rel="noreferrer" className="text-link-blue">
                apidocs.erlc.gg →
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
