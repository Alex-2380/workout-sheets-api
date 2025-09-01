// utils/storage.js
const NS = {
  user: 'll_user',
  usersCache: 'll_users_cache',
  routinesCache: 'll_routines_cache',
  dataCache: 'll_data_cache',
  activeWorkout: 'll_active_workout',
  outbox: 'll_outbox'
};

function safeGet(key, fallback = null) {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}
function safeSet(key, value) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}
function safeRemove(key) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
}

function emitUserChanged() {
  try { window.dispatchEvent(new Event('ll:user:changed')); } catch (e) { /* noop */ }
}

export const storage = {
  getUser() { return safeGet(NS.user); },
  setUser(u) { safeSet(NS.user, u); emitUserChanged(); },
  clearUser() { safeRemove(NS.user); emitUserChanged(); },

  cacheUsers(list) { safeSet(NS.usersCache, list); },
  getCachedUsers() { return safeGet(NS.usersCache, []); },

  cacheRoutines(rows) { safeSet(NS.routinesCache, rows); },
  getCachedRoutines() { return safeGet(NS.routinesCache, []); },

  cacheUserData(username, rows) {
    const m = safeGet(NS.dataCache, {});
    m[username] = rows;
    safeSet(NS.dataCache, m);
  },
  getCachedUserData(username) {
    const m = safeGet(NS.dataCache, {});
    return m[username] || [];
  },

  getActiveWorkout(username) {
    const m = safeGet(NS.activeWorkout, {});
    return m[username] || null;
  },
  setActiveWorkout(username, workout) {
    const m = safeGet(NS.activeWorkout, {});
    m[username] = workout;
    safeSet(NS.activeWorkout, m);
  },
  clearActiveWorkout(username) {
    const m = safeGet(NS.activeWorkout, {});
    delete m[username];
    safeSet(NS.activeWorkout, m);
  },

  getOutbox(username) {
    const m = safeGet(NS.outbox, {});
    return m[username] || [];
  },
  pushOutbox(username, record) {
    const m = safeGet(NS.outbox, {});
    if (!m[username]) m[username] = [];
    m[username].push(record);
    safeSet(NS.outbox, m);
  },
  clearOutbox(username) {
    const m = safeGet(NS.outbox, {});
    m[username] = [];
    safeSet(NS.outbox, m);
  }
};