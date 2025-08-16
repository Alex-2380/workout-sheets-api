import { useEffect, useMemo, useState } from 'react';
import { storage } from '../utils/storage';
import { sheets } from '../utils/sheetsClient';

export default function RoutineView() {
  const user = storage.getUser();
  const [users, setUsers] = useState(storage.getCachedUsers());
  const me = users.find(u=>u.name===user?.name);
  const [routines, setRoutines] = useState(storage.getCachedRoutines());

  useEffect(()=>{
    if (!user) { window.location.href = '/'; return; }
    sheets.getUsers().then(list => { storage.cacheUsers(list); setUsers(list); }).catch(()=>{});
    sheets.getRoutines().then(rows => { storage.cacheRoutines(rows); setRoutines(rows); }).catch(()=>{});
  }, []);

  const byDay = useMemo(()=>{
    const pick = routines.filter(r => r.routine === me?.routine);
    const m = {};
    pick.forEach(r => { (m[r.day] = m[r.day] || []).push(r); });
    Object.keys(m).forEach(d => m[d].sort((a,b)=>a.exercise.localeCompare(b.exercise)));
    return m;
  }, [routines, me?.routine]);

  return (
    <div className="grid fade-in">
      <div className="card">
        <div className="h2" style={{marginBottom:8}}>Current Routine</div>
        <div className="kpi"><span>User</span><strong>{user?.name}</strong></div>
        <div className="kpi"><span>Routine</span><strong>{me?.routine || '—'}</strong></div>
      </div>
      {Object.keys(byDay).sort((a,b)=>Number(a)-Number(b)).map(d=>(
        <div className="card" key={d}>
          <div className="h2" style={{marginBottom:8}}>Day {d}</div>
          <div className="grid">
            {byDay[d].map(ex => (
              <div className="kpi" key={ex.exercise}>
                <span>{ex.exercise}</span>
                <strong>{ex.sets} × {ex.targetReps}</strong>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
