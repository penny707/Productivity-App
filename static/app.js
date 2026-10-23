/* =========================================================
   Elio — app.js
   ========================================================= */

// ---------- State ----------
const state = {
  vakken: [],
  actiefVakId: null,
  onderdelen: {},      // key: vak_id -> [onderdelen met children]
  taken: {},           // key: onderdeel_id -> [taken]
  openOnderdelen: new Set(JSON.parse(localStorage.getItem("openOnderdelen") || "[]")),
  thema: "grey",
  sidebarIngeklapt: false,
  kleuren: [
    "#4F7CAC", // blauw
    "#4A8F5C", // groen
    "#C0504D", // rood
    "#B8962E", // geel/oker
    "#7A5C9E", // paars
    "#C2713A", // oranje
    "#3A8C8C", // teal
    "#8C5A6E", // roze/bruin
    "#5A6B7C", // grijsblauw
    "#6B8E3A"  // olijfgroen
  ],
  geselecteerdeKleur: "#4F7CAC"
};

// ---------- API helpers ----------
async function api(pad, methode = "GET", body = null) {
  const opties = {
    method: methode,
    headers: { "Content-Type": "application/json" }
  };
  if (body) opties.body = JSON.stringify(body);
  try {
    let res;
    try {
      res = await fetch(`/api${pad}`, opties);
    } catch (netwerkFout) {
      throw new Error("Geen verbinding met de app. Start ze opnieuw via het bureaubladicoon.");
    }
    if (!res.ok) {
      const fout = await res.json().catch(() => ({}));
      throw new Error(fout.fout || `HTTP ${res.status}`);
    }
    if (res.status === 204) return null;
    return await res.json();
  } catch (e) {
    toast(e.message || "Er ging iets mis", "fout");
    throw e;
  }
}

// ---------- DOM helpers ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k === "dataset") Object.assign(e.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined && v !== false) e.setAttribute(k, v);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c === null || c === undefined || c === false) continue;
    if (typeof c === "string") e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  }
  return e;
}

function svgIcoon(pad, size = 16, strokeWidth = 2) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", strokeWidth);
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const p = document.createElementNS(ns, "path");
  p.setAttribute("d", pad);
  svg.appendChild(p);
  return svg;
}

const ICOON = {
  plus: "M12 5v14M5 12h14",
  pijl: "M9 18l6-6-6-6",
  potlood: "M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z",
  prullenbak: "M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
  sluiten: "M18 6L6 18M6 6l12 12",
  klok: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  sub: "M3 6h18M3 12h12M3 18h6",
  taak: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  vlag: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7",
  doel: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10zM12 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2z",
  lijst: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  alarm: "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  kalender: "M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM3 10h18M8 2v4M16 2v4",
  vinkCirkel: "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3"
};

const TYPES = ["opdracht", "theorie", "labo"];
const TYPE_LABELS = { opdracht: "Opdracht", theorie: "Theorie", labo: "Labo" };

function percentage(klaar, totaal) {
  return totaal === 0 ? 0 : Math.round((klaar / totaal) * 100);
}

// Voortgangsbalk; het spoor is een lichtere tint van dezelfde kleur (zie CSS)
function maakMeter(pct, kleur) {
  return el("div", {
    class: "meter",
    style: kleur ? `--vak:${kleur}` : null,
    role: "progressbar",
    "aria-valuenow": pct, "aria-valuemin": 0, "aria-valuemax": 100
  }, el("div", { style: `width:${pct}%` }));
}

function maakVakChip(vak, groot = false) {
  const letter = (vak.naam || "?").trim().charAt(0).toUpperCase();
  return el("span", { class: "vak-chip" + (groot ? " groot" : ""), style: `--vak:${vak.kleur}` }, letter);
}

// ---------- Toast ----------
let toastTimer = null;
function toast(msg, type = "") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast zichtbaar" + (type === "fout" ? " fout" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove("zichtbaar");
  }, 2800);
}

// ---------- Datum helpers ----------
function vandaagISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dag = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dag}`;
}

function formatteerDatum(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
}

function datumStatus(iso) {
  if (!iso) return "";
  const vandaag = vandaagISO();
  if (iso < vandaag) return "verlopen";
  if (iso === vandaag) return "vandaag";
  return "";
}

function dagenTot(iso) {
  const d = new Date(iso + "T00:00:00");
  const v = new Date(vandaagISO() + "T00:00:00");
  return Math.round((d - v) / 86400000);
}

function datumVerschilLabel(iso) {
  if (!iso) return "";
  const dagen = dagenTot(iso);
  if (dagen < 0) return `${Math.abs(dagen)}d te laat`;
  if (dagen === 0) return "vandaag";
  if (dagen === 1) return "morgen";
  return `over ${dagen}d`;
}

function groet() {
  const uur = new Date().getHours();
  if (uur < 6) return "Goedenacht";
  if (uur < 12) return "Goedemorgen";
  if (uur < 18) return "Goedemiddag";
  return "Goedenavond";
}

// =========================================================
// THEMA + SIDEBAR STATE
// =========================================================
function pasThemaToe(thema) {
  state.thema = thema;
  document.documentElement.dataset.thema = thema;
  $$("[data-thema-keuze]").forEach(k => {
    k.setAttribute("aria-pressed", String(k.dataset.themaKeuze === thema));
  });
}

function kiesThema(thema) {
  pasThemaToe(thema);
  api("/instellingen", "PUT", { thema }).catch(() => {});
}

function pasSidebarToe(ingeklapt) {
  state.sidebarIngeklapt = ingeklapt;
  $("#sidebar").classList.toggle("ingeklapt", ingeklapt);
}

function wisselSidebar() {
  const nieuw = !state.sidebarIngeklapt;
  pasSidebarToe(nieuw);
  api("/instellingen", "PUT", { sidebar_ingeklapt: nieuw ? "1" : "0" }).catch(() => {});
}

// =========================================================
// ROUTING
// =========================================================
function route() {
  const hash = location.hash || "#/";
  const delen = hash.slice(2).split("/").filter(Boolean);

  $$(".nav-item").forEach(n => n.classList.remove("actief"));
  if (delen[0] !== "vak") {
    state.actiefVakId = null;
    markeerActiefVak();
  }

  if (delen.length === 0 || delen[0] === "") {
    toonView("overzicht");
    renderOverzicht();
    const nav = $('[data-route="overzicht"]');
    if (nav) nav.classList.add("actief");
  } else if (delen[0] === "vak" && delen[1]) {
    const id = parseInt(delen[1], 10);
    toonView("vak");
    laadVak(id);
  } else if (delen[0] === "deadlines") {
    toonView("deadlines");
    renderDeadlines();
    const nav = $('[data-route="deadlines"]');
    if (nav) nav.classList.add("actief");
  } else {
    location.hash = "#/";
  }
}

function toonView(naam) {
  $$(".view").forEach(v => v.classList.add("verborgen"));
  const v = $(`#view-${naam}`);
  if (v) v.classList.remove("verborgen");
  $("#hoofd").scrollTop = 0;
}

// =========================================================
// SIDEBAR VAKKEN RENDEREN
// =========================================================
function renderSidebarVakken() {
  const nav = $("#sidebar-vakken");
  // Focus onthouden, zodat je met Alt+pijltjes meerdere keren kan verplaatsen
  const focusVakId = nav.contains(document.activeElement) ? document.activeElement.dataset.vakId : null;
  nav.innerHTML = "";
  if (state.vakken.length === 0) return;

  for (const v of state.vakken) {
    const item = el("button", {
      class: "vak-nav-item" + (v.id === state.actiefVakId ? " actief" : ""),
      title: v.naam,
      draggable: "true",
      dataset: { vakId: v.id },
      onclick: () => { location.hash = `#/vak/${v.id}`; },
      ondragstart: (e) => startSlepen(e, v.id),
      ondragover: (e) => overSlepen(e, item),
      ondragleave: () => item.classList.remove("drop-boven", "drop-onder"),
      ondrop: (e) => dropVak(e, v.id, item),
      ondragend: stopSlepen,
      onkeydown: (e) => verplaatsMetToetsen(e, v.id)
    }, [
      el("span", { class: "vak-stip", style: `background:${v.kleur}` }),
      el("span", { class: "vak-nav-naam" }, v.naam)
    ]);
    nav.appendChild(item);
  }

  if (focusVakId) {
    const knop = nav.querySelector(`[data-vak-id="${focusVakId}"]`);
    if (knop) knop.focus();
  }
}

// ---------- Vakken herordenen (slepen of Alt+pijltjes) ----------
let sleepVakId = null;

function startSlepen(e, id) {
  sleepVakId = id;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", String(id));
  e.currentTarget.classList.add("slepen");
}

// Boven- of onderhelft van het vak waarover gesleept wordt
function dropPositie(e, item) {
  const r = item.getBoundingClientRect();
  return e.clientY < r.top + r.height / 2 ? "boven" : "onder";
}

function overSlepen(e, item) {
  if (sleepVakId === null) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  const pos = dropPositie(e, item);
  item.classList.toggle("drop-boven", pos === "boven");
  item.classList.toggle("drop-onder", pos === "onder");
}

function dropVak(e, doelId, item) {
  e.preventDefault();
  const id = sleepVakId;
  const pos = dropPositie(e, item);
  stopSlepen();
  if (id === null || id === doelId) return;
  const ids = state.vakken.map(v => v.id).filter(x => x !== id);
  let idx = ids.indexOf(doelId);
  if (pos === "onder") idx++;
  ids.splice(idx, 0, id);
  bewaarVakVolgorde(ids);
}

function stopSlepen() {
  sleepVakId = null;
  $$(".vak-nav-item").forEach(n => n.classList.remove("slepen", "drop-boven", "drop-onder"));
}

function verplaatsMetToetsen(e, id) {
  if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
  e.preventDefault();
  const ids = state.vakken.map(v => v.id);
  const i = ids.indexOf(id);
  const j = e.key === "ArrowUp" ? i - 1 : i + 1;
  if (j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  bewaarVakVolgorde(ids);
}

async function bewaarVakVolgorde(ids) {
  // Meteen tonen, daarna opslaan; bij een fout de oude volgorde terugzetten
  const oud = state.vakken;
  const perId = new Map(oud.map(v => [v.id, v]));
  state.vakken = ids.map(id => perId.get(id));
  renderSidebarVakken();
  try {
    await api("/vakken/volgorde", "PUT", { ids });
    if (!location.hash || location.hash === "#/") renderOverzicht();
  } catch (e) {
    state.vakken = oud;
    renderSidebarVakken();
  }
}

// Vakkenlijst ophalen, los van welke pagina open staat (ook na verversen).
async function vernieuwSidebar() {
  try {
    state.vakken = await api("/vakken");
    renderSidebarVakken();
  } catch (e) {
    console.error(e);
  }
}

function markeerActiefVak() {
  $$(".vak-nav-item").forEach(n => {
    n.classList.toggle("actief", Number(n.dataset.vakId) === state.actiefVakId);
  });
}

// =========================================================
// OVERZICHT
// =========================================================
async function renderOverzicht() {
  try {
    const data = await api("/overzicht");
    state.vakken = data.vakken;
    renderSidebarVakken();

    // Kerncijfers over alle vakken heen
    let klaar = 0, totaal = 0;
    for (const v of data.vakken) {
      klaar += v.progress.klaar;
      totaal += v.progress.totaal;
    }
    const openDeadlines = data.deadlines.filter(t => !t.klaar);
    const teLaat = openDeadlines.filter(t => dagenTot(t.deadline) < 0);
    const dezeWeek = openDeadlines.filter(t => { const d = dagenTot(t.deadline); return d >= 0 && d <= 7; });
    const vandaag = dezeWeek.filter(t => dagenTot(t.deadline) === 0);

    const datum = new Date().toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" });
    $("#overzicht-datum").textContent = datum.charAt(0).toUpperCase() + datum.slice(1);
    $("#overzicht-groet").textContent = groet();
    $("#overzicht-sub").textContent =
      data.vakken.length === 0 ? "Maak je eerste vak aan om te beginnen." :
      totaal === 0 ? "Voeg taken toe aan je vakken om je voortgang te volgen." :
      klaar === totaal ? "Alle taken zijn afgerond. Goed bezig!" :
      `Je hebt ${totaal - klaar} open ${totaal - klaar === 1 ? "taak" : "taken"}` +
        (dezeWeek.length ? `, ${dezeWeek.length} met een deadline deze week.` : ".");

    renderKpis({ klaar, totaal, teLaat, dezeWeek, vandaag });

    const grid = $("#vakken-grid");
    grid.innerHTML = "";

    if (data.vakken.length === 0) {
      $("#overzicht-leeg").classList.remove("verborgen");
      $("#kpi-rij").classList.add("verborgen");
      return;
    }
    $("#overzicht-leeg").classList.add("verborgen");
    $("#kpi-rij").classList.remove("verborgen");

    for (const v of data.vakken) {
      const volgende = openDeadlines.find(t => t.vak_id === v.id);
      grid.appendChild(maakVakKaart(v, volgende));
    }
  } catch (e) {
    console.error(e);
  }
}

function maakKpi({ label, icoon, waarde, meta, status = "", naar = null, extra = null }) {
  return el(naar ? "button" : "div", {
    class: "kpi-tegel" + (status ? ` status-${status}` : ""),
    type: naar ? "button" : null,
    onclick: naar ? () => { location.hash = naar; } : null
  }, [
    el("div", { class: "kpi-label" }, [svgIcoon(icoon, 15, 2), label]),
    el("div", { class: "kpi-waarde" }, waarde),
    el("div", { class: "kpi-meta" }, meta),
    extra
  ]);
}

function renderKpis({ klaar, totaal, teLaat, dezeWeek, vandaag }) {
  const rij = $("#kpi-rij");
  rij.innerHTML = "";
  const pct = percentage(klaar, totaal);
  rij.append(
    maakKpi({
      label: "Open taken", icoon: ICOON.lijst,
      waarde: String(totaal - klaar),
      meta: `van ${totaal} in totaal`
    }),
    maakKpi({
      label: "Te laat", icoon: ICOON.alarm,
      waarde: String(teLaat.length),
      meta: teLaat.length ? "harde deadlines verstreken" : "niets te laat",
      status: teLaat.length ? "kritiek" : "",
      naar: "#/deadlines"
    }),
    maakKpi({
      label: "Deadlines deze week", icoon: ICOON.kalender,
      waarde: String(dezeWeek.length),
      meta: vandaag.length ? `waarvan ${vandaag.length} vandaag` : "komende 7 dagen",
      status: vandaag.length ? "waarschuwing" : "",
      naar: "#/deadlines"
    }),
    maakKpi({
      label: "Afgerond", icoon: ICOON.vinkCirkel,
      waarde: `${pct}%`,
      meta: `${klaar} van ${totaal} taken`,
      extra: maakMeter(pct)
    })
  );
}

function maakVakKaart(v, volgende) {
  const p = v.progress;
  const pct = percentage(p.klaar, p.totaal);

  const tellers = [];
  for (const type of TYPES) {
    const [k, t] = p.per_type[type] || [0, 0];
    if (t > 0) {
      tellers.push(el("span", { class: "vak-kaart-teller" }, [
        TYPE_LABELS[type] + " ",
        el("strong", {}, `${k}/${t}`)
      ]));
    }
  }

  let volgendeRij;
  if (volgende) {
    const status = datumStatus(volgende.deadline);
    volgendeRij = el("div", {
      class: "vak-kaart-volgende " + status,
      title: `Eerstvolgende deadline: ${formatteerDatum(volgende.deadline)}`
    }, [
      svgIcoon(ICOON.vlag, 14, 2),
      el("span", { class: "tekst" }, volgende.titel),
      el("span", { class: "wanneer" }, datumVerschilLabel(volgende.deadline))
    ]);
  } else {
    volgendeRij = el("div", { class: "vak-kaart-volgende leeg" }, [
      svgIcoon(ICOON.vlag, 14, 2),
      el("span", { class: "tekst" }, "Geen open deadlines")
    ]);
  }

  const openen = () => { location.hash = `#/vak/${v.id}`; };
  return el("div", {
    class: "vak-kaart",
    style: `--vak:${v.kleur}`,
    tabindex: "0",
    role: "link",
    "aria-label": `${v.naam}, ${pct}% afgerond`,
    onclick: openen,
    onkeydown: (e) => { if (e.key === "Enter") openen(); }
  }, [
    el("div", { class: "vak-kaart-kop" }, [
      maakVakChip(v),
      el("div", { class: "vak-kaart-titels" }, [
        el("div", { class: "vak-kaart-naam" }, v.naam),
        el("div", { class: "vak-kaart-sub" },
          p.totaal === 0 ? "Nog geen taken" : `${p.klaar} van ${p.totaal} taken`)
      ]),
      el("span", { class: "vak-kaart-pct" }, `${pct}%`)
    ]),
    maakMeter(pct, v.kleur),
    tellers.length ? el("div", { class: "vak-kaart-tellers" }, tellers) : null,
    volgendeRij
  ]);
}

// =========================================================
// VAK DETAIL LADEN
// =========================================================
async function laadVak(id) {
  try {
    const [vak, onderdelen, taken] = await Promise.all([
      api(`/vakken/${id}`),
      api(`/onderdelen?vak_id=${id}`),
      api(`/taken?vak_id=${id}`)
    ]);

    state.actiefVakId = id;
    state.vak = vak;
    state.onderdelen[id] = bouwBoom(onderdelen);
    state.taken = {};
    for (const t of taken) {
      if (!state.taken[t.onderdeel_id]) state.taken[t.onderdeel_id] = [];
      state.taken[t.onderdeel_id].push(t);
    }

    markeerActiefVak();
    renderVak();
  } catch (e) {
    console.error(e);
    location.hash = "#/";
  }
}

// Header + voortgang + onderdelen tekenen vanuit de lokale state (geen API-calls).
function renderVak() {
  const vak = state.vak;
  if (!vak) return;

  const per_type = {};
  for (const type of TYPES) per_type[type] = [0, 0];
  let klaar = 0, totaal = 0;
  for (const lijst of Object.values(state.taken)) {
    for (const t of lijst) {
      totaal++;
      if (t.klaar) klaar++;
      if (per_type[t.type]) {
        per_type[t.type][1]++;
        if (t.klaar) per_type[t.type][0]++;
      }
    }
  }
  const pct = percentage(klaar, totaal);

  $("#vak-titel").textContent = vak.naam;
  $("#vak-sub").textContent = totaal === 0
    ? "Nog geen taken in dit vak."
    : `${klaar} van ${totaal} taken afgerond`;
  $("#vak-chip").replaceWith(Object.assign(maakVakChip(vak, true), { id: "vak-chip" }));

  const typeLabels = { opdracht: "Opdrachten", theorie: "Theorie", labo: "Labo" };
  const typesHtml = TYPES.map(type => {
    const [k, t] = per_type[type];
    return el("div", { class: `vak-progress-type type-${type}` }, [
      el("div", { class: "type-kop" }, [el("span", { class: "type-stip" }), typeLabels[type]]),
      el("strong", {}, `${k}/${t}`),
      maakMeter(percentage(k, t), "var(--type-kleur)")
    ]);
  });

  const pDiv = $("#vak-progress");
  pDiv.innerHTML = "";
  pDiv.append(
    el("div", { class: "vak-progress-hoofd" }, [
      el("div", { class: "vak-progress-label" }, "Voortgang"),
      el("div", { class: "vak-progress-pct" }, `${pct}%`),
      maakMeter(pct, vak.kleur)
    ]),
    el("div", { class: "vak-progress-types" }, typesHtml)
  );

  renderOnderdelen(vak.id);
}

function bouwBoom(onderdelen) {
  const map = {};
  const roots = [];
  for (const o of onderdelen) {
    map[o.id] = { ...o, children: [] };
  }
  for (const o of onderdelen) {
    if (o.parent_id && map[o.parent_id]) {
      map[o.parent_id].children.push(map[o.id]);
    } else {
      roots.push(map[o.id]);
    }
  }
  return roots;
}

// =========================================================
// ONDERDELEN + TAKEN RENDEREN
// =========================================================
function renderOnderdelen(vakId) {
  const lijst = $("#onderdelen-lijst");
  lijst.innerHTML = "";
  const boom = state.onderdelen[vakId] || [];

  if (boom.length === 0) {
    $("#onderdelen-leeg").classList.remove("verborgen");
    return;
  }
  $("#onderdelen-leeg").classList.add("verborgen");

  for (const o of boom) {
    lijst.appendChild(maakOnderdeelElement(o, false));
  }
}

// Telt taken van een onderdeel inclusief alle sub-onderdelen (elk niveau diep).
function telTaken(o) {
  const eigen = state.taken[o.id] || [];
  let klaar = eigen.filter(t => t.klaar).length;
  let totaal = eigen.length;
  for (const c of o.children) {
    const [k, t] = telTaken(c);
    klaar += k;
    totaal += t;
  }
  return [klaar, totaal];
}

function maakOnderdeelElement(o, isSub) {
  const isOpen = state.openOnderdelen.has(o.id);
  const takenVanO = state.taken[o.id] || [];
  const [klaar, totaal] = telTaken(o);

  const kop = el("div", {
    class: "onderdeel-kop",
    onclick: (ev) => {
      if (ev.target.closest(".onderdeel-acties")) return;
      toggleOnderdeel(o.id);
    }
  }, [
    el("span", { class: "onderdeel-pijl" }, svgIcoon(ICOON.pijl, 14, 2.2)),
    el("span", { class: "onderdeel-titel" }, o.titel),
    totaal > 0 ? el("span", {
      class: "onderdeel-teller" + (klaar === totaal ? " compleet" : "")
    }, `${klaar}/${totaal}`) : null,
    el("div", { class: "onderdeel-acties" }, [
      el("button", {
        class: "icoon-knop klein", title: "Sub-onderdeel toevoegen",
        onclick: (ev) => { ev.stopPropagation(); openModalOnderdeel(null, o.id); }
      }, svgIcoon(ICOON.plus, 14, 2.2)),
      el("button", {
        class: "icoon-knop klein", title: "Naam wijzigen",
        onclick: (ev) => { ev.stopPropagation(); openModalOnderdeel(o); }
      }, svgIcoon(ICOON.potlood, 14, 2)),
      el("button", {
        class: "icoon-knop klein", title: "Verwijderen",
        onclick: (ev) => { ev.stopPropagation(); bevestigVerwijderOnderdeel(o); }
      }, svgIcoon(ICOON.prullenbak, 14, 2))
    ])
  ]);

  const body = el("div", { class: "onderdeel-body" });

  // Taken van dit onderdeel
  const takenDiv = el("div", { class: "taken-lijst" });
  for (const t of takenVanO) {
    takenDiv.appendChild(maakTaakElement(t));
  }
  body.appendChild(takenDiv);

  // "Taak toevoegen"-link
  body.appendChild(el("button", {
    class: "taak-toevoegen-link",
    onclick: () => openModalTaak(null, o.id)
  }, [
    svgIcoon(ICOON.plus, 13, 2.2),
    "Taak toevoegen"
  ]));

  // Sub-onderdelen
  if (o.children.length > 0) {
    const subLijst = el("div", { class: "onderdeel-sub-lijst" });
    for (const c of o.children) {
      subLijst.appendChild(maakOnderdeelElement(c, true));
    }
    body.appendChild(subLijst);
  }

  const wrapper = el("div", {
    class: "onderdeel" + (isOpen ? " open" : "") + (isSub ? " sub" : ""),
    dataset: { onderdeelId: o.id }
  }, [kop, body]);

  return wrapper;
}

function toggleOnderdeel(id) {
  const wrapper = document.querySelector(`[data-onderdeel-id="${id}"]`);
  if (!wrapper) return;
  const open = wrapper.classList.toggle("open");
  if (open) state.openOnderdelen.add(id);
  else state.openOnderdelen.delete(id);
  localStorage.setItem("openOnderdelen", JSON.stringify([...state.openOnderdelen]));
}

function maakTaakElement(t) {
  const deadlineStatus = datumStatus(t.deadline);
  const streefStatus = datumStatus(t.streefdatum);

  const datumDelen = [];
  if (t.deadline) {
    datumDelen.push(el("span", {
      class: `taak-datum deadline ${deadlineStatus}`,
      title: `Harde deadline (${datumVerschilLabel(t.deadline)})`
    }, [
      svgIcoon(ICOON.vlag, 12, 2.2),
      formatteerDatum(t.deadline)
    ]));
  }
  if (t.streefdatum) {
    datumDelen.push(el("span", {
      class: `taak-datum streef ${streefStatus}`,
      title: `Persoonlijk streefmoment (${datumVerschilLabel(t.streefdatum)})`
    }, [
      svgIcoon(ICOON.doel, 12, 2.2),
      formatteerDatum(t.streefdatum)
    ]));
  }

  const checkbox = el("input", { type: "checkbox" });
  checkbox.checked = !!t.klaar;
  checkbox.addEventListener("change", () => toggleTaakKlaar(t.id, checkbox.checked));

  const wrapper = el("div", {
    class: "taak" + (t.klaar ? " klaar" : ""),
    dataset: { taakId: t.id }
  }, [
    checkbox,
    el("span", { class: "taak-titel" }, t.titel),
    el("span", { class: `taak-type ${t.type}` }, TYPE_LABELS[t.type] || t.type),
    ...datumDelen,
    el("div", { class: "taak-acties" }, [
      el("button", {
        class: "icoon-knop klein", title: "Bewerken",
        onclick: () => openModalTaak(t)
      }, svgIcoon(ICOON.potlood, 13, 2)),
      el("button", {
        class: "icoon-knop klein", title: "Verwijderen",
        onclick: () => bevestigVerwijderTaak(t)
      }, svgIcoon(ICOON.prullenbak, 13, 2))
    ])
  ]);
  return wrapper;
}

async function toggleTaakKlaar(id, klaar) {
  try {
    await api(`/taken/${id}`, "PUT", { klaar });
    // Lokale state bijwerken en opnieuw tekenen; geen volledige herlaadbeurt nodig
    for (const oid in state.taken) {
      const t = state.taken[oid].find(x => x.id === id);
      if (t) { t.klaar = klaar ? 1 : 0; break; }
    }
  } catch (e) {
    // Mislukt: renderVak zet de checkbox terug op de oude waarde
  }
  renderVak();
}

// =========================================================
// DEADLINES
// =========================================================
async function renderDeadlines() {
  try {
    const data = await api("/overzicht");

    // Harde deadlines
    const dl = $("#deadlines-lijst");
    dl.innerHTML = "";
    const deadlines = data.deadlines
      .filter(t => !t.klaar)
      .sort((a, b) => (a.deadline || "").localeCompare(b.deadline || ""));

    if (deadlines.length === 0) {
      $("#deadlines-leeg").classList.remove("verborgen");
    } else {
      $("#deadlines-leeg").classList.add("verborgen");
      renderGroepen(dl, deadlines, "deadline");
    }

    // Streefmomenten
    const sl = $("#streef-lijst");
    sl.innerHTML = "";
    const streef = data.streefmomenten
      .filter(t => !t.klaar)
      .sort((a, b) => (a.streefdatum || "").localeCompare(b.streefdatum || ""));

    if (streef.length === 0) {
      $("#streef-leeg").classList.remove("verborgen");
    } else {
      $("#streef-leeg").classList.add("verborgen");
      renderGroepen(sl, streef, "streef");
    }
  } catch (e) {
    console.error(e);
  }
}

// Verdeelt (gesorteerde) taken in tijdsgroepen: te laat, vandaag, deze week, later.
function renderGroepen(container, taken, soort) {
  const groepen = [
    { sleutel: "verlopen", titel: "Te laat", icoon: ICOON.alarm, taken: [] },
    { sleutel: "vandaag", titel: "Vandaag", icoon: ICOON.klok, taken: [] },
    { sleutel: "week", titel: "Komende 7 dagen", icoon: null, taken: [] },
    { sleutel: "later", titel: "Later", icoon: null, taken: [] }
  ];
  for (const t of taken) {
    const dagen = dagenTot(soort === "deadline" ? t.deadline : t.streefdatum);
    const idx = dagen < 0 ? 0 : dagen === 0 ? 1 : dagen <= 7 ? 2 : 3;
    groepen[idx].taken.push(t);
  }
  for (const g of groepen) {
    if (g.taken.length === 0) continue;
    container.appendChild(el("section", { class: `deadline-groep ${g.sleutel}` }, [
      el("h3", { class: "deadline-groep-kop" }, [
        g.icoon ? svgIcoon(g.icoon, 14, 2.2) : null,
        g.titel,
        el("span", { class: "aantal" }, String(g.taken.length))
      ]),
      ...g.taken.map(t => maakDeadlineItem(t, soort))
    ]));
  }
}

function maakDeadlineItem(t, soort) {
  const datum = soort === "deadline" ? t.deadline : t.streefdatum;
  const status = datumStatus(datum);
  const d = new Date(datum + "T00:00:00");

  return el("div", {
    class: `deadline-item ${status}`,
    tabindex: "0",
    role: "link",
    onclick: () => { location.hash = `#/vak/${t.vak_id}`; },
    onkeydown: (e) => { if (e.key === "Enter") location.hash = `#/vak/${t.vak_id}`; }
  }, [
    el("div", { class: "datum-tegel", title: d.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" }) }, [
      el("span", { class: "dag" }, String(d.getDate())),
      el("span", { class: "maand" }, d.toLocaleDateString("nl-BE", { month: "short" }).replace(".", ""))
    ]),
    el("div", { class: "deadline-info" }, [
      el("div", { class: "deadline-titel" }, t.titel),
      el("div", { class: "deadline-meta" }, [
        el("span", { class: "vak-stip", style: `background:${t.vak_kleur}` }),
        el("span", {}, t.vak_naam),
        el("span", { class: "scheiding" }, "·"),
        el("span", {}, t.onderdeel_titel),
        el("span", { class: "scheiding" }, "·"),
        el("span", {}, TYPE_LABELS[t.type] || t.type)
      ])
    ]),
    el("span", { class: "relatief " + status }, [
      status === "verlopen" ? svgIcoon(ICOON.alarm, 12, 2.2) : null,
      datumVerschilLabel(datum)
    ])
  ]);
}

// =========================================================
// MODALS
// =========================================================
function toonModal(id) {
  $(`#${id}`).classList.remove("verborgen");
}
function sluitModal(id) {
  $(`#${id}`).classList.add("verborgen");
}
function sluitAlleModals() {
  $$(".modal-achtergrond").forEach(m => m.classList.add("verborgen"));
}

// Kleurenpalet vullen
function renderKleurenPalet() {
  const palet = $("#kleuren-palet");
  palet.innerHTML = "";
  for (const kleur of state.kleuren) {
    const knop = el("button", {
      type: "button",
      class: "kleur-optie" + (kleur === state.geselecteerdeKleur ? " geselecteerd" : ""),
      style: `background:${kleur}`,
      title: kleur,
      onclick: () => {
        state.geselecteerdeKleur = kleur;
        renderKleurenPalet();
      }
    });
    palet.appendChild(knop);
  }
}

// --- Modal: Vak ---
function openModalVak(vak = null) {
  $("#modal-vak-titel").textContent = vak ? "Vak bewerken" : "Nieuw vak";
  $("#vak-id").value = vak ? vak.id : "";
  $("#vak-naam").value = vak ? vak.naam : "";
  state.geselecteerdeKleur = vak ? vak.kleur : "#4F7CAC";
  renderKleurenPalet();
  toonModal("modal-vak");
  setTimeout(() => $("#vak-naam").focus(), 50);
}

$("#form-vak").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("#vak-id").value;
  const naam = $("#vak-naam").value.trim();
  if (!naam) return;
  try {
    let nieuw = null;
    if (id) {
      await api(`/vakken/${id}`, "PUT", { naam, kleur: state.geselecteerdeKleur });
    } else {
      nieuw = await api("/vakken", "POST", { naam, kleur: state.geselecteerdeKleur });
    }
    sluitModal("modal-vak");
    toast(id ? "Vak bijgewerkt" : "Vak aangemaakt");
    await vernieuwSidebar();
    if (nieuw) location.hash = `#/vak/${nieuw.id}`;
    else route();
  } catch (e) {}
});

// --- Modal: Onderdeel ---
function openModalOnderdeel(onderdeel = null, parentId = null) {
  $("#modal-onderdeel-titel").textContent =
    onderdeel ? "Onderdeel bewerken" : parentId ? "Nieuw sub-onderdeel" : "Nieuw onderdeel";
  $("#onderdeel-id").value = onderdeel ? onderdeel.id : "";
  $("#onderdeel-parent-id").value =
    onderdeel ? (onderdeel.parent_id || "") : (parentId || "");
  $("#onderdeel-titel").value = onderdeel ? onderdeel.titel : "";

  const context = $("#onderdeel-context");
  if (parentId) {
    const parent = zoekOnderdeel(state.onderdelen[state.actiefVakId] || [], parentId);
    context.textContent = parent ? `Onder: ${parent.titel}` : "";
  } else {
    context.textContent = "";
  }

  toonModal("modal-onderdeel");
  setTimeout(() => $("#onderdeel-titel").focus(), 50);
}

function zoekOnderdeel(boom, id) {
  for (const o of boom) {
    if (o.id === id) return o;
    const gevonden = zoekOnderdeel(o.children || [], id);
    if (gevonden) return gevonden;
  }
  return null;
}

$("#form-onderdeel").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("#onderdeel-id").value;
  const parentId = $("#onderdeel-parent-id").value;
  const titel = $("#onderdeel-titel").value.trim();
  if (!titel || !state.actiefVakId) return;
  try {
    if (id) {
      await api(`/onderdelen/${id}`, "PUT", { titel });
    } else {
      await api("/onderdelen", "POST", {
        vak_id: state.actiefVakId,
        titel,
        parent_id: parentId ? parseInt(parentId, 10) : null
      });
    }
    sluitModal("modal-onderdeel");
    toast(id ? "Onderdeel bijgewerkt" : "Onderdeel aangemaakt");
    await laadVak(state.actiefVakId);
  } catch (e) {}
});

// --- Modal: Taak ---
function openModalTaak(taak = null, onderdeelId = null) {
  $("#modal-taak-titel").textContent = taak ? "Taak bewerken" : "Nieuwe taak";
  $("#taak-id").value = taak ? taak.id : "";
  $("#taak-onderdeel-id").value = taak ? taak.onderdeel_id : onderdeelId;
  $("#taak-titel").value = taak ? taak.titel : "";
  $("#taak-type").value = taak ? taak.type : "opdracht";
  $("#taak-deadline").value = taak && taak.deadline ? taak.deadline : "";
  $("#taak-streefdatum").value = taak && taak.streefdatum ? taak.streefdatum : "";
  toonModal("modal-taak");
  setTimeout(() => $("#taak-titel").focus(), 50);
}

$("#form-taak").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("#taak-id").value;
  const onderdeelId = $("#taak-onderdeel-id").value;
  const titel = $("#taak-titel").value.trim();
  if (!titel || !onderdeelId) return;
  const payload = {
    titel,
    type: $("#taak-type").value,
    deadline: $("#taak-deadline").value || null,
    streefdatum: $("#taak-streefdatum").value || null
  };
  try {
    if (id) {
      await api(`/taken/${id}`, "PUT", payload);
    } else {
      await api("/taken", "POST", { ...payload, onderdeel_id: parseInt(onderdeelId, 10) });
    }
    sluitModal("modal-taak");
    toast(id ? "Taak bijgewerkt" : "Taak aangemaakt");
    if (state.actiefVakId) await laadVak(state.actiefVakId);
  } catch (e) {}
});

// --- Bevestig verwijderen ---
let bevestigCallback = null;

function bevestig(titel, tekst, cb, knopTekst = "Verwijderen") {
  $("#modal-bevestig-titel").textContent = titel;
  $("#modal-bevestig-tekst").textContent = tekst;
  $("#knop-bevestig-ja").textContent = knopTekst;
  bevestigCallback = cb;
  toonModal("modal-bevestig");
}

$("#knop-bevestig-ja").addEventListener("click", async () => {
  const cb = bevestigCallback;
  bevestigCallback = null;
  sluitModal("modal-bevestig");
  if (cb) {
    try { await cb(); } catch (e) { /* fout is al getoond via toast */ }
  }
});

function bevestigVerwijderVak(vak) {
  bevestig("Vak verwijderen?",
    `"${vak.naam}" en alle onderdelen en taken erin worden permanent verwijderd.`,
    async () => {
      await api(`/vakken/${vak.id}`, "DELETE");
      toast("Vak verwijderd");
      await vernieuwSidebar();
      location.hash = "#/";
    });
}

function bevestigAfsluiten() {
  bevestig("App afsluiten?",
    "De app stopt op de achtergrond. Je gegevens zijn al opgeslagen. " +
    "Dubbelklik op het bureaubladicoon om ze later opnieuw te starten.",
    async () => {
      await api("/afsluiten", "POST");
      $("#gesloten").classList.remove("verborgen");
      window.close();
    }, "Afsluiten");
}

function bevestigVerwijderOnderdeel(o) {
  bevestig("Onderdeel verwijderen?",
    `"${o.titel}" en alle taken en sub-onderdelen erin worden permanent verwijderd.`,
    async () => {
      await api(`/onderdelen/${o.id}`, "DELETE");
      toast("Onderdeel verwijderd");
      await laadVak(state.actiefVakId);
    });
}

function bevestigVerwijderTaak(t) {
  bevestig("Taak verwijderen?",
    `"${t.titel}" wordt permanent verwijderd.`,
    async () => {
      await api(`/taken/${t.id}`, "DELETE");
      toast("Taak verwijderd");
      await laadVak(state.actiefVakId);
    });
}

// =========================================================
// EVENT LISTENERS (globaal)
// =========================================================
document.addEventListener("DOMContentLoaded", async () => {
  // Thema + sidebar-state laden
  try {
    const inst = await api("/instellingen");
    pasThemaToe(inst.thema || "grey");
    pasSidebarToe(inst.sidebar_ingeklapt === "1");
  } catch (e) {
    pasThemaToe("grey");
  }

  // Knoppen
  $("#knop-sidebar-toggle").addEventListener("click", wisselSidebar);
  $$("[data-thema-keuze]").forEach(k => {
    k.addEventListener("click", () => kiesThema(k.dataset.themaKeuze));
  });
  $("#knop-afsluiten").addEventListener("click", bevestigAfsluiten);
  $("#knop-nieuw-vak").addEventListener("click", () => openModalVak());
  $("#knop-vak-toevoegen-boven").addEventListener("click", () => openModalVak());
  $("#knop-onderdeel-toevoegen").addEventListener("click", () => openModalOnderdeel());
  $("#knop-terug").addEventListener("click", () => { location.hash = "#/"; });

  // Vak bewerken/verwijderen
  $("#knop-vak-bewerken").addEventListener("click", async () => {
    if (!state.actiefVakId) return;
    const vak = await api(`/vakken/${state.actiefVakId}`);
    if (vak) openModalVak(vak);
  });
  $("#knop-vak-verwijderen").addEventListener("click", async () => {
    if (!state.actiefVakId) return;
    const vak = await api(`/vakken/${state.actiefVakId}`);
    if (vak) bevestigVerwijderVak(vak);
  });

  // Modal sluit-knoppen
  $$("[data-sluit-modal]").forEach(btn => {
    btn.addEventListener("click", () => sluitModal(btn.dataset.sluitModal));
  });

  // Klik buiten modal sluit
  $$(".modal-achtergrond").forEach(m => {
    m.addEventListener("click", (e) => {
      if (e.target === m) m.classList.add("verborgen");
    });
  });

  // Escape sluit modals
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") sluitAlleModals();
  });

  // Tabs op deadlines-pagina
  $$(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach(t => t.classList.remove("actief"));
      tab.classList.add("actief");
      const naam = tab.dataset.tab;
      $$(".tab-paneel").forEach(p => p.classList.add("verborgen"));
      $(`#tab-${naam}`).classList.remove("verborgen");
    });
  });

  // Routing (vakkenlijst eerst, zodat de zijbalk ook na verversen gevuld is)
  await vernieuwSidebar();
  window.addEventListener("hashchange", route);
  route();
});