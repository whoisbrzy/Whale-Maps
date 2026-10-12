import { Link } from "react-router-dom";
import LegalPage from "../components/LegalPage.jsx";

/* NOTE: This is a plain-language starting template, not legal advice.
   Have it reviewed, and add your governing law/jurisdiction, before launch. */
const sections = [
  {
    title: "Agreeing to these terms",
    body: (
      <p>
        By using Whale Maps ("the Service") you agree to these Terms of Service. If you don't agree,
        please don't use the Service. If you use it on behalf of an ER:LC server or community, you
        confirm you're allowed to accept these terms for it.
      </p>
    ),
  },
  {
    title: "What Whale Maps is",
    body: (
      <>
        <p>
          Whale Maps is a roleplay companion tool that shows a live map for ER:LC, including shared
          player locations, routes and camera alerts. It is intended for use inside the game's
          roleplay.
        </p>
        <p>
          Whale Maps is an independent community project. It is not affiliated with, endorsed by or
          sponsored by Police Roleplay Community, Roblox or Discord. ER:LC, Roblox and Discord are
          trademarks of their respective owners.
        </p>
      </>
    ),
  },
  {
    title: "Accounts and Discord login",
    body: (
      <>
        <p>
          You sign in with your Discord account. You're responsible for activity on your account and
          for keeping it secure. You must meet the minimum age for Discord and Roblox in your
          country, and you must follow Discord's and Roblox's own terms while using the Service.
        </p>
      </>
    ),
  },
  {
    title: "Server keys and connected servers",
    body: (
      <>
        <p>
          To show live data, the Service can connect to an ER:LC server using that server's API key.
          If you add a key, you confirm that you own the server or are authorized to connect it. You
          are responsible for the key you provide, and you can remove it at any time.
        </p>
        <p>
          The Service depends on the ER:LC API. We don't control that API, and features may be
          limited, delayed or unavailable if it changes or is down.
        </p>
      </>
    ),
  },
  {
    title: "Acceptable use",
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>use the Service to harass, stalk or expose other people, or to share anyone's location outside of the game's roleplay;</li>
          <li>submit false, spammy or abusive camera reports or other content;</li>
          <li>try to break, overload, scrape or reverse-engineer the Service, or bypass its limits or access controls;</li>
          <li>use someone else's server key or account without permission; or</li>
          <li>use the Service for anything illegal or that breaks Discord's, Roblox's or the ER:LC rules.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Content you add",
    body: (
      <p>
        You keep ownership of what you add to the Service, such as camera reports and routes. You
        give us permission to store and display it to others in your session so the Service can work.
        We may remove content that breaks these terms.
      </p>
    ),
  },
  {
    title: "Changes, availability and ending access",
    body: (
      <p>
        We may change, pause or stop parts of the Service at any time. We may suspend or end access
        for anyone who breaks these terms or puts the Service or other users at risk. You can stop
        using the Service whenever you like.
      </p>
    ),
  },
  {
    title: "No warranty",
    body: (
      <p>
        The Service is provided "as is" and "as available", without warranties of any kind. Map
        positions, routes and alerts may be late, inaccurate or missing, so don't rely on them for
        anything important.
      </p>
    ),
  },
  {
    title: "Limit of liability",
    body: (
      <p>
        To the maximum extent allowed by law, Whale Maps and the people who run it are not liable
        for indirect or consequential losses, or for losses from using or being unable to use the
        Service. Nothing in these terms limits liability that can't be limited by law.
      </p>
    ),
  },
  {
    title: "Privacy",
    body: (
      <p>
        How we handle your information is described in our <Link to="/privacy">Privacy Policy</Link>.
      </p>
    ),
  },
  {
    title: "Changes to these terms",
    body: (
      <p>
        We may update these terms from time to time. We'll change the "last updated" date above, and
        continuing to use the Service after an update means you accept the new terms.
      </p>
    ),
  },
];

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These terms explain the rules for using Whale Maps. Please read them before you use the Service."
      sections={sections}
    />
  );
}
