import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import SiteLayout from "./layouts/SiteLayout";
import AppConsolePage from "./pages/AppConsolePage";
import HomePage from "./pages/HomePage";
import BangumiPage from "./pages/BangumiPage";
import GalleryAlbumPage from "./pages/GalleryAlbumPage";
import GalleryPage from "./pages/GalleryPage";
import MomentsPage from "./pages/MomentsPage";
import AboutSitePage from "./pages/AboutSitePage";
import AboutProjectPage from "./pages/AboutProjectPage";
import {
  shouldExposeAppConsole,
  shouldOpenAppConsoleAtRoot,
} from "./pwa/appAccessGate";
import PwaOwnerGate from "./pwa/PwaOwnerGate";

const RootEntry = () => {
  const hostname =
    typeof window === "undefined" ? "" : window.location.hostname;
  return shouldOpenAppConsoleAtRoot({ hostname, pathname: "/" }) ? (
    <Navigate to="/app" replace />
  ) : (
    <HomePage />
  );
};

const AppConsoleEntry = () => {
  const hostname =
    typeof window === "undefined" ? "" : window.location.hostname;
  return shouldExposeAppConsole({ hostname }) ? (
    <AppConsolePage />
  ) : (
    <Navigate to="/" replace />
  );
};

function App() {
  return (
    <PwaOwnerGate>
      <BrowserRouter>
        <Routes>
          <Route path="app" element={<AppConsoleEntry />} />
          <Route element={<SiteLayout />}>
            <Route index element={<RootEntry />} />
            <Route
              path="bangumi"
              element={<Navigate to="/bangumi/watching" replace />}
            />
            <Route path="bangumi/:status" element={<BangumiPage />} />
            <Route
              path="bili"
              element={<Navigate to="/bangumi/watching" replace />}
            />
            <Route path="gallery" element={<GalleryPage />} />
            <Route path="gallery/:albumId" element={<GalleryAlbumPage />} />
            <Route path="moments" element={<MomentsPage />} />
            <Route path="about" element={<AboutSitePage />} />
            <Route
              path="about/projects/:projectId"
              element={<AboutProjectPage />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </PwaOwnerGate>
  );
}

export default App;
