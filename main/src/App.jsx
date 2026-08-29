import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import SiteLayout from "./layouts/SiteLayout";
import AppConsolePage from "./pages/AppConsolePage";
import HomePage from "./pages/HomePage";
import BangumiPage from "./pages/BangumiPage";
import GalleryPage from "./pages/GalleryPage";
import GalleryPhotoPage from "./pages/GalleryPhotoPage";
import MomentsPage from "./pages/MomentsPage";
import MusicPage from "./pages/MusicPage";
import AboutSitePage from "./pages/AboutSitePage";
import AboutProjectPage from "./pages/AboutProjectPage";
import OwnerPasswordGate from "./pwa/OwnerPasswordGate";
import { MusicPlayerProvider } from "./player/MusicPlayerProvider.jsx";

// /app is reachable from any host; the password box is what stands in the way.
const AppConsoleEntry = () => (
  <OwnerPasswordGate>
    <AppConsolePage />
  </OwnerPasswordGate>
);

function App() {
  return (
    <BrowserRouter>
      {/* 挂在 Routes 外层：单例 <audio> 跨路由存活，切页面音乐不断。 */}
      <MusicPlayerProvider>
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
            <Route path="music" element={<MusicPage />} />
            <Route path="about" element={<AboutSitePage />} />
            <Route
              path="about/projects/:projectId"
              element={<AboutProjectPage />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </MusicPlayerProvider>
    </BrowserRouter>
  );
}

export default App;
