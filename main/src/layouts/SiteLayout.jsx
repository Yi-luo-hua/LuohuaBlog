import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import NavBar from "../components/Navbar";
import Footer from "../components/Footer";

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
    </main>
  );
};

export default SiteLayout;
