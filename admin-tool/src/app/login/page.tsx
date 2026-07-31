import { Suspense } from 'react';
import LoginForm from './LoginForm';

export default function LoginPage() {
  return (
    <main className="login-shell">
      <div className="card login-card">
        <h1>DigiBillMate Admin</h1>
        <p className="hint">Sign in to manage client sites.</p>

        {/* The form reads ?next= via useSearchParams, which needs a boundary
            so the shell can still be prerendered. */}
        <Suspense fallback={<p className="hint">Loading…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
