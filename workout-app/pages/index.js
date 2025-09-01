// pages/index.js
import { useEffect, useRef, useState } from 'react';
import { storage } from '../utils/storage';
import { sheets } from '../utils/sheetsClient';

export default function Login() {
  const [mounted, setMounted] = useState(false);
  const [users, setUsers] = useState([]);
  const [nameInput, setNameInput] = useState('');
  const [loggedUser, setLoggedUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const redirectTimer = useRef(null);

  useEffect(() => {
    setMounted(true); // avoid SSR/hydration mismatch

    // populate from cache first (fast / offline)
    const cached = storage.getCachedUsers() || [];
    setUsers(cached);

    // try fresh copy (non-blocking)
    sheets.getUsers()
      .then(list => {
        if (Array.isArray(list) && list.length) {
          setUsers(list);
          storage.cacheUsers(list);
        }
      })
      .catch(() => {
        // offline / API missing -> use cache
      });

    // If already logged in — show welcome then redirect
    const u = storage.getUser();
    if (u) {
      setLoggedUser(u);
      redirectTimer.current = setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1200);
    }

    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  // helper: case-insensitive find in a list
  const findUserInList = (candidate, list = users) => {
    const name = String(candidate || '').trim();
    if (!name) return null;
    const found = (list || []).find(u => String(u.name || '').toLowerCase() === name.toLowerCase());
    return found || null;
  };

  // local match for the live check (does not prevent final server check)
  const localMatch = findUserInList(nameInput, users);

  async function login() {
    setMessage('');
    const name = String(nameInput || '').trim();
    if (!name) {
      setMessage('Please enter a username.');
      return;
    }

    setLoading(true);
    try {
      // try to refresh the users list (best-effort). This ensures we don't deny a valid user due to stale cache.
      const fresh = await sheets.getUsers().catch(() => null);
      if (Array.isArray(fresh) && fresh.length) {
        storage.cacheUsers(fresh);
        setUsers(fresh);
      }

      // check against fresh list if available, otherwise against cached list
      const listToCheck = (Array.isArray(fresh) && fresh.length) ? fresh : users;
      const found = findUserInList(name, listToCheck);

      if (!found) {
        setMessage('User not found.');
        setLoading(false);
        return;
      }

      // login
      storage.setUser({ name: found.name });
      window.location.href = '/dashboard';
    } catch (err) {
      console.error('Login error', err);
      setMessage('Unexpected error — try again.');
      setLoading(false);
    }
  }

  // don't render on server
  if (!mounted) return null;

  // if logged in — centered welcome card (no extra text)
  if (loggedUser) {
    return (
      <div className="full-screen-center">
        <div className="card welcome-card fade-in-slow" style={{ textAlign: 'center' }}>
          <div className="h1" style={{ margin: 0 }}>Welcome, {loggedUser.name}!</div>
        </div>
      </div>
    );
  }

  // regular login UI (centered)
  return (
    <div className="full-screen-center">
      <div className="card fade-in-slow" style={{ width: 'min(560px, 96%)' }}>
        <div className="h1" style={{ marginBottom: 14, textAlign: 'center' }}>Welcome to MaxLift</div>

        <div className="grid">
          {/* input row with neon-green outline when matched */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              autoFocus
              placeholder="Username"
              value={nameInput}
              onChange={e => { setNameInput(e.target.value); setMessage(''); }}
              onKeyDown={e => { if (e.key === 'Enter') login(); }}
              style={{
                flex: 1,
                transition: 'box-shadow .15s ease, border-color .15s ease',
                borderRadius: 8,
                padding: '10px 12px',
                border: localMatch ? '1px solid #39FF14' : '1px solid var(--input-border)',
                boxShadow: localMatch ? '0 0 18px rgba(57,255,20,0.18)' : 'none',
                background: 'var(--input-bg)',
                color: 'var(--text)',
                outline: 'none',
                fontSize: 15
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="primary"
              onClick={login}
              disabled={loading}
              style={{ opacity: loading ? 0.6 : 1, flex: 1, marginTop: 6 }}
            >
              {loading ? 'Checking…' : 'Login'}
            </button>
          </div>

          {message && (
            <div style={{ color: 'var(--secondary)', fontWeight: 700, marginTop: 8 }}>
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}