// Rivera Press — the shop's catalogue, prices, press calendar and print artwork.
//
// Pure data and pure functions. No DOM, no imports, no side effects, so both the
// page and the WebMCP tools price a run from exactly the same numbers.

/* ---------------------------------------------------------------- helpers */

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const usd = (n) => '$' + round2(n).toFixed(2);

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(dateISO, n) {
  return new Date(Date.parse(dateISO + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
}

export function dayDiff(fromISO, toISO) {
  return Math.round((Date.parse(toISO + 'T12:00:00Z') - Date.parse(fromISO + 'T12:00:00Z')) / 86400000);
}

export function isDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(String(s) + 'T12:00:00Z'));
}

// Small deterministic hash + PRNG: the artwork and the booked press days look
// arbitrary but never move between renders or reloads.
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------------- catalogue */

export const PAPERS = [
  {
    id: 'photo_rag',
    name: 'Hahnemühle Photo Rag 308',
    character: 'Cotton, matte, deep blacks',
    price_20x30: 9.50,
    price_30x40: 16.00,
    price_40x60: 30.00
  },
  {
    id: 'baryta',
    name: 'Canson Baryta Photographique',
    character: 'Semi-gloss, high contrast',
    price_20x30: 8.25,
    price_30x40: 14.00,
    price_40x60: 26.50
  },
  {
    id: 'cotton_rag',
    name: 'Ilford Smooth Cotton Rag',
    character: 'Soft matte, warm white',
    price_20x30: 7.00,
    price_30x40: 12.50,
    price_40x60: 23.00
  },
  {
    id: 'hot_press',
    name: 'Epson Hot Press Natural',
    character: 'Textured, the budget sheet',
    price_20x30: 6.25,
    price_30x40: 11.00,
    price_40x60: 20.50
  }
];

export const SIZES = ['20x30', '30x40', '40x60'];

export const SIZE_LABELS = {
  '20x30': '20 × 30 cm',
  '30x40': '30 × 40 cm',
  '40x60': '40 × 60 cm'
};

export const FINISHES = [
  {
    id: 'matte',
    name: 'Matte seal',
    surcharge_usd: 0,
    extra_days: 0,
    note: 'Sprayed matte, no sheen. The house default.'
  },
  {
    id: 'satin',
    name: 'Satin seal',
    surcharge_usd: 0.60,
    extra_days: 0,
    note: 'A little gloss in the blacks. Reads warmer under gallery light.'
  },
  {
    id: 'deckled',
    name: 'Deckled edge',
    surcharge_usd: 1.75,
    extra_days: 2,
    note: 'Edges torn by hand against a steel rule, then sealed matte. Two extra days.'
  }
];

export const SETUP_USD = 35;
export const SETUP_WAIVED_AT = 25;
export const MAX_RUN = 400;

export const SETS = [
  {
    id: 'cerro_signals',
    name: 'Cerro Signals',
    prints: 9,
    edition: 40,
    colour: 'Oxide red and slate on unbleached white',
    paper: 'photo_rag',
    note: 'Radar sweeps redrawn from harbour charts. The reds sit down properly on cotton; on baryta they go hot.',
    art: { kind: 'arcs', ground: '#F0E6D8', inks: ['#9C2A21', '#3E4A54'] }
  },
  {
    id: 'rambla_nocturne',
    name: 'Rambla Nocturne',
    prints: 12,
    edition: 25,
    colour: 'Indigo and bone, printed dark',
    paper: 'baryta',
    note: 'Twelve views of the same stretch of seafront after midnight. Needs a sheet that holds a black.',
    art: { kind: 'bands', ground: '#161C2A', inks: ['#E8E2D4', '#4B5B85', '#9C2A21'] }
  },
  {
    id: 'salt_field',
    name: 'Salt Field',
    prints: 6,
    edition: 60,
    colour: 'One warm grey, printed at three densities',
    paper: 'cotton_rag',
    note: 'The largest edition we keep in stock. Quiet enough to hang in a row of six.',
    art: { kind: 'dots', ground: '#F4F0E7', inks: ['#6E675C'] }
  },
  {
    id: 'palermo_grid',
    name: 'Palermo Grid',
    prints: 8,
    edition: 30,
    colour: 'Ochre and black on unbleached white',
    paper: 'hot_press',
    note: 'Block plans of eight streets in Palermo. The texture of the hot press sheet does most of the work.',
    art: { kind: 'grid', ground: '#EFE7D6', inks: ['#B4712A', '#1E1A16'] }
  },
  {
    id: 'winter_ferry',
    name: 'Winter Ferry',
    prints: 10,
    edition: 20,
    colour: 'Four greys, cold',
    paper: 'baryta',
    note: 'Our smallest edition. Sold as a set of ten; we will not split it.',
    art: { kind: 'waves', ground: '#E7EAEC', inks: ['#2F3A42', '#66757F', '#9FAEB6'] }
  },
  {
    id: 'marea_baja',
    name: 'Marea Baja',
    prints: 7,
    edition: 45,
    colour: 'Teal and sand',
    paper: 'cotton_rag',
    note: 'Low tide at Punta Carretas, seven mornings running. The teal shifts on a satin seal.',
    art: { kind: 'rays', ground: '#F2EEE3', inks: ['#1F6B6B', '#C79A5B'] }
  }
];

/* ------------------------------------------------------------------ lookups */

const norm = (s) => String(s == null ? '' : s).toLowerCase().trim();

export function findPaper(q) {
  const s = norm(q);
  if (!s) return null;
  return PAPERS.find((p) => p.id === s) ||
    PAPERS.find((p) => norm(p.name) === s) ||
    PAPERS.find((p) => norm(p.name).includes(s) || p.id.includes(s)) || null;
}

export function findSet(q) {
  const s = norm(q);
  if (!s) return null;
  return SETS.find((x) => x.id === s) ||
    SETS.find((x) => norm(x.name) === s) ||
    SETS.find((x) => norm(x.name).includes(s) || x.id.includes(s.replace(/\s+/g, '_'))) || null;
}

export function findFinish(q) {
  const s = norm(q);
  if (!s) return FINISHES[0];
  return FINISHES.find((f) => f.id === s) ||
    FINISHES.find((f) => norm(f.name) === s) ||
    FINISHES.find((f) => norm(f.name).includes(s)) || null;
}

export function normalizeSize(q) {
  const s = norm(q).replace(/\s|cm|×/g, '').replace(/x/g, 'x');
  return SIZES.includes(s) ? s : null;
}

/* -------------------------------------------------------------------- quote */

export function turnaroundDays(quantity, size, finish) {
  let days = quantity <= 20 ? 3 : quantity <= 60 ? 5 : 9;
  if (size === '40x60') days += 1;
  days += finish ? finish.extra_days : 0;
  return days;
}

// The one place a price is decided. Everything on the page and every tool
// response comes through here.
export function quoteRun({ quantity, size, paper, finish, set } = {}) {
  const qty = Math.trunc(Number(quantity));
  if (!Number.isFinite(qty) || qty < 1) {
    return { ok: false, error: 'quantity must be a whole number of prints, 1 or more' };
  }
  if (qty > MAX_RUN) {
    return {
      ok: false,
      error: 'Rivera prints up to ' + MAX_RUN + ' sheets in one run; larger jobs are split across two press days',
      max_run: MAX_RUN
    };
  }
  const sz = normalizeSize(size);
  if (!sz) return { ok: false, error: 'size must be one of ' + SIZES.join(', '), sizes: SIZES };
  const p = findPaper(paper);
  if (!p) return { ok: false, error: 'no such paper', papers: PAPERS.map((x) => x.id) };
  const f = findFinish(finish);
  if (!f) return { ok: false, error: 'no such finish', finishes: FINISHES.map((x) => x.id) };
  const s = set ? findSet(set) : null;
  if (set && !s) return { ok: false, error: 'no such set', sets: SETS.map((x) => x.id) };

  const perPrint = p['price_' + sz];
  const printsUsd = round2(perPrint * qty);
  const finishUsd = round2(f.surcharge_usd * qty);
  const setupUsd = qty >= SETUP_WAIVED_AT ? 0 : SETUP_USD;
  const days = turnaroundDays(qty, sz, f);

  return {
    ok: true,
    currency: 'USD',
    set: s ? s.name : null,
    set_id: s ? s.id : null,
    prints_in_set: s ? s.prints : null,
    full_sets_covered: s ? Math.floor(qty / s.prints) : null,
    quantity: qty,
    size: sz,
    size_label: SIZE_LABELS[sz],
    paper: p.name,
    paper_id: p.id,
    finish: f.name,
    finish_id: f.id,
    per_print_usd: perPrint,
    breakdown: {
      prints_usd: printsUsd,
      finish_usd: finishUsd,
      setup_usd: setupUsd,
      setup_note: setupUsd === 0
        ? 'Press setup waived on runs of ' + SETUP_WAIVED_AT + ' sheets or more.'
        : 'Press setup ' + usd(SETUP_USD) + ', waived from ' + SETUP_WAIVED_AT + ' sheets.'
    },
    total_usd: round2(printsUsd + finishUsd + setupUsd),
    turnaround_days: days,
    earliest_ready: addDays(todayISO(), days)
  };
}

/* --------------------------------------------------------- press calendar */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const CALENDAR_DAYS = 21;

export function dayLabel(dateISO) {
  const d = new Date(dateISO + 'T12:00:00Z');
  return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate();
}

export function weekdayOf(dateISO) {
  return WEEKDAYS[new Date(dateISO + 'T12:00:00Z').getUTCDay()];
}

// Twenty-one days of press time. Sunday and Monday the bays are cold, the shop
// takes no same-day work, and a stable fifth of the remaining days are booked.
export function pressDays(fromISO = todayISO(), count = CALENDAR_DAYS) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const date = addDays(fromISO, i);
    const dow = new Date(date + 'T12:00:00Z').getUTCDay();
    let state = 'open';
    let note = 'Both bays free.';
    if (i === 0) {
      state = 'closed';
      note = 'Today is already loaded. We take no same-day work.';
    } else if (dow === 0 || dow === 1) {
      state = 'closed';
      note = 'Presses are cold Sunday and Monday.';
    } else if (hash('rivera-press:' + date) % 5 === 0) {
      state = 'full';
      note = 'Both bays booked.';
    }
    out.push({ date, weekday: WEEKDAYS[dow], label: dayLabel(date), state, note });
  }
  return out;
}

export function pressDay(dateISO, fromISO = todayISO()) {
  return pressDays(fromISO).find((d) => d.date === dateISO) || null;
}

export function freeDays(fromISO = todayISO()) {
  return pressDays(fromISO).filter((d) => d.state === 'open');
}

// The two open days closest to a date the shop cannot take.
export function nearestFreeDays(dateISO, fromISO = todayISO(), howMany = 2) {
  return freeDays(fromISO)
    .slice()
    .sort((a, b) => Math.abs(dayDiff(dateISO, a.date)) - Math.abs(dayDiff(dateISO, b.date)))
    .slice(0, howMany)
    .map((d) => d.date);
}

/* ------------------------------------------------------------------ search */

// One search over sets, papers and finishes, so an agent can ask in plain words.
export function searchCatalog(query) {
  const q = norm(query);
  const hit = (text) => q.length > 0 && norm(text).includes(q);
  const sets = SETS
    .filter((s) => hit(s.name) || hit(s.id) || hit(s.colour) || hit(s.note) || hit(String(s.edition)))
    .map((s) => ({
      kind: 'set', id: s.id, name: s.name, prints: s.prints, edition: s.edition,
      colour: s.colour, recommended_paper: s.paper
    }));
  const papers = PAPERS
    .filter((p) => hit(p.name) || hit(p.id) || hit(p.character))
    .map((p) => ({
      kind: 'paper', id: p.id, name: p.name, character: p.character,
      price_20x30: p.price_20x30, price_30x40: p.price_30x40, price_40x60: p.price_40x60
    }));
  const finishes = FINISHES
    .filter((f) => hit(f.name) || hit(f.id) || hit(f.note))
    .map((f) => ({ kind: 'finish', id: f.id, name: f.name, surcharge_per_print_usd: f.surcharge_usd, note: f.note }));
  return { sets, papers, finishes, count: sets.length + papers.length + finishes.length };
}

/* ------------------------------------------------------------------- prints */

// Each set is drawn, not photographed: one small deterministic composition per
// set, in that set's own two or three inks on its own ground.

function svg(inner, label) {
  return '<svg class="print__svg" viewBox="0 0 300 400" role="img" aria-label="' +
    String(label).replace(/"/g, '') + '" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
}

function ground(colour) {
  return '<rect x="0" y="0" width="300" height="400" fill="' + colour + '"/>';
}

const fx = (n) => Math.round(n * 100) / 100;

function artArcs(a, r) {
  let out = '<g fill="none" stroke-linecap="round">';
  for (let i = 0; i < 11; i++) {
    const rad = 34 + i * 30;
    const ink = a.inks[i % 2];
    const w = i % 3 === 0 ? 5 : 1.6;
    const o = 0.35 + r() * 0.55;
    out += '<circle cx="34" cy="366" r="' + rad + '" stroke="' + ink + '" stroke-width="' + w +
      '" opacity="' + fx(o) + '"/>';
  }
  // The outer <svg> clips at the viewBox, so the big arcs run off the sheet.
  return out + '</g>';
}

function artBands(a, r) {
  let y = 26;
  let out = '';
  while (y < 380) {
    const h = 4 + Math.round(r() * 26);
    const ink = a.inks[Math.floor(r() * a.inks.length)];
    const x = 20 + Math.round(r() * 40);
    const w = 300 - x - (16 + Math.round(r() * 46));
    out += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + ink +
      '" opacity="' + fx(0.55 + r() * 0.45) + '"/>';
    y += h + 6 + Math.round(r() * 14);
  }
  return out;
}

function artDots(a, r) {
  let out = '<g fill="' + a.inks[0] + '">';
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 12; col++) {
      const t = row / 15;
      const rad = fx(1 + t * 5.2 * (0.5 + r() * 0.9));
      if (rad < 1.1) continue;
      out += '<circle cx="' + fx(26 + col * 22) + '" cy="' + fx(30 + row * 22.5) + '" r="' + rad +
        '" opacity="' + fx(0.25 + t * 0.6) + '"/>';
    }
  }
  return out + '</g>';
}

function artGrid(a, r) {
  let out = '';
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 6; col++) {
      const x = 22 + col * 43;
      const y = 24 + row * 39;
      const pick = r();
      if (pick > 0.72) {
        out += '<rect x="' + x + '" y="' + y + '" width="34" height="30" fill="' + a.inks[0] +
          '" opacity="' + fx(0.5 + r() * 0.5) + '"/>';
      } else if (pick > 0.42) {
        out += '<rect x="' + (x + 0.75) + '" y="' + (y + 0.75) + '" width="32.5" height="28.5" fill="none" stroke="' +
          a.inks[1] + '" stroke-width="1.5" opacity="0.75"/>';
      } else if (pick > 0.3) {
        out += '<rect x="' + x + '" y="' + (y + 12) + '" width="34" height="6" fill="' + a.inks[1] + '" opacity="0.6"/>';
      }
    }
  }
  return out;
}

function artWaves(a, r) {
  let out = '<g fill="none" stroke-linecap="round">';
  for (let i = 0; i < 9; i++) {
    const base = 60 + i * 36;
    const amp = 8 + r() * 22;
    const phase = r() * 6.28;
    let d = 'M 12 ' + fx(base);
    for (let x = 12; x <= 288; x += 12) {
      d += ' L ' + x + ' ' + fx(base + Math.sin(phase + x / 44) * amp);
    }
    out += '<path d="' + d + '" stroke="' + a.inks[i % a.inks.length] + '" stroke-width="' +
      fx(1.2 + r() * 3.4) + '" opacity="' + fx(0.5 + r() * 0.5) + '"/>';
  }
  return out + '</g>';
}

function artRays(a, r) {
  let out = '<g stroke-linecap="round">';
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    const x = fx(14 + t * 272);
    out += '<line x1="150" y1="392" x2="' + x + '" y2="' + fx(20 + r() * 90) + '" stroke="' +
      a.inks[i % 2] + '" stroke-width="' + fx(0.8 + r() * 3.6) + '" opacity="' + fx(0.3 + r() * 0.55) + '"/>';
  }
  out += '</g>';
  out += '<rect x="0" y="300" width="300" height="100" fill="' + a.inks[1] + '" opacity="0.16"/>';
  return out;
}

const ART = { arcs: artArcs, bands: artBands, dots: artDots, grid: artGrid, waves: artWaves, rays: artRays };

export function setArt(set) {
  const a = set.art;
  const draw = ART[a.kind] || artBands;
  const r = rng(hash(set.id));
  return svg(ground(a.ground) + draw(a, r), set.name + ' — ' + set.colour);
}
