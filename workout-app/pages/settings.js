import { useEffect, useState } from 'react';
import { storage } from '../utils/storage';
import { sheets } from '../utils/sheetsClient';
import { getTheme, setTheme, availableAccents } from '../utils/theme';

export default function Settings() {
  const user = storage.getUser();
  const [users, setUsers] = useState(storage.getCachedUsers());
  const [routines, setRoutines] = useState(storage.getCachedRoutines());
  const [mode, setMode] = useState(getTheme().mode);
  const [accent, setAccent] = useState(getTheme().accent);

  useEffect(()=>{
    sheets.getUsers().then(list => { storage.cacheUsers(list); setUsers(list); }).catch(()=>{});
    sheets.getRoutines().then(rows => { storage.cacheRoutines(rows); setRoutines(rows); }).catch(()=>{});
  }, []);

  function saveTheme() {
    setTheme({ mode, accent });
    alert('Theme saved.');
  }

  function switchUser(name) {
    storage.setUser({ name });
    window.location.href = '/dashboard';
  }

  function logout() {
    storage.clearUser();
    window.location.href = '/';
  }

  return (
    <div className="grid fade-in">
      <div className="card">
        <div className="h2">Theme</div>
        <div style={{display:'flex', gap:8, marginBottom:8}}>
          <button className="ghost" onClick={()=>setMode('dark')}>Dark</button>
          <button className="ghost" onClick={()=>setMode('light')}>Light</button>
        </div>
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          {availableAccents().map(c=>(
            <button key={c} className="ghost" onClick={()=>setAccent(c)}
              style={{borderColor: accent===c ? 'var(--accent)' : undefined}}>
              <span style={{display:'inline-block', width:20, height:20, borderRadius:999, background:c, verticalAlign:'middle'}}/> &nbsp; {c}
            </button>
          ))}
        </div>
        <div style={{marginTop:10}}>
          <button className="primary" onClick={saveTheme}>Save Theme</button>
        </div>
      </div>

      <div className="card">
        <div className="h2">Account</div>
        <div className="grid">
          <div className="kpi"><span>Current User</span><strong>{user?.name || '—'}</strong></div>
          <label className="muted">Switch User</label>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            {users.map(u => (
              <button key={u.name} className="ghost" onClick={()=>switchUser(u.name)}>{u.name}</button>
            ))}
          </div>
          <button className="ghost" onClick={logout}>Log Out</button>
        </div>
      </div>

      <div className="card">
        <div className="h2">Data & Sync</div>
        <div className="grid">
          <div className="muted">App stores everything locally for offline safety and tries to sync to Google Sheets. If your API’s POST is not implemented, completed workouts will appear in the Dashboard’s “Pending Sync”.</div>
        </div>
      </div>
    </div>
  );
}
