import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import SiteLayout from "./layouts/SiteLayout";
import AppConsolePage from "./pages/AppConsolePage";
import HomePage from "./pages/HomePage";
import BangumiPage from "./pages/BangumiPage";
import GalleryPage from "./pages/GalleryPage";
import GalleryPhotoPage from "./pages/GalleryPhotoPage";
import MomentsPage from "./pages/MomentsPage";
import AboutSitePage from "./pages/AboutSitePage";
import AboutProjectPage from "./pages/AboutProjectPage";
import OwnerPasswordGate from "./pwa/OwnerPasswordGate";

// /app is reachable from any host; the password box is what stands in the way.
const AppConsoleEntry = () => (
  <OwnerPasswordGate>
    <AppConsolePage />
  </OwnerPasswordGate>
);

function App() {
  return (
    <BrowserRouter>
        <Routes>
          <Route path="app" element={<AppConsoleEntry />} />
          <Route element={<SiteLayout />}>
            <Route index element={<HomePage />} />
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
            <Route path="gallery/:photoId" element={<GalleryPhotoPage />} />
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
  );
}

export default App;
