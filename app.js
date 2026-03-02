const KEY = "pointeuse.sessions.v1";

const $ = (id) => document.getElementById(id);

function loadSessions(){
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}
function saveSessions(s){ localStorage.setItem(KEY, JSON.stringify(s)); }

function nowISO(){ return new Date().toISOString(); }

function formatHM(iso){
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", {hour:"2-digit", minute:"2-digit"});
}
function formatDateFR(d){
  return d.toLocaleDateString("fr-FR", {weekday:"short", day:"2-digit", month:"2-digit"});
}
function formatMonthTitle(d){
  return d.toLocaleDateString("fr-FR", {month:"long", year:"numeric"});
}
function msToHM(ms){
  const totalMin = Math.round(ms/60000);
  const h = Math.floor(totalMin/60);
  const m = totalMin % 60;
  return `${h}h${String(m).padStart(2,"0")}`;
}
function durationMs(startIso, endIso){
  return new Date(endIso).getTime() - new Date(startIso).getTime();
}

function getOpenSession(sessions){
  return sessions.find(x => !x.end) || null;
}

function start(){
  const sessions = loadSessions();
  if (getOpenSession(sessions)) return;

  sessions.unshift({
    id: crypto.randomUUID(),
    place: "Bazan",
    start: nowISO(),
    end: null
  });
  saveSessions(sessions);
  render();
}

function stop(){
  const sessions = loadSessions();
  const open = getOpenSession(sessions);
  if (!open) return;
  open.end = nowISO();
  saveSessions(sessions);
  render();
}

function sameDay(a,b){
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

function startOfWeek(date){
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0 = lundi
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() - day);
  return d;
}
function endOfWeek(date){
  const s = startOfWeek(date);
  const e = new Date(s);
  e.setDate(e.getDate() + 7);
  return e;
}

function startOfMonth(date){
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0,0,0,0);
  return d;
}
function endOfMonth(date){
  const d = startOfMonth(date);
  d.setMonth(d.getMonth() + 1);
  return d; // exclusive
}

/* ---------- RENDER CLOCK (today) ---------- */

function renderToday(sessions){
  const today = new Date();
  const list = sessions.filter(x=>{
    const ds = new Date(x.start);
    return sameDay(ds, today);
  });

  if (!list.length){
    $("today").innerHTML = `<div class="muted">Aucune session aujourd’hui.</div>`;
    return;
  }

  let total = 0;
  const rows = list.map(x=>{
    const end = x.end ? x.end : nowISO();
    const dur = durationMs(x.start, end);
    if (x.end) total += dur;
    return `<tr>
      <td>${formatHM(x.start)}</td>
      <td>${x.end ? formatHM(x.end) : "—"}</td>
      <td>${x.end ? msToHM(dur) : "en cours"}</td>
      <td>${x.place}</td>
    </tr>`;
  }).join("");

  $("today").innerHTML = `
    <table>
      <thead><tr><th>Début</th><th>Fin</th><th>Durée</th><th>Lieu</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="muted" style="margin-top:8px">Total (sessions terminées) : <b>${msToHM(total)}</b></div>
  `;
}

/* ---------- RENDER WEEK ---------- */

function renderWeek(sessions){
  const now = new Date();
  const s = startOfWeek(now);
  const e = endOfWeek(now);

  const list = sessions
    .filter(x=>{
      const ds = new Date(x.start);
      return ds >= s && ds < e;
    })
    .sort((a,b)=> new Date(a.start) - new Date(b.start));

  if (!list.length){
    $("week").innerHTML = `<div class="muted">Aucune session cette semaine.</div>`;
    $("weekTotal").textContent = "";
    return;
  }

  const groups = new Map();
  for (const x of list){
    const d = new Date(x.start);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(x);
  }

  let weekTotalMs = 0;
  let html = "";

  for (const [key, items] of groups){
    const d = new Date(items[0].start);
    let dayTotal = 0;

    const rows = items.map(x=>{
      if (!x.end) return "";
      const dur = durationMs(x.start, x.end);
      dayTotal += dur;
      return `<tr>
        <td>${formatHM(x.start)}</td>
        <td>${formatHM(x.end)}</td>
        <td>${msToHM(dur)}</td>
        <td>${x.place}</td>
      </tr>`;
    }).join("");

    weekTotalMs += dayTotal;

    html += `
      <div class="muted" style="margin:10px 0 6px"><b>${formatDateFR(d)}</b> — total: ${msToHM(dayTotal)}</div>
      <table>
        <thead><tr><th>Début</th><th>Fin</th><th>Durée</th><th>Lieu</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="muted">Pas de session terminée ce jour.</td></tr>`}</tbody>
      </table>
    `;
  }

  $("week").innerHTML = html;
  $("weekTotal").innerHTML = `Total semaine (sessions terminées) : <b>${msToHM(weekTotalMs)}</b>`;
}

/* ---------- RENDER MONTH ---------- */

let selectedMonth = new Date();

function renderMonth(sessions){
  const s = startOfMonth(selectedMonth);
  const e = endOfMonth(selectedMonth);

  $("monthTitle").textContent = formatMonthTitle(selectedMonth);

  const list = sessions
    .filter(x=>{
      const ds = new Date(x.start);
      return ds >= s && ds < e;
    })
    .sort((a,b)=> new Date(a.start) - new Date(b.start));

  if (!list.length){
    $("monthTotal").textContent = "0h00";
    $("monthDays").textContent = "0";
    $("monthSessions").textContent = "0";
    $("monthList").innerHTML = `<div class="muted">Aucune session ce mois-ci.</div>`;
    return;
  }

  const groups = new Map(); // YYYY-MM-DD
  let monthTotalMs = 0;
  let sessionCount = 0;

  for (const x of list){
    const d = new Date(x.start);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(x);
  }

  let html = "";

  for (const [key, items] of groups){
    const d = new Date(items[0].start);
    let dayTotal = 0;

    const rows = items.map(x=>{
      if (!x.end) return "";
      const dur = durationMs(x.start, x.end);
      dayTotal += dur;
      monthTotalMs += dur;
      sessionCount += 1;
      return `<tr>
        <td>${formatHM(x.start)}</td>
        <td>${formatHM(x.end)}</td>
        <td>${msToHM(dur)}</td>
        <td>${x.place}</td>
      </tr>`;
    }).join("");

    html += `
      <div class="muted" style="margin:10px 0 6px"><b>${formatDateFR(d)}</b> — total: ${msToHM(dayTotal)}</div>
      <table>
        <thead><tr><th>Début</th><th>Fin</th><th>Durée</th><th>Lieu</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="muted">Pas de session terminée ce jour.</td></tr>`}</tbody>
      </table>
    `;
  }

  $("monthTotal").textContent = msToHM(monthTotalMs);
  $("monthDays").textContent = String(groups.size);
  $("monthSessions").textContent = String(sessionCount);
  $("monthList").innerHTML = html;
}

/* ---------- STATUS + EXPORT ---------- */

function renderStatus(sessions){
  const open = getOpenSession(sessions);
  const isOn = !!open;

  $("btnStart").disabled = isOn;
  $("btnStop").disabled = !isOn;

  $("status").textContent = isOn ? "pointé" : "pas pointé";
  $("currentInfo").textContent = isOn
    ? `Début : ${formatHM(open.start)} — Lieu : ${open.place}`
    : "";
}

function exportCSV(){
  const sessions = loadSessions().filter(x=>x.end);
  const header = ["date","debut","fin","duree","lieu"];
  const lines = [header.join(",")];

  for (const x of sessions){
    const d = new Date(x.start);
    const date = d.toLocaleDateString("fr-FR");
    const debut = formatHM(x.start);
    const fin = formatHM(x.end);
    const dur = msToHM(durationMs(x.start,x.end));
    lines.push([date,debut,fin,dur,x.place].join(","));
  }

  const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "pointeuse.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function resetAll(){
  if (!confirm("Supprimer toutes les sessions ?")) return;
  localStorage.removeItem(KEY);
  render();
}

/* ---------- TABS ---------- */

function setActiveView(name){
  const views = ["clock","week","month","settings"];
  for (const v of views){
    const el = $("view-" + v);
    if (el) el.classList.toggle("active", v === name);
  }
  document.querySelectorAll(".tab").forEach(t=>{
    t.classList.toggle("active", t.dataset.view === name);
  });
}

/* ---------- MAIN RENDER ---------- */

function render(){
  const sessions = loadSessions();
  renderStatus(sessions);
  renderToday(sessions);
  renderWeek(sessions);
  renderMonth(sessions);
}

/* ---------- EVENTS ---------- */

$("btnStart").addEventListener("click", start);
$("btnStop").addEventListener("click", stop);
$("btnExport").addEventListener("click", exportCSV);
$("btnReset").addEventListener("click", resetAll);

$("btnPrevMonth").addEventListener("click", ()=>{
  selectedMonth = new Date(selectedMonth);
  selectedMonth.setMonth(selectedMonth.getMonth() - 1);
  render();
});

$("btnNextMonth").addEventListener("click", ()=>{
  selectedMonth = new Date(selectedMonth);
  selectedMonth.setMonth(selectedMonth.getMonth() + 1);
  render();
});

document.querySelectorAll(".tab").forEach(t=>{
  t.addEventListener("click", ()=>{
    setActiveView(t.dataset.view);
  });
});

render();
