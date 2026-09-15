import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { LibraryProvider, useLibrary } from '@/services/LibraryProvider';
import { PlayerProvider } from '@/player/PlayerProvider';
import { ToastProvider } from '@/hooks/useToast';
import { LoadingState } from '@/components/ui';
import { HomePage } from '@/pages/HomePage';
import { SearchPage } from '@/pages/SearchPage';
import { LibraryPage } from '@/pages/LibraryPage';
import { LikedSongsPage } from '@/pages/LikedSongsPage';
import { RecentPage } from '@/pages/RecentPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/* Detail and settings screens are split out: they are not on the path most
   sessions take, and keeping them out of the first download matters on mobile. */
const PlaylistPage = lazy(() => import('@/pages/PlaylistPage').then((m) => ({ default: m.PlaylistPage })));
const AlbumPage = lazy(() => import('@/pages/AlbumPage').then((m) => ({ default: m.AlbumPage })));
const ArtistPage = lazy(() => import('@/pages/ArtistPage').then((m) => ({ default: m.ArtistPage })));
const StatsPage = lazy(() => import('@/pages/StatsPage').then((m) => ({ default: m.StatsPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const SystemStatusPage = lazy(() => import('@/pages/SystemStatusPage').then((m) => ({ default: m.SystemStatusPage })));

function ThemeSync() {
  const { settings } = useLibrary();

  useEffect(() => {
    const apply = () => {
      const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      const light = settings.theme === 'light' || (settings.theme === 'system' && prefersLight);
      document.documentElement.classList.toggle('light', light);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#f8f7f4' : '#0b0f0e');
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [settings.theme]);

  return null;
}

function Shell() {
  const { ready, profile } = useLibrary();

  if (!ready) {
    return (
      <div className="h-full grid place-items-center">
        <LoadingState label="Preparazione della libreria…" />
      </div>
    );
  }

  return (
    <>
      <ThemeSync />
      <PlayerProvider>
        <Suspense fallback={<LoadingState />}>
          <Routes>
            <Route path="/login" element={profile ? <Navigate to="/" replace /> : <LoginPage />} />
            <Route element={profile ? <AppLayout /> : <Navigate to="/login" replace />}>
              <Route index element={<HomePage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="library" element={<LibraryPage />} />
              <Route path="library/:tab" element={<LibraryPage />} />
              <Route path="liked" element={<LikedSongsPage />} />
              <Route path="playlist/:id" element={<PlaylistPage />} />
              <Route path="album/:id" element={<AlbumPage />} />
              <Route path="artist/:id" element={<ArtistPage />} />
              <Route path="recent" element={<RecentPage />} />
              <Route path="stats" element={<StatsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="system" element={<SystemStatusPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </PlayerProvider>
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <LibraryProvider>
        <Shell />
      </LibraryProvider>
    </ToastProvider>
  );
}
