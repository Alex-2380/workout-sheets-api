// components/RoutineList.js
import { useMemo, useState } from 'react';

export default function RoutineList({ routines = [], onRefresh }) {
  // derive unique routine names
  const routinesByName = useMemo(() => {
    const m = {};
    (routines || []).forEach(r => {
      if (!r.routine) return;
      m[r.routine] = m[r.routine] || [];
      m[r.routine].push(r);
    });
    return m;
  }, [routines]);

  const [expanded, setExpanded] = useState({});

  const toggle = (name) => {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const names = Object.keys(routinesByName).sort((a,b)=>a.localeCompare(b));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="h2">All Routines</div>
        <div>
        </div>
      </div>

      {names.length === 0 && (
        <div className="card" style={{ marginTop: 8 }}>
          <div style={{ color: 'var(--muted)' }}>No routines found.</div>
        </div>
      )}

      {names.map(name => {
        const rows = (routinesByName[name] || []).slice().sort((a,b)=>Number(a.day)-Number(b.day));
        const days = {};
        rows.forEach(r => { (days[r.day] = days[r.day] || []).push(r); });

        return (
          <div className="card" key={name} style={{ marginTop: 8 }}>
            <div
              onClick={() => toggle(name)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
  {/* Routine name on the left */}
  <div className="h2" style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{name}</div>

  {/* Exercises/days stacked on the right */}
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
       <div style={{ color: 'var(--muted)', fontSize: 13 }}>{Object.keys(days).length} days</div> 
<div style={{ color: 'var(--muted)', fontSize: 12 }}>{rows.length} exercises</div>

  </div>
</div>

              <div style={{ display: 'flex', gap: 8 }}>
                {/* show chevron state */}

              </div>
            </div>

            {expanded[name] && (
              <div style={{ marginTop: 12 }}>
                {Object.keys(days).sort((a,b)=>Number(a)-Number(b)).map(d => (
                  <div key={d} style={{ marginBottom: 15 }}>
                    <div className="text-secondary" style={{ fontWeight: 800,  fontSize: 15 }}>Day {d}</div>
                    <div className="divider" />
<div className="grid exercises" style={{ width: '100%', minWidth: 0 }}>
  {days[d].map(ex => (
    <div
      className="kpi"
      style={{
        fontSize: 13,
        fontWeight: 600,
        marginBottom: -2,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        minWidth: 0,  // this prevents flex children from forcing overflow
      }}
      key={`${name}-${d}-${ex.exercise}`}
    >
      <span
        className="exercise-name"
        style={{
          display: 'block',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 'calc(100% - 60px)', // leave room for sets × reps
        }}
      >
        {String(ex.exercise).toUpperCase()}
      </span>
      <strong
        className="sr"
        style={{
          fontWeight: 400,
          marginLeft: 8,
	  fontSize: 13,
          whiteSpace: 'nowrap',
          flexShrink: 0, // prevent shrinking
        }}
      >
        {ex.sets} × {ex.targetReps || '—'}
      </strong>
    </div>
  ))}
</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
