import { storage, timerStore, localAdapter } from "./storage.js";
import { cloudEnabled, isLoggedIn, login, logout } from "./auth.js";

const $ = (sel) => document.querySelector(sel);
let sessions = [];

// ---------- utilidades ----------
const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

function pad(n) {
  return String(n).padStart(2, "0");
}

function clock(ms) {
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function human(ms) {
  if (ms > 0 && ms < 60000) return `${Math.round(ms / 1000)}s`;
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h ${pad(m)}min`;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d) {
  const x = startOfDay(d);
  const diff = (x.getDay() + 6) % 7; // semana começa na segunda
  x.setDate(x.getDate() - diff);
  return x;
}

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
const fmtTime = (d) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function toDateInput(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// ---------- abas ----------
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${btn.dataset.view}`));
    render();
  });
});

// ---------- cronômetro ----------
// estado: { startedAt, accumulatedMs, runningSince | null }
let timer = timerStore.get();

function elapsed() {
  if (!timer) return 0;
  return timer.accumulatedMs + (timer.runningSince ? Date.now() - timer.runningSince : 0);
}

function startTimer() {
  const now = Date.now();
  timer = { startedAt: now, accumulatedMs: 0, runningSince: now };
  timerStore.set(timer);
}

function toggleTimer() {
  if (!timer) return startTimer();
  if (timer.runningSince) {
    timer.accumulatedMs += Date.now() - timer.runningSince;
    timer.runningSince = null;
  } else {
    timer.runningSince = Date.now();
  }
  timerStore.set(timer);
}

function pauseTimer() {
  if (timer?.runningSince) toggleTimer();
}

function resetTimer() {
  timer = null;
  timerStore.set(null);
  $("#stop-form").classList.add("hidden");
}

function renderTimer() {
  const card = $(".timer-card");
  const running = !!timer?.runningSince;
  $("#timer-display").textContent = clock(elapsed());
  card.classList.toggle("paused", !running);
  $("#timer-status").textContent = !timer ? "Cronômetro parado" : running ? "Estudando..." : "Pausado";
  $("#timer-since").textContent = timer ? `Iniciado em ${fmtDate(timer.startedAt)} às ${fmtTime(timer.startedAt)}` : "";
  $("#btn-toggle").textContent = !timer ? "Iniciar" : running ? "Pausar" : "Retomar";
  $("#btn-stop").disabled = !timer;
  $("#btn-discard").disabled = !timer;
}

$("#btn-toggle").addEventListener("click", () => {
  toggleTimer();
  renderTimer();
});

$("#btn-stop").addEventListener("click", () => {
  if (!timer) return;
  pauseTimer();
  renderTimer();
  $("#stop-form").classList.remove("hidden");
  $("#stop-name").focus();
});

$("#stop-cancel").addEventListener("click", () => {
  $("#stop-form").classList.add("hidden");
  toggleTimer();
  renderTimer();
});

$("#btn-discard").addEventListener("click", () => {
  if (timer && confirm("Descartar o tempo atual sem salvar?")) {
    resetTimer();
    renderTimer();
  }
});

$("#stop-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const durationMs = elapsed();
  if (durationMs < 1000) return alert("Sessão muito curta.");
  const ok = await saveSession({
    name: $("#stop-name").value.trim(),
    start: new Date(timer.startedAt).toISOString(),
    durationMs,
    source: "timer",
  });
  if (!ok) return;
  $("#stop-name").value = "";
  resetTimer();
  render();
});

// ---------- lançamento manual ----------
$("#manual-date").value = toDateInput(new Date());
$("#manual-date").max = toDateInput(new Date());

$("#manual-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const h = Number($("#manual-hours").value) || 0;
  const m = Number($("#manual-minutes").value) || 0;
  const durationMs = (h * 60 + m) * 60000;
  if (durationMs <= 0) return ($("#manual-msg").textContent = "Informe uma duração maior que zero.");
  const [y, mo, d] = $("#manual-date").value.split("-").map(Number);
  const [hh, mm] = ($("#manual-time").value || "12:00").split(":").map(Number);
  const start = new Date(y, mo - 1, d, hh, mm);
  const name = $("#manual-name").value.trim();
  if (!(await saveSession({ name, start: start.toISOString(), durationMs, source: "manual" }))) return;
  $("#manual-msg").textContent = `Adicionado: ${name} — ${human(durationMs)} em ${fmtDate(start)}.`;
  $("#manual-name").value = "";
  render();
});

// ---------- sessões ----------
async function saveSession(data) {
  const session = { id: uid(), createdAt: new Date().toISOString(), ...data };
  try {
    await storage.addSession(session);
  } catch (e) {
    alert(`Não foi possível salvar: ${e.message}. Tente novamente.`);
    return false;
  }
  sessions.push(session);
  return true;
}

async function deleteSession(id) {
  if (!confirm("Excluir esta sessão?")) return;
  try {
    await storage.deleteSession(id);
  } catch (e) {
    return alert(`Não foi possível excluir: ${e.message}`);
  }
  sessions = sessions.filter((s) => s.id !== id);
  render();
}

function sumSince(from) {
  return sessions.filter((s) => new Date(s.start) >= from).reduce((a, s) => a + s.durationMs, 0);
}

function sessionItem(s, withDelete) {
  const end = new Date(new Date(s.start).getTime() + s.durationMs);
  const badge = s.source === "manual" ? '<span class="badge">manual</span>' : "";
  return `<li>
    <div><div class="name">${escapeHtml(s.name)}${badge}</div>
    <div class="meta">${fmtTime(s.start)} – ${fmtTime(end)}</div></div>
    <div class="row"><span class="dur">${human(s.durationMs)}</span>
    ${withDelete ? `<button class="btn danger" data-del="${s.id}" title="Excluir">✕</button>` : ""}</div>
  </li>`;
}

const sorted = () => [...sessions].sort((a, b) => new Date(b.start) - new Date(a.start));

function renderToday() {
  const today = startOfDay(new Date());
  const list = sorted().filter((s) => new Date(s.start) >= today);
  $("#today-total").textContent = human(sumSince(today));
  $("#today-list").innerHTML = list.length
    ? list.map((s) => sessionItem(s, false)).join("")
    : '<li class="empty">Nenhuma sessão salva hoje.</li>';
}

function renderDashboard() {
  const now = new Date();
  $("#stat-day").textContent = human(sumSince(startOfDay(now)));
  $("#stat-week").textContent = human(sumSince(startOfWeek(now)));
  $("#stat-month").textContent = human(sumSince(new Date(now.getFullYear(), now.getMonth(), 1)));
  $("#stat-year").textContent = human(sumSince(new Date(now.getFullYear(), 0, 1)));
  $("#stat-total").textContent = human(sessions.reduce((a, s) => a + s.durationMs, 0));

  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = startOfDay(now);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const ms = sessions
      .filter((s) => { const t = new Date(s.start); return t >= d && t < next; })
      .reduce((a, s) => a + s.durationMs, 0);
    days.push({ d, ms });
  }
  const max = Math.max(...days.map((x) => x.ms), 1);
  $("#chart-days").innerHTML = days
    .map(({ d, ms }, i) => `<div class="bar-col ${i === 13 ? "today" : ""}" title="${fmtDate(d)}: ${human(ms)}">
      <div class="bar-track"><div class="bar" style="height:${(ms / max) * 100}%"></div></div>
      <span>${pad(d.getDate())}</span></div>`)
    .join("");

  const byName = {};
  sessions.forEach((s) => {
    const key = s.name.trim().toLowerCase();
    byName[key] ??= { name: s.name.trim(), ms: 0 };
    byName[key].ms += s.durationMs;
  });
  const acts = Object.values(byName).sort((a, b) => b.ms - a.ms);
  const top = acts[0]?.ms || 1;
  $("#by-activity").innerHTML = acts.length
    ? acts.map((a) => `<li><div class="top"><span>${escapeHtml(a.name)}</span><span>${human(a.ms)}</span></div>
        <div class="track"><div class="fill" style="width:${(a.ms / top) * 100}%"></div></div></li>`).join("")
    : '<li class="empty">Sem dados ainda.</li>';
}

function renderHistory() {
  const list = sorted();
  if (!list.length) {
    $("#history-list").innerHTML = '<li class="empty">Nenhuma sessão registrada.</li>';
    return;
  }
  let html = "";
  let lastDay = "";
  for (const s of list) {
    const day = startOfDay(s.start).toISOString();
    if (day !== lastDay) {
      const total = list
        .filter((x) => startOfDay(x.start).toISOString() === day)
        .reduce((a, x) => a + x.durationMs, 0);
      html += `<li class="day-header"><span>${fmtDate(s.start)}</span><span>${human(total)}</span></li>`;
      lastDay = day;
    }
    html += sessionItem(s, true);
  }
  $("#history-list").innerHTML = html;
}

$("#history-list").addEventListener("click", (e) => {
  const id = e.target.closest("[data-del]")?.dataset.del;
  if (id) deleteSession(id);
});

function renderNames() {
  const names = [...new Set(sessions.map((s) => s.name.trim()))].sort();
  $("#activity-names").innerHTML = names.map((n) => `<option value="${escapeHtml(n)}"></option>`).join("");
}

// ---------- exportar / importar ----------
$("#btn-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `english-tracker-${toDateInput(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$("#import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw new SyntaxError();
    const ids = new Set(sessions.map((s) => s.id));
    const fresh = data.filter((s) => s && s.id && s.name && s.start && s.durationMs > 0 && !ids.has(s.id));
    await storage.importSessions(fresh);
    sessions = [...sessions, ...fresh];
    alert(`${fresh.length} sessão(ões) importada(s).`);
    render();
  } catch (err) {
    alert(err instanceof SyntaxError || !err.message ? "Arquivo inválido." : `Falha ao importar: ${err.message}`);
  }
  e.target.value = "";
});

// ---------- inicialização ----------
function render() {
  renderTimer();
  renderToday();
  renderDashboard();
  renderHistory();
  renderNames();
}

// Envia para a nuvem as sessões que estavam só neste navegador.
async function migrateLocalSessions() {
  const local = await localAdapter.listSessions();
  if (!local.length) return;
  if (!confirm(`Encontramos ${local.length} sessão(ões) salvas só neste navegador. Enviar para a nuvem?`)) return;
  const ids = new Set(sessions.map((s) => s.id));
  const fresh = local.filter((s) => !ids.has(s.id));
  await storage.importSessions(fresh);
  sessions = [...sessions, ...fresh];
  localAdapter.clear();
}

function showApp() {
  $("#login").classList.add("hidden");
  $("#app").classList.remove("hidden");
  $("#tabs").classList.remove("hidden");
  $("#btn-logout").classList.toggle("hidden", !cloudEnabled());
  $("#mode-badge").textContent = cloudEnabled() ? "nuvem" : "local";
}

function showLogin() {
  $("#app").classList.add("hidden");
  $("#tabs").classList.add("hidden");
  $("#login").classList.remove("hidden");
  $("#login-email").focus();
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.submitter;
  btn.disabled = true;
  $("#login-msg").textContent = "Entrando...";
  try {
    await login($("#login-email").value.trim(), $("#login-password").value, async () =>
      prompt("Primeiro acesso: defina uma nova senha (mín. 10 caracteres, com maiúscula, minúscula e número)"),
    );
    $("#login-password").value = "";
    $("#login-msg").textContent = "";
    await start();
  } catch (err) {
    $("#login-msg").textContent =
      err.code === "NotAuthorizedException" ? "E-mail ou senha incorretos." : `Erro: ${err.message}`;
  } finally {
    btn.disabled = false;
  }
});

$("#btn-logout").addEventListener("click", () => {
  if (!confirm("Sair da conta?")) return;
  logout();
  sessions = [];
  showLogin();
});

async function start() {
  try {
    sessions = await storage.listSessions();
    if (cloudEnabled()) await migrateLocalSessions();
  } catch (err) {
    if (!isLoggedIn()) return showLogin();
    alert(`Não foi possível carregar os dados: ${err.message}`);
  }
  showApp();
  render();
}

async function init() {
  if (!timer) startTimer(); // ao abrir o site, já começa a contar
  setInterval(() => {
    renderTimer();
    document.title = timer?.runningSince ? `${clock(elapsed())} · English Tracker` : "English Tracker";
  }, 250);
  if (cloudEnabled() && !isLoggedIn()) return showLogin();
  await start();
}

init();
