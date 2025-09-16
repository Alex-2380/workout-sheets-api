// pages/change-routine.js
import { useEffect, useState } from 'react';
import { storage } from '../utils/storage';
import { sheets } from '../utils/sheetsClient';
import RoutineList from '../components/RoutineList';
import RoutineBuilder from '../components/RoutineBuilder';

export default function ChangeRoutine() {
  const user = storage.getUser();
  const [users, setUsers] = useState(storage.getCachedUsers());
  const [routines, setRoutines] = useState(storage.getCachedRoutines());
  const me = users.find(u => u.name === user?.name);

  // UI mode: 'home' | 'view' | 'create'
  const [mode, setMode] = useState('home');

  // Selected routine for the top selector (moved from settings)
  const [selectedRoutine, setSelectedRoutine] = useState(me?.routine || '');
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [savedRoutine, setSavedRoutine] = useState(false);
  const [routineError, setRoutineError] = useState('');

  useEffect(() => {
    if (!user) { window.location.href = '/'; return; }
    // refresh
    sheets.getUsers().then(list => { storage.cacheUsers(list); setUsers(list); }).catch(()=>{});
    sheets.getRoutines().then(rows => { storage.cacheRoutines(rows); setRoutines(rows); }).catch(()=>{});
    // load exercises too (builder will also load them)
  }, []);

  useEffect(() => {
    const meNow = (users || []).find(u => u.name === user?.name);
    if (meNow && typeof meNow.routine !== 'undefined' && meNow.routine !== selectedRoutine) {
      setSelectedRoutine(meNow.routine || '');
    }
  }, [users]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveRoutine() {
    if (!user) return;
    const routineToSave = selectedRoutine || '';

    const currentMe = users.find(u => u.name === user?.name);
    if (routineToSave === (currentMe?.routine || '')) {
      setSavedRoutine(true);
      setTimeout(() => setSavedRoutine(false), 1500);
      return;
    }

    setSavingRoutine(true);
    setRoutineError('');
    try {
      const current = storage.getCachedUsers() || [];
      const updated = current.map(u => u.name === user.name ? { ...u, routine: routineToSave } : u);
      storage.cacheUsers(updated);
      setUsers(updated);
    } catch (err) {}

    try {
      let ok = false;
      if (typeof sheets.setUserRoutine === 'function') {
        ok = await sheets.setUserRoutine(user.name, routineToSave);
      } else {
        const resp = await fetch(`/api/sheets?tab=Users`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            keyColumn: 'Users',
            keyValue: user.name,
            set: { 'Current Routine': routineToSave }
          })
        });
        ok = resp.ok;
      }

      if (!ok) throw new Error('Server update failed');

      try {
        const list = await sheets.getUsers();
        storage.cacheUsers(list);
        setUsers(list);
      } catch (e) {}

      setSavedRoutine(true);
      setTimeout(() => setSavedRoutine(false), 2000);
    } catch (err) {
      console.warn('setUserRoutine failed; local cache updated only.', err);
      setRoutineError((err && err.message) ? err.message : 'Save failed');
      setTimeout(() => setRoutineError(''), 4000);
    } finally {
      setSavingRoutine(false);
    }
  }

  return (
    <div className="grid fade-in" style={{ maxWidth: '760px', margin: '0 auto' }}>
      <div className="card header-card">
        <div className="h1 title-accent"  style={{ textAlign: 'center', fontSize: 25 }}>Change Routine</div>
      </div>

      {/* Top selector (moved from settings) */}
      <div className="card">
        <div className="h2">Current Routine</div>

        <input
          placeholder="— select a routine —"
          list="routine-list-main"
          value={selectedRoutine}
          onChange={e => setSelectedRoutine(e.target.value)}
          onFocus={e => {
            if (selectedRoutine === (me?.routine || '')) setSelectedRoutine('');
          }}
          onBlur={e => {
            if (!e.target.value || String(e.target.value).trim() === '') {
              setSelectedRoutine(me?.routine || '');
            }
          }}
          style={{
            width: '100%',
            marginBottom: 8,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid var(--input-border)',
            background: 'var(--input-bg)',
            color: 'var(--text)',
            boxSizing: 'border-box'
          }}
          aria-label="Select routine"
        />
        <datalist id="routine-list-main">
          {Array.from(new Set((routines || []).map(r => r.routine)))
            .filter(Boolean)
            .sort((a,b) => a.localeCompare(b))
            .map(name => (
              <option key={name} value={name} />
            ))
          }
        </datalist>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <button
            className="primary"
            onClick={saveRoutine}
            style={{ flex: '0 0 auto' }}
            disabled={savingRoutine}
          >
            {savingRoutine ? 'Saving…' : 'Update Routine'}
          </button>

          <button
            className="ghost"
            onClick={() => setSelectedRoutine(me?.routine || '')}
            style={{ flex: '0 0 auto' }}
          >
            Reset
          </button>

          {savedRoutine && <div style={{ color: 'var(--success)', fontWeight: 700, marginLeft: 8 }}>Saved ✓</div>}
          {savingRoutine && <div style={{ color: 'var(--muted)', marginLeft: 8 }}>Saving…</div>}
          {routineError && <div style={{ color: 'var(--danger)', marginLeft: 8 }}>{routineError}</div>}
        </div>
      </div>

      {/* Home actions as simple buttons (not a card) */}
      {mode === 'home' && (
        <div style={{ marginTop: 12 }}>
<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
  <button className="ghost" style={{ fontWeight: 700 }}onClick={() => setMode('view')}>View Routines</button>
  <button className="secondary" onClick={() => setMode('create')}>Create New Routine</button>
</div>

        </div>
      )}

      {/* View all routines */}
      {mode === 'view' && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button className="ghost" onClick={() => setMode('home')}>Back</button>
          </div>

          <RoutineList
            routines={routines}
            onRefresh={async () => {
              try {
                const rows = await sheets.getRoutines();
                storage.cacheRoutines(rows);
                setRoutines(rows);
              } catch (e) {}
            }}
          />
        </div>
      )}

      {/* Create / Edit routine builder */}
      {mode === 'create' && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button className="ghost" onClick={() => setMode('home')}>Back</button>
          </div>

          <RoutineBuilder
            routines={routines}
            onSaved={async () => {
              // refresh routines list after save
              try {
                const rows = await sheets.getRoutines();
                storage.cacheRoutines(rows);
                setRoutines(rows);
              } catch (e) {}
            }}
          />
        </div>
      )}
    </div>
  );
}
