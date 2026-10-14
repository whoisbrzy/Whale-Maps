import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogoMark, Wordmark, Discord, Menu, IconChevron, IconClose, IconSpark } from "./Icons.jsx";
import { useAuth } from "../auth.jsx";

// Change the key when the announcement changes, so people who dismissed the old one see the new one.
const BANNER_KEY = "waylo-banner-releasing-soon";
const BANNER_TEXT = "Releasing soon";

const LINKS = [
  { to: "/#features", label: "Features" },
  { to: "/verify", label: "Verify Roblox" },
];
const RESOURCES = [
  { to: "/#faq", label: "FAQ" },
  { to: "/terms", label: "Terms of Service" },
  { to: "/privacy", label: "Privacy Policy" },
];
const MOBILE = [...LINKS, ...RESOURCES];

function bannerDismissed() {
  try {
    return localStorage.getItem(BANNER_KEY) === "1";
  } catch {
    return false; // storage can be blocked; just show the strip
  }
}

export default function Navbar() {
  const [menu, setMenu] = useState(null); // null | "resources" | "user" | "mobile"
  const [banner, setBanner] = useState(() => !bannerDismissed());
  const navRef = useRef(null);
  const location = useLocation();
  const { user, logout } = useAuth();

  // Tell the CSS how tall the topbar is (page padding and anchor offsets follow it).
  useLayoutEffect(() => {
    document.documentElement.dataset.banner = banner ? "on" : "off";
  }, [banner]);

  const dismissBanner = () => {
    setBanner(false);
    try {
      localStorage.setItem(BANNER_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  // Close menus on navigation, outside click and Escape.
  useEffect(() => setMenu(null), [location.pathname, location.hash]);
  useEffect(() => {
    if (!menu) return undefined;
    const onDown = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setMenu(null);
    };
    const onKey = (e) => e.key === "Escape" && setMenu(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const toggle = (name) => setMenu((m) => (m === name ? null : name));

  return (
    <header className="topbar">
      {banner && (
        <div className="banner" role="region" aria-label="Announcement">
          <p className="banner__text">
            <IconSpark aria-hidden="true" />
            {BANNER_TEXT}
          </p>
          <button className="banner__close" type="button" aria-label="Dismiss announcement" onClick={dismissBanner}>
            <IconClose />
          </button>
        </div>
      )}

      <div className="nav" ref={navRef}>
        <div className="container nav__inner">
          <Link className="nav__brand" to="/" aria-label="Waylo home">
            <LogoMark />
            <Wordmark />
          </Link>

          <nav className="nav__links" aria-label="Main">
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="nav__link">
                {l.label}
              </Link>
            ))}
            <div className="nav__dd">
              <button
                type="button"
                className="nav__link"
                aria-haspopup="menu"
                aria-expanded={menu === "resources"}
                onClick={() => toggle("resources")}
              >
                Resources <IconChevron aria-hidden="true" />
              </button>
              {menu === "resources" && (
                <div className="nav__menu nav__menu--left" role="menu">
                  {RESOURCES.map((l) => (
                    <Link key={l.to} to={l.to} className="nav__menu-link" role="menuitem">
                      {l.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="nav__actions">
            {user ? (
              <div className="nav__dd">
                <button
                  type="button"
                  className="nav__login"
                  title={user.name}
                  aria-haspopup="menu"
                  aria-expanded={menu === "user"}
                  onClick={() => toggle("user")}
                >
                  <img
                    className="nav__avatar"
                    src={user.avatar}
                    alt=""
                    width="25"
                    height="25"
                    referrerPolicy="no-referrer"
                  />
                  <span className="nav__login-text">{user.name}</span>
                </button>
                {menu === "user" && (
                  <div className="nav__menu" role="menu">
                    <Link to="/verify" className="nav__menu-link" role="menuitem">
                      Verify Roblox
                    </Link>
                    <button type="button" className="nav__menu-link nav__menu-link--button" role="menuitem" onClick={logout}>
                      Log out
                    </button>
                  </div>
                )}
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
              className="btn btn--icon nav__burger"
              type="button"
              aria-label="Menu"
              aria-expanded={menu === "mobile"}
              aria-controls="nav-menu"
              onClick={() => toggle("mobile")}
            >
              <Menu width="18" height="18" />
            </button>

            {menu === "mobile" && (
              <nav id="nav-menu" className="nav__menu" aria-label="Site">
                {MOBILE.map((l) => (
                  <Link key={l.to} to={l.to} className="nav__menu-link">
                    {l.label}
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
      </div>
    </header>
  );
}
