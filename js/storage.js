// Camada de armazenamento. Hoje usa localStorage; depois pode ser trocada
// por um adapter que fala com a API na AWS mantendo a mesma interface.

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
    const sessions = read(SESSIONS_KEY, []);
    sessions.push(session);
    write(SESSIONS_KEY, sessions);
    return session;
  },
  async deleteSession(id) {
    write(SESSIONS_KEY, read(SESSIONS_KEY, []).filter((s) => s.id !== id));
  },
  async replaceAll(sessions) {
    write(SESSIONS_KEY, sessions);
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

export const storage = localAdapter;
