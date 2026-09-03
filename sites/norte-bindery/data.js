// Norte Bindery — the workshop's own numbers.
// No dependency on the baton library: this is what the business knows about
// itself, and it is the same whether or not a mission is aboard.

export const BINDINGS = [
  {
    id: 'coptic',
    image: './assets/generated/bind-coptic.webp',
    name: 'Coptic stitch, exposed spine',
    notes: 'Sewn over tapes, opens completely flat. Three signatures.',
    per_copy: 5.25,
    bench: 'Bench 1'
  },
  {
    id: 'japanese_stab',
    image: './assets/generated/bind-japanese-stab.webp',
    name: 'Japanese stab binding',
    notes: 'Side-sewn through four stations, no glue in the spine.',
    per_copy: 4.25,
    bench: 'Bench 1'
  },
  {
    id: 'saddle_folio',
    image: './assets/generated/bind-saddle-folio.webp',
    name: 'Saddle-stitched folio',
    notes: 'Two wire staples on the fold. The fastest thing we do.',
    per_copy: 3.10,
    bench: 'Bench 2'
  }
];

export const COVERS = [
  {
    id: 'cloth_board',
    image: './assets/generated/cover-cloth-board.webp',
    name: 'Cloth-wrapped board',
    notes: 'Bookcloth over 2 mm greyboard, turned in by hand.',
    per_copy: 1.25
  },
  {
    id: 'light_card',
    image: './assets/generated/cover-light-card.webp',
    name: 'Light card wrap',
    notes: '300 gsm card, scored and folded on the bench.',
    per_copy: 0.50
  }
];

export const WORKSHOP = {
  name: 'Norte Bindery',
  founded: 2011,
  benches: 2,
  bench_names: ['Bench 1 — sewing frame', 'Bench 2 — press and guillotine'],
  slots_per_day: 2,
  capacity_copies_per_day: 120,
  min_quantity: 10,
  max_quantity: 500,
  closed_weekday: 0, // Sunday
  calendar_days: 21
};

/* ------------------------------------------------------------------ dates */

const DAY_MS = 86400000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const noon = (dateISO) => Date.parse(dateISO + 'T12:00:00Z');
export const toISO = (ms) => new Date(ms).toISOString().slice(0, 10);
export const shiftDays = (dateISO, n) => toISO(noon(dateISO) + n * DAY_MS);
export const daysBetween = (fromISO, toISODate) => Math.round((noon(toISODate) - noon(fromISO)) / DAY_MS);
export const weekdayName = (dateISO) => WEEKDAYS[new Date(noon(dateISO)).getUTCDay()];

/* -------------------------------------------------------- bench calendar */

// Days already spoken for, counted forward from whatever today is, so two
// people opening the page on the same day see the same booked-up week.
const FULL_OFFSETS = [1, 2, 7, 8, 15];
const HALF_OFFSETS = [3, 10, 17];

// One day of the bench diary: past, closed, full, or free with a slot count.
export function benchDay(dateISO, todayISO) {
  const weekday = weekdayName(dateISO);
  if (!isDate(dateISO)) return { date: dateISO, weekday: null, state: 'invalid', slots_left: 0 };
  const offset = daysBetween(todayISO, dateISO);
  const base = { date: dateISO, weekday, offset_days: offset };
  if (offset < 0) return { ...base, state: 'past', slots_left: 0 };
  if (new Date(noon(dateISO)).getUTCDay() === WORKSHOP.closed_weekday) {
    return { ...base, state: 'closed', slots_left: 0, note: 'the workshop is shut on Sundays' };
  }
  if (FULL_OFFSETS.includes(offset)) return { ...base, state: 'full', slots_left: 0, note: 'both benches are taken' };
  if (HALF_OFFSETS.includes(offset)) return { ...base, state: 'free', slots_left: 1, note: 'one bench left' };
  return { ...base, state: 'free', slots_left: WORKSHOP.slots_per_day };
}

export function benchCalendar(fromISO, days, todayISO) {
  const out = [];
  for (let i = 0; i < days; i++) out.push(benchDay(shiftDays(fromISO, i), todayISO));
  return out;
}

// The free days closest to a date the caller cannot have, nearest first.
export function nearestFreeDays(dateISO, todayISO, howMany = 3, searchDays = 30) {
  const found = [];
  for (let step = 1; step <= searchDays && found.length < howMany; step++) {
    for (const dir of [1, -1]) {
      const candidate = shiftDays(dateISO, step * dir);
      if (daysBetween(todayISO, candidate) < 0) continue;
      if (benchDay(candidate, todayISO).state === 'free' && !found.includes(candidate)) {
        found.push(candidate);
        if (found.length === howMany) break;
      }
    }
  }
  return found.sort();
}

/* ------------------------------------------------------------- catalogue */

const match = (list, q) => {
  const s = String(q || '').toLowerCase().trim();
  if (!s) return null;
  return list.find((x) => x.id === s) ||
    list.find((x) => x.name.toLowerCase() === s) ||
    list.find((x) => x.name.toLowerCase().includes(s) || x.id.includes(s)) ||
    null;
};

export const findBinding = (q) => match(BINDINGS, q);
export const findCover = (q) => match(COVERS, q);

// Sewing takes longer on a big run; the guillotine does not care.
export const benchDaysFor = (quantity) => (quantity <= 60 ? 2 : quantity <= 200 ? 4 : 7);
