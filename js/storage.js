// Camada de armazenamento: localStorage (sem AWS configurada) ou API na AWS.
import { config } from "./config.js";
import { cloudEnabled, getIdToken, logout } from "./auth.js";

const SESSIONS_KEY = "et.sessions";
const TIMER_KEY = "et.timer";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export const localAdapter = {
  async listSessions() {
    return read(SESSIONS_KEY, []);
  },
  async addSession(session) {
    write(SESSIONS_KEY, [...read(SESSIONS_KEY, []), session]);
  },
  async deleteSession(id) {
    write(SESSIONS_KEY, read(SESSIONS_KEY, []).filter((s) => s.id !== id));
  },
  async importSessions(list) {
    write(SESSIONS_KEY, [...read(SESSIONS_KEY, []), ...list]);
  },
  clear() {
    localStorage.removeItem(SESSIONS_KEY);
  },
};

async function api(method, path, body) {
  const token = await getIdToken();
  const res = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    logout();
    location.reload();
  }
  if (!res.ok) throw new Error(`Erro na API (${res.status})`);
  return res.status === 204 ? null : res.json();
}

export const cloudAdapter = {
  listSessions: () => api("GET", "/sessions"),
  addSession: (session) => api("POST", "/sessions", session),
  deleteSession: (id) => api("DELETE", `/sessions/${encodeURIComponent(id)}`),
  async importSessions(list) {
    for (let i = 0; i < list.length; i += 200) await api("POST", "/sessions", list.slice(i, i + 200));
  },
};

// Estado do cronômetro fica sempre local (é por dispositivo).
export const timerStore = {
  get() {
    return read(TIMER_KEY, null);
  },
  set(state) {
    if (state) write(TIMER_KEY, state);
    else localStorage.removeItem(TIMER_KEY);
  },
};

export const storage = cloudEnabled() ? cloudAdapter : localAdapter;
