// Pointeuse + Planning + ICS (iPhone via Calendrier)
// Données en localStorage (perso)

const PLACE = "Estaminet L’Amusette";

const KEY_SESS = "pointeuse.sessions.v2";
const KEY_PLAN = "pointeuse.planning.v1";

const $ = (id) => document.getElementById(id);

// ---------- Storage ----------
function load(key, fallback){
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}
function save(key, val){
  localStorage.setItem(key, JSON.stringify(val));
}

// ---------- Time helpers ----------
function nowISO(){ return new Date().toISOString(); }

function toLocalHM(iso){
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", {hour:"2-digit", minute:"2-digit"});
}

function toLocalDateFR(iso){
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {weekday:"short", day:"2-digit", month:"2-digit"});
}

function msToHMS(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const hh = Math.floor(s/3600);
  const mm = Math.floor((s%3600)/60);
  const ss = s%60;
  return `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;
}

function msToHM(ms){
  const totalMin = Math.round(ms/60000);
  const h = Math.floor(totalMin/60);
  const m = totalMin % 60;
  return `${h}h${String(m).padStart(2,"0")}`;
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
  return e; // exclusive
}

function durationMs(startIso, endIso){
  return new Date(endIso).getTime() - new Date(startIso).getTime();
}

// ---------- Sessions ----------
function sessions(){ return load(KEY_SESS, []); }
function setSessions(v){ save(KEY_SESS, v); }

function getOpenSession(list){
  return list.find(x => !x.end) || null;
}

function safeUUID(){
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function startSession(){
  const s = sessions();
  if (getOpenSession(s)) return;

  s.unshift({
    id: safeUUID(),
    place: PLACE,
    start: nowISO(),
    end: null
  });

  setSessions(s);
  render();
}

function stopSession(){
  const s = sessions();
  const open = getOpenSession(s);
  if (!open) return;

  open.end = nowISO();
  setSessions(s);
  render();
}

function cancelOpenSession(){
  const s = sessions();
  const open = getOpenSession(s);
  if (!open) { alert("Aucun pointage en cours."); return; }

  if (!confirm("Annuler le pointage en cours (supprimer la session ouverte) ?")) return;
  const filtered = s.filter(x => x.id !== open.id);
  setSessions(filtered);
  render();
}

// Edit session times (start/end)
function editSession(id){
  const s = sessions();
  const item = s.find(x => x.id === id);
  if (!item) return;

  const currentStart = new Date(item.start);
  const startStr = prompt(
    "Modifier l’heure de DÉBUT (format HH:MM)\nEx: 11:30",
    currentStart.toLocaleTimeString("fr-FR",{hour:"2-digit", minute:"2-digit"})
  );
  if (startStr === null) return;

  let endStr = null;
  if (item.end){
    const currentEnd = new Date(item.end);
    endStr = prompt(
      "Modifier l’heure de FIN (format HH:MM)\nEx: 15:00",
      currentEnd.toLocaleTimeString("fr-FR",{hour:"2-digit", minute:"2-digit"})
    );
    if (endStr === null) return;
  } else {
    const wantEnd = confirm("Cette session est en cours. Voulez-vous aussi définir une heure de fin ?");
    if (wantEnd){
      endStr = prompt("Heure de FIN (HH:MM)", "");
      if (endStr === null) return;
    }
  }

  const okHM = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

  if (!okHM(startStr) || (endStr && !okHM(endStr))){
    alert("Format invalide. Utilise HH:MM (ex 11:30).");
    return;
  }

  // Rebuild ISO on same date as original start
  const base = new Date(item.start);
  const [sh, sm] = startStr.split(":").map(Number);
  const newStart = new Date(base.getFullYear(), base.getMonth(), base.getDate(), sh, sm, 0);

  item.start = newStart.toISOString();

  if (endStr){
    const [eh, em] = endStr.split(":").map(Number);
    let newEnd = new Date(base.getFullYear(), base.getMonth(), base.getDate(), eh, em, 0);
    if (newEnd <= newStart) newEnd.setDate(newEnd.getDate() + 1); // shift nuit
    item.end = newEnd.toISOString();
  }

  setSessions(s);
  render();
}

function deleteSession(id){
  if (!confirm("Supprimer cette session ?")) return;
  const s = sessions().filter(x => x.id !== id);
  setSessions(s);
  render();
}

// ---------- Live timer ----------
let liveTimerInterval = null;

function updateLiveTimer(){
  const s = sessions();
  const open = getOpenSession(s);
  if (!open){
    $("liveTimer").textContent = "00:00:00";
    return;
  }
  const ms = Date.now() - new Date(open.start).getTime();
  $("liveTimer").textContent = msToHMS(ms);
}

// ---------- ICS (Calendrier) ----------
function toUTCICS(d){
  const z = new Date(d.getTime() - d.getTimezoneOffset()*60000);
  return z.toISOString().replace(/[-:]/g,"").split(".")[0] + "Z";
}

function makeEvent({title, description, start, end, alarmMinutesBefore=0}){
  const uid = safeUUID() + "@pointeuse";
  const dtstamp = toUTCICS(new Date());
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description || ""}`,
    `DTSTART:${toUTCICS(start)}`,
    `DTEND:${toUTCICS(end)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${title}`,
    `TRIGGER:-PT${alarmMinutesBefore}M`,
    "END:VALARM",
    "END:VEVENT",
  ].join("\r\n");
}

function buildICS(events){
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Aurel Pointeuse//FR",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR"
  ].join("\r\n");
}

function downloadICS(filename, icsText){
  const blob = new Blob([icsText], {type:"text/calendar;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function parseTimeToDate(hhmm, baseDate){
  const [h,m] = hhmm.split(":").map(Number);
  return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), h, m, 0);
}

function icsForShift(baseDate, startStr, endStr, label){
  const start = parseTimeToDate(startStr, baseDate);
  let end = parseTimeToDate(endStr, baseDate);
  if (end <= start) end.setDate(end.getDate() + 1);

  const events = [];

  // Début shift
  events.push(makeEvent({
    title: `⏱️ Pointer — ${label}`,
    description: "Ouvre la pointeuse et appuie sur “Je pointe”.",
    start,
    end: new Date(start.getTime() + 5*60000),
    alarmMinutesBefore: 0
  }));

  // Fin shift
  events.push(makeEvent({
    title: `✅ Pense à dépointer — ${label}`,
    description: "Ouvre la pointeuse et appuie sur “Je dépointe”.",
    start: end,
    end: new Date(end.getTime() + 5*60000),
    alarmMinutesBefore: 0
  }));

  return events;
}

// Notifs pour le shift en cours (demande une heure de fin prévue)
function notifsForOpenShift(){
  const s = sessions();
  const open = getOpenSession(s);
  if (!open){
    alert("Tu n’es pas pointé. Pointe d’abord, ou utilise le Planning.");
    return;
  }

  const endStr = prompt("Heure de FIN prévue (HH:MM) pour recevoir “Pense à dépointer” :", "");
  if (endStr === null) return;

  const okHM = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  if (!okHM(endStr)){
    alert("Format invalide. Utilise HH:MM (ex 23:15).");
    return;
  }

  const start = new Date(open.start);
  const startStr = start.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});

  const baseDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const events = [
    // on ajoute aussi un rappel “pointer” à l’heure réelle de début (utile si tu veux historiser, mais surtout pour cohérence)
    ...icsForShift(baseDate, startStr, endStr, `${PLACE} (shift en cours)`)
  ];

  const ics = buildICS(events);
  downloadICS("notifs-shift.ics", ics);
  alert("Fichier .ics téléchargé. Ouvre-le sur iPhone pour ajouter les notifications au Calendrier.");
}

// ---------- Planning ----------
function planning(){ return load(KEY_PLAN, []); }
function setPlanning(v){ save(KEY_PLAN, v); }

function addPlan(){
  const date = $("planDate").value;   // YYYY-MM-DD
  const type = $("planType").value;   // midi/soir/autre
  const start = $("planStart").value; // HH:MM
  const end = $("planEnd").value;     // HH:MM

  if (!date || !start || !end){
    alert("Mets une date + heure début + heure fin.");
    return;
  }

  const p = planning();
  p.unshift({
    id: safeUUID(),
    date,
    type,
    place: PLACE,
    start,
    end
  });

  setPlanning(p);
  renderPlanning();
}

function deletePlan(id){
  if (!confirm("Supprimer ce shift du planning ?")) return;
  setPlanning(planning().filter(x => x.id !== id));
  renderPlanning();
}

function editPlan(id){
  const p = planning();
  const item = p.find(x => x.id === id);
  if (!item) return;

  const newDate = prompt("Date (YYYY-MM-DD)", item.date);
  if (newDate === null) return;

  const newStart = prompt("Heure début (HH:MM)", item.start);
  if (newStart === null) return;

  const newEnd = prompt("Heure fin (HH:MM)", item.end);
  if (newEnd === null) return;

  const okDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  const okHM = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

  if (!okDate(newDate) || !okHM(newStart) || !okHM(newEnd)){
    alert("Format invalide. Date: YYYY-MM-DD / Heures: HH:MM");
    return;
  }

  item.date = newDate;
  item.start = newStart;
  item.end = newEnd;

  setPlanning(p);
  renderPlanning();
}

function exportPlanningICS(){
  const p = planning();
  if (!p.length){
    alert("Planning vide.");
    return;
  }

  const events = [];

  for (const shift of p){
    const [Y,M,D] = shift.date.split("-").map(Number);
    const baseDate = new Date(Y, M-1, D);

    const label = `${shift.place} (${shift.type})`;
    events.push(...icsForShift(baseDate, shift.start, shift.end, label));
  }

  const ics = buildICS(events);
  downloadICS("notifs-planning.ics", ics);
  alert("Fichier .ics téléchargé. Ouvre-le sur iPhone pour ajouter toutes les notifications du planning.");
}

function renderPlanning(){
  const p = planning()
    .slice()
    .sort((a,b) => (a.date + a.start).localeCompare(b.date + b.start));

  if (!p.length){
    $("planningList").innerHTML = `<div class="muted">Aucun shift dans le planning.</div>`;
    return;
  }

  const rows = p.map(x => {
    return `
      <div class="card" style="box-shadow:none;border:1px solid #eee">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div>
            <div><b>${x.date}</b> <span class="pill">${x.type}</span></div>
            <div class="muted">${x.place}</div>
            <div style="margin-top:6px"><b>${x.start}</b> → <b>${x.end}</b></div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;min-width:120px">
            <button class="btnSmall btnGhost" onclick="window.__editPlan('${x.id}')">Modifier</button>
            <button class="btnSmall btnGhost" onclick="window.__delPlan('${x.id}')">Supprimer</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  $("planningList").innerHTML = rows;
}

// expose for onclick
window.__editPlan = editPlan;
window.__delPlan = deletePlan;

// ---------- Rendering (today/week) ----------
function renderStatusAndTimer(){
  const s = sessions();
  const open = getOpenSession(s);

  $("btnStart").disabled = !!open;
  $("btnStop").disabled = !open;

  $("status").textContent = open ? "pointé" : "pas pointé";
  $("currentInfo").textContent = open
    ? `Début : ${toLocalHM(open.start)} — ${open.place}`
    : "";

  // start/stop interval
  if (liveTimerInterval) clearInterval(liveTimerInterval);
  updateLiveTimer();
  liveTimerInterval = setInterval(updateLiveTimer, 1000);
}

function renderToday(){
  const s = sessions();
  const today = new Date();

  const list = s.filter(x => sameDay(new Date(x.start), today));

  if (!list.length){
    $("today").innerHTML = `<div class="muted">Aucune session aujourd’hui.</div>`;
    return;
  }

  let totalMs = 0;

  const rows = list.map(x => {
    const isOpen = !x.end;
    if (!isOpen){
      totalMs += durationMs(x.start, x.end);
    }

    const dur = isOpen ? "en cours" : msToHM(durationMs(x.start, x.end));

    return `<tr>
      <td>${toLocalHM(x.start)}</td>
      <td>${x.end ? toLocalHM(x.end) : "—"}</td>
      <td>${dur}</td>
      <td>${x.place}</td>
      <td>
        <button class="btnSmall btnGhost" onclick="window.__editSess('${x.id}')">Modifier</button>
        <button class="btnSmall btnGhost" onclick="window.__delSess('${x.id}')">Suppr.</button>
      </td>
    </tr>`;
  }).join("");

  $("today").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Début</th><th>Fin</th><th>Durée</th><th>Lieu</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="muted" style="margin-top:8px">Total (sessions terminées) : <b>${msToHM(totalMs)}</b></div>
  `;
}

function renderWeek(){
  const s = sessions().filter(x => x.end); // only closed for totals
  const now = new Date();
  const ws = startOfWeek(now);
  const we = endOfWeek(now);

  const list = s
    .filter(x => {
      const d = new Date(x.start);
      return d >= ws && d < we;
    })
    .sort((a,b) => new Date(a.start) - new Date(b.start));

  if (!list.length){
    $("week").innerHTML = `<div class="muted">Aucune session terminée cette semaine.</div>`;
    $("weekTotal").textContent = "";
    return;
  }

  // group by day
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
      const ms = durationMs(x.start, x.end);
      dayTotal += ms;
      return `<tr>
        <td>${toLocalHM(x.start)}</td>
        <td>${toLocalHM(x.end)}</td>
        <td>${msToHM(ms)}</td>
        <td>${x.place}</td>
      </tr>`;
    }).join("");

    weekTotalMs += dayTotal;

    html += `
      <div class="muted" style="margin:10px 0 6px"><b>${toLocalDateFR(items[0].start)}</b> — total: ${msToHM(dayTotal)}</div>
      <table>
        <thead><tr><th>Début</th><th>Fin</th><th>Durée</th><th>Lieu</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  $("week").innerHTML = html;
  $("weekTotal").innerHTML = `Total semaine : <b>${msToHM(weekTotalMs)}</b>`;
}

// expose for buttons
window.__editSess = editSession;
window.__delSess = deleteSession;

// ---------- Export CSV ----------
function exportCSV(){
  const s = sessions().filter(x => x.end);

  const header = ["date","debut","fin","duree","lieu"];
  const lines = [header.join(",")];

  for (const x of s){
    const d = new Date(x.start);
    const date = d.toLocaleDateString("fr-FR");
    const debut = toLocalHM(x.start);
    const fin = toLocalHM(x.end);
    const duree = msToHM(durationMs(x.start, x.end));
    lines.push([date, debut, fin, duree, `"${x.place.replaceAll('"','""')}"`].join(","));
  }

  const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "heures-estaminet.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Reset ----------
function resetAll(){
  if (!confirm("Tout supprimer ? (sessions + planning)")) return;
  localStorage.removeItem(KEY_SESS);
  localStorage.removeItem(KEY_PLAN);
  render();
}

// ---------- Render all ----------
function render(){
  renderStatusAndTimer();
  renderToday();
  renderWeek();
  renderPlanning();
}

// ---------- Wire UI ----------
$("btnStart").addEventListener("click", startSession);
$("btnStop").addEventListener("click", stopSession);
$("btnClearOpen").addEventListener("click", cancelOpenSession);
$("btnIcsFromOpen").addEventListener("click", notifsForOpenShift);

$("btnAddPlan").addEventListener("click", addPlan);
$("btnExportPlanIcs").addEventListener("click", exportPlanningICS);

$("btnExportCSV").addEventListener("click", exportCSV);
$("btnResetAll").addEventListener("click", resetAll);

// default plan date = today
(function initDefaults(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  $("planDate").value = `${yyyy}-${mm}-${dd}`;
})();

render();
