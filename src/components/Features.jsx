import { Discord, IconPin, IconUsers, IconRoute, IconCamera, IconLink } from "./Icons.jsx";

/* status "live" = works today, "soon" = planned. Keep this honest: flip a tile to
   "live" only when the feature really ships (see AGENTS.md roadmap).
   `size` sets how many of the grid's 6 columns the tile spans. */
const FEATURES = [
  {
    Icon: IconPin,
    title: "Live location sharing",
    text: "See your team on the map as they move. Positions come straight from your ER:LC server.",
    status: "soon",
    size: 4,
    art: "dots",
  },
  {
    Icon: IconUsers,
    title: "Private sessions",
    text: "Join with a code. Only people in your session see you.",
    status: "soon",
    size: 2,
    art: "code",
  },
  {
    Icon: IconRoute,
    title: "Routes",
    text: "Pick a destination and follow the road, or drop your own waypoints.",
    status: "soon",
    size: 2,
    art: "route",
  },
  {
    Icon: IconCamera,
    title: "Camera alerts",
    text: "A warning as you approach a camera. Add or report cameras so every map stays current.",
    status: "soon",
    size: 2,
    art: "cam",
  },
  {
    Icon: IconLink,
    title: "Connected to ER:LC",
    text: "Server owners add their server key once. It stays on our backend and never reaches a browser.",
    status: "soon",
    size: 2,
    art: "link",
  },
  {
    Icon: Discord,
    title: "Discord login and Roblox link",
    text: "Sign in with Discord, then verify your Roblox account through Dock. We only read your basic Discord profile, never your messages or servers.",
    status: "live",
    size: 6,
    art: "none",
  },
];

/* Small decorative drawings, one per tile */
function Art({ kind }) {
  if (kind === "dots")
    return (
      <svg className="tile__art" viewBox="0 0 320 90" aria-hidden="true">
        <path d="M10 70 C70 70 80 25 150 40 S250 70 310 20" fill="none" stroke="rgba(143,180,255,.25)" strokeWidth="2" strokeDasharray="3 6" />
        <circle cx="70" cy="58" r="6" fill="#34d399" />
        <circle cx="150" cy="40" r="6" fill="#2f6bff" />
        <circle cx="150" cy="40" r="14" fill="none" stroke="#2f6bff" strokeOpacity=".4" />
        <circle cx="235" cy="62" r="6" fill="#22d3ee" />
        <circle cx="300" cy="24" r="6" fill="#f43f5e" />
      </svg>
    );
  if (kind === "code")
    return (
      <div className="tile__code" aria-hidden="true">
        {["W", "7", "K", "2"].map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
    );
  if (kind === "route")
    return (
      <svg className="tile__art" viewBox="0 0 200 80" aria-hidden="true">
        <path d="M12 64 C60 64 50 20 100 30 S160 14 188 16" fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
        <circle cx="12" cy="64" r="5" fill="#34d399" />
        <circle cx="188" cy="16" r="5" fill="#2f6bff" />
      </svg>
    );
  if (kind === "cam")
    return (
      <svg className="tile__art" viewBox="0 0 200 80" aria-hidden="true">
        <path d="M10 56 H190" stroke="rgba(255,255,255,.18)" strokeWidth="14" strokeLinecap="round" />
        <path d="M10 56 H104" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
        <circle cx="130" cy="56" r="26" fill="#f59e0b" fillOpacity=".12" stroke="#f59e0b" strokeOpacity=".5" />
        <circle cx="130" cy="56" r="7" fill="#f59e0b" />
      </svg>
    );
  if (kind === "link")
    return (
      <svg className="tile__art" viewBox="0 0 200 80" aria-hidden="true">
        <rect x="14" y="26" width="52" height="28" rx="14" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2" />
        <rect x="134" y="26" width="52" height="28" rx="14" fill="none" stroke="#2f6bff" strokeWidth="2" />
        <path d="M66 40 H134" stroke="#2f6bff" strokeWidth="2" strokeDasharray="4 5" />
      </svg>
    );
  return null;
}

export default function Features() {
  return (
    <section className="section" id="features" aria-labelledby="features-title">
      <div className="container">
        <h2 className="section__title" id="features-title">
          Built for the patrol, not the spreadsheet
        </h2>
        <p className="section__lead">Everything below is planned for launch. Login and Roblox linking work today.</p>

        <div className="bento">
          {FEATURES.map(({ Icon, title, text, status, size, art }) => (
            <article className={`tile tile--${size}${status === "live" ? " tile--live" : ""}`} key={title}>
              <div className="tile__head">
                <span className="tile__icon">
                  <Icon />
                </span>
                <span className={`badge${status === "live" ? " badge--live" : ""}`}>
                  {status === "live" ? "Available now" : "Coming soon"}
                </span>
              </div>
              <Art kind={art} />
              <h3 className="tile__title">{title}</h3>
              <p className="tile__text">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
