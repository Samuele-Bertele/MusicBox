import { NavLink, useNavigate } from 'react-router-dom';
import { Activity, Clock, Disc3, Heart, Home, Library, ListMusic, Plus, Search, Settings, Users } from 'lucide-react';
import { useLibrary } from '@/services/LibraryProvider';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 h-10 px-3 rounded-lg text-sm transition-colors ${
    isActive ? 'bg-elevated text-txt' : 'text-muted hover:text-txt hover:bg-elevated/60'
  }`;

export function Sidebar() {
  const { playlists, createPlaylist } = useLibrary();
  const navigate = useNavigate();

  const newPlaylist = async () => {
    const pl = await createPlaylist(`Playlist ${playlists.length + 1}`);
    if (pl) navigate(`/playlist/${pl.id}`);
  };

  return (
    <nav className="hidden md:flex flex-col gap-6 w-64 shrink-0 h-full p-3 border-r border-line/60" aria-label="Navigazione principale">
      <div className="px-3 pt-2 pb-1">
        <span className="text-lg font-semibold tracking-[-0.04em]">musicbox</span>
      </div>

      <div className="space-y-1">
        <NavLink to="/" className={linkClass} end>
          <Home className="h-4 w-4" /> Home
        </NavLink>
        <NavLink to="/search" className={linkClass}>
          <Search className="h-4 w-4" /> Cerca
        </NavLink>
        <NavLink to="/library" className={linkClass}>
          <Library className="h-4 w-4" /> Libreria
        </NavLink>
      </div>

      <div className="space-y-1">
        <NavLink to="/liked" className={linkClass}>
          <Heart className="h-4 w-4" /> Preferiti
        </NavLink>
        <NavLink to="/library/albums" className={linkClass}>
          <Disc3 className="h-4 w-4" /> Album
        </NavLink>
        <NavLink to="/library/artists" className={linkClass}>
          <Users className="h-4 w-4" /> Artisti
        </NavLink>
        <NavLink to="/recent" className={linkClass}>
          <Clock className="h-4 w-4" /> Ascoltati di recente
        </NavLink>
        <NavLink to="/stats" className={linkClass}>
          <Activity className="h-4 w-4" /> Statistiche
        </NavLink>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between px-3 mb-2">
          <span className="text-xs text-muted">Playlist</span>
          <button className="icon-btn h-7 w-7" onClick={newPlaylist} aria-label="Crea playlist">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
          {playlists.length === 0 ? (
            <p className="px-3 text-xs text-muted leading-relaxed">
              Nessuna playlist. Creane una per raccogliere quello che ti piace.
            </p>
          ) : (
            playlists.map((pl) => (
              <NavLink key={pl.id} to={`/playlist/${pl.id}`} className={linkClass}>
                <ListMusic className="h-4 w-4 shrink-0" />
                <span className="truncate">{pl.name}</span>
              </NavLink>
            ))
          )}
        </div>
      </div>

      <NavLink to="/settings" className={linkClass}>
        <Settings className="h-4 w-4" /> Impostazioni
      </NavLink>
    </nav>
  );
}
