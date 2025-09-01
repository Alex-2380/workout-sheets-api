// utils/sheetsClient.js
// Client for the app to call /api/sheets (same Next app by default), or remote API if NEXT_PUBLIC_API_URL is set.

const PUBLIC_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, ''); // optional external API base (no trailing slash)

function buildUrl(tab) {
  const encoded = encodeURIComponent(tab);
  if (PUBLIC_BASE) return `${PUBLIC_BASE}/sheets?tab=${encoded}`;
  return `/sheets?tab=${encoded}`;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${txt}`);
  }
  return res.json();
}

const safeParseInt = (v) => {
  if (v === undefined || v === null) return 0;
  const s = String(v).trim();
  if (s === '') return 0;
  const cleaned = s.replace(/[^0-9\-]/g, '');
  const n = parseInt(cleaned, 10);
  return Number.isNaN(n) ? 0 : n;
};

const safeParseFloat = (v) => {
  if (v === undefined || v === null) return 0;
  const s = String(v).trim();
  if (s === '') return 0;
  const cleaned = s.replace(/[^\d\.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
};

// Normalizer: if server returns array-of-arrays, we return that. If server returns { headers, rows } object, convert.
function normalizeToTable(response) {
  if (Array.isArray(response)) return response;
  if (!response || typeof response !== 'object') return [];

  if (Array.isArray(response.rows) && Array.isArray(response.headers)) {
    const header = response.headers;
    const rows = response.rows.map(rowObj => header.map(h => {
      if (Object.prototype.hasOwnProperty.call(rowObj, h)) return rowObj[h];
      const lower = String(h).toLowerCase();
      const foundKey = Object.keys(rowObj).find(k => String(k).toLowerCase() === lower);
      return foundKey ? rowObj[foundKey] : '';
    }));
    return [header, ...rows];
  }

  if (Array.isArray(response.rows) && response.rows.length && Array.isArray(response.rows[0])) {
    return response.rows;
  }

  return [];
}

function findHeaderIndex(headerArray, headerName) {
  if (!Array.isArray(headerArray)) return -1;
  const lower = String(headerName).toLowerCase();
  let ix = headerArray.indexOf(headerName);
  if (ix !== -1) return ix;
  ix = headerArray.findIndex(h => String(h).toLowerCase() === lower);
  return ix;
}

export const sheets = {
  async getUsers() {
    const url = buildUrl('Users');
    try {
      const raw = await fetchJson(url);
      const table = normalizeToTable(raw);
      if (!table || table.length < 1) return [];
      const header = table[0];
      const rows = table.slice(1);
      const ixName = findHeaderIndex(header, 'Users') !== -1 ? findHeaderIndex(header, 'Users') : 0;
      const ixRoutine = findHeaderIndex(header, 'Current Routine') !== -1 ? findHeaderIndex(header, 'Current Routine') : 1;
      return rows.map(r => ({ name: String(r[ixName] ?? '').trim(), routine: String(r[ixRoutine] ?? '').trim() })).filter(x => !!x.name);
    } catch (e) {
      console.warn('sheets.getUsers failed:', e.message || e);
      return [];
    }
  },

  async getRoutines() {
    const url = buildUrl('Routines');
    try {
      const raw = await fetchJson(url);
      const table = normalizeToTable(raw);
      if (!table || table.length < 1) return [];
      const header = table[0];
      const rows = table.slice(1);
      const cols = {
        routine: findHeaderIndex(header, 'Routine') !== -1 ? findHeaderIndex(header, 'Routine') : 0,
        day: findHeaderIndex(header, 'Day') !== -1 ? findHeaderIndex(header, 'Day') : 1,
        exercise: findHeaderIndex(header, 'Exercise') !== -1 ? findHeaderIndex(header, 'Exercise') : 2,
        sets: findHeaderIndex(header, 'Sets') !== -1 ? findHeaderIndex(header, 'Sets') : 3,
        targetReps: findHeaderIndex(header, 'Target Reps') !== -1 ? findHeaderIndex(header, 'Target Reps') : 4
      };
      return rows.map(r => {
        const rawSets = r[cols.sets];
        const rawTarget = r[cols.targetReps];
        return {
          routine: r[cols.routine] ?? '',
          day: String(r[cols.day] ?? ''),
          exercise: r[cols.exercise] ?? '',
          sets: safeParseInt(rawSets),
          targetReps: (rawTarget === undefined || rawTarget === null) ? '' : String(rawTarget).trim()
        };
      }).filter(x => !!x.routine && !!x.exercise);
    } catch (e) {
      console.warn('sheets.getRoutines failed:', e.message || e);
      return [];
    }
  },

  async getUserData(username) {
    const tab = `Data (${username})`;
    const url = buildUrl(tab);
    try {
      const raw = await fetchJson(url);
      const table = normalizeToTable(raw);
      if (!table || table.length < 1) return [];
      const header = table[0];
      const rows = table.slice(1);
      const ix = (name) => findHeaderIndex(header, name);
      return rows.map(r => {
        const weightRaw = r[ix('Weight')];
        const setRaw = r[ix('Set')];
        const repsRaw = r[ix('Reps')];
        return {
          user: r[ix('User')],
          routine: r[ix('Routine')],
          day: String(r[ix('Day')] ?? ''),
          exercise: r[ix('Exercise')],
          weight: safeParseFloat(weightRaw),
          set: safeParseInt(setRaw),
          // important: preserve reps as string (AMRAP, 30 sec, ...)
          reps: (repsRaw === undefined || repsRaw === null) ? '' : String(repsRaw).trim(),
          date: r[ix('Date')]
        };
      }).filter(x => !!x.user);
    } catch (e) {
      console.warn('sheets.getUserData failed:', e.message || e);
      return [];
    }
  },

  async appendWorkoutRows(username, rows) {
    const tab = `Data (${username})`;
    const url = buildUrl(tab);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows })
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        console.error('appendWorkoutRows POST failed', res.status, txt);
        throw new Error(`POST failed ${res.status}`);
      }
      return true;
    } catch (e) {
      console.warn('appendWorkoutRows failed:', e.message || e);
      return false;
    }
  },

  // --- NEW: update a user's "Current Routine" in the Users sheet ---
  // Client expects the /api/sheets endpoint (or remote API) to accept a PATCH-like update payload.
  // If your server API is different, you can adapt this implementation to match it.
  async setUserRoutine(username, routine) {
    const url = buildUrl('Users');
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          keyColumn: 'Users',
          keyValue: username,
          set: { 'Current Routine': routine }
        })
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        console.error('setUserRoutine failed', res.status, txt);
        throw new Error(`PATCH failed ${res.status}`);
      }
      return true;
    } catch (e) {
      console.warn('setUserRoutine failed:', e.message || e);
      return false;
    }
  }
};