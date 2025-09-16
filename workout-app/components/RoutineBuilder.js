// components/RoutineBuilder.js
import ReactDOM from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { storage } from '../utils/storage';
import { sheets } from '../utils/sheetsClient';

const DRAFT_KEY = 'routine_draft';

// create stable-ish ids for client-side use
const uniqueId = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const ensureIdsForDays = (daysIn = []) =>
  (daysIn || []).map((d) => ({
    id: d.id || uniqueId('day'),
    exercises: (d.exercises || []).map((ex) => ({
      id: ex.id || uniqueId('ex'),
      exercise: ex.exercise || '',
      sets: ex.sets || '',
      targetReps: ex.targetReps || '',
      _error: ex._error || ''
    }))
  }));

const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
};

export default function RoutineBuilder({ routines = [], onSaved }) {
  const [routineName, setRoutineName] = useState('');
  const [days, setDays] = useState(() => ensureIdsForDays([{ exercises: [] }]));
  const [exerciseCatalog, setExerciseCatalog] = useState([]);
  const [muscleOptions, setMuscleOptions] = useState([]);
  const [addingExerciseName, setAddingExerciseName] = useState('');
  const [addingExercisePrimary, setAddingExercisePrimary] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [error, setError] = useState('');
  const autosaveTimer = useRef(null);
  const [routineNameError, setRoutineNameError] = useState('');
  const [showUseTemplate, setShowUseTemplate] = useState(false);
  const [templateChoice, setTemplateChoice] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  const toastTimer = useRef(null);

  // per-day exercise reordering toggle keyed by day.id
  const [reorderingExercises, setReorderingExercises] = useState({});

  const templates = useMemo(
    () =>
      Array.from(
        new Set(
          (routines || [])
            .map((r) => String(r.routine || '').toUpperCase())
            .filter(Boolean)
        )
      ).sort(),
    [routines]
  );

  // sheet refs used for summary modal behavior (unchanged)
  const sheetCardRef = useRef(null);
  const sheetHeaderRef = useRef(null);
  const sheetBodyRef = useRef(null);

  useEffect(() => {
    const detect = () => setIsMobile(window.innerWidth < 700);
    detect();
    window.addEventListener('resize', detect);
    return () => window.removeEventListener('resize', detect);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const exRows = await sheets.getExercises();
        if (!mounted) return;
        const catalog = Array.from(
          new Set((exRows || []).map((r) => String(r.exercise || '').toUpperCase()).filter(Boolean))
        );
        setExerciseCatalog(catalog);

        const muscles = Array.from(
          new Set((exRows || []).map((r) => String(r.primary || '').toUpperCase()).filter(Boolean))
        );
        setMuscleOptions(muscles);
      } catch (e) {
        console.warn('Failed to load Exercises:', e);
      }

      // template draft fallback
      const tplRaw = localStorage.getItem('routine_draft_template');
      if (tplRaw) {
        try {
          const tpl = JSON.parse(tplRaw);
          if (tpl && tpl.rows && tpl.rows.length) {
            const byDay = {};
            tpl.rows.forEach((r) => {
              const d = r.day === undefined || r.day === null ? 1 : Number(r.day);
              byDay[d] = byDay[d] || [];
              byDay[d].push({
                exercise: String(r.exercise || '').toUpperCase(),
                sets: r.sets || '',
                targetReps: r.targetReps || '',
                _error: ''
              });
            });
            const daysArr = Object.keys(byDay)
              .sort((a, b) => Number(a) - Number(b))
              .map((k) => ({ exercises: byDay[k] }));
            setRoutineName(tpl.fromTemplateName ? `${tpl.fromTemplateName} (copy)` : '');
            setDays(ensureIdsForDays(daysArr.length ? daysArr : [{ exercises: [] }]));
            localStorage.removeItem('routine_draft_template');
            return;
          }
        } catch (e) { /* ignore */ }
      }

      // restore autosaved draft if present
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        try {
          const draft = JSON.parse(raw);
          if (draft && (draft.name || draft.days)) {
            const normalizedDays = ensureIdsForDays(draft.days || [{ exercises: [] }]);
            setRoutineName(draft.name || '');
            setDays(normalizedDays);
            setExerciseCatalog((prev) => Array.from(new Set([...prev, ...(draft.catalog || [])])));
          }
        } catch (e) { /* ignore parse errors */ }
      }
    })();

    return () => { mounted = false; };
  }, [routines]);

  // autosave
  useEffect(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      try {
        const payload = { name: routineName, days, catalog: exerciseCatalog, savedAt: Date.now() };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      } catch (e) {
        console.warn('Failed to autosave draft', e);
      }
    }, 700);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [routineName, days, exerciseCatalog]);

  // toast helpers
  const showToast = (message, type = 'success', ms = 3000) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: true, message, type });
    toastTimer.current = setTimeout(() => {
      setToast((t) => ({ ...t, visible: false }));
      toastTimer.current = null;
    }, ms);
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // summary modal scroll lock
  useEffect(() => {
    if (!showSummary) {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      return;
    }
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const id = setTimeout(() => {
      try {
        if (sheetBodyRef.current) sheetBodyRef.current.scrollTop = 0;
        if (sheetHeaderRef.current) sheetHeaderRef.current.focus();
      } catch (e) {}
    }, 60);

    return () => {
      clearTimeout(id);
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [showSummary]);

  // validation
  const getRowError = (row) => {
    const exName = String(row.exercise || '').trim().toUpperCase();
    if (!exName) return 'Exercise required';
    if (!exerciseCatalog.includes(exName)) return `Exercise not found: ${row.exercise || ''}`;
    if (!row.sets || !/^[1-9]\d*$/.test(String(row.sets))) return 'Sets required';
    if (!row.targetReps || String(row.targetReps).trim() === '') return 'Reps required';
    return '';
  };

  // add exercise (catalog)
  const addExerciseToCatalog = async () => {
    const name = String(addingExerciseName || '').trim().toUpperCase();
    const primary = String(addingExercisePrimary || '').trim().toUpperCase();

    if (!name) { setError('Please enter a valid exercise name.'); return; }
    if (!primary) { setError('Please select a primary muscle group from the dropdown.'); return; }
    if (!muscleOptions.includes(primary)) { setError('Primary muscle must be chosen from existing options.'); return; }
    if (exerciseCatalog.includes(name)) { setError('That exercise already exists in the catalog.'); return; }

    setError('');
    setExerciseCatalog((prev) => Array.from(new Set([name, ...prev])));

    const ok = await sheets.appendExercises([[name, primary]]);
    if (!ok) {
      setExerciseCatalog((prev) => prev.filter((x) => x !== name));
      setError('Failed to persist exercise to server.');
      return;
    }

    setAddingExerciseName('');
    setAddingExercisePrimary('');
    showToast(`Added exercise: ${name}`, 'success', 2500);
    try { alert(`Added exercise: ${name}`); } catch (e) {}
  };

  // day/exercise manipulation (preserve ids)
  const addExerciseRow = (dayIndex) => {
    setDays((prev) => {
      const copy = prev.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) }));
      copy[dayIndex].exercises.push({ id: uniqueId('ex'), exercise: '', sets: '', targetReps: '', _error: '' });
      return copy;
    });
  };

  const removeExerciseRow = (dayIndex, idx) => {
    setDays((prev) => {
      const copy = prev.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) }));
      copy[dayIndex].exercises.splice(idx, 1);
      return copy;
    });
  };

  const updateExerciseCell = (dayIndex, idx, key, val) => {
    setDays((prev) => {
      const copy = prev.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) }));
      if (!copy[dayIndex]) return prev;
      if (key === 'exercise') copy[dayIndex].exercises[idx][key] = String(val || '').toUpperCase();
      else if (key === 'sets') {
        const sanitized = String(val || '').replace(/[^\d]/g, '');
        copy[dayIndex].exercises[idx][key] = sanitized;
      } else copy[dayIndex].exercises[idx][key] = val;
      copy[dayIndex].exercises[idx]._error = '';
      return copy;
    });
  };

  const addDay = () => setDays((prev) => [...prev, { id: uniqueId('day'), exercises: [] }]);

  const removeDay = (dayIndex) => {
    if (!confirm('Remove this day? This will delete exercises on the day.')) return;
    setDays((prev) => prev.filter((_, i) => i !== dayIndex));
  };

  const validateExerciseRow = (dayIndex, idx) => {
    const row = (days[dayIndex] && days[dayIndex].exercises && days[dayIndex].exercises[idx]) || null;
    if (!row) return;
    const err = getRowError(row);
    setDays((prev) => {
      const copy = prev.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) }));
      if (!copy[dayIndex] || !copy[dayIndex].exercises[idx]) return prev;
      copy[dayIndex].exercises[idx]._error = err;
      return copy;
    });
    return err;
  };

  const validateForSave = () => {
    if (!routineName || String(routineName).trim() === '') return 'Routine name is required.';
    const existingNames = Array.from(
      new Set((routines || []).map((r) => String(r.routine || '').toUpperCase()).filter(Boolean))
    );
    if (existingNames.includes(String(routineName || '').toUpperCase())) {
      return `A routine named "${routineName}" already exists. Choose a different name or use a template.`;
    }

    const hasAnyExercise = days.some((d) => (d.exercises || []).some((e) => e.exercise && e.exercise.trim()));
    if (!hasAnyExercise) return 'At least one exercise is required.';

    let foundError = false;
    setDays((prev) => {
      const copy = prev.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) }));
      for (let di = 0; di < copy.length; di++) {
        for (let ei = 0; ei < (copy[di].exercises || []).length; ei++) {
          const row = copy[di].exercises[ei];
          const err = getRowError(row);
          row._error = err;
          if (err) foundError = true;
        }
      }
      return copy;
    });

    if (foundError) return 'Please fix the highlighted inputs before saving.';
    return null;
  };

  const clearDraft = () => localStorage.removeItem(DRAFT_KEY);

  const handleCancel = () => {
    if (!confirm('Are you sure you want to cancel? You will lose all unsaved data.')) return;
    clearDraft();
    setRoutineName('');
    setDays([{ id: uniqueId('day'), exercises: [] }]);
    setExerciseCatalog((prev) => prev);
  };

  const buildRowsForSheet = () => {
    const name = String(routineName || '').trim().toUpperCase();
    const rows = [];
    (days || []).forEach((d, di) => {
      (d.exercises || []).forEach((ex) => {
        if (!ex.exercise || !String(ex.exercise).trim()) return;
        rows.push([name, String(di + 1), String(ex.exercise).toUpperCase(), String(ex.sets || ''), String(ex.targetReps || '')]);
      });
    });
    return rows;
  };

  const hasValidationErrors = useMemo(() => {
    for (let di = 0; di < days.length; di++) {
      const d = days[di];
      for (let ei = 0; ei < (d.exercises || []).length; ei++) {
        const r = d.exercises[ei];
        const err = getRowError(r);
        if (err) return true;
      }
    }
    return false;
  }, [days, exerciseCatalog]);

  const handleSaveConfirm = async () => {
    const err = validateForSave();
    if (err) {
      setError(err);
      showToast(err, 'error', 2800);
      setShowSummary(false);
      return;
    }

    const rows = buildRowsForSheet();
    if (!rows.length) {
      setError('No exercises to save.');
      showToast('No exercises to save.', 'error', 2200);
      setShowSummary(false);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const ok = await sheets.appendRoutines(rows);
      if (!ok) throw new Error('Save to server failed');

      try {
        const updated = await sheets.getRoutines();
        storage.cacheRoutines(updated);
      } catch (e) {}

      clearDraft();
      setSaving(false);
      setShowSummary(false);
      if (onSaved) onSaved();
      showToast('Routine saved', 'success', 2200);
      try { alert('Routine saved!'); } catch (e) {}
      setRoutineName('');
      setDays([{ id: uniqueId('day'), exercises: [] }]);
    } catch (e) {
      console.error(e);
      setError((e && e.message) ? e.message : 'Save failed');
      showToast((e && e.message) ? e.message : 'Save failed', 'error', 3000);
      setSaving(false);
    }
  };

  const draftSummary = useMemo(() => {
    const totalExercises = days.reduce((acc, d) => acc + (d.exercises ? d.exercises.filter((e) => e.exercise && e.exercise.trim()).length : 0), 0);
    return { days: days.length, totalExercises, name: routineName };
  }, [days, routineName]);

  // apply template
  const applyTemplate = (templateName) => {
    if (!templateName) { setError('Select a template'); return; }
    const pick = (routines || []).filter((r) => String(r.routine || '').toUpperCase() === String(templateName || '').toUpperCase());
    if (!pick || !pick.length) return;
    const byDay = {};
    pick.forEach((r) => {
      const d = Number(r.day || 1);
      byDay[d] = byDay[d] || [];
      byDay[d].push({
        exercise: String(r.exercise || '').toUpperCase(),
        sets: r.sets || '',
        targetReps: r.targetReps || '',
        _error: ''
      });
    });
    const daysArr = Object.keys(byDay).sort((a, b) => Number(a) - Number(b)).map((k) => ({ exercises: byDay[k] }));
    setDays(ensureIdsForDays(daysArr.length ? daysArr : [{ exercises: [] }]));
    setRoutineName(`${templateName} (copy)`.toUpperCase());
    setShowUseTemplate(false);
  };

  const onExerciseBlur = (dayIndex, idx) => {
    validateExerciseRow(dayIndex, idx);
  };

  const renderDayErrors = (day) => {
    const errors = (day.exercises || []).map((r, i) => ({ idx: i + 1, msg: r._error || getRowError(r) })).filter(x => x.msg);
    if (!errors.length) {
      return <div style={{ minHeight: 20 }} />;
    }
    const toShow = errors.slice(0, 3);
    return (
      <div style={{ minHeight: 20, color: 'var(--danger)', fontSize: 13 }}>
        {toShow.map(e => <div key={e.idx} style={{ lineHeight: '16px' }}>{`#${e.idx}: ${e.msg}`}</div>)}
        {errors.length > toShow.length && <div style={{ lineHeight: '16px' }}>...and {errors.length - toShow.length} more</div>}
      </div>
    );
  };

  // ---------------- Drag & Drop helpers & pointer-follow placeholder ----------------
  // state for pointer-following placeholder
  const [draggingInfo, setDraggingInfo] = useState({
    isDragging: false,
    id: null,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    text: ''
  });

  // store pointer offset so placeholder lines up with pointer where item was grabbed
  const pointerOffsetRef = useRef({ offsetX: 0, offsetY: 0 });
  // store pointer move handler so we can remove it on cleanup
  const pointerMoveHandlerRef = useRef(null);

  const findExerciseTextById = (id) => {
    for (let di = 0; di < days.length; di++) {
      const ex = (days[di].exercises || []).find((e) => e.id === id);
      if (ex) return `${String(ex.exercise || '').toUpperCase()} ${ex.sets ? `• ${ex.sets}×${ex.targetReps || '—'}` : ''}`.trim();
    }
    return '';
  };

  // capture pointer position & offset when the user presses the drag handle (before the RBD drag begins)
  const handlePointerDownOnHandle = (ev, exId) => {
    try {
      const isTouch = ev && ev.touches;
      const clientX = isTouch ? ev.touches[0].clientX : ev.clientX;
      const clientY = isTouch ? ev.touches[0].clientY : ev.clientY;
      const el = document.querySelector(`[data-rbd-draggable-id="${exId}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        pointerOffsetRef.current = { offsetX: clientX - r.left, offsetY: clientY - r.top };
      } else {
        pointerOffsetRef.current = { offsetX: 0, offsetY: 0 };
      }
    } catch (e) {
      pointerOffsetRef.current = { offsetX: 0, offsetY: 0 };
    }
  };

  // Drag start: enable body drag class and begin following pointer
  const onDragStart = (start) => {
    try {
      document.body.classList.add('rb-dragging');
      document.body.style.touchAction = 'none';
      document.body.style.userSelect = 'none';
    } catch (e) {}

    // find bounding rect for initial sizing & content
    const draggableId = start && start.draggableId;
    if (!draggableId) return;

    const el = typeof document !== 'undefined' ? document.querySelector(`[data-rbd-draggable-id="${draggableId}"]`) : null;
    const rect = el ? el.getBoundingClientRect() : { width: 200, height: 48, left: 0, top: 0 };
    const text = findExerciseTextById(draggableId) || '';

    // set initial placeholder position (use rect left/top as fallback)
    setDraggingInfo({
      isDragging: true,
      id: draggableId,
      width: rect.width,
      height: rect.height,
      x: rect.left,
      y: rect.top,
      text
    });

    // pointer move handler updates placeholder position
    const onPointerMove = (e) => {
      const isTouch = e && e.touches;
      const clientX = isTouch ? e.touches[0].clientX : e.clientX;
      const clientY = isTouch ? e.touches[0].clientY : e.clientY;
      const left = clientX - (pointerOffsetRef.current.offsetX || 0);
      const top = clientY - (pointerOffsetRef.current.offsetY || 0);
      // keep it on screen bounds (simple clamp)
      const clampedX = Math.max(0, Math.min(window.innerWidth - (rect.width || 40), left));
      const clampedY = Math.max(0, Math.min(window.innerHeight - (rect.height || 20), top));
      setDraggingInfo((prev) => ({ ...prev, x: clampedX, y: clampedY }));
    };

    pointerMoveHandlerRef.current = onPointerMove;
    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('touchmove', onPointerMove, { passive: true });
  };

  // Drag end: cleanup and perform reorder logic (reorder handled separately in onDragEnd below)
  const onDragEnd = (result) => {
    // always remove pointer listeners + body drag class early
    try {
      if (pointerMoveHandlerRef.current) {
        document.removeEventListener('mousemove', pointerMoveHandlerRef.current);
        document.removeEventListener('touchmove', pointerMoveHandlerRef.current);
        pointerMoveHandlerRef.current = null;
      }
    } catch (e) {}
    try {
      document.body.classList.remove('rb-dragging');
      document.body.style.touchAction = '';
      document.body.style.userSelect = '';
    } catch (e) {}

    // stop rendering portal placeholder
    setDraggingInfo({ isDragging: false, id: null, width: 0, height: 0, x: 0, y: 0, text: '' });

    if (!result || !result.destination) return;

    const { source, destination, type } = result;

    // Only one type used: EXERCISES (we removed day DnD).
    if (type === 'EXERCISES') {
      const srcDayId = source.droppableId.replace('exercises-', '');
      const destDayId = destination.droppableId.replace('exercises-', '');

      setDays((prev) => {
        const copy = prev.map((d) => ({ ...d, exercises: d.exercises.map(e => ({ ...e })) }));
        const srcIdx = copy.findIndex(d => d.id === srcDayId);
        const destIdx = copy.findIndex(d => d.id === destDayId);
        if (srcIdx === -1 || destIdx === -1) return prev;

        if (srcIdx === destIdx) {
          copy[srcIdx].exercises = reorder(copy[srcIdx].exercises, source.index, destination.index);
        } else {
          const [moved] = copy[srcIdx].exercises.splice(source.index, 1);
          copy[destIdx].exercises.splice(destination.index, 0, moved);
        }
        return copy;
      });
    }
  };

  // ------------------------------------------------------------

  return (
    <div className="card" style={{ paddingBottom: 20, paddingLeft: 8, paddingRight: 8, boxSizing: 'border-box' }}>
      {/* Scoped drag-time styles only while dragging */}
      <style>{`
        /* while dragging we avoid transforms on app root containers that break rbd positioning */
        body.rb-dragging {
          -webkit-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
          touch-action: none !important;
        }
        body.rb-dragging #__next,
        body.rb-dragging #root,
        body.rb-dragging .card,
        body.rb-dragging .grid,
        body.rb-dragging .row {
          transform: none !important;
          transition: none !important;
          will-change: auto !important;
        }
      `}</style>

      {/* Pointer-following placeholder rendered in a portal so transforms won't affect it */}
      {typeof document !== 'undefined' && draggingInfo.isDragging && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed',
            left: Math.round(draggingInfo.x),
            top: Math.round(draggingInfo.y),
            width: draggingInfo.width || 220,
            height: draggingInfo.height || 48,
            pointerEvents: 'none',
            zIndex: 14000,
            boxSizing: 'border-box',
            borderRadius: 8,
            background: 'var(--input-bg)',
            border: '1px solid var(--input-border)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            padding: '6px 10px',
            fontWeight: 600,
            color: 'var(--text)',
            transform: 'translateZ(0)'
          }}
        >
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', fontSize: 13 }}>
            {draggingInfo.text || 'Moving…'}
          </div>
        </div>,
        document.body
      )}

      {/* TOAST */}
      {toast.visible && (
        <div style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 12000,
          padding: '10px 14px',
          borderRadius: 10,
          background: toast.type === 'success' ? '#0b7a38' : (toast.type === 'error' ? '#b91c1c' : '#2563eb'),
          color: 'white',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)'
        }}>
          {toast.message}
        </div>
      )}

      <div className="h2" style={{ color: 'var(--secondary)' }}>Create New Routine</div>
      <div style={{ marginTop: 8, fontSize: 14 , color: 'var(--muted)' }}>
        Start from a template or create a new routine from scratch. Draft auto-saves while you edit.
      </div>

      {/* Template / add-exercise sections (unchanged) */}
      <div style={{ marginTop: 12 }}>
        <button className="ghost" style={{ fontSize: 15, padding: 8, borderRadius: 8 }} onClick={() => { setShowUseTemplate((prev) => !prev); }}>
          {showUseTemplate ? 'Close Template' : 'Use Template'}
        </button>

        {showUseTemplate && (
          <div style={{ marginTop: 8 }}>
            <div style={{ marginBottom: 8 }}>Select a routine to use as a template:</div>
            <div style={{ position: 'relative', maxWidth: 480 }}>
              <input
                placeholder="— choose a template —"
                list="template-list"
                value={templateChoice}
                onChange={(e) => setTemplateChoice(String(e.target.value || ''))}
                style={{
                  width: '100%',
                  marginBottom: 8,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--input-border)',
                  background: 'var(--input-bg)',
                  color: 'var(--text)',
                  boxSizing: 'border-box',
                  textTransform: 'uppercase'
                }}
                aria-label="Select template"
              />
              <datalist id="template-list">
                {templates.map((t) => <option key={t} value={t} />)}
              </datalist>
            </div>

            <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="primary" style={{ fontSize: 15, padding: 8, borderRadius: 8 }}onClick={() => applyTemplate(templateChoice)}>Add</button>
              <button className="ghost" style={{ fontSize: 15, padding: 8, borderRadius: 8 }}onClick={() => { setTemplateChoice(''); setShowUseTemplate(false); }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 8, fontSize: 14 , color: 'var(--muted)' }}>
        If an exercise is not in the list you can open "Add New Exercise"
      </div>

      <div style={{ marginTop: 12 }}>
        <button className="ghost" style={{ fontSize: 15, padding: 8, borderRadius: 8 }}onClick={() => setShowAddExercise((s) => !s)}>{showAddExercise ? 'Close Add Exercise' : 'Add New Exercise'}</button>

        {showAddExercise && (
          <div style={{ marginTop: 8 }}>
            <label className="text-secondary" style={{ fontWeight: 700 }}>ADD A NEW EXERCISE</label>
            <div style={{ marginTop: 6, marginBottom: 8, color: 'var(--muted)', fontSize: 12 }}>
              If the exercise doesn't exist, add it here. Do not create duplicates.
            </div>

            <div style={{
              display: 'flex',
              gap: 8,
              marginTop: 6,
              alignItems: 'center',
              flexWrap: isMobile ? 'nowrap' : 'wrap',
              position: 'relative'
            }}>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <input
                  list="exercise-catalog-list"
                  value={addingExerciseName}
                  onChange={(e) => {
                    setAddingExerciseName(String(e.target.value || '').toUpperCase());
                    setError('');
                  }}
                  placeholder="E.g. FRONT SQUAT"
                  style={{
                    width: '100%',
                    padding: 8,
                    borderRadius: 8,
                    border: '1px solid var(--input-border)',
                    textTransform: 'uppercase',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap'
                  }}
                />
                <datalist id="exercise-catalog-list">
                  {exerciseCatalog.map((name) => <option key={name} value={name} />)}
                </datalist>
              </div>

              <div style={{ width: 110, minWidth: 80 }}>
                <input
                  placeholder="MUSCLE"
                  list="muscle-list"
                  value={addingExercisePrimary}
                  onChange={(e) => {
                    setAddingExercisePrimary(String(e.target.value || '').toUpperCase());
                    setError('');
                  }}
                  style={{
                    width: '100%',
                    padding: 8,
                    borderRadius: 8,
                    border: '1px solid var(--input-border)',
                    textTransform: 'uppercase',
                    boxSizing: 'border-box',
                    background: 'var(--input-bg)'
                  }}
                />
                <datalist id="muscle-list">
                  {muscleOptions.map((m) => <option key={m} value={m} />)}
                </datalist>
              </div>

              {!isMobile && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="primary" style={{ fontSize: 15, padding: 8, borderRadius: 8 }} onClick={addExerciseToCatalog}>Add</button>
                  <button className="ghost" style={{ fontSize: 15, padding: 8, borderRadius: 8 }} onClick={() => { setAddingExerciseName(''); setAddingExercisePrimary(''); }}>Clear</button>
                </div>
              )}
            </div>

            {isMobile && (
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button className="primary" style={{ fontSize: 15, padding: 8, borderRadius: 8 }}onClick={addExerciseToCatalog}>Add</button>
                <button className="ghost" style={{ fontSize: 15, padding: 8, borderRadius: 8 }}onClick={() => { setAddingExerciseName(''); setAddingExercisePrimary(''); }}>Clear</button>
              </div>
            )}

            {error && <div style={{ color: 'var(--danger)', marginTop: 8 }}>{error}</div>}
          </div>
        )}
      </div>

      <hr style={{ margin: '16px 0' }} />

      {/* routine name */}
      <div style={{ marginTop: 30 }}>
        <label className="text-accent" style={{ fontWeight: 700 }}>ROUTINE NAME</label>
        <div style={{ position: 'relative', maxWidth: 720 }}>
          <input
            value={routineName}
            onChange={(e) => {
              const value = String(e.target.value || '').toUpperCase();
              setRoutineName(value);

              if (!value.trim()) {
                setRoutineNameError('Routine name is required.');
              } else if (
                routines.some(r => String(r.routine || '').toUpperCase() === value)
              ) {
                setRoutineNameError(`A routine named "${value}" already exists. Choose a different name or use a template.`);
              } else {
                setRoutineNameError('');
              }
            }}
            placeholder="E.g. 4-DAY STRENGTH"
            list="routine-name-list"
            style={{
              width: '100%',
              padding: 8,
              marginTop: 6,
              borderRadius: 8,
              border: '1px solid var(--input-border)',
              textTransform: 'uppercase',
              boxSizing: 'border-box'
            }}
          />
          {routineNameError && (
            <div style={{ color: 'var(--danger)', marginTop: 6, fontSize: 13 }}>
              {routineNameError}
            </div>
          )}
          <datalist id="routine-name-list">
            {Array.from(new Set((routines || []).map((r) => String(r.routine || '').toUpperCase()).filter(Boolean))).map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>

        <div style={{ marginTop: 6, color: 'var(--muted)', fontSize: 13 }}>
          Suggestions shown to help avoid duplicate routine names.
        </div>
      </div>

      <hr style={{ margin: '12px 0' }} />

      {/* Days editor */}
      <div>
        {/* DragDropContext wraps exercises-only droppables */}
        <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
          {days.map((d, dayIndex) => (
            <div key={d.id} className="card" style={{ marginBottom: 10, boxSizing: 'border-box', padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="h3" style={{ color: 'var(--secondary)' }}>DAY {dayIndex + 1}</div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="ghost"
                    style={{ padding: 6, borderRadius: 8, fontSize: 13 }}
                    onClick={() => setReorderingExercises(prev => ({ ...prev, [d.id]: !prev[d.id] }))}
                  >
                    {reorderingExercises[d.id] ? 'Done Reordering' : 'Rearrange Exercises'}
                  </button>

                  <button className="ghost" style={{ padding: 4, marginRight: 15, fontSize: 25, border: 0 }} onClick={() => removeDay(dayIndex)} disabled={days.length === 1} title="Remove day">−</button>
                </div>
              </div>

              <div className="divider" />

              <div style={{ marginTop: 8 }}>
                <Droppable droppableId={`exercises-${d.id}`} type="EXERCISES">
                  {(providedEx) => (
                    <div ref={providedEx.innerRef} {...providedEx.droppableProps} style={{ minHeight: 48 }}>
                      {(d.exercises || []).map((ex, idx) => (
                        <Draggable
                          key={ex.id}
                          draggableId={ex.id}
                          index={idx}
                          isDragDisabled={!reorderingExercises[d.id]}
                        >
                          {(providedExItem, snapshot) => {
                            // base user style for exercise row (kept intact)
                            const userExStyle = {
                              display: 'flex',
                              gap: 6,
                              alignItems: 'center',
                              marginBottom: 6,
                              flexWrap: 'nowrap',
                              width: '100%',
                              position: 'relative' // helps prevent stacking artifacts
                            };

                            // react-beautiful-dnd provides draggable style; merge it
                            const providedStyle = providedExItem.draggableProps.style || {};

                            // hide the library's floating clone by making the original invisible while dragging
                            const draggingStyle = snapshot.isDragging ? { opacity: 0, top: 0, left: 0, bottom: 0, right: 0, position: 'relative' } : {};

                            const exCombinedStyle = { ...userExStyle, ...providedStyle, ...draggingStyle };

                            // merge dragHandleProps but ensure our onMouseDown/onTouchStart run first
                            const dragHandleProps = providedExItem.dragHandleProps || {};

                            return (
                              <div
                                ref={providedExItem.innerRef}
                                {...providedExItem.draggableProps}
                                style={exCombinedStyle}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                                  {reorderingExercises[d.id] ? (
                                    <div
                                      {...dragHandleProps}
                                      onMouseDown={(e) => {
                                        handlePointerDownOnHandle(e, ex.id);
                                        if (dragHandleProps && dragHandleProps.onMouseDown) dragHandleProps.onMouseDown(e);
                                      }}
                                      onTouchStart={(e) => {
                                        handlePointerDownOnHandle(e, ex.id);
                                        if (dragHandleProps && dragHandleProps.onTouchStart) dragHandleProps.onTouchStart(e);
                                      }}
                                      style={{ cursor: 'grab', padding: 6, userSelect: 'none' }}
                                      title="Drag to reorder exercise"
                                    >
                                      ⋮
                                    </div>
                                  ) : null}

                                  <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                                    <input
                                      placeholder="EXERCISE"
                                      list={`exercise-list-${d.id}`}
                                      value={ex.exercise || ''}
                                      onChange={(e) => updateExerciseCell(dayIndex, idx, 'exercise', e.target.value)}
                                      onBlur={() => onExerciseBlur(dayIndex, idx)}
                                      style={{
                                        width: '100%',
                                        padding: 6,
                                        paddingRight: 6,
                                        borderRadius: 8,
                                        fontSize: 12,
                                        border: ex._error ? '1px solid var(--danger)' : '1px solid var(--input-border)',
                                        textTransform: 'uppercase',
                                        boxSizing: 'border-box',
                                        overflow: 'hidden',
                                        whiteSpace: 'nowrap',
                                      }}
                                    />
                                    <datalist id={`exercise-list-${d.id}`}>
                                      {exerciseCatalog.map((name) => <option key={name} value={name} />)}
                                    </datalist>
                                  </div>

                                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                    <div style={{ width: isMobile ? 45 : 80, minWidth: 45 }}>
                                      <input
                                        placeholder="SETS"
                                        title="Sets"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={ex.sets || ''}
                                        onChange={(e) => updateExerciseCell(dayIndex, idx, 'sets', e.target.value)}
                                        onBlur={() => onExerciseBlur(dayIndex, idx)}
                                        style={{ width: '100%', fontSize: 12, padding: 6, borderRadius: 8, border: ex._error ? '1px solid var(--danger)' : '1px solid var(--input-border)', boxSizing: 'border-box', textAlign: 'center' }}
                                      />
                                    </div>

                                    <div style={{ width: isMobile ? 60 : 110 }}>
                                      <input
                                        placeholder="REPS"
                                        title="Reps"
                                        value={ex.targetReps || ''}
                                        onChange={(e) => updateExerciseCell(dayIndex, idx, 'targetReps', e.target.value)}
                                        onBlur={() => onExerciseBlur(dayIndex, idx)}
                                        style={{ width: '100%', fontSize: 12, padding: 6, borderRadius: 8, border: ex._error ? '1px solid var(--danger)' : '1px solid var(--input-border)', boxSizing: 'border-box', textAlign: 'center' }}
                                      />
                                    </div>

                                    {!reorderingExercises[d.id] && (
                                      <div>
                                        <button className="ghost" style={{ padding: 4, fontSize: 20, border: 0 }} onClick={() => removeExerciseRow(dayIndex, idx)} title="Remove exercise">−</button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }}
                        </Draggable>
                      ))}
                      {providedEx.placeholder}
                    </div>
                  )}
                </Droppable>

                {(d.exercises || []).length === 0 && (
                  <div style={{ color: 'var(--muted)' }}>No exercises — use the button below to add one.</div>
                )}
              </div>

              <div style={{ marginTop: 8 }}>
                {renderDayErrors(d)}
              </div>

              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button className="ghost" style={{ padding: 8, borderRadius: 8 }} onClick={() => addExerciseRow(dayIndex)}>+ Add Exercise</button>
              </div>
            </div>
          ))}
        </DragDropContext>

        <div style={{ display: 'flex', gap: 8, marginTop: 25, marginBottom: 50, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="ghost" style={{ padding: 8, borderRadius: 8 }} onClick={addDay}>+ Add Day</button>
        </div>
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        <button
          className="primary"
          onClick={() => {
            const err = validateForSave();
            if (err) {
              setError(err);
              showToast(err, 'error', 2800);
              return;
            }
            setShowSummary(true);
          }}
          disabled={saving || hasValidationErrors || !routineName}
        >
          Create Routine
        </button>

        <button className="ghost" onClick={handleCancel} disabled={saving}>Cancel</button>

        {saving && <div style={{ color: 'var(--muted)', alignSelf: 'center' }}>Saving…</div>}
      </div>

      {/* Summary sheet (unchanged) */}
      {showSummary && (
        <div className="sheet-overlay" onClick={() => setShowSummary(false)}>
          <div className="sheet-card slide-up" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Review routine" ref={sheetCardRef}>
            <div ref={sheetHeaderRef} tabIndex={-1} style={{ outline: 'none', marginBottom: 8 }}>
              <div className="h2" style={{ marginBottom: 6, color: 'var(--accent)' }}>Routine summary</div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>Review the routine below before saving.</div>
            </div>

            <div className="sheet-body" ref={sheetBodyRef} style={{ padding: '0 16px 16px 16px', overflowY: 'auto', flex: 1, maxHeight: '66vh' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
                <div className="kpi" style={{ padding: '8px 10px' }}>
                  <span style={{ color: 'var(--muted)' }}>Days</span>
                  <strong style={{ marginLeft: 8 }}>{draftSummary.days}</strong>
                </div>
                <div className="kpi" style={{ padding: '8px 10px' }}>
                  <span style={{ color: 'var(--muted)' }}>Exercises</span>
                  <strong style={{ marginLeft: 8 }}>{draftSummary.totalExercises}</strong>
                </div>
                <div style={{ flex: 1 }} />
              </div>

              <div>
                {days.map((d, di) => (
                  <div key={d.id} style={{ marginBottom: 14 }}>
                    <div className="text-secondary" style={{ fontWeight: 800, fontSize: 15 }}>Day {di + 1}</div>
                    <div className="divider" />
                    <div className="grid exercises" style={{ width: '100%', minWidth: 0, marginTop: 8 }}>
                      {(d.exercises || []).map((ex, i) => (
                        ex && ex.exercise && String(ex.exercise).trim() ? (
                          <div className="kpi" key={`day-${di}-ex-${i}`} style={{ fontSize: 13, fontWeight: 600, marginBottom: -2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0, paddingTop: 6, paddingBottom: 6 }}>
                            <span className="exercise-name" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 'calc(100% - 80px)' }}>
                              {String(ex.exercise).toUpperCase()}
                            </span>
                            <strong className="sr" style={{ fontWeight: 400, marginLeft: 8, fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {ex.sets} × {ex.targetReps || '—'}
                            </strong>
                          </div>
                        ) : null
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid rgba(0,0,0,0.04)', boxSizing: 'border-box', justifyContent: 'flex-end', alignItems: 'center' }}>
              <button className="ghost" onClick={() => setShowSummary(false)}>Close</button>
              <button className="primary" onClick={handleSaveConfirm} disabled={saving || hasValidationErrors}>
                {saving ? 'Saving...' : 'Finish & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
