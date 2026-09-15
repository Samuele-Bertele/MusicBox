import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Gauge, LogOut, Settings, User } from 'lucide-react';
import { useState } from 'react';
import { useLibrary } from '@/services/LibraryProvider';
import { signOut } from '@/services/auth';
import { ContextMenu, useContextMenu } from './ContextMenu';

export function TopBar({ title }: { title?: string }) {
  const navigate = useNavigate();
  const { profile } = useLibrary();
  const menu = useContextMenu();
  const [busy, setBusy] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 px-4 md:px-6 h-14 bg-bg/85 backdrop-blur-md border-b border-line/40">
      <div className="hidden md:flex gap-1">
        <button className="icon-btn h-8 w-8 bg-elevated" onClick={() => navigate(-1)} aria-label="Indietro">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button className="icon-btn h-8 w-8 bg-elevated" onClick={() => navigate(1)} aria-label="Avanti">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <h1 className="text-base font-medium truncate flex-1 md:flex-none">{title}</h1>

      <div className="ml-auto">
        <button
          className="flex items-center gap-2 h-9 pl-1 pr-3 rounded-full bg-elevated hover:bg-line/60 transition-colors"
          onClick={menu.open}
          aria-label="Menu account"
        >
          <span className="h-7 w-7 rounded-full bg-accent/20 text-accent grid place-items-center text-xs font-semibold">
            {(profile?.displayName ?? '?').slice(0, 1).toUpperCase()}
          </span>
          <span className="text-sm max-w-[8rem] truncate">{profile?.displayName ?? 'Ospite'}</span>
        </button>
      </div>

      <ContextMenu
        anchor={menu.anchor}
        onClose={menu.close}
        items={[
          { label: 'Impostazioni', icon: <Settings />, onSelect: () => navigate('/settings') },
          { label: 'Stato del sistema', icon: <Gauge />, onSelect: () => navigate('/system') },
          { label: 'Profilo', icon: <User />, onSelect: () => navigate('/settings') },
          {
            label: 'Esci',
            icon: <LogOut />,
            danger: true,
            disabled: busy,
            onSelect: async () => {
              setBusy(true);
              await signOut();
              navigate('/login', { replace: true });
              window.location.reload();
            },
          },
        ]}
      />
    </header>
  );
}
