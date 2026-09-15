import { NavLink } from 'react-router-dom';
import { Home, Library, Search } from 'lucide-react';

const items = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/search', label: 'Cerca', icon: Search, end: false },
  { to: '/library', label: 'Libreria', icon: Library, end: false },
];

export function BottomNav() {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-lg border-t border-line/60 safe-bottom"
      aria-label="Navigazione"
    >
      <div className="grid grid-cols-3">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${isActive ? 'text-accent' : 'text-muted'}`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
