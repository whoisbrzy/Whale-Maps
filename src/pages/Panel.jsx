import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth.jsx";
import { SITE } from "../config.js";

const FEATURES = ["beta", "map", "sharing", "routes", "cameras"];

/* Developer-only panel: list signed-up users, ban/unban, grant features,
   and block ER:LC server codes. Access is enforced by the API
   (DEVELOPER_IDS in lib/config.js); this page just surfaces it. */

export default function Panel() {
  const { user, ready } = useAuth();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [servers, setServers] = useState([]);
  const [serverCode, setServerCode] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}&limit=100`, { credentials: "same-origin" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setUsers(d.users || []);
      setTotal(d.total || 0);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [q]);

  const loadServers = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/servers", { credentials: "same-origin" });
      const d = await r.json();
      if (r.ok) setServers(d.servers || []);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    if (user?.developer) { load(); loadServers(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.developer]);

  async function post(path, body) {
    const r = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  }

  async function toggleBan(u) {
    try {
      await post("/api/admin/ban", { id: u._id, banned: !u.banned });
      await load();
    } catch (e) { setError(e.message); }
  }

  async function toggleGrant(u, key) {
    const grants = (u.grants || []).includes(key)
      ? (u.grants || []).filter((g) => g !== key)
      : [...(u.grants || []), key];
    try {
      await post("/api/admin/grants", { id: u._id, grants });
      await load();
    } catch (e) { setError(e.message); }
  }

  async function blockServer(blocked) {
    try {
      await post("/api/admin/servers/block", { code: serverCode, blocked });
      setServerCode("");
      await loadServers();
    } catch (e) { setError(e.message); }
  }

  if (!ready) return <div className="page container container--narrow"><p className="page__lead">Loading…</p></div>;

  if (!user?.developer) {
    return (
      <main className="page container container--narrow">
        <h1 className="page__title">Developer panel</h1>
        <p className="page__lead">
          {user
            ? "This account does not have access to the developer panel."
            : "Log in with a developer account to view this page."}
        </p>
      </main>
    );
  }

  return (
    <main className="page container">
      <h1 className="page__title">Developer panel</h1>
      <p className="page__meta">{total} signed-up {total === 1 ? "user" : "users"}</p>
      {error && <p className="panel__error" role="alert">{error}</p>}

      <div className="panel__toolbar">
        <input
          className="panel__search"
          type="search"
          placeholder="Search by name or username…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <button className="btn btn--small btn--primary" type="button" onClick={load}>Search</button>
      </div>

      <div className="panel__table-wrap">
        <table className="panel__table">
          <thead>
            <tr>
              <th>User</th>
              <th>Roblox</th>
              <th>Joined</th>
              <th>Last login</th>
              <th>Features</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} className={u.banned ? "panel__row--banned" : undefined}>
                <td>
                  <div className="panel__usercell">
                    <img className="nav__avatar" src={u.avatar} alt="" width="25" height="25" referrerPolicy="no-referrer" />
                    <div>
                      <div className="panel__name">{u.name || u.username || u._id}</div>
                      <div className="panel__id">{u._id}</div>
                    </div>
                  </div>
                </td>
                <td className="panel__muted">{u.roblox ? u.roblox.name || u.roblox.id : "—"}</td>
                <td className="panel__muted">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                <td className="panel__muted">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}</td>
                <td>
                  <div className="panel__grants">
                    {FEATURES.map((f) => (
                      <button
                        key={f}
                        type="button"
                        className={`panel__grant${(u.grants || []).includes(f) ? " panel__grant--on" : ""}`}
                        aria-pressed={(u.grants || []).includes(f)}
                        title={`Toggle ${f} access`}
                        onClick={() => toggleGrant(u, f)}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </td>
                <td>
                  <button
                    className={`btn btn--small ${u.banned ? "btn--ghost" : "btn--danger"}`}
                    type="button"
                    onClick={() => toggleBan(u)}
                  >
                    {u.banned ? "Unban" : "Ban"}
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={6} className="panel__muted">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="section__title panel__subtitle">Blocked servers</h2>
      <p className="page__meta">Block an ER:LC server from being connected to {SITE.name}.</p>
      <div className="panel__toolbar">
        <input
          className="panel__search"
          type="text"
          placeholder="Server ID"
          value={serverCode}
          onChange={(e) => setServerCode(e.target.value)}
        />
        <button className="btn btn--small btn--danger" type="button" disabled={serverCode.length < 2} onClick={() => blockServer(true)}>
          Block server
        </button>
      </div>
      <div className="panel__table-wrap">
        <table className="panel__table">
          <thead>
            <tr><th>Server code</th><th>Blocked</th><th>Reason</th><th></th></tr>
          </thead>
          <tbody>
            {servers.map((s) => (
              <tr key={s._id}>
                <td className="panel__name">{s._id}</td>
                <td className="panel__muted">{s.blockedAt ? new Date(s.blockedAt).toLocaleString() : "—"}</td>
                <td className="panel__muted">{s.reason || "—"}</td>
                <td>
                  <button className="btn btn--small btn--ghost" type="button" onClick={() => post("/api/admin/servers/block", { code: s._id, blocked: false }).then(loadServers)}>
                    Unblock
                  </button>
                </td>
              </tr>
            ))}
            {servers.length === 0 && (
              <tr><td colSpan={4} className="panel__muted">No blocked servers.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
