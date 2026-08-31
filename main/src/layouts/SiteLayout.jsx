import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import NavBar from "../components/Navbar";
import Footer from "../components/Footer";
import MiniPlayerDock from "../player/MiniPlayerDock.jsx";

// The about board is sized to fill the viewport exactly, so a footer under it
// would only ever be a strip below the fold.
const FULL_SCREEN_ROUTES = new Set(["/about"]);

const SiteLayout = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <main className="relative min-h-screen w-full overflow-x-clip">
      <NavBar />
      <Outlet />
      {FULL_SCREEN_ROUTES.has(pathname) ? null : <Footer />}
      {/* /about 是精确铺满视口的气泡板且自带播放器卡片，/music 自带底部
          播放条——角上的小浮窗在这两处只会重复；其余页面播放过一次后常驻。 */}
      <MiniPlayerDock
        hidden={FULL_SCREEN_ROUTES.has(pathname) || pathname === "/music"}
      />
    </main>
  );
};

export default SiteLayout;
