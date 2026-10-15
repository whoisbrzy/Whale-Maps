import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { Discord, IconCrown, IconLink, IconShield, IconMap, IconUsers } from "../components/Icons.jsx";

export default function Settings() {
  const { user, ready, logout } = useAuth();
  const [copiedId, setCopiedId] = useState(false);
  const [defaultMapPostal, setDefaultMapPostal] = useState(() => {
    try {
      return localStorage.getItem("waylo_pref_postals") !== "false";
    } catch {
      return true;
    }
  });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem("waylo_pref_sounds") === "true";
    } catch {
      return false;
    }
  });
  const [saveNotice, setSaveNotice] = useState("");

  const handleCopyId = () => {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const togglePostalPref = (val) => {
    setDefaultMapPostal(val);
    try {
      localStorage.setItem("waylo_pref_postals", val ? "true" : "false");
      setSaveNotice("Preferences updated!");
      setTimeout(() => setSaveNotice(""), 2500);
    } catch {}
  };

  const toggleSoundPref = (val) => {
    setSoundEnabled(val);
    try {
      localStorage.setItem("waylo_pref_sounds", val ? "true" : "false");
      setSaveNotice("Preferences updated!");
      setTimeout(() => setSaveNotice(""), 2500);
    } catch {}
  };

  if (!ready) {
    return (
      <section className="page page--center">
        <div className="container container--narrow">
          <p className="panel__muted">Loading settings…</p>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="page page--center">
        <div className="container container--narrow" style={{ textAlign: "center" }}>
          <p className="eyebrow">Waylo Patrol</p>
          <h1 className="page__title">Account Settings</h1>
          <p className="page__lead">
            Log in with Discord to view and manage your account details, connections, and map preferences.
          </p>
          <a className="btn btn--primary" href="/auth/login">
            <Discord /> Login with Discord
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="page page--settings" style={{ minHeight: "85svh", paddingBottom: "4rem" }}>
      <div className="container container--narrow">
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <p className="eyebrow" style={{ color: "var(--blue-400)", marginBottom: "0.4rem" }}>Preferences & Identity</p>
          <h1 className="page__title" style={{ margin: "0 0 0.5rem" }}>Account Settings</h1>
          <p className="page__lead" style={{ margin: 0 }}>
            Manage your profile, linked accounts, and default patrol preferences.
          </p>
        </div>

        {saveNotice && (
          <div
            style={{
              padding: "0.75rem 1rem",
              background: "rgba(47, 107, 255, 0.15)",
              border: "1px solid rgba(47, 107, 255, 0.4)",
              borderRadius: "8px",
              color: "var(--blue-300)",
              fontSize: "0.88rem",
              fontWeight: 600,
              marginBottom: "1.5rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span>✓</span> {saveNotice}
          </div>
        )}

        {/* Profile Card */}
        <div
          style={{
            background: "#0c0e14",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "14px",
            padding: "1.5rem",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
            <img
              src={user.avatar}
              alt=""
              referrerPolicy="no-referrer"
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                border: "2px solid rgba(47, 107, 255, 0.5)",
                objectFit: "cover",
                background: "#161922",
              }}
            />
            <div style={{ flex: 1, minWidth: "200px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0, color: "#fff" }}>
                  {user.name}
                </h2>
                <span
                  style={{
                    background: "rgba(47, 107, 255, 0.2)",
                    border: "1px solid rgba(47, 107, 255, 0.4)",
                    color: "var(--blue-300)",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    padding: "0.15rem 0.5rem",
                    borderRadius: "999px",
                    textTransform: "uppercase",
                  }}
                >
                  Verified User
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--text-soft)" }}>
                  ID: <code style={{ color: "#fff", background: "rgba(255,255,255,0.06)", padding: "0.15rem 0.4rem", borderRadius: "4px" }}>{user.id}</code>
                </span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  style={{
                    background: "transparent",
                    border: 0,
                    color: "var(--blue-400)",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {copiedId ? "Copied!" : "Copy ID"}
                </button>
              </div>
            </div>
            <a
              href="/auth/login"
              className="btn btn--ghost btn--small"
              style={{ fontSize: "0.82rem", height: "34px", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            >
              <Discord /> Refresh Discord Connection
            </a>
          </div>
        </div>

        {/* Linked Accounts Section */}
        <div
          style={{
            background: "#0c0e14",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "14px",
            padding: "1.5rem",
            marginBottom: "1.5rem",
          }}
        >
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 1rem", color: "#fff" }}>
            Linked Accounts
          </h3>

          {/* Discord Item */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1rem",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: "10px",
              marginBottom: "0.85rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "rgba(88, 101, 242, 0.15)",
                  color: "#5865f2",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Discord width="22" height="22" />
              </div>
              <div>
                <strong style={{ display: "block", fontSize: "0.95rem", color: "#fff" }}>Discord</strong>
                <span style={{ fontSize: "0.82rem", color: "var(--text-soft)" }}>
                  Connected as <span style={{ color: "#fff" }}>{user.name}</span>
                </span>
              </div>
            </div>
            <span
              style={{
                fontSize: "0.78rem",
                color: "#4ade80",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              ● Connected
            </span>
          </div>

          {/* Roblox Item */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1rem",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "rgba(47, 107, 255, 0.15)",
                  color: "var(--blue-400)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <IconShield width="20" height="20" />
              </div>
              <div>
                <strong style={{ display: "block", fontSize: "0.95rem", color: "#fff" }}>Roblox Verification</strong>
                <span style={{ fontSize: "0.82rem", color: "var(--text-soft)" }}>
                  {user.roblox ? (
                    <>
                      Linked to <strong style={{ color: "#fff" }}>{user.roblox.name}</strong> (ID: {user.roblox.id})
                    </>
                  ) : (
                    "Not linked yet. Verify your Roblox account to sync roles and access in-game features."
                  )}
                </span>
              </div>
            </div>
            <Link
              to="/verify"
              className="btn btn--ghost btn--small"
              style={{ fontSize: "0.82rem", height: "32px", padding: "0 0.8rem" }}
            >
              {user.roblox ? "Manage Link" : "Verify Now"}
            </Link>
          </div>
        </div>

        {/* Map & Patrol Preferences */}
        <div
          style={{
            background: "#0c0e14",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "14px",
            padding: "1.5rem",
            marginBottom: "1.5rem",
          }}
        >
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 1rem", color: "#fff" }}>
            Map & Patrol Preferences
          </h3>

          {/* Postal Map Default Toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.85rem 0",
              borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            }}
          >
            <div>
              <strong style={{ display: "block", fontSize: "0.92rem", color: "#fff" }}>Default to Postal Overlay</strong>
              <span style={{ fontSize: "0.8rem", color: "var(--text-soft)" }}>
                Start with postal grid numbers visible when launching the tactical map.
              </span>
            </div>
            <button
              type="button"
              onClick={() => togglePostalPref(!defaultMapPostal)}
              style={{
                width: "48px",
                height: "26px",
                borderRadius: "999px",
                background: defaultMapPostal ? "var(--blue-500)" : "rgba(255, 255, 255, 0.15)",
                border: 0,
                position: "relative",
                cursor: "pointer",
                transition: "background 0.2s ease",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "3px",
                  left: defaultMapPostal ? "25px" : "3px",
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: "#fff",
                  transition: "left 0.2s ease",
                }}
              />
            </button>
          </div>

          {/* Sound Alerts Toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.85rem 0",
            }}
          >
            <div>
              <strong style={{ display: "block", fontSize: "0.92rem", color: "#fff" }}>Unit Ping & Emergency Sounds</strong>
              <span style={{ fontSize: "0.8rem", color: "var(--text-soft)" }}>
                Play a subtle audio tone when new 911 calls or panic button alerts occur on the map.
              </span>
            </div>
            <button
              type="button"
              onClick={() => toggleSoundPref(!soundEnabled)}
              style={{
                width: "48px",
                height: "26px",
                borderRadius: "999px",
                background: soundEnabled ? "var(--blue-500)" : "rgba(255, 255, 255, 0.15)",
                border: 0,
                position: "relative",
                cursor: "pointer",
                transition: "background 0.2s ease",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "3px",
                  left: soundEnabled ? "25px" : "3px",
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: "#fff",
                  transition: "left 0.2s ease",
                }}
              />
            </button>
          </div>
        </div>

        {/* Quick Links & Danger Zone */}
        <div
          style={{
            background: "#0c0e14",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "14px",
            padding: "1.5rem",
          }}
        >
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 1rem", color: "#fff" }}>
            Account Actions
          </h3>
          <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap", alignItems: "center" }}>
            <Link to="/servers" className="btn btn--ghost btn--small">
              <IconMap /> My Servers
            </Link>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={logout}
              style={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.3)" }}
            >
              Log Out of Waylo
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
