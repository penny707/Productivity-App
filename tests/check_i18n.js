// Controleert de vertalingen van de interface (static/i18n.js).
// Start met:  node tests/check_i18n.js
//
// - Engels en Nederlands hebben exact dezelfde sleutels.
// - Elke sleutel die app.js of index.html gebruikt, bestaat.
// - Elke sleutel wordt ergens gebruikt (geen vergeten teksten).

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const lees = (bestand) => fs.readFileSync(path.join(root, bestand), "utf8");

const context = { document: { documentElement: {} }, $$: () => [] };
vm.createContext(context);
vm.runInContext(lees("static/i18n.js") + "\nthis.VERTALINGEN = VERTALINGEN;", context);
const { en, nl } = context.VERTALINGEN;

const fouten = [];
const sleutelsEn = Object.keys(en);
const sleutelsNl = Object.keys(nl);
for (const k of sleutelsEn) if (!(k in nl)) fouten.push(`Ontbreekt in het Nederlands: ${k}`);
for (const k of sleutelsNl) if (!(k in en)) fouten.push(`Ontbreekt in het Engels: ${k}`);

// Gebruikte sleutels: elke tekst tussen aanhalingstekens in app.js die op een
// sleutel lijkt (bv. "kpi.overdue.some"), plus de data-i18n-attributen in de HTML.
const appJs = lees("static/app.js");
const html = lees("static/index.html");
const gebruikt = new Set();
for (const m of appJs.matchAll(/"([a-z]+(?:\.[a-zA-Z]+)+)"/g)) gebruikt.add(m[1]);
for (const m of html.matchAll(/data-i18n(?:-title|-placeholder|-aria-label)?="([^"]+)"/g)) gebruikt.add(m[1]);
// Sleutels die per taaktype worden opgebouwd: `type.${type}` en `types.${type}`
for (const type of ["opdracht", "theorie", "labo"]) {
  gebruikt.add(`type.${type}`);
  gebruikt.add(`types.${type}`);
}

for (const k of gebruikt) if (!(k in en)) fouten.push(`Gebruikt maar niet vertaald: ${k}`);
for (const k of sleutelsEn) if (!gebruikt.has(k)) fouten.push(`Vertaald maar nergens gebruikt: ${k}`);

// Plaatshouders ({naam}) moeten in beide talen dezelfde zijn
const plaatshouders = (w) => (typeof w === "string" ? [...w.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(",") : null);
for (const k of sleutelsEn) {
  if (k in nl && plaatshouders(en[k]) !== plaatshouders(nl[k])) {
    fouten.push(`Andere plaatshouders in ${k}: "${en[k]}" / "${nl[k]}"`);
  }
}

if (fouten.length) {
  console.error(fouten.join("\n"));
  process.exit(1);
}
console.log(`OK: ${sleutelsEn.length} sleutels in het Engels en Nederlands, ${gebruikt.size} gebruikt.`);
