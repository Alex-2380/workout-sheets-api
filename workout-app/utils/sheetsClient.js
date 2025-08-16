const BASE = process.env.NEXT_PUBLIC_SHEETS_API_URL;

const okBase = () => {
  if (!BASE) throw new Error('Missing NEXT_PUBLIC_SHEETS_API_URL');
  return BASE;
};

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Your API returns array-of-rows for "Routines" and "Users" and "Data(NAME)".
 * We normalize to JS objects.
 */
export const sheets = {
  async getUsers() {
    const base = okBase();
    const data = await getJson(`${base}/api/sheets?tab=Users`);
    // Expect rows: [ ["Users","Current Routine"], ["Alex","BULKY"], ...]
    const [header, ...rows] = data;
    const ixName = header.indexOf('Users') !== -1 ? header.indexOf('Users') : 0;
    const ixRoutine = header.indexOf('Current Routine') !== -1 ? header.indexOf('Current Routine') : 1;
    return rows.map(r => ({ name: r[ixName], routine: r[ixRoutine] })).filter(x => !!x.name);
  },

  async getRoutines() {
    const base = okBase();
    const data = await getJson(`${base}/api/sheets?tab=Routines`);
    const [header, ...rows] = data;
    const cols = {
      routine: header.indexOf('Routine'),
      day: header.indexOf('Day'),
      exercise: header.indexOf('Exercise'),
      sets: header.indexOf('Sets'),
      targetReps: header.indexOf('Target Reps')
    };
    return rows.map(r => ({
      routine: r[cols.routine],
      day: String(r[cols.day]),
      exercise: r[cols.exercise],
      sets: Number(r[cols.sets] || 0),
      targetReps: Number(r[cols.targetReps] || 0)
    })).filter(x => !!x.routine && !!x.exercise);
  },

  async getUserData(username) {
    const base = okBase();
    // Tab format: Data(User) — ex: Data(Alex)
    const tab = `Data(${encodeURIComponent(username)})`;
    const data = await getJson(`${base}/api/sheets?tab=${tab}`);
    const [header, ...rows] = data;
    const ix = (name) => header.indexOf(name);
    return rows.map(r => ({
      user: r[ix('User')],
      routine: r[ix('Routine')],
      day: String(r[ix('Day')]),
      exercise: r[ix('Exercise')],
      weight: Number(r[ix('Weight')] || 0),
      set: Number(r[ix('Set')] || 0),
      reps: Number(r[ix('Reps')] || 0),
      date: r[ix('Date')]
    })).filter(x => !!x.user);
  },

  // Try to push to your API. If your current API doesn't support POST yet,
  // we swallow the error and the caller can queue in outbox.
  async appendWorkoutRows(username, rows) {
    const base = okBase();
    const tab = `Data(${encodeURIComponent(username)})`;
    try {
      const res = await fetch(`${base}/api/sheets?tab=${tab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Expect rows as array of arrays (raw)
        body: JSON.stringify({ rows })
      });
      if (!res.ok) throw new Error(`POST failed ${res.status}`);
      return true;
    } catch (e) {
      return false;
    }
  }
};
