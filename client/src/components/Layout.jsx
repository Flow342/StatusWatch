import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

export function Layout({ children }) {
  const { isAdmin, user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface/50 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-up/15 text-up">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 12h4l3 7 4-14 3 7h4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-base font-semibold tracking-tight">StatusWatch</span>
          </Link>

          <nav className="flex items-center gap-3 text-sm">
            {isAdmin ? (
              <>
                <span className="hidden text-ink-muted sm:inline">
                  Signed in as <span className="text-ink">{user.username}</span>
                </span>
                <button type="button" className="btn-secondary" onClick={logout}>
                  Sign out
                </button>
              </>
            ) : (
              location.pathname !== '/login' && (
                <Link to="/login" className="btn-secondary">
                  Admin sign in
                </Link>
              )
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-ink-faint sm:px-6">
        StatusWatch — checks run server-side on a schedule; this page refreshes every 30 seconds.
      </footer>
    </div>
  );
}

export default Layout;
