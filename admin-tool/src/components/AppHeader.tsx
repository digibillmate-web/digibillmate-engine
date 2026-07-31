import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import SignOutButton from '@/components/SignOutButton';

/**
 * Shared chrome. Reads the session itself rather than taking the email as a
 * prop, so no page has to remember to pass it.
 */
export default async function AppHeader({ current }: { current?: 'sites' | 'clients' }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link className="app-header__brand" href="/sites">
          DigiBillMate Admin
        </Link>

        <nav className="app-nav">
          <Link className={`app-nav__link ${current === 'sites' ? 'is-current' : ''}`} href="/sites">
            Sites
          </Link>
          <Link
            className={`app-nav__link ${current === 'clients' ? 'is-current' : ''}`}
            href="/clients"
          >
            Clients
          </Link>
        </nav>

        <div className="app-header__spacer" />
        <span className="app-header__user">{user?.email}</span>
        <SignOutButton />
      </div>
    </header>
  );
}
