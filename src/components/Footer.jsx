import { Link } from "react-router-dom";
import { LogoMark, Wordmark } from "./Icons.jsx";
import { SITE } from "../config.js";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div className="footer__about">
            <Link className="nav__brand" to="/" aria-label="Waylo home">
              <LogoMark />
              <Wordmark />
            </Link>
            <p>A live map for ER:LC with location sharing, routes and camera alerts.</p>
          </div>

          <nav className="footer__col" aria-label="Product">
            <h3>Product</h3>
            <a href="#map">Open the map</a>
            <a href="/auth/login">Login with Discord</a>
            <Link to="/#features">Features</Link>
            <Link to="/#faq">FAQ</Link>
          </nav>

          <nav className="footer__col" aria-label="Legal">
            <h3>Legal</h3>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
            {SITE.contactEmail && <a href={`mailto:${SITE.contactEmail}`}>Contact</a>}
          </nav>
        </div>

        <div className="footer__bottom">
          <p>
            © {SITE.year} {SITE.name}. Not affiliated with or endorsed by Police Roleplay Community,
            Roblox or Discord.
          </p>
        </div>
      </div>
    </footer>
  );
}
