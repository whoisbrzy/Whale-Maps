import { WhaleMark, ArrowRight, ArrowUp, Discord } from "./Icons.jsx";

/* To use a real screenshot, put it at public/hero.jpg and set
   HERO_IMAGE = "/hero.jpg". The dark overlay keeps the text readable. */
const HERO_IMAGE = null;

export default function Hero() {
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
            Open the map <ArrowRight />
          </a>
          <a className="btn btn--ghost" href="#login">
            <Discord /> Login with Discord
          </a>
          <a className="btn btn--ghost" href="#docs">
            Read the docs
          </a>
        </div>
      </div>

      <a className="hero__scroll" href="#features" aria-label="Scroll to features">
        <ArrowUp />
      </a>
    </section>
  );
}
