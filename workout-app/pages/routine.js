// pages/routine-view.js  (or replace your existing file/component)
import { useEffect, useMemo, useState } from 'react';
import { storage } from '../utils/storage';
import { sheets } from '../utils/sheetsClient';

export default function RoutineView() {
  const user = storage.getUser();
  const [users, setUsers] = useState(storage.getCachedUsers());
  const me = users.find(u => u.name === user?.name);
  const [routines, setRoutines] = useState(storage.getCachedRoutines());

  useEffect(() => {
    if (!user) { window.location.href = '/'; return; }
    sheets.getUsers().then(list => { storage.cacheUsers(list); setUsers(list); }).catch(() => {});
    sheets.getRoutines().then(rows => { storage.cacheRoutines(rows); setRoutines(rows); }).catch(() => {});
  }, []);

  const byDay = useMemo(() => {
    const pick = routines.filter(r => r.routine === me?.routine);
    const m = {};
    pick.forEach(r => { (m[r.day] = m[r.day] || []).push(r); });
    return m;
  }, [routines, me?.routine]);

  return (
    <div className="grid fade-in routine-page">
      {/* Centered routine NAME in primary color - responsive + word-safe wrapping */}
      <div className="card header-card">
        <div
          className="h1 title-accent routine-name"
          style={{
            margin: 0,
            textAlign: 'center',
            // scale down on small screens, keep readable on large
            fontSize: 'clamp(18px, 6vw, 28px)',
            lineHeight: 1.05,
            whiteSpace: 'normal',
            // prefer wrapping at word boundaries (avoid mid-word breaks)
            overflowWrap: 'normal',
            wordBreak: 'normal',
            hyphens: 'none',
            // ensure long names still truncate nicely if someone uses a single continuous word:
            maxWidth: '100%',
            wordSpacing: '0.02em'
          }}
          title={me?.routine || ''}
        >
          {me?.routine || '—'}
        </div>
      </div>

      {Object.keys(byDay).sort((a, b) => Number(a) - Number(b)).map(d => (
        <div className="card" key={d}>
          <div className="h2 day-title">Day {d}</div>

          <div className="divider" />

          <div className="grid exercises">
            {byDay[d].map(ex => {
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
                <div className="kpi" key={ex.exercise} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* TOP ROW: exercise name (flexible) + right-side top label (pinned to right) */}
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <span
                      className="exercise-name"
                      style={{
                        flex: 1,
                        minWidth: 0, // critical for ellipsis
                        marginRight: 12,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={ex.exercise}
                    >
                      {ex.exercise}
                    </span>

                    <div
                      style={{
                        // right-side top label only; no multiline content here so it won't affect ellipsis
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {/* Single-line: original "sets × targetReps" behavior */}
                      {!isMultiline && (
                        <strong className="sr">{ex.sets} × {val || '—'}</strong>
                      )}

                      {/* Multiline: show "N Set(s)" (right-aligned on the top row) */}
                      {isMultiline && (
                        <strong className="sr">{setsLabel}</strong>
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
  );
}
