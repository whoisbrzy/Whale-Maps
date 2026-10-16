import { useEffect, useState } from "react";
import { LogoMark } from "./Icons.jsx";

/* Custom window controls for the desktop app (the window is frameless there).
   Renders nothing on the website. Also teaches the app's local UI to start the
   Discord login on the real site origin — the OAuth state cookie has to be set
   there for the callback to validate. */
export default function DesktopTitlebar() {
  const [desktop, setDesktop] = useState(false);
  const [maxed, setMaxed] = useState(false);

  useEffect(() => {
    const w = window.wayloDesktop;
    if (!w?.isDesktop) return;
    setDesktop(true);
    document.documentElement.dataset.wayloDesktop = "1";
    const offState = w.onWindowState?.((s) => setMaxed(Boolean(s?.maximized)));

    // Login links (/auth/login) must go to the site origin, not the local one.
    const origin = w.siteOrigin;
    const onClick = (e) => {
      const a = e.target?.closest?.('a[href="/auth/login"]');
      if (a && origin) {
        e.preventDefault();
        window.location.href = origin + "/auth/login";
      }
    };
    document.addEventListener("click", onClick, true);
    return () => {
      offState?.();
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  if (!desktop) return null;
  const w = window.wayloDesktop;
  return (
    <div className="wtitlebar">
      <span className="wtitlebar__title">
        <LogoMark />
        Waylo
      </span>
      <div className="wtitlebar__controls">
        <button type="button" aria-label="Minimize" onClick={() => w.window.minimize()}>
          <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
            <path d="M0 5h10" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button type="button" aria-label={maxed ? "Restore" : "Maximize"} onClick={() => w.window.toggleMaximize()}>
          {maxed ? (
            <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
              <path d="M2.5 4.5h3v3h-3z M1 1h4v1.5 M4.5 4.5V1" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
              <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
        </button>
        <button type="button" className="wtitlebar__close" aria-label="Close" onClick={() => w.window.close()}>
          <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
            <path d="M0 0l10 10M10 0L0 10" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
