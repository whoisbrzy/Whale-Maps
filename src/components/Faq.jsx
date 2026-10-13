import { Link } from "react-router-dom";

const ITEMS = [
  {
    q: "What is Whale Maps?",
    a: (
      <p>
        Whale Maps is a live map companion for ER:LC roleplay. It shows where your team is, helps
        you plan routes, and warns you about speed and traffic cameras, all in a browser tab you can
        keep open on a second screen or your phone.
      </p>
    ),
  },
  {
    q: "How does it connect to my ER:LC server?",
    a: (
      <p>
        Whale Maps reads player positions through the official ER:LC server API using your server's
        API key. You add the key once during setup, and the app uses it to keep the map up to date.
        You can remove the key at any time.
      </p>
    ),
  },
  {
    q: "Who can see my location?",
    a: (
      <p>
        Only people in the same ER:LC server and Whale Maps session as you. Your position is never
        shown publicly, and it's only used to draw the live map and trigger camera alerts.
      </p>
    ),
  },
  {
    q: "How do routes and camera alerts work?",
    a: (
      <p>
        Pick a destination and Whale Maps draws a route from where you are. Cameras are marked on the
        map, and you get an alert as you approach one. You can also add cameras you find so the rest
        of your team gets warned too.
      </p>
    ),
  },
  {
    q: "Why do I log in with Discord?",
    a: (
      <p>
        Discord login gives you an account without another password, and lets server owners decide
        who can use their map. We only ask for the basic profile details we need to sign you in. See
        the <Link to="/privacy">Privacy Policy</Link> for the full list.
      </p>
    ),
  },
  {
    q: "Why verify my Roblox account?",
    a: (
      <p>
        Verifying links your Roblox account to your Discord login, so other players can trust who is
        on the map. It's done through Dock: you sign in there with Discord and Roblox once, and we
        store the link so you don't have to repeat it. You can remove it any time on the{" "}
        <Link to="/verify">Verify page</Link>.
      </p>
    ),
  },
  {
    q: "Do I need to install anything?",
    a: (
      <p>
        No. Whale Maps runs in your browser on desktop and mobile. You don't need to install anything
        in Roblox or in ER:LC.
      </p>
    ),
  },
  {
    q: "Is Whale Maps affiliated with ER:LC, Roblox or Discord?",
    a: (
      <p>
        No. Whale Maps is an independent community tool. It is not affiliated with, endorsed by or
        sponsored by Police Roleplay Community, Roblox or Discord. ER:LC, Roblox and Discord are
        trademarks of their respective owners.
      </p>
    ),
  },
];

export default function Faq() {
  return (
    <section className="section" id="faq" aria-labelledby="faq-title">
      <div className="container container--narrow">
        <p className="eyebrow">FAQ</p>
        <h2 className="section__title" id="faq-title">
          Frequently asked questions
        </h2>
        <p className="section__lead">Quick answers about how Whale Maps works.</p>

        <div className="faq">
          {ITEMS.map((item) => (
            <details className="faq__item" key={item.q}>
              <summary className="faq__q">
                <span>{item.q}</span>
                <svg className="faq__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </summary>
              <div className="faq__a">{item.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
