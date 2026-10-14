import { defaultCourses, defaultCups, defaultTees } from './golfCourse';

const STORAGE_KEY = 'maxlift_golf_v1';

function safeRead() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function safeWrite(value) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function profileTemplate() {
  return {
    version: 1,
    tees: defaultTees(),
    cups: defaultCups(),
    courses: defaultCourses(),
    rounds: [],
    activeRoundId: null,
    updatedAt: new Date().toISOString(),
  };
}

function keyFor(username) {
  return String(username || 'local-player').trim().toLowerCase();
}

function getProfile(username) {
  const all = safeRead();
  const key = keyFor(username);
  const profile = all[key] || profileTemplate();
  // Support a partial/older stored profile without discarding the person's rounds.
return {
  ...profileTemplate(),
  ...profile,
  tees: Array.isArray(profile.tees) ? profile.tees : defaultTees(),
  cups: Array.isArray(profile.cups) ? profile.cups : defaultCups(),
  courses: Array.isArray(profile.courses) ? profile.courses : defaultCourses(),
  rounds: Array.isArray(profile.rounds) ? profile.rounds : [],
};
}

function putProfile(username, profile) {
  const all = safeRead();
  all[keyFor(username)] = { ...profile, updatedAt: new Date().toISOString() };
  safeWrite(all);
  return all[keyFor(username)];
}

export function makeId(prefix = 'golf') {
  const random = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

export const golfStorage = {
  load(username) {
    return copy(getProfile(username));
  },

  save(username, profile) {
    return copy(putProfile(username, profile));
  },

  replaceTees(username, tees) {
    const profile = getProfile(username);
    profile.tees = copy(tees);
    return copy(putProfile(username, profile));
  },

  replaceCourses(username, courses) {
    const profile = getProfile(username);
    profile.courses = copy(courses);
    return copy(putProfile(username, profile));
  },

saveRound(username, round) {
  const profile = getProfile(username);
  const now = new Date().toISOString();

  // Only one round can be active for this player at a time.
  if (round.status === 'active') {
    profile.rounds = profile.rounds.map(existing => {
      if (
        existing.id !== round.id &&
        existing.status === 'active'
      ) {
        return {
          ...existing,
          status: 'cancelled',
          cancelledAt: now,
          updatedAt: now,
        };
      }

      return existing;
    });
  }

  const index = profile.rounds.findIndex(item => item.id === round.id);

  if (index >= 0) {
    profile.rounds[index] = copy(round);
  } else {
    profile.rounds.unshift(copy(round));
  }

  if (round.status === 'active') {
    profile.activeRoundId = round.id;
  } else if (profile.activeRoundId === round.id) {
    profile.activeRoundId = null;
  }

  // Recover the active-round pointer if an older profile has a stale ID.
  if (
    !profile.activeRoundId ||
    !profile.rounds.some(
      item =>
        item.id === profile.activeRoundId &&
        item.status === 'active'
    )
  ) {
    const mostRecentActive = profile.rounds.find(
      item => item.status === 'active'
    );

    profile.activeRoundId = mostRecentActive?.id || null;
  }

  return copy(putProfile(username, profile));
},

  getActiveRound(username) {
    const profile = getProfile(username);
    return copy(profile.rounds.find(round => round.id === profile.activeRoundId && round.status === 'active') || null);
  },

mergeRemoteRounds(username, remoteRounds) {
  if (!Array.isArray(remoteRounds)) {
    return this.load(username);
  }

  const profile = getProfile(username);
  const localById = new Map(
    profile.rounds.map(round => [round.id, round])
  );

  remoteRounds.forEach(remote => {
    const local = localById.get(remote.id);

    const localStamp = new Date(
      local?.updatedAt ||
      local?.completedAt ||
      local?.createdAt ||
      0
    ).getTime();

    const remoteStamp = new Date(
      remote?.updatedAt ||
      remote?.completedAt ||
      remote?.createdAt ||
      0
    ).getTime();

    if (!local || remoteStamp > localStamp) {
      localById.set(remote.id, remote);
    }
  });

  profile.rounds = Array.from(localById.values()).sort(
    (a, b) =>
      new Date(b.createdAt || 0) -
      new Date(a.createdAt || 0)
  );

  // Never restore a cancelled round as active.
  const mostRecentActive = profile.rounds.find(
    round => round.status === 'active'
  );

  profile.activeRoundId = mostRecentActive?.id || null;

  return copy(putProfile(username, profile));
},
};
