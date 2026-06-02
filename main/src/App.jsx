import { BrowserRouter, Route, Routes } from "react-router-dom";
import SiteLayout from "./layouts/SiteLayout";
import HomePage from "./pages/HomePage";
import BiliHubPage from "./pages/BiliHubPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<HomePage />} />
          <Route path="bili/*" element={<BiliHubPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
