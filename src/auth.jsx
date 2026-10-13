import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/* Who is logged in? Asks the server once (GET /api/me) and shares the answer.
   On a host without server.js the request fails and the user simply stays logged out. */
const AuthContext = createContext({ user: null, ready: false, logout: async () => {} });

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, ready: false });

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/me", { credentials: "same-origin", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setState({ user: d.user ?? null, ready: true }))
      .catch(() => {
        if (!ctrl.signal.aborted) setState({ user: null, ready: true });
      });
    return () => ctrl.abort();
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      /* ignore: we clear local state either way */
    }
    setState({ user: null, ready: true });
  }, []);

  const value = useMemo(() => ({ ...state, logout }), [state, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
