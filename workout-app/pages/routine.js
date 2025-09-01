import { useEffect, useMemo, useState } from 'react';
import { storage } from '../utils/storage';
import { sheets } from '../utils/sheetsClient';

export default function RoutineView() {
  const user = storage.getUser();
  const [users, setUsers] = useState(storage.getCachedUsers());
  const me = users.find(u => u.name === user?.name);
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
    return m;
  }, [routines, me?.routine]);

  return (
// ...inside return()
<div className="grid fade-in routine-page">
  {/* Centered routine NAME in primary color */}
  <div className="card header-card">
    <div className="h1 title-accent">{me?.routine || '—'}</div>
  </div>

  {Object.keys(byDay).sort((a,b)=>Number(a)-Number(b)).map(d=>(
    <div className="card" key={d}>
      <div className="h2 day-title">Day {d}</div>

      <div className="grid exercises">
        {byDay[d].map(ex => (
          <div className="kpi" key={ex.exercise}>
            <span className="exercise-name">{ex.exercise}</span>
            {/* make BOTH sets × reps muted */}
            <strong className="sr">{ex.sets} × {ex.targetReps || '—'}</strong>
          </div>
        ))}
      </div>
    </div>
  ))}
</div>
  );
}