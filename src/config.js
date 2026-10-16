/* Site-wide settings used by the footer and legal pages. */
export const SITE = {
  name: "Waylo",
  year: 2026,
  // Set a real inbox to show a "Contact" link in the footer and on the legal pages.
  // While empty, those links are hidden.
  contactEmail: "",
  // Shown at the top of the Terms and Privacy pages. Update when the text changes.
  legalUpdated: "October 14, 2026",
};

/* Direct link to the Windows installer, used by the button on the web /map page. GitHub serves the
   newest release's asset at /releases/latest/download/<file name>, so each release must contain a
   file with exactly this name (set electron-builder's nsis "artifactName" to "Waylo-Setup.exe"). */
export const DESKTOP_DOWNLOAD_URL = "https://github.com/whoisbrzy/Whale-Maps/releases/latest/download/Waylo-Setup.exe";
