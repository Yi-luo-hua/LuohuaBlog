import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { I18nProvider } from './i18n/I18nContext';
import { WeatherProvider } from './weather/WeatherContext';
import { ArchivesPage } from './pages/ArchivesPage';
import { ArticlesPage } from './pages/ArticlesPage';
import { GalleryAlbumPage } from './pages/GalleryAlbumPage';
import { GalleryPage } from './pages/GalleryPage';
import { HomePage } from './pages/HomePage';
import { LinksPage } from './pages/LinksPage';
import { MomentsPage } from './pages/MomentsPage';
import { PostPage } from './pages/PostPage';

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

export function App() {
  return (
    <I18nProvider>
      <WeatherProvider>
        <BrowserRouter basename={routerBasename}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/archives" element={<ArchivesPage />} />
              <Route path="/articles" element={<ArticlesPage />} />
              <Route path="/post/:slug" element={<PostPage />} />
              <Route path="/moments" element={<MomentsPage />} />
              <Route path="/gallery" element={<GalleryPage />} />
              <Route path="/gallery/:id" element={<GalleryAlbumPage />} />
              <Route path="/links" element={<LinksPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </WeatherProvider>
    </I18nProvider>
  );
}
