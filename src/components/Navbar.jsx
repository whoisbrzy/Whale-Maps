import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogoMark, Wordmark, Discord, Menu } from "./Icons.jsx";
import { useAuth } from "../auth.jsx";

const MENU = [
  { to: "/#features", label: "Features" },
  { to: "/#faq", label: "FAQ" },
  { to: "/verify", label: "Verify Roblox" },
  { to: "/terms", label: "Terms of Service" },
  { to: "/privacy", label: "Privacy Policy" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const location = useLocation();
  const { user, logout } = useAuth();

  // Close on navigation, outside click and Escape.
  useEffect(() => setOpen(false), [location.pathname, location.hash]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="nav">
      <div className="container nav__inner">
        <Link className="nav__brand" to="/" aria-label="Waylo home">
          <LogoMark />
          <Wordmark />
        </Link>

        <div className="nav__actions" ref={wrapRef}>
          {user ? (
            <div className="nav__login" title={user.name}>
              <img
                className="nav__avatar"
                src={user.avatar}
                alt=""
                width="25"
                height="25"
                referrerPolicy="no-referrer"
              />
              <span className="nav__login-text">{user.name}</span>
            </div>
          ) : (
            <a className="nav__login" href="/auth/login">
              <span className="nav__login-badge">
                <Discord />
              </span>
              <span className="nav__login-text">Login with Discord</span>
            </a>
          )}
          <button
            className="btn btn--icon"
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            aria-controls="nav-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <Menu width="18" height="18" />
          </button>

          {open && (
            <nav id="nav-menu" className="nav__menu" aria-label="Site">
              {MENU.map((item) => (
                <Link key={item.to} to={item.to} className="nav__menu-link">
                  {item.label}
                </Link>
              ))}
              {user && (
                <button type="button" className="nav__menu-link nav__menu-link--button" onClick={logout}>
                  Log out
                </button>
              )}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
