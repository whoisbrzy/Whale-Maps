import { Discord, IconPin, IconUsers, IconRoute, IconCamera, IconLink } from "./Icons.jsx";

/* status "live" = works today, "soon" = planned. Keep this honest: flip a card to
   "live" only when the feature really ships (see AGENTS.md roadmap). */
const FEATURES = [
  {
    Icon: IconPin,
    title: "Live location sharing",
    text: "See your team on the map in real time. Positions come straight from your ER:LC server.",
    status: "soon",
  },
  {
    Icon: IconUsers,
    title: "Private sessions",
    text: "Join with a session code. Only the people in your session can see you and your status.",
    status: "soon",
  },
  {
    Icon: IconRoute,
    title: "Routes",
    text: "Pick a destination and follow the route. Place your own waypoints, with automatic road routing to follow.",
    status: "soon",
  },
  {
    Icon: IconCamera,
    title: "Camera alerts",
    text: "Get a warning as you approach a camera, and add or report cameras so everyone's map stays current.",
    status: "soon",
  },
  {
    Icon: IconLink,
    title: "Connected to ER:LC",
    text: "Server owners add their ER:LC server key once. The key stays on our backend and never reaches a browser.",
    status: "soon",
  },
  {
    Icon: Discord,
    title: "Discord login",
    text: "Sign in with one click. We only ask for your basic profile, never your messages or your servers.",
    status: "live",
  },
];

export default function Features() {
  return (
    <section className="section" id="features" aria-labelledby="features-title">
      <div className="container">
        <p className="eyebrow">Features</p>
        <h2 className="section__title" id="features-title">
          Everything your patrol needs
        </h2>
        <p className="section__lead">A live map built for ER:LC roleplay.</p>

        <div className="features">
          {FEATURES.map(({ Icon, title, text, status }) => (
            <article className="feature" key={title}>
              <div className="feature__top">
                <span className="feature__icon">
                  <Icon />
                </span>
                <span className={`badge${status === "live" ? " badge--live" : ""}`}>
                  {status === "live" ? "Available" : "Coming soon"}
                </span>
              </div>
              <h3 className="feature__title">{title}</h3>
              <p className="feature__text">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
