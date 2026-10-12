import { Outlet } from "react-router-dom";
import Navbar from "./Navbar.jsx";
import Footer from "./Footer.jsx";
import ScrollManager from "./ScrollManager.jsx";

export default function Layout() {
  return (
    <>
      <ScrollManager />
      <Navbar />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
