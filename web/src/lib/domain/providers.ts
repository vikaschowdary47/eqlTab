/**
 * "Who sends your bills?" (spec sections 17.2 and 21.4).
 *
 * The household picks its state and its electricity, gas and internet companies. The Gmail scan then
 * looks only at mail from those companies. Gmail's `from:` matches the sender's name as well as
 * the address, so we search by company name and don't need to know every company's sending domain.
 * After the first real bill, the exact sender address is remembered (see learnedSenders) so later
 * scans are exact.
 *
 * Lists are suggestions, not limits: "Someone else" lets people type any company.
 *
 * Sources (checked Oct 2026): Illinois areas (utilitiesformyhome.com), Connecticut gas companies
 * (portal.ct.gov/pura), Texas largest retail providers (electricityplans.com), Chicago and Connecticut
 * internet coverage (broadbandmap.com), NY/NJ/MA/PA/IL/CT utilities (ENGIE utility list).
 * Confirmed sender addresses: Peoples Gas noreply@peoplesgasdelivery.com, Eversource
 * noreply@notifications.eversource.com; SCG soconngas.com, CNG cngcorp.com, UI uinet.com.
 * CA, FL, GA and MI lists are the well-known utilities and were not checked against a source.
 */

export const BILL_CATEGORIES = ["electricity", "gas", "internet"] as const;
export type BillCategory = (typeof BILL_CATEGORIES)[number];

export const CATEGORY_COPY: Record<BillCategory, { label: string; question: string; emoji: string }> = {
  electricity: { label: "Electricity", question: "Who sends your electricity bill?", emoji: "⚡" },
  gas: { label: "Gas", question: "Who sends your gas bill?", emoji: "🔥" },
  internet: { label: "Internet", question: "Who's your internet provider?", emoji: "📶" },
};

export interface Provider {
  id: string;
  name: string;
  /** Words Gmail's from: should match (sender name or address). Distinctive, lowercase. */
  keywords: string[];
  /** Short hint shown under the name in the picker, e.g. "Chicago city". */
  hint?: string;
}

const p = (id: string, name: string, keywords: string[], hint?: string): Provider => ({ id, name, keywords, hint });

// ---------- shared providers ----------
const XFINITY = p("xfinity", "Xfinity (Comcast)", ["xfinity", "comcast"]);
const ATT = p("att", "AT&T", ["att", "at&t"]);
const SPECTRUM = p("spectrum", "Spectrum", ["spectrum", "charter"]);
const VERIZON_FIOS = p("verizon", "Verizon Fios", ["verizon"]);
const FRONTIER = p("frontier", "Frontier", ["frontier"]);
const OPTIMUM = p("optimum", "Optimum", ["optimum", "altice"]);
const ASTOUND = p("astound", "Astound (RCN, Grande, Wave)", ["astound", "rcn", "grande"]);
const COX = p("cox", "Cox", ["cox"]);
const WOW = p("wow", "WOW!", ["wowway", "wow!"]);
const GOOGLE_FIBER = p("google-fiber", "Google Fiber", ["google fiber"]);
/** Available almost everywhere; added to every state's internet list. */
const NATIONAL_INTERNET = [
  p("tmobile-home", "T-Mobile Home Internet", ["t-mobile", "tmobile"]),
  p("verizon-home", "Verizon 5G Home", ["verizon"]),
  p("att-air", "AT&T Internet Air", ["att", "at&t"]),
  p("starlink", "Starlink", ["starlink"]),
];

interface StateProviders { name: string; electricity: Provider[]; gas: Provider[]; internet: Provider[]; note?: string }

export const STATES: Record<string, StateProviders> = {
  IL: {
    name: "Illinois",
    electricity: [
      p("comed", "ComEd", ["comed"], "Chicago & north"),
      p("ameren-il", "Ameren Illinois", ["ameren"], "Central & south"),
      p("midamerican", "MidAmerican Energy", ["midamerican"], "Quad Cities"),
    ],
    gas: [
      p("peoples-gas", "Peoples Gas", ["peoples gas", "peoplesgasdelivery"], "Chicago city"),
      p("nicor", "Nicor Gas", ["nicor"], "Suburbs"),
      p("north-shore-gas", "North Shore Gas", ["north shore gas", "northshoregasdelivery"], "North Shore"),
      p("ameren-il-gas", "Ameren Illinois", ["ameren"], "Central & south"),
      p("midamerican-gas", "MidAmerican Energy", ["midamerican"], "Quad Cities"),
    ],
    internet: [XFINITY, ATT, ASTOUND, WOW, ...NATIONAL_INTERNET],
  },
  CT: {
    name: "Connecticut",
    electricity: [
      p("eversource", "Eversource", ["eversource"], "Most of CT"),
      p("ui", "United Illuminating (UI)", ["uinet", "united illuminating"], "New Haven & Bridgeport"),
    ],
    gas: [
      p("scg", "Southern Connecticut Gas (SCG)", ["soconngas", "southern connecticut gas", "scg"], "New Haven & Bridgeport"),
      p("cng", "Connecticut Natural Gas (CNG)", ["cngcorp", "connecticut natural gas", "cng"], "Hartford & Greenwich"),
      p("eversource-gas", "Eversource Gas (formerly Yankee Gas)", ["eversource", "yankee gas"]),
    ],
    internet: [XFINITY, FRONTIER, OPTIMUM, SPECTRUM, p("gonetspeed", "GoNetspeed", ["gonetspeed"]), p("breezeline", "Breezeline", ["breezeline"]), ...NATIONAL_INTERNET],
  },
  TX: {
    name: "Texas",
    note: "Most of Texas picks its own electricity company. Choose the one on your bill, not the one that fixes power lines (Oncor, CenterPoint).",
    electricity: [
      p("reliant", "Reliant", ["reliant"]),
      p("txu", "TXU Energy", ["txu"]),
      p("just-energy", "Just Energy", ["just energy", "justenergy"]),
      p("cirro", "Cirro Energy", ["cirro"]),
      p("discount-power", "Discount Power", ["discount power", "discountpower"]),
      p("ambit", "Ambit Energy", ["ambit"]),
      p("gexa", "Gexa Energy", ["gexa"]),
      p("green-mountain", "Green Mountain Energy", ["green mountain", "greenmountain"]),
      p("direct-energy", "Direct Energy", ["direct energy", "directenergy"]),
      p("4change", "4Change Energy", ["4change"]),
      p("champion", "Champion Energy", ["champion energy", "championenergy"]),
      p("austin-energy", "Austin Energy", ["austin energy", "austinenergy"], "City of Austin"),
      p("cps", "CPS Energy", ["cps energy", "cpsenergy"], "San Antonio"),
      p("el-paso-electric", "El Paso Electric", ["el paso electric", "epelectric"], "El Paso"),
      p("entergy-tx", "Entergy Texas", ["entergy"], "Southeast Texas"),
    ],
    gas: [
      p("atmos", "Atmos Energy", ["atmos"]),
      p("centerpoint-gas", "CenterPoint Energy", ["centerpoint"]),
      p("texas-gas-service", "Texas Gas Service", ["texas gas service", "texasgasservice"]),
      p("cps-gas", "CPS Energy", ["cps energy", "cpsenergy"], "San Antonio"),
    ],
    internet: [ATT, SPECTRUM, XFINITY, FRONTIER, OPTIMUM, ASTOUND, GOOGLE_FIBER, ...NATIONAL_INTERNET],
  },
  CA: {
    name: "California",
    electricity: [p("pge", "PG&E", ["pg&e", "pge"]), p("sce", "Southern California Edison", ["southern california edison", "sce"]), p("sdge", "SDG&E", ["sdg&e", "sdge"]), p("ladwp", "LADWP", ["ladwp"], "Los Angeles"), p("smud", "SMUD", ["smud"], "Sacramento")],
    gas: [p("socalgas", "SoCalGas", ["socalgas"]), p("pge-gas", "PG&E", ["pg&e", "pge"]), p("sdge-gas", "SDG&E", ["sdg&e", "sdge"])],
    internet: [ATT, SPECTRUM, XFINITY, FRONTIER, COX, ...NATIONAL_INTERNET],
  },
  NY: {
    name: "New York",
    electricity: [p("coned", "Con Edison", ["coned", "con edison"]), p("national-grid", "National Grid", ["national grid", "nationalgrid"]), p("nyseg", "NYSEG", ["nyseg"]), p("rge", "RG&E", ["rg&e", "rge"]), p("pseg-li", "PSEG Long Island", ["pseg"]), p("central-hudson", "Central Hudson", ["central hudson", "cenhud"]), p("oru", "Orange & Rockland", ["orange & rockland", "oru"])],
    gas: [p("coned-gas", "Con Edison", ["coned", "con edison"]), p("national-grid-gas", "National Grid", ["national grid", "nationalgrid"]), p("national-fuel", "National Fuel", ["national fuel", "natfuel"]), p("nyseg-gas", "NYSEG", ["nyseg"])],
    internet: [SPECTRUM, VERIZON_FIOS, OPTIMUM, FRONTIER, ASTOUND, ...NATIONAL_INTERNET],
  },
  NJ: {
    name: "New Jersey",
    electricity: [p("pseg-nj", "PSE&G", ["pse&g", "pseg"]), p("jcpl", "JCP&L", ["jcp&l", "jcpl", "firstenergy"]), p("ace", "Atlantic City Electric", ["atlantic city electric", "atlanticcityelectric"]), p("rockland-nj", "Rockland Electric (O&R)", ["orange & rockland", "oru"])],
    gas: [p("pseg-nj-gas", "PSE&G", ["pse&g", "pseg"]), p("njng", "New Jersey Natural Gas", ["njng", "new jersey natural gas"]), p("sjg", "South Jersey Gas", ["south jersey gas", "southjerseygas"]), p("etown", "Elizabethtown Gas", ["elizabethtown gas", "elizabethtowngas"])],
    internet: [VERIZON_FIOS, OPTIMUM, XFINITY, ...NATIONAL_INTERNET],
  },
  MA: {
    name: "Massachusetts",
    electricity: [p("eversource-ma", "Eversource", ["eversource"]), p("national-grid-ma", "National Grid", ["national grid", "nationalgrid"]), p("unitil-ma", "Unitil", ["unitil"])],
    gas: [p("national-grid-ma-gas", "National Grid", ["national grid", "nationalgrid"]), p("eversource-ma-gas", "Eversource", ["eversource"])],
    internet: [XFINITY, VERIZON_FIOS, ASTOUND, SPECTRUM, ...NATIONAL_INTERNET],
  },
  MI: {
    name: "Michigan",
    electricity: [p("dte", "DTE Energy", ["dte"]), p("consumers", "Consumers Energy", ["consumers energy", "consumersenergy"])],
    gas: [p("dte-gas", "DTE Energy", ["dte"]), p("consumers-gas", "Consumers Energy", ["consumers energy", "consumersenergy"]), p("semco", "SEMCO Energy", ["semco"])],
    internet: [XFINITY, ATT, SPECTRUM, WOW, ...NATIONAL_INTERNET],
  },
  PA: {
    name: "Pennsylvania",
    electricity: [p("peco", "PECO", ["peco"]), p("ppl", "PPL Electric", ["ppl"]), p("duquesne", "Duquesne Light", ["duquesne"]), p("firstenergy-pa", "FirstEnergy (Met-Ed, Penelec, Penn Power, West Penn)", ["firstenergy", "met-ed", "penelec"])],
    gas: [p("peco-gas", "PECO", ["peco"]), p("pgw", "Philadelphia Gas Works", ["pgw", "philadelphia gas works"]), p("columbia-pa", "Columbia Gas", ["columbia gas", "columbiagas"]), p("peoples-pa", "Peoples Natural Gas", ["peoples natural gas", "peoples-gas"]), p("ugi", "UGI", ["ugi"])],
    internet: [XFINITY, VERIZON_FIOS, SPECTRUM, ...NATIONAL_INTERNET],
  },
  FL: {
    name: "Florida",
    electricity: [p("fpl", "FPL", ["fpl"]), p("duke-fl", "Duke Energy", ["duke energy", "duke-energy"]), p("teco", "Tampa Electric", ["tampa electric", "tecoenergy"]), p("jea", "JEA", ["jea"], "Jacksonville")],
    gas: [p("teco-gas", "TECO Peoples Gas", ["peoples gas", "peoplesgas"]), p("fcg", "Florida City Gas", ["florida city gas", "floridacitygas"])],
    internet: [XFINITY, ATT, SPECTRUM, FRONTIER, ...NATIONAL_INTERNET],
  },
  GA: {
    name: "Georgia",
    electricity: [p("georgia-power", "Georgia Power", ["georgia power", "georgiapower"])],
    gas: [p("gng", "Georgia Natural Gas", ["georgia natural gas", "gng"]), p("scana", "SCANA Energy", ["scana"]), p("gas-south", "Gas South", ["gas south", "gassouth"])],
    internet: [ATT, XFINITY, SPECTRUM, ...NATIONAL_INTERNET],
  },
};

export const STATE_OPTIONS = Object.entries(STATES).map(([code, s]) => ({ code, name: s.name })).sort((a, b) => a.name.localeCompare(b.name));
/** Any other state: no suggestions for power and gas, national internet only. */
export const OTHER_STATE = "OTHER";

export function providersFor(state: string, category: BillCategory): Provider[] {
  const s = STATES[state];
  if (s) return s[category];
  return category === "internet" ? [XFINITY, ATT, SPECTRUM, VERIZON_FIOS, FRONTIER, COX, OPTIMUM, ...NATIONAL_INTERNET] : [];
}

/** What the household chose for one category. */
export interface BillSource {
  category: BillCategory;
  /** A provider id from the list, or null when they typed a name. */
  providerId: string | null;
  name: string;
  keywords: string[];
}

/** Keywords for a company someone typed: the full name, plus one distinctive word. */
export function keywordsForTyped(name: string): string[] {
  const clean = name.toLowerCase().replace(/[^a-z0-9&' -]/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const words = clean.split(" ").filter((w) => w.length >= 4 && !GENERIC_WORDS.has(w));
  return [...new Set([clean, ...(words.length ? [words[0]] : [])])];
}
const GENERIC_WORDS = new Set(["energy", "electric", "electricity", "power", "natural", "company", "service", "services", "utility", "utilities", "internet", "city", "light"]);

export function sourceFromChoice(state: string, category: BillCategory, choice: { providerId?: string | null; typed?: string | null }): BillSource | null {
  if (choice.providerId) {
    const found = providersFor(state, category).find((x) => x.id === choice.providerId);
    return found ? { category, providerId: found.id, name: found.name, keywords: found.keywords } : null;
  }
  const typed = (choice.typed ?? "").trim().slice(0, 60);
  const keywords = keywordsForTyped(typed);
  return typed && keywords.length ? { category, providerId: null, name: typed, keywords } : null;
}

// ---------- Gmail search and matching ----------

function quote(k: string) {
  return /[\s&]/.test(k) ? `"${k.replace(/"/g, "")}"` : k;
}

/** An exact sender address remembered after a real bill from it, and which company it was. */
export interface LearnedSender { address: string; name: string; category: BillCategory }

/** Gmail query for the chosen companies plus any exact sender addresses already learned. */
export function sourcesSearchQuery(sources: BillSource[], learned: LearnedSender[] = [], days = 90): string | null {
  const terms = [...new Set([...sources.flatMap((s) => s.keywords), ...learned.map((l) => l.address)])].map(quote);
  if (terms.length === 0) return null;
  return `newer_than:${days}d from:(${terms.join(" OR ")}) -in:chats`;
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9&@.-]+/g, " ").trim();
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Which chosen company a sender line belongs to, or null. "ComEd <noreply@e.comed.com>" → ComEd. */
export function matchSource(from: string, sources: BillSource[], learned: LearnedSender[] = []): { name: string; category: BillCategory } | null {
  const address = senderAddress(from);
  const known = address ? learned.find((l) => l.address === address) : undefined;
  if (known) return { name: known.name, category: known.category };
  const f = normalize(from);
  for (const s of sources) {
    for (const k of s.keywords) {
      // Whole word in the name or address: "comed" matches "e.comed.com" and "ComEd", not "becomedy".
      if (new RegExp(`(^|[\\s.@-])${escapeRe(k.toLowerCase())}($|[\\s.@-])`).test(f)) return { name: s.name, category: s.category };
    }
  }
  return null;
}

/** The address to remember after a real bill from it. */
export function senderAddress(from: string): string | null {
  const a = (/<([^>]+)>/.exec(from)?.[1] ?? from).trim().toLowerCase();
  return /^[^\s@]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(a) ? a : null;
}

/** Validates what the browser sent. Unknown ids and empty names are dropped, never guessed. */
export function parseSources(state: string, raw: unknown): BillSource[] | null {
  if (!Array.isArray(raw) || raw.length > 12) return null;
  const out: BillSource[] = [];
  for (const r of raw) {
    const o = r as { category?: unknown; providerId?: unknown; typed?: unknown };
    if (!BILL_CATEGORIES.includes(o.category as BillCategory)) return null;
    const s = sourceFromChoice(state, o.category as BillCategory, { providerId: typeof o.providerId === "string" ? o.providerId : null, typed: typeof o.typed === "string" ? o.typed : null });
    if (s) out.push(s);
  }
  return out;
}
