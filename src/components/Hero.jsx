import { WhaleMark, ArrowRight, ArrowUp, Discord } from "./Icons.jsx";
import { useAuth } from "../auth.jsx";

/* Background screenshot lives at public/hero.jpg. Swap the file to change it;
   the dark overlay keeps the text readable. Set to null for the gradient. */
const HERO_IMAGE = "/hero.jpg";

export default function Hero() {
  const { user } = useAuth();
  return (
    <section className="hero">
      <div
        className={`hero__bg${HERO_IMAGE ? " hero__bg--image" : ""}`}
        style={HERO_IMAGE ? { "--hero-image": `url(${HERO_IMAGE})` } : undefined}
      />
      <div className="hero__shade" />

      <div className="container">
        <h1 className="hero__title">
          <span className="hero__title-line">Navigate ER:LC</span>
          <span className="hero__title-line">
            with{" "}
            <span className="hero__brand">
              <WhaleMark />
              Whale Maps
            </span>
          </span>
        </h1>

        <p className="hero__lead">
          Whale Maps connects your ER:LC server to a live map with location
          sharing, routes and camera alerts.
        </p>

        <div className="hero__cta">
          <a className="btn btn--primary" href="#map">
            Get Started <ArrowRight />
          </a>
          {!user && (
            <a className="btn btn--ghost" href="/auth/login">
              <Discord /> Connect with Discord
            </a>
          )}
          <a className="btn btn--ghost" href="#faq">
            Read the Docs
          </a>
        </div>
      </div>

      <a className="hero__scroll" href="#features" aria-label="Scroll to features">
        <ArrowUp />
      </a>
    </section>
  );
}
