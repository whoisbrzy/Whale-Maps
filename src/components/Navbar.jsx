import { WhaleMark, Discord, Menu } from "./Icons.jsx";

export default function Navbar() {
  return (
    <header className="nav">
      <div className="container nav__inner">
        <a className="nav__brand" href="/" aria-label="Whale Maps home">
          <WhaleMark />
          Whale Maps
        </a>

        <div className="nav__actions">
          <a className="nav__login" href="#login">
            <span className="nav__login-badge">
              <Discord />
            </span>
            <span className="nav__login-text">Login with Discord</span>
          </a>
          <button className="btn btn--icon" type="button" aria-label="Open menu">
            <Menu width="18" height="18" />
          </button>
        </div>
      </div>
    </header>
  );
}
