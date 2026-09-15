import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/ui';

export function NotFoundPage() {
  return (
    <EmptyState
      title="Pagina non trovata"
      description="Il collegamento che hai seguito non porta a nulla."
      action={
        <Link className="btn-outline" to="/">
          Torna alla Home
        </Link>
      }
    />
  );
}
