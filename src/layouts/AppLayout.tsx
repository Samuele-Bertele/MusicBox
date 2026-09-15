import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { BottomNav } from '@/components/BottomNav';
import { Player } from '@/player/Player';
import { Toasts } from '@/components/ui';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

const TITLES: Record<string, string> = {
  '/': 'Home',
  '/search': 'Cerca',
  '/library': 'Libreria',
  '/library/albums': 'Album',
  '/library/artists': 'Artisti',
  '/liked': 'Preferiti',
  '/recent': 'Ascoltati di recente',
  '/stats': 'Statistiche',
  '/settings': 'Impostazioni',
  '/system': 'Stato del sistema',
};

/**
 * The player lives here, outside <Outlet />, so navigating never unmounts it
 * and audio keeps playing across pages.
 */
export function AppLayout() {
  const { pathname } = useLocation();
  useKeyboardShortcuts();

  useEffect(() => {
    document.getElementById('scroll-region')?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar title={TITLES[pathname]} />
          <main id="scroll-region" className="flex-1 overflow-y-auto px-4 md:px-6 pb-44 md:pb-8 pt-4">
            <Outlet />
          </main>
        </div>
      </div>
      <Player />
      <BottomNav />
      <Toasts />
    </div>
  );
}
