import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar.jsx";
import Footer from "./Footer.jsx";
import ScrollManager from "./ScrollManager.jsx";
import DesktopTitlebar from "./DesktopTitlebar.jsx";
import { useAuth } from "../auth.jsx";

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, ready } = useAuth();
  const desktop = Boolean(window.wayloDesktop?.isDesktop);

  // Desktop flow: log in with Discord, then verify with Dock, then servers.
  useEffect(() => {
    if (!desktop || !ready || !user) return;
    const free = ["/verify", "/terms", "/privacy"];
    if (!user.roblox && !free.includes(location.pathname)) navigate("/verify");
    else if (user.roblox && location.pathname === "/verify") navigate("/servers");
  }, [desktop, ready, user, location.pathname, navigate]);

  return (
    <>
      <ScrollManager />
      <DesktopTitlebar />
      <Navbar />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
