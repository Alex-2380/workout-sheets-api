import { useEffect, useMemo, useState } from 'react';
import { storage } from '../utils/storage';
import { sheets } from '../utils/sheetsClient';

function groupRoutineByDay(rows, routineName) {
  const pick = rows.filter(r => r.routine === routineName);
  const map = {};
  pick.forEach(r => {
    map[r.day] = map[r.day] || [];
    map[r.day].push(r);
  });
  // sort by exercise order (as listed)
  Object.keys(map).forEach(d => map[d].sort((a,b)=> a.exercise.localeCompare(b.exercise)));
  return map;
}

export default function WorkoutPage() {
  const user = storage.getUser();
  const [users, setUsers] = useState(storage.getCachedUsers());
  const me = users.find(u=>u.name===user?.name);
  const [routines, setRoutines] = useState(storage.getCachedRoutines());
  const byDay = useMemo(()=> groupRoutineByDay(routines, me?.routine || ''), [routines, me?.routine]);
  const [day, setDay] = useState(Object.keys(byDay)[0] || '1');

  const [active, setActive] = useState(() => user ? storage.getActiveWorkout(user.name) : null);
  const [history, setHistory] = useState([]);

  useEffect(()=>{
    if (!user) { window.location.href = '/'; return; }

    sheets.getUsers().then(list => { storage.cacheUsers(list); setUsers(list); }).catch(()=>{});
    sheets.getRoutines().then(rows => { storage.cacheRoutines(rows); setRoutines(rows); }).catch(()=>{});
    sheets.getUserData(user.name).then(rows => { storage.cacheUserData(user.name, rows); setHistory(rows); }).catch(()=>{ setHistory(storage.getCachedUserData(user.name)); });

  }, []);

  useEffect(()=>{
    // initialize a new active workout if none or routine changed
    if (!active && me?.routine) {
      const sets = [];
      (byDay[day] || []).forEach(ex => {
        for (let s=1; s<=ex.sets; s++) {
          sets.push({ exercise: ex.exercise, set: s, weight: '', reps: '', notes: '' });
        }
      });
      const w = {
        routine: me.routine,
        day,
        startedAt: new Date().toISOString(),
        sets
      };
      setActive(w);
      storage.setActiveWorkout(user.name, w);
    }
  }, [byDay, day, me?.routine]);

  function updateSet(idx, patch) {
    const w = { ...active, sets: active.sets.map((s,i)=> i===idx ? {...s, ...patch} : s) };
    setActive(w);
    storage.setActiveWorkout(user.name, w);
  }

  function finish() {
    if (!active) return;
    // Build rows for Sheets: User,Routine,Day,Exercise,Weight,Set,Reps,Date
    const dateStr = new Date().toLocaleString();
    const rows = active.sets
      .filter(s => (s.reps || s.weight)) // only entries with data
      .map(s => ({
        user: user.name,
        routine: active.routine,
        day: active.day,
        exercise: s.exercise,
        weight: parseFloat(s.weight||'0') || 0,
        set: s.set,
        reps: parseInt(s.reps||'0', 10) || 0,
        date: dateStr
      }));

    if (!rows.length) {
      alert('No set entries to save yet.');
      return;
    }

    // Try push; if fails, queue outbox
    sheets.appendWorkoutRows(user.name, rows.map(r => [r.user,r.routine,r.day,r.exercise,r.weight,r.set,r.reps,r.date]))
      .then(ok => {
        if (!ok) rows.forEach(r => storage.pushOutbox(user.name, r));
      })
      .finally(()=>{
        // Clear active, show confetti, go dashboard
        try { confetti(); } catch {}
        storage.clearActiveWorkout(user.name);
        window.location.href = '/dashboard';
      });
  }

  // Tiny confetti
  function confetti() {
    const n = 60;
    for (let i=0;i<n;i++){
      const el = document.createElement('div');
      el.style.position='fixed';
      el.style.left=Math.random()*100+'%';
      el.style.top='-10px';
      el.style.width='8px';
      el.style.height='12px';
      el.style.background='var(--accent)';
      el.style.opacity='.9';
      el.style.borderRadius='2px';
      el.style.zIndex='999';
      document.body.appendChild(el);
      const end = window.innerHeight + 40;
      const rot = (Math.random()*360)+'deg';
      el.animate([
        { transform: 'translateY(0) rotate(0deg)' },
        { transform: `translateY(${end}px) rotate(${rot})` }
      ], { duration: 1200 + Math.random()*800, easing: 'cubic-bezier(.2,.8,.2,1)' })
      .onfinish = ()=>el.remove();
    }
    setTimeout(()=> alert('Workout saved! 🎉'), 10);
  }

  const exercises = byDay[day] || [];
  const lastByExercise = useMemo(()=>{
    const map = {};
    history.forEach(r => {
      if (r.routine===me?.routine && r.day===day) {
        const key = r.exercise + ':' + r.set;
        map[key] = r; // last occurrence wins as we iterate
      }
    });
    return map;
  }, [history, me?.routine, day]);

  return (
    <div className="grid fade-in">
      <div className="card">
        <div className="h2" style={{marginBottom:8}}>Start Workout</div>
        <div className="grid-2">
          <div className="kpi"><span>User</span><strong>{user?.name}</strong></div>
          <div className="kpi"><span>Routine</span><strong>{me?.routine || '—'}</strong></div>
        </div>
        <div style={{display:'flex', gap:8, marginTop:8}}>
          <label className="badge">Day</label>
          <select value={day} onChange={e=>setDay(e.target.value)}>
            {Object.keys(byDay).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {active && exercises.map(ex => (
        <div className="card" key={ex.exercise}>
          <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between'}}>
            <div>
              <div className="h2" style={{margin:0}}>{ex.exercise}</div>
              <div className="muted">Target: {ex.sets} × {ex.targetReps}</div>
            </div>
            <span className="badge">Day {day}</span>
          </div>
          <div className="divider" />
          {(active.sets.filter(s=>s.exercise===ex.exercise)).map((s, idx) => {
            const prev = lastByExercise[ex.exercise + ':' + s.set];
            return (
              <div className="row" key={idx} style={{marginBottom:8}}>
                <div className="kpi"><span>Set {s.set}</span>
                  <strong>{prev ? `${prev.weight}×${prev.reps}` : '—'}</strong>
                </div>
                <input placeholder="Weight" inputMode="decimal"
                       value={s.weight} onChange={e=>updateSet(active.sets.indexOf(s), { weight: e.target.value })} />
                <input placeholder="Reps" inputMode="numeric"
                       value={s.reps} onChange={e=>updateSet(active.sets.indexOf(s), { reps: e.target.value })} />
              </div>
            );
          })}
        </div>
      ))}

      <button className="primary" onClick={finish}>Finish Workout</button>
    </div>
  );
}
