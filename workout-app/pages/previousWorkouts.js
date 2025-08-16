import { useEffect, useState } from 'react';
import { storage } from '../utils/storage';
import { sheets } from '../utils/sheetsClient';

export default function PreviousWorkouts() {
  const user = storage.getUser();
  const [rows, setRows] = useState([]);

  useEffect(()=>{
    if (!user) { window.location.href = '/'; return; }
    const cached = storage.getCachedUserData(user.name);
    setRows(cached);
    sheets.getUserData(user.name).then(r => { storage.cacheUserData(user.name, r); setRows(r); }).catch(()=>{});
  }, []);

  // Group by date
  const byDate = rows.reduce((m, r) => {
    const d = new Date(r.date).toLocaleDateString();
    (m[d] = m[d] || []).push(r);
    return m;
  }, {});

  const dates = Object.keys(byDate).sort((a,b)=> new Date(b)-new Date(a));

  return (
    <div className="grid fade-in">
      <div className="card"><div className="h2">Previous Workouts</div></div>
      {dates.map(d => (
        <div className="card" key={d}>
          <div className="h2" style={{marginBottom:8}}>{d}</div>
          {byDate[d].map((r, i) => (
            <div key={i} className="kpi">
              <span>{r.routine} • Day {r.day} • {r.exercise} • Set {r.set}</span>
              <strong>{r.weight}×{r.reps}</strong>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
