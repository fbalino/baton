// Norte Bindery — the binding leg of a mission that arrives with a baton.
//
// The page is three steps in one screen, not a long scroll: bindings and
// covers, the bench diary, the leg. The agent's tools move the step, and so do
// the buttons, so the view stays where the work is without the page moving.
//
// Signing happens on this origin's server (the library POSTs /api/sign); no
// private key ships to the browser any more.

import { mountBaton, round2, todayISO } from './baton.js';
import { SITE } from './config.js';
import {
  BINDINGS, COVERS, WORKSHOP,
  benchCalendar, benchDay, benchDaysFor, findBinding, findCover,
  isDate, nearestFreeDays, weekdayName
} from './data.js';

const $ = (id) => document.getElementById(id);
const usd = (n) => '$' + round2(n).toFixed(2);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ------------------------------------------------------------------ theme */

const root = document.documentElement;
const themeBtn = $('theme-toggle');
const systemDark = matchMedia('(prefers-color-scheme: dark)');

const activeTheme = () => root.dataset.theme || (systemDark.matches ? 'dark' : 'light');

function paintThemeButton() {
  const next = activeTheme() === 'dark' ? 'light' : 'dark';
  themeBtn.textContent = next === 'dark' ? 'Dark' : 'Light';
  themeBtn.setAttribute('aria-label', 'Switch to the ' + next + ' theme');
}

themeBtn.addEventListener('click', () => {
  const next = activeTheme() === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('norte.theme', next); } catch { /* private mode */ }
  paintThemeButton();
});
systemDark.addEventListener('change', paintThemeButton);
paintThemeButton();

/* ------------------------------------------------------------------- page */

$('host-label').textContent = location.host || 'file://';

$('facts').textContent = [
  WORKSHOP.benches + ' benches',
  BINDINGS.length + ' bindings',
  WORKSHOP.min_quantity + ' to ' + WORKSHOP.max_quantity + ' copies a booking',
  'working since ' + WORKSHOP.founded
].join(' · ');

$('bindings').innerHTML = BINDINGS.map((b) =>
  '<tr><td class="name">' + b.name + '</td><td class="how">' + b.notes + '</td>' +
  '<td class="num">' + usd(b.per_copy) + '</td></tr>'
).join('');

$('covers').innerHTML = COVERS.map((c) =>
  '<tr><td class="name">' + c.name + '</td><td class="how">' + c.notes + '</td>' +
  '<td class="num">' + usd(c.per_copy) + '</td></tr>'
).join('');

/* ------------------------------------------------------- what this visit did */

let lastQuote = null;      // what reserve_press_slot books a bench against
let heldDate = null;       // the bench day held during this visit
const heldDays = new Set(); // days this page has held, so the diary shows them

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDay = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  return m ? Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] : String(iso);
};

function drawDiary() {
  const today = todayISO();
  const rows = benchCalendar(today, WORKSHOP.calendar_days, today).map((d) => {
    const held = heldDays.has(d.date);
    const cls = held ? 'half' : d.state === 'free' ? (d.slots_left === 1 ? 'half' : 'free') : d.state;
    const label = held ? 'held for you'
      : d.state === 'closed' ? 'closed'
      : d.state === 'full' ? 'taken'
      : d.slots_left === 1 ? '1 bench' : '2 benches';
    return '<li class="day day--' + cls + '">' +
      '<span class="day__dow">' + weekdayName(d.date).slice(0, 3) + '</span>' +
      '<span class="day__num">' + Number(d.date.slice(8, 10)) + '</span>' +
      '<span class="day__state">' + label + '</span>' +
      '</li>';
  });
  $('bench-diary').innerHTML = rows.join('');
}
drawDiary();

/* ------------------------------------------------------------------ steps */

const stepBtns = [...document.querySelectorAll('.steps .step')];
const stepPanels = [...document.querySelectorAll('.panel[data-step]')];
const backBtn = document.querySelector('[data-nav="back"]');
const nextBtn = document.querySelector('[data-nav="next"]');
const LAST_STEP = stepBtns.length;

let currentStep = 1;
const finished = new Set(); // steps whose work is actually done

// Moves the view without moving the page: panels are shown and hidden in
// place, so nothing scrolls and the reader's eye stays where it was.
function goToStep(n) {
  const want = Math.min(LAST_STEP, Math.max(1, Math.trunc(Number(n)) || 1));
  currentStep = want;
  for (const p of stepPanels) p.hidden = Number(p.dataset.step) !== want;
  for (const b of stepBtns) {
    const i = Number(b.dataset.step);
    if (i === want) b.setAttribute('aria-current', 'step');
    else b.removeAttribute('aria-current');
    if (i !== want && (finished.has(i) || i < want)) b.dataset.done = 'yes';
    else delete b.dataset.done;
  }
  backBtn.disabled = want === 1;
  nextBtn.disabled = want === LAST_STEP;
}

const markFinished = (n) => { finished.add(Number(n)); goToStep(currentStep); };

for (const b of stepBtns) b.addEventListener('click', () => goToStep(b.dataset.step));
backBtn.addEventListener('click', () => goToStep(currentStep - 1));
nextBtn.addEventListener('click', () => goToStep(currentStep + 1));

/* ---- the agent's tools move the same steps the buttons do ---------------
   Wrapping registerTool means the library's own tools count too: the page
   turns to the leg the moment baton_complete_leg asks for the tap, so the
   operator is looking at what they are about to sign. */

const TOOL_STEP = {
  list_bindings: 1,
  quote_binding_for_mission: 1,
  bench_availability: 2,
  reserve_press_slot: 2,
  baton_complete_leg: 3
};

const TOOL_FINISHES = {
  quote_binding_for_mission: 1,
  reserve_press_slot: 2,
  baton_complete_leg: 3
};

try {
  const mc = document.modelContext;
  if (mc && typeof mc.registerTool === 'function' && !mc.__norteSteps) {
    const registerTool = mc.registerTool.bind(mc);
    mc.registerTool = function (definition, options) {
      const target = definition && TOOL_STEP[definition.name];
      if (!target || typeof definition.execute !== 'function') return registerTool(definition, options);
      const name = definition.name;
      const run = definition.execute;
      const wrapped = {
        ...definition,
        execute: async (input, client) => {
          goToStep(target);
          const out = await run(input, client);
          if (out && out.ok === true && TOOL_FINISHES[name]) markFinished(TOOL_FINISHES[name]);
          drawQuote();
          drawLeg();
          return out;
        }
      };
      return registerTool(wrapped, options);
    };
    mc.__norteSteps = true;
  }
} catch { /* an ordinary browser has no modelContext; the buttons still work */ }

/* ------------------------------------------------ step 1: the live quote */

function drawQuote() {
  const box = $('quote-now');
  if (!lastQuote) { box.hidden = true; box.innerHTML = ''; return; }
  const q = lastQuote;
  box.hidden = false;
  box.innerHTML =
    '<div class="quote__total">' + usd(q.cost_usd) + '</div>' +
    '<div class="quote__body">' +
      '<div class="quote__line">' + q.copies + ' copies · ' + esc(q.binding_name.toLowerCase()) +
        ' with a ' + esc(q.cover_name.toLowerCase()) + '</div>' +
      '<div class="quote__sub">' + usd(q.per_copy_usd) + ' a copy · ' + q.bench_days +
        ' bench days · ' + esc(q.bench) + '</div>' +
    '</div>' +
    '<div class="quote__fit quote__fit--' + (q.fits ? 'ok' : 'bad') + '">' +
      (q.fits ? 'fits the money left' : 'over the money left') + '</div>';
}

/* ------------------------------------------------- step 3: what gets signed */

function signedLeg() {
  try {
    return baton.mission?.legs?.find((l) => l.origin === location.origin) || null;
  } catch { return null; }
}

function drawLeg() {
  const leg = signedLeg();
  const ev = (leg && leg.evidence) || {};
  const q = lastQuote;
  const dash = '—';

  const bindingName = ev.binding ? (findBinding(ev.binding)?.name || ev.binding) : q ? q.binding_name : null;
  const coverName = ev.cover ? (findCover(ev.cover)?.name || ev.cover) : q ? q.cover_name : null;
  let copies = ev.copies ?? q?.copies ?? null;
  if (copies == null) { try { copies = baton.mission?.constraints?.quantity ?? null; } catch { copies = null; } }
  const date = ev.bench_date || heldDate;
  const cost = leg ? leg.cost_usd : q?.cost_usd;

  const rows = [
    ['Binding', bindingName || dash],
    ['Cover', coverName || dash],
    ['Copies', copies == null ? dash : String(copies)],
    ['Bench day', date ? weekdayName(date) + ' ' + shortDay(date) : dash],
    ['Cost', cost == null ? dash : usd(cost)]
  ];
  $('leg-sheet').innerHTML = rows.map(([k, v]) =>
    '<div class="sheet__row"><dt>' + k + '</dt><dd>' + esc(v) + '</dd></div>').join('');

  const note = $('leg-note');
  if (leg) {
    note.className = 'sheet__note sheet__note--signed';
    note.textContent = 'Signed. ' + leg.summary + ' Signed by ' + leg.kid + '.';
  } else if (date) {
    note.className = 'sheet__note';
    note.textContent = 'The bench is held until the leg is signed. The operator taps Confirm once.';
  } else if (q) {
    note.className = 'sheet__note';
    note.textContent = 'Hold a bench day on step 2, then the leg can be signed.';
  } else {
    note.className = 'sheet__note';
    note.textContent = 'Nothing is quoted yet. This is where the binding leg is signed.';
  }
}

/* ------------------------------------------------- copy an example prompt */

function fallbackCopy(text) {
  const box = document.createElement('textarea');
  box.value = text;
  box.setAttribute('readonly', '');
  box.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
  document.body.appendChild(box);
  box.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  box.remove();
  return ok;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return fallbackCopy(text);
  }
}

for (const btn of document.querySelectorAll('.prompt__copy')) {
  let restore = 0;
  btn.addEventListener('click', async () => {
    const text = btn.closest('.prompt')?.querySelector('.prompt__text')?.textContent.trim() || '';
    if (!text) return;
    const ok = await copyText(text);
    btn.textContent = ok ? 'Copied' : 'Select it';
    if (ok) btn.dataset.copied = 'yes'; else delete btn.dataset.copied;
    clearTimeout(restore);
    restore = setTimeout(() => {
      btn.textContent = 'Copy';
      delete btn.dataset.copied;
    }, 1600);
  });
}

/* ------------------------------------------------------------------ baton */

const baton = mountBaton({
  ...SITE,
  emptyHint: 'Arrive with a baton in the link and the tools for this leg appear.',
  // What an agent that lands here has to do, in one paragraph. baton_inspect
  // hands it back as brief.this_stop_must and the panel prints it on the page,
  // so nobody has to tell the agent the job a second time.
  stopBrief: 'Quote binding options for the copies on the baton, choose one that fits the remaining ' +
    'budget and the instructions, hold the first free bench day, sign the leg (the operator taps ' +
    'Confirm once), then mint the link and continue to the courier.',
  panel: $('mission-panel'),
  toolsBox: $('site-tools')
});

if (!baton.hasWebMCP) $('no-webmcp').hidden = false;

drawQuote();
drawLeg();
goToStep(1);

// The signature is the library's tool, not this site's, and the confirm card is
// the library's too. Watching the panel keeps the page on the leg while the
// operator answers, and again once the leg is signed.
try {
  const panel = $('mission-panel');
  let jumped = false;
  new MutationObserver(() => {
    drawLeg();
    const asking = !!panel.querySelector('.baton__confirm:not([hidden]) .confirm');
    const signed = !!signedLeg();
    if (signed) markFinished(3);
    if ((asking || signed) && !jumped) { jumped = true; goToStep(3); }
    if (!asking && !signed) jumped = false;
  }).observe(panel, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
} catch { /* no panel: the buttons still work */ }

/* ---- confirmation policy — one tap at Norte -----------------------------
   The operator taps Confirm once, for baton_complete_leg: the signature, which
   is also the money. Holding a bench applies as soon as the agent asks for it
   and stands until the leg is signed, so the agent quotes, holds and signs in
   one run instead of stopping at every step. */

/* The line the mission panel shows under Norte's row while the leg is built. */

function showLegStatus(line) {
  try {
    const m = baton.mission;
    if (m && m.legs.some((l) => l.origin === location.origin)) return; // signed: the summary speaks now
    baton.setLegStatus(line);
  } catch { /* older library, or no panel */ }
}

/* ------------------------------------------- always on: one plain read tool */

baton.registerAlways((signal, register) => {
  register({
    name: 'about_bindery',
    description: 'What Norte Bindery is and what it can take on: benches, daily capacity, the quantities it accepts and the kind of leg it will sign.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async () => ({
      ok: true,
      name: WORKSHOP.name,
      founded: WORKSHOP.founded,
      benches: WORKSHOP.benches,
      bench_names: WORKSHOP.bench_names,
      capacity_copies_per_day: WORKSHOP.capacity_copies_per_day,
      quantity_range: [WORKSHOP.min_quantity, WORKSHOP.max_quantity],
      closed: 'Sundays',
      takes: 'binding legs only, on a mission that already carries a signed print leg',
      note: 'Quoting needs a mission aboard. Arrive with a baton in the link and the rest of the tools appear.',
      next: baton.mission
        ? 'Call list_bindings, then quote_binding_for_mission with a binding and a cover.'
        : 'This site needs a baton in the link before it can quote. Open the carry link from the print shop.'
    })
  }, signal);
});

/* -------------------------------------- only while a mission is on the page */

baton.registerWhenMissionAboard((signal, register) => {
  register({
    name: 'list_bindings',
    description: 'The three binding styles Norte sews, and the two covers, each with its per-copy price and which bench it runs on.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async () => ({
      ok: true,
      currency: 'USD',
      bindings: BINDINGS,
      covers: COVERS,
      pricing: 'binding per copy + cover per copy, times the copies on the baton',
      next: 'Price one with quote_binding_for_mission, passing a binding and a cover.'
    })
  }, signal);

  register({
    name: 'quote_binding_for_mission',
    description: 'Price a binding and cover for the number of copies the baton already carries, and say straight away whether the mission budget still allows it. Norte never asks how many copies there are: it reads that from the print leg.',
    inputSchema: {
      type: 'object',
      properties: {
        binding: { type: 'string', description: 'Binding id or name from list_bindings, e.g. coptic.' },
        cover: { type: 'string', description: 'Cover id or name from list_bindings, e.g. cloth_board.' }
      },
      required: ['binding', 'cover'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    execute: async (input) => {
      const b = findBinding(input.binding);
      const c = findCover(input.cover);
      if (!b) {
        return { ok: false, error: 'no such binding', choices: BINDINGS.map((x) => x.id), next: 'Call quote_binding_for_mission again with one of the listed bindings.' };
      }
      if (!c) {
        return { ok: false, error: 'no such cover', choices: COVERS.map((x) => x.id), next: 'Call quote_binding_for_mission again with one of the listed covers.' };
      }

      const copies = baton.mission.constraints.quantity;
      if (copies < WORKSHOP.min_quantity || copies > WORKSHOP.max_quantity) {
        return {
          ok: false,
          error: 'this mission carries ' + copies + ' copies; Norte binds ' +
            WORKSHOP.min_quantity + ' to ' + WORKSHOP.max_quantity + ' per booking',
          copies,
          next: 'Tell the operator Norte cannot take this quantity, and call baton_decline if the mission should move on without a binding.'
        };
      }

      const per_copy_usd = round2(b.per_copy + c.per_copy);
      const cost_usd = round2(per_copy_usd * copies);
      const bench_days = benchDaysFor(copies);
      const check = baton.checkAction({ cost_usd });

      lastQuote = {
        binding: b.id, binding_name: b.name, cover: c.id, cover_name: c.name,
        copies, per_copy_usd, cost_usd, bench_days, bench: b.bench, fits: check.allowed
      };
      drawQuote();
      drawLeg();

      showLegStatus(copies + ' copies · ' + b.name.toLowerCase() + ', ' + c.name.toLowerCase() +
        ' · ' + usd(cost_usd) + (check.allowed ? ' · bench day to hold' : ' · over the budget'));

      return {
        ok: true,
        binding: b.name,
        binding_id: b.id,
        cover: c.name,
        cover_id: c.id,
        bench: b.bench,
        copies,
        per_copy_usd,
        cost_usd,
        bench_days,
        check,
        note: 'The copy count came off the print leg on this baton.',
        next: check.allowed
          ? 'This fits. Call bench_availability, hold the first free day with reserve_press_slot, ' +
            'sign the leg with baton_complete_leg, then baton_mint to carry the mission to the courier.'
          : 'This is over the budget by $' + (check.failures?.[0]?.over_by_usd ?? 0) +
            '. Follow the operator\'s instructions and quote the cheaper binding or cover with ' +
            'quote_binding_for_mission, rather than asking them what to do.'
      };
    }
  }, signal);

  register({
    name: 'bench_availability',
    description: 'The bench diary: which days Norte has room, which are taken, and which are Sundays. Two benches a day, three weeks ahead by default.',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'First day to show, as YYYY-MM-DD. Defaults to today.' },
        days: { type: 'integer', description: 'How many days to show, 1 to 60. Defaults to 21.' }
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    execute: async (input) => {
      const today = todayISO();
      const from = input?.from ? String(input.from) : today;
      if (!isDate(from)) return { ok: false, error: 'from must look like YYYY-MM-DD', next: 'Call bench_availability again with from as YYYY-MM-DD, or leave it out.' };
      const days = Math.min(60, Math.max(1, Math.trunc(input?.days ?? WORKSHOP.calendar_days)));
      const calendar = benchCalendar(from, days, today).map((d) =>
        heldDays.has(d.date) ? { ...d, state: 'full', slots_left: 0, note: 'held for this mission' } : d
      );
      const free = calendar.filter((d) => d.state === 'free').map((d) => d.date);
      return {
        ok: true,
        today,
        from,
        days,
        benches: WORKSHOP.benches,
        closed: 'Sundays',
        calendar,
        free_days: free,
        first_free_day: free[0] ?? null,
        taken_days: calendar.filter((d) => d.state === 'full').map((d) => d.date),
        next: free[0]
          ? 'Hold the first free day: call reserve_press_slot for ' + free[0] +
            ', then sign the leg with baton_complete_leg and mint on to the courier.'
          : 'No bench day is free in this window. Call bench_availability again further ahead.'
      };
    }
  }, signal);

  register({
    name: 'reserve_press_slot',
    description: 'Hold a bench day for the binding already quoted. The hold applies straight away and stands until the leg is signed; nothing is charged before that. Hands back the evidence for baton_complete_leg (binding, cover, copies, bench date, cost).',
    inputSchema: {
      type: 'object',
      properties: { date: { type: 'string', description: 'Bench day as YYYY-MM-DD, from bench_availability.' } },
      required: ['date'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false },
    execute: async (input) => {
      const date = String(input?.date || '');
      if (!isDate(date)) return { ok: false, error: 'date must look like YYYY-MM-DD', next: 'Call bench_availability and pass one of its free days.' };

      const today = todayISO();
      const day = heldDays.has(date)
        ? { state: 'full', date }
        : benchDay(date, today);

      if (day.state === 'past') {
        return {
          ok: false, error: date + ' has already gone by', today,
          nearest_free_days: nearestFreeDays(today, today),
          next: 'Call reserve_press_slot again with one of the nearest free days.'
        };
      }
      if (day.state === 'closed') {
        return {
          ok: false,
          error: date + ' is a Sunday and the workshop is shut',
          nearest_free_days: nearestFreeDays(date, today),
          next: 'Call reserve_press_slot again with one of the nearest free days.'
        };
      }
      if (day.state === 'full') {
        return {
          ok: false,
          error: 'both benches are taken on ' + date,
          nearest_free_days: nearestFreeDays(date, today),
          next: 'Pick one of the nearest free days and call reserve_press_slot again.'
        };
      }
      if (!lastQuote) {
        return {
          ok: false,
          error: 'nothing has been quoted yet, and Norte holds a bench against a job rather than an empty date',
          next: 'Call quote_binding_for_mission with a binding and a cover, then reserve_press_slot again.'
        };
      }

      const q = lastQuote;
      heldDays.add(date);
      heldDate = date;
      drawDiary();
      drawLeg();
      baton.debug('bench held on ' + date + ' for ' + q.copies + ' copies — until the leg is signed');
      showLegStatus(q.copies + ' copies · ' + q.binding_name.toLowerCase() + ', ' + q.cover_name.toLowerCase() +
        ' · bench ' + shortDay(date) + ' held until the leg is signed · ready to sign');

      return {
        ok: true,
        held: true,
        holds_until: 'the leg is signed',
        evidence: {
          slot_id: 'NB-' + date.replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
          bench: q.bench,
          bench_date: date,
          binding: q.binding,
          cover: q.cover,
          copies: q.copies,
          cost_usd: q.cost_usd
        },
        bench_days: q.bench_days,
        weekday: weekdayName(date),
        cost_usd: q.cost_usd,
        next: 'Bench day held until the leg is signed. Call baton_complete_leg with this evidence, cost_usd ' +
          q.cost_usd + ' and a one-line summary — the operator taps Confirm once on the page — then ' +
          'baton_mint to carry the mission to the courier and finish the route there on your own.'
      };
    }
  }, signal);
});
