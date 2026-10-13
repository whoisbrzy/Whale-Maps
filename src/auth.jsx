import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/* Who is logged in? Asks the server (GET /api/me) and shares the answer.
   user = { id, name, avatar, roblox: { id, name } | null }. On a host without the API the
   request fails and the user simply stays logged out. */
const AuthContext = createContext({
  user: null,
  ready: false,
  robloxEnabled: false,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, ready: false, robloxEnabled: false });

  const load = useCallback(async (signal) => {
    try {
      const r = await fetch("/api/me", { credentials: "same-origin", signal });
      const d = r.ok ? await r.json() : {};
      setState({ user: d.user ?? null, ready: true, robloxEnabled: Boolean(d.robloxEnabled) });
    } catch {
      if (!signal?.aborted) setState((s) => ({ ...s, user: null, ready: true }));
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const refresh = useCallback(() => load(), [load]);

  const logout = useCallback(async () => {
    try {
      await fetch("/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      /* ignore: we clear local state either way */
    }
    setState((s) => ({ ...s, user: null, ready: true }));
  }, []);

  const value = useMemo(() => ({ ...state, refresh, logout }), [state, refresh, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
