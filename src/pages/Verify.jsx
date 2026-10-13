import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth.jsx";
import { ArrowRight, Discord } from "../components/Icons.jsx";

const POLL_MIN_MS = 2500; // Dock asks for at least 2s between polls
const MAX_WAIT_MS = 5 * 60_000; // Dock sessions last 5 minutes
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MESSAGES = {
  expired: "That verification expired. Start again.",
  cancelled: "Verification was cancelled. Start again when you're ready.",
  mismatch: "That verification belongs to a different Discord account. Log in with the Discord account you verified.",
  taken: "That Roblox account is already linked to another Whale Maps account.",
};

export default function Verify() {
  const { user, ready, robloxEnabled, refresh } = useAuth();
  const [phase, setPhase] = useState("idle"); // idle | starting | waiting | error
  const [message, setMessage] = useState("");
  const [verifyUrl, setVerifyUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const run = useRef(0); // bumping this cancels any running poll loop

  useEffect(() => () => void run.current++, []);

  async function poll(sid, my) {
    const t0 = Date.now();
    while (my === run.current && Date.now() - t0 < MAX_WAIT_MS) {
      const started = Date.now();
      const r = await fetch(`/api/roblox/status?sid=${encodeURIComponent(sid)}`, { credentials: "same-origin" });
      const d = await r.json().catch(() => ({}));
      if (my !== run.current) return;
      if (r.status === 429) {
        await sleep((d.retryAfter || 5) * 1000);
        continue;
      }
      if (d.status === "completed") {
        await refresh();
        setPhase("idle");
        return;
      }
      if (!r.ok || ["expired", "cancelled", "mismatch", "taken"].includes(d.status)) {
        setPhase("error");
        setMessage(d.error || MESSAGES[d.status] || "Verification didn't complete.");
        return;
      }
      const spent = Date.now() - started;
      if (spent < POLL_MIN_MS) await sleep(POLL_MIN_MS - spent);
    }
    if (my === run.current) {
      setPhase("error");
      setMessage("Verification timed out. Start again.");
    }
  }

  async function start() {
    const my = ++run.current;
    setPhase("starting");
    setMessage("");
    try {
      const r = await fetch("/api/roblox/start", { method: "POST", credentials: "same-origin" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't start verification.");
      if (my !== run.current) return;
      setVerifyUrl(d.verifyUrl);
      setPhase("waiting");
      window.open(d.verifyUrl, "_blank", "noopener,noreferrer"); // may be blocked: the link below always works
      await poll(d.sid, my);
    } catch (err) {
      if (my === run.current) {
        setPhase("error");
        setMessage(err.message);
      }
    }
  }

  async function unlink() {
    setBusy(true);
    try {
      await fetch("/api/roblox/unlink", { method: "POST", credentials: "same-origin" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  let body;
  if (!ready) {
    body = <p className="panel__muted">Loading…</p>;
  } else if (!user) {
    body = (
      <>
        <p className="panel__text">Log in with Discord first. We'll then link your Roblox account to it.</p>
        <a className="btn btn--primary" href="/auth/login">
          <Discord /> Connect with Discord
        </a>
      </>
    );
  } else if (!robloxEnabled) {
    body = <p className="panel__muted">Roblox verification isn't set up on this site yet.</p>;
  } else if (user.roblox) {
    body = (
      <>
        <div className="panel__row">
          <span className="badge badge--live">Verified</span>
          <span className="panel__who">
            {user.roblox.name ? `@${user.roblox.name}` : "Roblox account"}
            <span className="panel__id"> · ID {user.roblox.id}</span>
          </span>
        </div>
        <p className="panel__text">Your Roblox account is linked to your Discord account.</p>
        <button className="btn btn--ghost" type="button" onClick={unlink} disabled={busy}>
          {busy ? "Removing…" : "Unlink Roblox account"}
        </button>
      </>
    );
  } else {
    body = (
      <>
        <ol className="panel__steps">
          <li>Press the button. Dock opens in a new tab.</li>
          <li>Sign in with Discord and Roblox there to link the two accounts.</li>
          <li>Come back to this tab. It updates by itself.</li>
        </ol>
        {phase === "waiting" ? (
          <>
            <p className="panel__text" role="status">
              Waiting for you to finish on Dock…
            </p>
            <a className="btn btn--ghost" href={verifyUrl} target="_blank" rel="noopener noreferrer">
              Open Dock again <ArrowRight />
            </a>
          </>
        ) : (
          <button className="btn btn--primary" type="button" onClick={start} disabled={phase === "starting"}>
            {phase === "starting" ? "Starting…" : "Verify with Dock"} <ArrowRight />
          </button>
        )}
        {phase === "error" && (
          <p className="panel__error" role="alert">
            {message}
          </p>
        )}
      </>
    );
  }

  return (
    <section className="page">
      <div className="container container--narrow">
        <p className="eyebrow">Account</p>
        <h1 className="page__title">Verify your Roblox account</h1>
        <p className="page__lead">
          Link your Roblox account to your Discord login so other players know it's really you.
        </p>

        {user && (
          <div className="panel__user">
            <img className="nav__avatar" src={user.avatar} alt="" width="25" height="25" referrerPolicy="no-referrer" />
            <span>{user.name}</span>
          </div>
        )}

        <div className="panel">{body}</div>
      </div>
    </section>
  );
}
