import { useEffect, useState } from "react";
import { LogoMark, Wordmark, ArrowRight, Discord } from "./Icons.jsx";
import { useAuth } from "../auth.jsx";

/* The slideshow lives inside the map-preview window. To change it, replace the files
   in public/hero/ or edit this list. */
const SLIDES = ["/hero/slide-1.jpg", "/hero/slide-2.jpg", "/hero/slide-3.jpg"];
const SLIDE_MS = 6500;

function useSlideshow(count) {
  const [index, setIndex] = useState(0);
  const [tick, setTick] = useState(0); // bumping this restarts the timer (after a dot click)

  useEffect(() => {
    SLIDES.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || count < 2) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), SLIDE_MS);
    return () => clearInterval(id);
  }, [count, tick]);

  const go = (i) => {
    setIndex(i);
    setTick((t) => t + 1);
  };
  return [index, go];
}

export default function Hero() {
  const { user } = useAuth();
  const [active, goTo] = useSlideshow(SLIDES.length);

  return (
    <section className="hero">
      <div className="container hero__grid">
        <div className="hero__copy">
          <h1 className="hero__title">
            <span className="hero__script">Navigate</span>
            <span className="hero__title-line">ER:LC with</span>
            <span className="hero__brand">
              <LogoMark />
              <Wordmark alt="Waylo" />
            </span>
          </h1>

          <p className="hero__lead">
            A live map for your ER:LC server. Share your location with your team, follow routes and
            get a warning before the next camera.
          </p>

          <div className="hero__cta">
            <a className="btn btn--primary" href="#features">
              See what's coming <ArrowRight />
            </a>
            {!user && (
              <a className="btn btn--ghost" href="/auth/login">
                <Discord /> Login with Discord
              </a>
            )}
          </div>
        </div>

        <div className="hero__stage">
          <div className="mapwin" role="img" aria-label="Preview of the Waylo map with a route and a camera alert">
            <div className="mapwin__bar" aria-hidden="true">
              <span />
              <span />
              <span />
              <b>Preview</b>
            </div>
            <div className="mapwin__view">
              {SLIDES.map((src, i) => (
                <div
                  key={src}
                  className={`mapwin__slide${i === active ? " is-active" : ""}`}
                  style={{ backgroundImage: `url(${src})` }}
                />
              ))}
              <div className="mapwin__grid" aria-hidden="true" />

              <svg className="mapwin__route" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
                <path className="mapwin__route-line" pathLength="1" d="M40 250 C 120 250, 110 150, 200 150 S 300 70, 360 50" />
              </svg>
              <span className="pin pin--start" aria-hidden="true" />
              <span className="pin pin--end" aria-hidden="true" />
              <span className="pin pin--cam" aria-hidden="true">
                <i />
              </span>

              <div className="mapwin__card" aria-hidden="true">
                <span className="mapwin__dot" />
                <div>
                  <strong>Camera ahead</strong>
                  <small>400 ft on your route</small>
                </div>
              </div>
            </div>
          </div>

          <div className="hero__dots" role="group" aria-label="Preview images">
            {SLIDES.map((src, i) => (
              <button
                key={src}
                type="button"
                className={`hero__dot${i === active ? " is-active" : ""}`}
                aria-label={`Show image ${i + 1} of ${SLIDES.length}`}
                aria-current={i === active}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
