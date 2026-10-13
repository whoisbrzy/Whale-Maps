import { Link } from "react-router-dom";
import LegalPage from "../components/LegalPage.jsx";
import { SITE } from "../config.js";

/* NOTE: This is a plain-language starting template, not legal advice.
   It describes the planned design (Discord login, server key kept on the
   backend, no location history, no sale of data). Keep it in sync with what
   the app actually does, and have it reviewed before launch. */
const sections = [
  {
    title: "What we collect",
    body: (
      <>
        <p>We collect only what we need to run the Service:</p>
        <ul>
          <li>
            <strong>Discord account details.</strong> When you sign in with Discord we receive your
            Discord user ID, username, display name and avatar, and save them in our database so
            your account is remembered.
          </li>
          <li>
            <strong>Roblox account link.</strong> If you verify your Roblox account through Dock, we
            receive your Roblox user ID, look up your public Roblox username, and store both next to
            your Discord account.
          </li>
          <li>
            <strong>ER:LC server data.</strong> If a server is connected, we receive the server's
            API key and the data the ER:LC API returns for that server, such as player names and
            IDs, team, and in-game position.
          </li>
          <li>
            <strong>Content you add.</strong> Things like camera reports, routes and session
            settings.
          </li>
          <li>
            <strong>Technical data.</strong> Basic information such as IP address, browser and device
            type, and error logs, used to keep the Service secure and working.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "How we use it",
    body: (
      <ul>
        <li>to sign you in and keep your account secure;</li>
        <li>to draw the live map, share positions with your session, plan routes and trigger camera alerts;</li>
        <li>to prevent abuse and fix problems; and</li>
        <li>to improve the Service.</li>
      </ul>
    ),
  },
  {
    title: "Who can see your information",
    body: (
      <>
        <p>
          Your name and in-game position are visible to other people in the same ER:LC server and
          Whale Maps session, because that is what the Service is for. They are not shown publicly.
        </p>
        <p>
          We don't sell your personal data. We share it only with the providers that run the Service
          for us (Vercel for hosting and MongoDB Atlas for our database), or when the law requires
          it.
        </p>
        <p>
          Roblox verification is handled by Dock (docksys.xyz), a separate service. When you verify,
          Dock sees your Discord and Roblox accounts under its own terms and privacy policy, and
          tells us which Roblox account belongs to your Discord account.
        </p>
      </>
    ),
  },
  {
    title: "Server keys",
    body: (
      <p>
        A server's API key is stored on our servers and is used only to read that server's data. It
        is never sent to other users' browsers. A server owner can remove their key at any time,
        after which we stop reading that server's data.
      </p>
    ),
  },
  {
    title: "How long we keep data",
    body: (
      <p>
        We keep your account details and Roblox link until you remove the link or ask us to delete
        them. Live position data is used in
        real time to draw the map, and we don't build a long-term history of where you've been. Logs
        are kept only as long as needed for security and troubleshooting.
      </p>
    ),
  },
  {
    title: "Cookies and local storage",
    body: (
      <p>
        We use cookies or similar browser storage to keep you signed in and to remember settings
        like your preferences. We don't use advertising trackers.
      </p>
    ),
  },
  {
    title: "Your choices and rights",
    body: (
      <>
        <p>
          You can leave a session, remove a server key, unlink your Roblox account on the Verify
          page, or stop using the Service at any time. You
          can ask us to access, correct or delete the personal data we hold about you. If you're in
          the European Economic Area or the UK, you also have the right to object to or restrict
          certain processing.
        </p>
        <p>
          {SITE.contactEmail && "To make a request, use the contact details at the bottom of this page. "}
          You can also manage the apps connected to your account in your Discord settings.
        </p>
      </>
    ),
  },
  {
    title: "Children",
    body: (
      <p>
        The Service isn't meant for anyone under the minimum age required to use Discord in their
        country. If you think a child has given us personal data, let us know and we'll delete it.
      </p>
    ),
  },
  {
    title: "Where data is processed",
    body: (
      <p>
        Our hosting providers may process data in countries other than your own. We take reasonable
        steps to protect it wherever it is handled.
      </p>
    ),
  },
  {
    title: "Changes to this policy",
    body: (
      <p>
        We may update this policy. We'll change the "last updated" date above, and for significant
        changes we'll make that clear in the Service. See also our{" "}
        <Link to="/terms">Terms of Service</Link>.
      </p>
    ),
  },
];

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This policy explains what information Whale Maps collects, why, and the choices you have."
      sections={sections}
    />
  );
}
