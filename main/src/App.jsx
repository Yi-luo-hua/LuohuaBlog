import { BrowserRouter, Route, Routes } from "react-router-dom";
import SiteLayout from "./layouts/SiteLayout";
import HomePage from "./pages/HomePage";
import BiliHubPage from "./pages/BiliHubPage";
import LoginPage from "./pages/LoginPage";
import AiTrafficPage from "./pages/AiTrafficPage";
import GuestbookPage from "./pages/GuestbookPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<HomePage />} />
          <Route path="bili" element={<BiliHubPage />} />
          <Route path="ai-traffic" element={<AiTrafficPage />} />
          <Route path="guestbook" element={<GuestbookPage />} />
          <Route path="login" element={<LoginPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
