import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LogoMark, Wordmark, ArrowRight, ArrowUp, Discord } from "./Icons.jsx";
import { useAuth } from "../auth.jsx";

/* Background slideshow. To change it, replace the files in public/hero/ or edit this list.
   The dark overlay (.hero__shade) keeps the text readable on any image. */
const SLIDES = ["/hero/slide-1.jpg", "/hero/slide-2.jpg", "/hero/slide-3.jpg"];
const SLIDE_MS = 6500;

function useSlideshow(count) {
  const [index, setIndex] = useState(0);
  const [tick, setTick] = useState(0); // bumping this restarts the timer (after a dot click)

  useEffect(() => {
    // Load the other slides in advance so the crossfade never flashes empty.
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
      <div className="hero__bg" aria-hidden="true">
        {SLIDES.map((src, i) => (
          <div
            key={src}
            className={`hero__slide${i === active ? " is-active" : ""}`}
            style={{ backgroundImage: `url(${src})` }}
          />
        ))}
      </div>
      <div className="hero__shade" />

      <div className="container">
        <h1 className="hero__title">
          <span className="hero__title-line">
            <span className="hero__script">Navigate</span> ER:LC
          </span>
          <span className="hero__title-line">
            with{" "}
            <span className="hero__brand">
              <LogoMark />
              <Wordmark alt="Waylo" />
            </span>
          </span>
        </h1>

        <p className="hero__lead">
          Waylo connects your ER:LC server to a live map with location
          sharing, routes and camera alerts.
        </p>

        <div className="hero__cta">
          <Link className="btn btn--primary" to="/servers">
            Get Started <ArrowRight />
          </Link>
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

      <div className="hero__dots" role="group" aria-label="Background images">
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
    </section>
  );
}
