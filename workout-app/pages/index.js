import { useEffect, useState } from 'react';
import Link from 'next/link';
import { storage } from '../utils/storage';
import { sheets } from '../utils/sheetsClient';
import { getTheme, setTheme, availableAccents } from '../utils/theme';

export default function Login() {
  const [users, setUsers] = useState(storage.getCachedUsers());
  const [selected, setSelected] = useState('');
  const theme = getTheme();

  useEffect(()=>{
    // fetch users (cache first)
    sheets.getUsers()
      .then(list => { setUsers(list); storage.cacheUsers(list); })
      .catch(()=>{ /* offline */});
  }, []);

  function login() {
    if (!selected) return;
    storage.setUser({ name: selected });
    window.location.href = '/dashboard';
  }

  return (
    <div className="grid fade-in">
      <div className="card">
        <div className="h1">Welcome to LiftLog</div>
        <div className="muted" style={{opacity:.8, margin:'6px 0 12px'}}>Fast, offline-friendly tracker with Google Sheets sync.</div>

        <div className="grid">
          <label className="muted">Select user</label>
          <select value={selected} onChange={e=>setSelected(e.target.value)}>
            <option value="">— Choose —</option>
            {users.map(u => <option key={u.name} value={u.name}>{u.name}</option>)}
          </select>
          <button className="primary" onClick={login}>Login</button>
          <Link href="/settings" className="ghost">Theme & Settings</Link>
        </div>
      </div>
    </div>
  );
}
