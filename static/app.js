/* =========================================================
   Productivity App — app.js
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
    const res = await fetch(`/api${pad}`, opties);
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
  taak: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
};

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

function datumVerschilLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  const v = new Date(vandaagISO() + "T00:00:00");
  const dagen = Math.round((d - v) / 86400000);
  if (dagen < 0) return `${Math.abs(dagen)}d te laat`;
  if (dagen === 0) return "vandaag";
  if (dagen === 1) return "morgen";
  return `over ${dagen}d`;
}

// =========================================================
// THEMA + SIDEBAR STATE
// =========================================================
function pasThemaToe(thema) {
  state.thema = thema;
  document.documentElement.dataset.thema = thema;
  const labels = { grey: "Grey", light: "Light", dark: "Dark" };
  $("#thema-label").textContent = labels[thema] || thema;
}

function wisselThema() {
  const volgorde = ["grey", "light", "dark"];
  const idx = volgorde.indexOf(state.thema);
  const nieuw = volgorde[(idx + 1) % volgorde.length];
  pasThemaToe(nieuw);
  api("/instellingen", "PUT", { thema: nieuw }).catch(() => {});
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
  $$(".vak-nav-item").forEach(n => n.classList.remove("actief"));

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
  nav.innerHTML = "";
  if (state.vakken.length === 0) return;

  for (const v of state.vakken) {
    const item = el("button", {
      class: "vak-nav-item" + (v.id === state.actiefVakId ? " actief" : ""),
      title: v.naam,
      onclick: () => { location.hash = `#/vak/${v.id}`; }
    }, [
      el("span", { class: "vak-stip", style: `background:${v.kleur}` }),
      el("span", { class: "vak-nav-naam" }, v.naam)
    ]);
    nav.appendChild(item);
  }
}

// =========================================================
// OVERZICHT
// =========================================================
async function renderOverzicht() {
  try {
    const data = await api("/overzicht");
    state.vakken = data.vakken;
    renderSidebarVakken();

    const grid = $("#vakken-grid");
    grid.innerHTML = "";

    if (data.vakken.length === 0) {
      $("#overzicht-leeg").classList.remove("verborgen");
      return;
    }
    $("#overzicht-leeg").classList.add("verborgen");

    for (const v of data.vakken) {
      const p = v.progress;
      const pct = p.totaal === 0 ? 0 : Math.round((p.klaar / p.totaal) * 100);

      const tellers = [];
      const typeLabels = { opdracht: "Opdracht", theorie: "Theorie", labo: "Labo" };
      for (const [type, label] of Object.entries(typeLabels)) {
        const [klaar, totaal] = p.per_type[type] || [0, 0];
        if (totaal > 0) {
          tellers.push(el("span", { class: "vak-kaart-teller" }, [
            label + ": ",
            el("strong", {}, `${klaar}/${totaal}`)
          ]));
        }
      }

      const kaart = el("div", {
        class: "vak-kaart",
        onclick: () => { location.hash = `#/vak/${v.id}`; }
      }, [
        el("div", { class: "vak-kaart-kleur", style: `background:${v.kleur}` }),
        el("div", { class: "vak-kaart-kop" }, [
          el("span", { class: "vak-stip", style: `background:${v.kleur}` }),
          el("span", { class: "vak-kaart-naam" }, v.naam)
        ]),
        el("div", { class: "vak-kaart-progress-label" }, [
          el("span", {}, p.totaal === 0 ? "Nog geen taken" : `${p.klaar} van ${p.totaal} taken`),
          el("span", {}, `${pct}%`)
        ]),
        el("div", { class: "progress-balk" }, [
          el("div", { style: `width:${pct}%; background:${v.kleur}` })
        ]),
        tellers.length ? el("div", { class: "vak-kaart-tellers" }, tellers) : null
      ]);
      grid.appendChild(kaart);
    }
  } catch (e) {
    console.error(e);
  }
}

// =========================================================
// VAK DETAIL LADEN
// =========================================================
async function laadVak(id) {
  try {
    const [vak, onderdelen, alleTaken, overzicht] = await Promise.all([
      api(`/vakken/${id}`),
      api(`/onderdelen?vak_id=${id}`),
      api(`/taken`),
      api("/overzicht")
    ]);

    state.actiefVakId = id;
    state.onderdelen[id] = bouwBoom(onderdelen);
    state.taken = {};
    for (const t of alleTaken) {
      if (!state.taken[t.onderdeel_id]) state.taken[t.onderdeel_id] = [];
      state.taken[t.onderdeel_id].push(t);
    }

    // Sidebar vak actief markeren
    $$(".vak-nav-item").forEach(n => n.classList.remove("actief"));
    const navItems = $$(".vak-nav-item");
    const idx = state.vakken.findIndex(v => v.id === id);
    if (idx >= 0 && navItems[idx]) navItems[idx].classList.add("actief");

    // Header
    $("#vak-titel").textContent = vak.naam;
    $("#vak-titel").style.color = "";
    const vp = overzicht.vakken.find(v => v.id === id);
    if (vp) {
      const p = vp.progress;
      const pct = p.totaal === 0 ? 0 : Math.round((p.klaar / p.totaal) * 100);
      $("#vak-sub").textContent = p.totaal === 0
        ? "Nog geen taken in dit vak."
        : `${p.klaar} van ${p.totaal} taken afgerond.`;

      const typesHtml = [];
      const typeLabels = { opdracht: "Opdrachten", theorie: "Theorie", labo: "Labo" };
      for (const [type, label] of Object.entries(typeLabels)) {
        const [klaar, totaal] = p.per_type[type] || [0, 0];
        typesHtml.push(el("div", { class: "vak-progress-type" }, [
          el("strong", {}, `${klaar}/${totaal}`),
          el("span", {}, label)
        ]));
      }

      const pDiv = $("#vak-progress");
      pDiv.innerHTML = "";
      pDiv.appendChild(el("div", { class: "vak-progress-rij" }, [
        el("span", { class: "vak-progress-label" }, "Voortgang"),
        el("span", { class: "vak-progress-pct" }, `${pct}%`)
      ]));
      pDiv.appendChild(el("div", { class: "progress-balk" }, [
        el("div", { style: `width:${pct}%; background:${vak.kleur}` })
      ]));
      pDiv.appendChild(el("div", { class: "vak-progress-types" }, typesHtml));
    }

    renderOnderdelen(id);
  } catch (e) {
    console.error(e);
    location.hash = "#/";
  }
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

function maakOnderdeelElement(o, isSub) {
  const isOpen = state.openOnderdelen.has(o.id);
  const takenVanO = state.taken[o.id] || [];

  // Tel taken inclusief sub-onderdelen
  let totaal = takenVanO.length;
  let klaar = takenVanO.filter(t => t.klaar).length;
  for (const c of o.children) {
    const tc = state.taken[c.id] || [];
    totaal += tc.length;
    klaar += tc.filter(t => t.klaar).length;
  }

  const kop = el("div", {
    class: "onderdeel-kop",
    onclick: (ev) => {
      if (ev.target.closest(".onderdeel-acties")) return;
      toggleOnderdeel(o.id);
    }
  }, [
    el("span", { class: "onderdeel-pijl" }, svgIcoon(ICOON.pijl, 14, 2.2)),
    el("span", { class: "onderdeel-titel" }, o.titel),
    totaal > 0 ? el("span", { class: "onderdeel-teller" }, `${klaar}/${totaal}`) : null,
    el("div", { class: "onderdeel-acties" }, [
      el("button", {
        class: "icoon-knop", title: "Sub-onderdeel toevoegen",
        onclick: (ev) => { ev.stopPropagation(); openModalOnderdeel(null, o.id); }
      }, svgIcoon(ICOON.plus, 14, 2.2)),
      el("button", {
        class: "icoon-knop", title: "Naam wijzigen",
        onclick: (ev) => { ev.stopPropagation(); openModalOnderdeel(o); }
      }, svgIcoon(ICOON.potlood, 14, 2)),
      el("button", {
        class: "icoon-knop", title: "Verwijderen",
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
      title: "Harde deadline"
    }, [
      svgIcoon(ICOON.klok, 12, 2),
      formatteerDatum(t.deadline)
    ]));
  }
  if (t.streefdatum) {
    datumDelen.push(el("span", {
      class: `taak-datum streef ${streefStatus}`,
      title: "Persoonlijk streefmoment"
    }, [
      svgIcoon(ICOON.klok, 12, 2),
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
    el("span", { class: `taak-type ${t.type}` },
      t.type === "opdracht" ? "Opdracht" : t.type === "theorie" ? "Theorie" : "Labo"),
    ...datumDelen,
    el("div", { class: "taak-acties" }, [
      el("button", {
        class: "icoon-knop", title: "Bewerken",
        onclick: () => openModalTaak(t)
      }, svgIcoon(ICOON.potlood, 13, 2)),
      el("button", {
        class: "icoon-knop", title: "Verwijderen",
        onclick: () => bevestigVerwijderTaak(t)
      }, svgIcoon(ICOON.prullenbak, 13, 2))
    ])
  ]);
  return wrapper;
}

async function toggleTaakKlaar(id, klaar) {
  try {
    await api(`/taken/${id}`, "PUT", { klaar });
    // Optimistisch: lokale state updaten
    for (const oid in state.taken) {
      const t = state.taken[oid].find(x => x.id === id);
      if (t) { t.klaar = klaar ? 1 : 0; break; }
    }
    // Progress + teller herberekenen
    if (state.actiefVakId) {
      // Bewaar open-state
      const openState = new Set(state.openOnderdelen);
      await laadVak(state.actiefVakId);
      state.openOnderdelen = openState;
      // Re-render onderdelen met open-state
      renderOnderdelen(state.actiefVakId);
    }
  } catch (e) {
    // Zet checkbox terug
    renderOnderdelen(state.actiefVakId);
  }
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
      for (const t of deadlines) {
        dl.appendChild(maakDeadlineItem(t, "deadline"));
      }
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
      for (const t of streef) {
        sl.appendChild(maakDeadlineItem(t, "streef"));
      }
    }
  } catch (e) {
    console.error(e);
  }
}

function maakDeadlineItem(t, soort) {
  const datum = soort === "deadline" ? t.deadline : t.streefdatum;
  const status = datumStatus(datum);

  return el("div", {
    class: `deadline-item ${status}`,
    onclick: () => { location.hash = `#/vak/${t.vak_id}`; }
  }, [
    el("div", { class: "deadline-kleur", style: `background:${t.vak_kleur}` }),
    el("div", { class: "deadline-info" }, [
      el("div", { class: "deadline-titel" }, t.titel),
      el("div", { class: "deadline-meta" }, [
        el("span", {}, t.vak_naam),
        el("span", { class: "scheiding" }, "·"),
        el("span", {}, t.onderdeel_titel),
        el("span", { class: "scheiding" }, "·"),
        el("span", {}, t.type.charAt(0).toUpperCase() + t.type.slice(1))
      ])
    ]),
    el("div", { class: "deadline-datum " + status }, [
      formatteerDatum(datum),
      el("span", { class: "klein", style: "display:block;font-weight:500;opacity:0.8" },
        datumVerschilLabel(datum))
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
    if (id) {
      await api(`/vakken/${id}`, "PUT", { naam, kleur: state.geselecteerdeKleur });
    } else {
      const nieuw = await api("/vakken", "POST", { naam, kleur: state.geselecteerdeKleur });
      if (nieuw) {
        state.actiefVakId = nieuw.id;
        location.hash = `#/vak/${nieuw.id}`;
      }
    }
    sluitModal("modal-vak");
    toast(id ? "Vak bijgewerkt" : "Vak aangemaakt");
    await renderOverzicht();
    if (state.actiefVakId) {
      if (location.hash.includes("/vak/")) await laadVak(state.actiefVakId);
    }
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

function bevestig(titel, tekst, cb) {
  $("#modal-bevestig-titel").textContent = titel;
  $("#modal-bevestig-tekst").textContent = tekst;
  bevestigCallback = cb;
  toonModal("modal-bevestig");
}

$("#knop-bevestig-ja").addEventListener("click", async () => {
  if (bevestigCallback) {
    await bevestigCallback();
    bevestigCallback = null;
  }
  sluitModal("modal-bevestig");
});

function bevestigVerwijderVak(vak) {
  bevestig("Vak verwijderen?",
    `"${vak.naam}" en alle onderdelen en taken erin worden permanent verwijderd.`,
    async () => {
      await api(`/vakken/${vak.id}`, "DELETE");
      toast("Vak verwijderd");
      location.hash = "#/";
      await renderOverzicht();
    });
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
  $("#knop-thema").addEventListener("click", wisselThema);
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

  // Routing
  window.addEventListener("hashchange", route);
  route();
});