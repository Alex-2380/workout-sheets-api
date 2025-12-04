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
                      {days[d].map(ex => {
                        const raw = ex.targetReps ?? '';
                        const val = String(raw);
                        const isMultiline = val.includes('\n');

                        // helper for pluralizing "Set(s)"
                        const setsCount = ex.sets ?? '';
                        const setsNum = Number(setsCount);
                        const setsLabel =
                          setsCount && !Number.isNaN(setsNum)
                            ? `${setsCount} ${setsNum === 1 ? 'Set' : 'Sets'}`
                            : (setsCount || '—');

                        return (
                          <div
                            className="kpi"
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              marginBottom: -2,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6,
                              minWidth: 0,  // prevents flex children from forcing overflow
                            }}
                            key={`${name}-${d}-${ex.exercise}`}
                          >
                            {/* TOP ROW: exercise name (flexible) + right-side top label (pinned to right) */}
                            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                              <span
                                className="exercise-name"
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  marginRight: 12,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={String(ex.exercise).toUpperCase()}
                              >
                                {String(ex.exercise).toUpperCase()}
                              </span>

                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'flex-end',
                                  whiteSpace: 'nowrap',
                                  marginLeft: 'auto',
                                }}
                              >
                                {/* Single-line: original "sets × targetReps" behavior */}
                                {!isMultiline && (
                                  <strong
                                    className="sr"
                                    style={{
                                      fontWeight: 400,
                                      marginLeft: 8,
                                      fontSize: 13,
                                      whiteSpace: 'nowrap',
                                      flexShrink: 0,
                                    }}
                                  >
                                    {ex.sets} × {val || '—'}
                                  </strong>
                                )}

                                {/* Multiline: show "N Set(s)" (right-aligned on the top row) */}
                                {isMultiline && (
                                  <strong
                                    className="sr"
                                    style={{
                                      fontWeight: 400,
                                      marginLeft: 8,
                                      fontSize: 13,
                                      whiteSpace: 'nowrap',
                                      flexShrink: 0,
                                    }}
                                  >
                                    {setsLabel}
                                  </strong>
                                )}
                              </div>
                            </div>

                            {/* SECOND ROW (only when multiline): spacer left, breakdown on right */}
                            {isMultiline && (
                              <div style={{ display: 'flex', width: '100%' }}>
                                {/* left spacer: lines up under the exercise-name column */}
                                <div style={{ flex: 1, minWidth: 0 }} />

                                {/* right breakdown: sits under the top right label and is right-aligned */}
                                <div
                                  className="target-reps-multiline"
                                  style={{
                                    marginLeft: 12,
                                    whiteSpace: 'pre-line',
                                    textAlign: 'right',
                                    fontSize: '0.95rem',
                                    color: 'var(--muted-color, #666)',
                                    wordBreak: 'break-word'
                                  }}
                                >
                                  {val}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
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
