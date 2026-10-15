import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import Verify from "./pages/Verify.jsx";
import Servers from "./pages/Servers.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import MapPage from "./pages/Map.jsx";
import Settings from "./pages/Settings.jsx";
import Panel from "./pages/Panel.jsx";
import Terms from "./pages/Terms.jsx";
import Privacy from "./pages/Privacy.jsx";
import NotFound from "./pages/NotFound.jsx";

/* BrowserRouter is provided in main.jsx. */
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/servers" element={<Servers />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/panel" element={<Panel />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="/map" element={<MapPage />} />
    </Routes>
  );
}
