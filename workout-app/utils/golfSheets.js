// Golf sync uses the app's existing server-side Google credentials. Local
// storage remains the immediate/offline source of truth, while this module
// mirrors complete immutable round snapshots when the configured Sheet is up.

const PUBLIC_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');
const endpoint = `${PUBLIC_BASE}/api/golf`;

async function request(path = '', options = {}) {
  const response = await fetch(`${endpoint}${path}`, options);
  if (!response.ok) {
    const message = await response.text().catch(() => 'Golf sync unavailable');
    throw new Error(message || `Golf sync failed (${response.status})`);
  }
  return response.json();
}

export const golfSheets = {
  async loadRounds(owner) {
    return request(`?owner=${encodeURIComponent(owner || '')}`);
  },

  async saveRound(owner, round) {
    return request('', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'saveRound', owner, round }),
    });
  },

  async initialize(owner, layout) {
    return request('', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'initialize', owner, layout }),
    });
  },

  async saveLayout(owner, layout) {
    return request('', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'saveLayout', owner, layout }),
    });
  },
};
