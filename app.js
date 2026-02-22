// Pointeuse simple (1 utilisateur, local)
// Stockage : localStorage

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
  // session sans "end"
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
  // Lundi = 1 en France
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
  return e; // exclusive
}

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

function renderWeek(sessions){
  const now = new Date();
  const s = startOfWeek(now);
  const e = endOfWeek(now);

  // sessions dont le start est dans la semaine
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

  // group by day
  const groups = new Map(); // key YYYY-MM-DD
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

function render(){
  const sessions = loadSessions();
  renderStatus(sessions);
  renderToday(sessions);
  renderWeek(sessions);
}

$("btnStart").addEventListener("click", start);
$("btnStop").addEventListener("click", stop);
$("btnExport").addEventListener("click", exportCSV);
$("btnReset").addEventListener("click", resetAll);

render();
function pad(n){ return String(n).padStart(2,"0"); }

function makeICS({title, description, startDate, endDate, alarmMinutesBefore=0}) {
  // iCalendar en UTC (simple et compatible)
  const toUTC = (d) => {
    const z = new Date(d.getTime() - d.getTimezoneOffset()*60000);
    return z.toISOString().replace(/[-:]/g,"").split(".")[0] + "Z";
  };

  const uid = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())) + "@pointeuse";
  const dtstamp = toUTC(new Date());
  const dtstart = toUTC(startDate);
  const dtend = toUTC(endDate);

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Aurel Pointeuse//FR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description || ""}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${title}`,
    `TRIGGER:-PT${alarmMinutesBefore}M`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}

function downloadText(filename, text, mime="text/calendar;charset=utf-8") {
  const blob = new Blob([text], {type:mime});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

document.getElementById("btnIcs")?.addEventListener("click", () => {
  const s = document.getElementById("shiftStart").value; // "HH:MM"
  const e = document.getElementById("shiftEnd").value;

  if (!s || !e) { alert("Mets une heure de début et une heure de fin."); return; }

  const today = new Date();
  const [sh, sm] = s.split(":").map(Number);
  const [eh, em] = e.split(":").map(Number);

  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), sh, sm, 0);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), eh, em, 0);

  // Si fin < début, on suppose que ça finit le lendemain (shift de nuit)
  if (end <= start) end.setDate(end.getDate() + 1);

  // 2 fichiers .ics (plus simple à importer)
  const icsStart = makeICS({
    title: "⏱️ Pointer (Bazan)",
    description: "Ouvre la pointeuse et appuie sur “Je pointe”.",
    startDate: start,
    endDate: new Date(start.getTime() + 5*60000), // event de 5 min
    alarmMinutesBefore: 0
  });

  const icsEnd = makeICS({
    title: "✅ Pense à dépointer",
    description: "Ouvre la pointeuse et appuie sur “Je dépointe”.",
    startDate: end,
    endDate: new Date(end.getTime() + 5*60000),
    alarmMinutesBefore: 0
  });

  downloadText(`rappel-pointer-${pad(sh)}${pad(sm)}.ics`, icsStart);
  downloadText(`rappel-depointer-${pad(eh)}${pad(em)}.ics`, icsEnd);

  alert("Deux fichiers .ics ont été téléchargés. Ouvre-les sur iPhone pour ajouter les rappels au Calendrier.");
});
