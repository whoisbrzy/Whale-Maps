/* Vercel serverless function: one catch-all for every /api/* and /auth/* request
   (vercel.json rewrites /auth/* to /api/auth/*). All the logic lives in lib/app.js. */
import { route } from "../lib/app.js";
import { json } from "../lib/http.js";

export default async function handler(req, res) {
  try {
    if (!(await route(req, res))) json(res, 404, { error: "not_found" });
  } catch (err) {
    console.error("Request failed:", err);
    if (!res.headersSent) json(res, 500, { error: "server_error" });
    else res.end();
  }
}
