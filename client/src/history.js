// Saved session summaries (numbers only, never images).
//
// For now they're kept in this browser with localStorage, so history is per
// device/browser profile and is lost if site data is cleared. A later phase
// swaps these four functions for calls to the backend API, and nothing else
// in the app needs to change.

const KEY = 'eyestrain.sessions.v1';
const MAX_SESSIONS = 500; // oldest are dropped beyond this

// Returns an array of summaries (oldest first), or null if storage is
// unavailable (e.g. blocked site data or some private-browsing modes).
export function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return null;
  }
}

function store(sessions) {
  try {
    localStorage.setItem(KEY, JSON.stringify(sessions));
    return true;
  } catch {
    return false;
  }
}

// Returns true if saved.
export function saveSession(summary) {
  const sessions = loadSessions();
  if (!sessions) return false;
  sessions.push({ id: String(summary.startedAt), ...summary });
  sessions.sort((a, b) => a.startedAt - b.startedAt);
  return store(sessions.slice(-MAX_SESSIONS));
}

export function deleteSession(id) {
  const sessions = loadSessions();
  return sessions ? store(sessions.filter((s) => s.id !== id)) : false;
}

export function clearSessions() {
  return store([]);
}
