// Rivera Press — the shop, and the tools the shop hands an agent.
//
// The page and the tools run the same functions: a quote shown in the builder is
// the quote a tool returns, and an order approved by a tool appears on the page
// the moment it is approved. Nothing here signs anything; signing belongs to the
// Baton library and happens on this origin's server.

import { mountBaton, newMission } from './baton.js';
import { SITE, ROUTE } from './config.js';
import {
  PAPERS, SIZES, SIZE_LABELS, FINISHES, SETS,
  SETUP_USD, SETUP_WAIVED_AT, MAX_RUN, CALENDAR_DAYS,
  findPaper, findSet, findFinish,
  quoteRun, searchCatalog, setArt, setImage,
  pressDays, pressDay, freeDays, nearestFreeDays,
  todayISO, addDays, isDate, usd
} from './data.js';

/* ------------------------------------------------------------------ tiny */

const el = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------------------------------------------------------------- prints */

// A print on the page is a photograph. If the file is missing the drawn
// composition takes its place in the same frame, so nothing shows as broken.

function printFrame(set, { className = '', eager = false, width = 1000, height = 1250 } = {}) {
  return '<div class="print ' + className + '">' +
    '<img class="print__img" src="' + setImage(set) + '"' +
    ' width="' + width + '" height="' + height + '"' +
    ' alt="' + esc(set.name + ', a print from the set on the studio table') + '"' +
    (eager ? '' : ' loading="lazy"') + ' decoding="async" data-set="' + set.id + '">' +
    '</div>';
}

function drawInstead(img) {
  const set = findSet(img.dataset.set);
  if (!set || !img.parentNode) return;
  img.outerHTML = setArt(set);
}

function wirePrints(root) {
  for (const img of (root || document).querySelectorAll('img.print__img')) {
    if (img.dataset.wired) continue;
    img.dataset.wired = '1';
    if (img.complete && img.naturalWidth === 0) { drawInstead(img); continue; }
    img.addEventListener('error', () => drawInstead(img), { once: true });
  }
}

/* ----------------------------------------------------------------- state */

const STORE_KEY = 'rivera.shop';

const state = {
  form: { set: 'cerro_signals', quantity: 40, qmode: 'total', size: '20x30', paper: 'photo_rag', finish: 'matte' },
  orders: [],
  activeId: null,
  seq: 1042,
  filter: null,
  message: ''
};

function save() {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify({
      form: state.form, orders: state.orders, activeId: state.activeId, seq: state.seq
    }));
  } catch { /* private mode: this session only */ }
}

function restore() {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.form) Object.assign(state.form, saved.form);
    if (Array.isArray(saved.orders)) state.orders = saved.orders;
    if (saved.activeId) state.activeId = saved.activeId;
    if (Number.isFinite(saved.seq)) state.seq = saved.seq;
  } catch { /* start fresh */ }
}

const activeOrder = () => state.orders.find((o) => o.id === state.activeId) || null;
const orderById = (id) => state.orders.find((o) => o.id === String(id || '').trim().toUpperCase()) || null;

/* ---------------------------------------------------------------- orders */

function statusOf(order) {
  if (order.slot) return 'slot_held';
  if (order.proof.approved_at) return 'proof_approved';
  return 'quoted';
}

const STATUS_LABEL = { quoted: 'Quoted', proof_approved: 'Proof approved', slot_held: 'Press day held' };

function makeOrder({ set, quantity, size, paper, finish }) {
  const q = quoteRun({ set, quantity, size, paper, finish });
  if (!q.ok) return q;
  const s = findSet(set);
  if (!s) return { ok: false, error: 'a set is needed to open an order', sets: SETS.map((x) => x.id) };
  const now = new Date().toISOString();
  const order = {
    id: 'RP-' + state.seq++,
    created_at: now,
    set_id: s.id,
    set: s.name,
    quantity: q.quantity,
    size: q.size,
    paper_id: q.paper_id,
    paper: q.paper,
    finish_id: q.finish_id,
    finish: q.finish,
    quote: q,
    proof: { id: 'PF-' + Math.floor(1000 + Math.random() * 8999), generated_at: now, approved_at: null },
    slot: null
  };
  state.orders.push(order);
  state.activeId = order.id;
  save();
  return { ok: true, order };
}

function requote(order, changes) {
  const next = {
    set: order.set_id,
    quantity: changes.quantity ?? order.quantity,
    size: changes.size ?? order.size,
    paper: changes.paper ?? order.paper_id,
    finish: changes.finish ?? order.finish_id
  };
  const q = quoteRun(next);
  if (!q.ok) return q;
  const changed =
    q.quantity !== order.quantity || q.size !== order.size ||
    q.paper_id !== order.paper_id || q.finish_id !== order.finish_id;
  if (!changed) return { ok: true, order, changed: false, reproofed: false };

  const wasApproved = !!order.proof.approved_at;
  const hadSlot = !!order.slot;
  order.quantity = q.quantity;
  order.size = q.size;
  order.paper_id = q.paper_id;
  order.paper = q.paper;
  order.finish_id = q.finish_id;
  order.finish = q.finish;
  order.quote = q;
  order.proof = { id: 'PF-' + Math.floor(1000 + Math.random() * 8999), generated_at: new Date().toISOString(), approved_at: null };
  order.slot = null;
  save();
  return { ok: true, order, changed: true, reproofed: wasApproved, slot_released: hadSlot };
}

function approveProof(order) {
  order.proof.approved_at = new Date().toISOString();
  save();
  return order;
}

function holdSlot(order, date) {
  order.slot = {
    slot_id: 'RP-' + date.replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
    date,
    press: order.quantity > 60 ? 'Bay 1, Epson P9500' : 'Bay 2, Epson P7570',
    capacity_prints: order.quantity > 60 ? 120 : 60,
    held_by: 'Rivera Press',
    holds_until: new Date(Date.now() + 48 * 3600000).toISOString()
  };
  save();
  return order;
}

function readyDate(order) {
  if (!order.slot) return null;
  const f = findFinish(order.finish_id);
  return addDays(order.slot.date, 1 + f.extra_days);
}

function orderView(order) {
  return {
    order_id: order.id,
    status: statusOf(order),
    set: order.set,
    set_id: order.set_id,
    quantity: order.quantity,
    size: order.size,
    paper: order.paper,
    paper_id: order.paper_id,
    finish: order.finish,
    finish_id: order.finish_id,
    total_usd: order.quote.total_usd,
    breakdown: order.quote.breakdown,
    turnaround_days: order.quote.turnaround_days,
    proof: {
      id: order.proof.id,
      approved: !!order.proof.approved_at,
      approved_at: order.proof.approved_at
    },
    press_slot: order.slot ? { slot_id: order.slot.slot_id, date: order.slot.date, press: order.slot.press } : null,
    ready_on: readyDate(order),
    timeline: timeline(order).map((t) => ({ step: t.key, state: t.state, when: t.when }))
  };
}

// Everything baton_complete_leg needs to describe this leg, straight from the order.
function legEvidence(order) {
  return {
    order_id: order.id,
    set: order.set,
    quantity: order.quantity,
    size: order.size,
    paper: order.paper,
    finish: order.finish,
    proof_id: order.proof.id,
    proof_approved_at: order.proof.approved_at,
    press_slot_id: order.slot ? order.slot.slot_id : null,
    slot_date: order.slot ? order.slot.date : null,
    ready_on: readyDate(order),
    cost_usd: order.quote.total_usd
  };
}

function legSummary(order) {
  return 'Printed ' + order.quantity + ' sheets of ' + order.set + ' at ' + SIZE_LABELS[order.size] +
    ' on ' + order.paper + ', ' + order.finish.toLowerCase() +
    (order.slot ? ', press day ' + order.slot.date : '');
}

function timeline(order) {
  const approved = !!order.proof.approved_at;
  const held = !!order.slot;
  return [
    { key: 'quoted', name: 'Quoted', when: order.created_at.slice(0, 10), state: 'done' },
    {
      key: 'proof_approved', name: 'Proof approved',
      when: approved ? order.proof.approved_at.slice(0, 10) : 'waiting for approval',
      state: approved ? 'done' : 'now'
    },
    {
      key: 'slot_held', name: 'Press day held',
      when: held ? order.slot.date : approved ? 'pick a free day' : 'after the proof',
      state: held ? 'done' : approved ? 'now' : 'todo'
    },
    {
      key: 'printing', name: 'Printing',
      when: held ? 'on ' + order.slot.date : 'after the slot is held',
      state: held ? 'now' : 'todo'
    },
    {
      key: 'ready', name: 'Ready for collection',
      when: held ? 'from ' + readyDate(order) : 'after printing',
      state: 'todo'
    }
  ];
}

/* --------------------------------------------------- what the page shows */

function pageNow() {
  const order = activeOrder();
  const parts = [];
  if (order) {
    const st = statusOf(order);
    parts.push('Order ' + order.id + ' on the page: ' + order.quantity + ' sheets of ' + order.set +
      ', ' + SIZE_LABELS[order.size] + ', ' + order.paper + ', ' + order.finish.toLowerCase() +
      ', ' + usd(order.quote.total_usd) + ' — ' + STATUS_LABEL[st].toLowerCase() +
      (order.slot ? ' for ' + order.slot.date : '') + '.');
  } else {
    const q = currentQuote();
    parts.push(q.ok
      ? 'The builder shows ' + q.quantity + ' sheets, ' + q.size_label + ', ' + q.paper + ', ' + usd(q.total_usd) + '. No order opened yet.'
      : 'The builder is showing an incomplete specification. No order opened yet.');
  }
  if (baton && baton.mission) parts.push('Mission ' + baton.mission.id + ' is aboard in the panel.');
  else parts.push('No mission aboard yet.');
  return parts.join(' ');
}

/* -------------------------------------------------------------- the page */

el('host-label').textContent = location.host || 'file://';

/* theme */

function systemDark() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}
function currentTheme() {
  const t = document.documentElement.dataset.theme;
  return t === 'dark' || t === 'light' ? t : systemDark() ? 'dark' : 'light';
}
function paintTheme() {
  const t = currentTheme();
  el('theme-label').textContent = t === 'dark' ? 'Dark' : 'Light';
  el('theme-toggle').setAttribute('aria-pressed', String(t === 'dark'));
  el('theme-toggle').title = 'Switch to the ' + (t === 'dark' ? 'light' : 'dark') + ' theme';
}
el('theme-toggle').addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('rivera.theme', next); } catch { /* private mode */ }
  paintTheme();
});
paintTheme();

/* ------------------------------------------------------------------ steps

   The shop is four steps in one place. Nothing scrolls: a step is shown by
   unhiding its panel and hiding the other three, so the view stays where it
   is while the work moves on. The step buttons, the Back and Next buttons and
   the site tools all go through goToStep, which is why the camera holds still
   while an agent works. */

const STEP_COUNT = 4;
let step = 1;
let stepsSeen = 1;

const stepButtons = Array.from(document.querySelectorAll('.steps .step'));
const stepPanels = Array.from(document.querySelectorAll('.panel[data-step]'));
const navBack = document.querySelector('.steps__nav [data-nav="back"]');
const navNext = document.querySelector('.steps__nav [data-nav="next"]');

function goToStep(n) {
  const want = Math.min(STEP_COUNT, Math.max(1, Math.trunc(Number(n)) || 1));
  step = want;
  if (want > stepsSeen) stepsSeen = want;
  for (const panel of stepPanels) panel.hidden = panel.dataset.step !== String(want);
  for (const btn of stepButtons) {
    const k = Number(btn.dataset.step);
    if (k === want) btn.setAttribute('aria-current', 'step');
    else btn.removeAttribute('aria-current');
    // Anything behind the furthest step reached has been done.
    if (k !== want && k < stepsSeen) btn.dataset.done = '';
    else delete btn.dataset.done;
  }
  if (navBack) navBack.disabled = want === 1;
  if (navNext) navNext.disabled = want === STEP_COUNT;
}

for (const btn of stepButtons) btn.addEventListener('click', () => goToStep(btn.dataset.step));
if (navBack) navBack.addEventListener('click', () => goToStep(step - 1));
if (navNext) navNext.addEventListener('click', () => goToStep(step + 1));

/* one-time content */

// The hero is a photograph of the press room, not a print from a set: there is
// no drawn stand-in for it, so a missing file takes the frame off the page
// rather than leaving a broken image in the corner of the hero.
{
  const heroImg = el('hero-image');
  const dropHero = () => { const f = el('hero-frame'); if (f) f.hidden = true; };
  if (heroImg.complete && heroImg.naturalWidth === 0) dropHero();
  else heroImg.addEventListener('error', dropHero, { once: true });
}

el('papers-body').innerHTML = PAPERS.map((p) =>
  '<tr><td class="paper__name">' + esc(p.name) + '</td><td class="muted">' + esc(p.character) + '</td>' +
  '<td class="num">' + usd(p.price_20x30) + '</td>' +
  '<td class="num">' + usd(p.price_30x40) + '</td>' +
  '<td class="num">' + usd(p.price_40x60) + '</td></tr>'
).join('');

el('finishes-list').innerHTML = FINISHES.map((f) =>
  '<li><b>' + esc(f.name) + '</b>' +
  '<span class="surcharge">' + (f.surcharge_usd === 0 ? 'no surcharge' : '+' + usd(f.surcharge_usd) + ' a sheet') + '</span>' +
  '<div class="note">' + esc(f.note) + '</div></li>'
).join('');

// The hero button is a real control: it opens step 1 and puts the keyboard on
// the first set, so the page starts where the work starts.
el('start-project').addEventListener('click', () => {
  goToStep(1);
  const first = el('sets-grid').querySelector('[data-pick]');
  if (first) first.focus();
});

/* form skeleton */

el('f-set').innerHTML =
  SETS.map((s) => '<option value="' + s.id + '">' + esc(s.name) + ' · ' + s.prints + ' prints</option>').join('') +
  '<option value="">Loose sheets, my own files</option>';

el('f-paper').innerHTML = PAPERS.map((p) =>
  '<option value="' + p.id + '">' + esc(p.name) + '</option>'
).join('');

el('f-size').innerHTML = SIZES.map((s) =>
  '<label class="pill"><input type="radio" name="size" value="' + s + '"><span>' + esc(SIZE_LABELS[s]) + '</span></label>'
).join('');

el('f-finish').innerHTML = FINISHES.map((f) =>
  '<label class="pill"><input type="radio" name="finish" value="' + f.id + '"><span>' + esc(f.name) + '</span></label>'
).join('');

/* ------------------------------------------------------------- rendering */

function totalSheets(form) {
  const s = form.set ? findSet(form.set) : null;
  const n = Math.trunc(Number(form.quantity) || 0);
  if (form.qmode === 'per_print' && s) return n * s.prints;
  return n;
}

function currentQuote() {
  const f = state.form;
  return quoteRun({
    set: f.set || undefined,
    quantity: totalSheets(f),
    size: f.size,
    paper: f.paper,
    finish: f.finish
  });
}

// Values are written back only when the page changes the form itself; while
// somebody is typing, only the notes under the fields are repainted.
function formToDom() {
  const f = state.form;
  el('f-set').value = f.set || '';
  el('f-quantity').value = f.quantity;
  el('f-paper').value = f.paper;
  for (const input of document.querySelectorAll('input[name="size"]')) input.checked = input.value === f.size;
  for (const input of document.querySelectorAll('input[name="finish"]')) input.checked = input.value === f.finish;
  for (const input of document.querySelectorAll('input[name="qmode"]')) input.checked = input.value === f.qmode;
  paintNotes();
}

function paintNotes() {
  const f = state.form;
  const set = f.set ? findSet(f.set) : null;
  const perPrint = document.querySelector('input[name="qmode"][value="per_print"]');
  perPrint.disabled = !set;
  perPrint.closest('.pill').style.opacity = set ? '1' : '0.45';

  el('set-note').textContent = set
    ? set.prints + ' prints · edition of ' + set.edition + ' · ' + set.colour + ' · we suggest ' + findPaper(set.paper).name
    : 'Send your own files and we will proof them the same way.';

  const sheets = totalSheets(f);
  el('qty-note').textContent = f.qmode === 'per_print' && set
    ? sheets + ' sheets in total (' + f.quantity + ' of each of the ' + set.prints + ' prints).'
    : sheets >= SETUP_WAIVED_AT
      ? 'Press setup is waived from ' + SETUP_WAIVED_AT + ' sheets.'
      : 'Under ' + SETUP_WAIVED_AT + ' sheets a ' + usd(SETUP_USD) + ' press setup applies.';

  const paper = findPaper(f.paper);
  el('paper-note').textContent = paper ? paper.character + ' · ' + usd(paper['price_' + f.size]) + ' a sheet at ' + SIZE_LABELS[f.size] : '';
}

function domToForm() {
  const f = state.form;
  f.set = el('f-set').value;
  f.quantity = Math.max(1, Math.min(MAX_RUN, Math.trunc(Number(el('f-quantity').value) || 1)));
  f.paper = el('f-paper').value;
  const size = document.querySelector('input[name="size"]:checked');
  const finish = document.querySelector('input[name="finish"]:checked');
  const qmode = document.querySelector('input[name="qmode"]:checked');
  if (size) f.size = size.value;
  if (finish) f.finish = finish.value;
  if (qmode) f.qmode = qmode.value;
  if (!f.set && f.qmode === 'per_print') f.qmode = 'total';
  save();
}

function renderQuote() {
  const q = currentQuote();
  const box = el('quote-card');
  if (!q.ok) {
    box.innerHTML = '<div class="quote__title">Quote</div><p class="quote__bad">' + esc(q.error) + '</p>';
    return;
  }
  const b = q.breakdown;
  box.innerHTML = [
    '<div class="quote__title">' + (q.set ? esc(q.set) : 'Loose sheets') + '</div>',
    '<div class="quote__spec">' + q.quantity + ' sheets · ' + esc(q.size_label) + ' · ' + esc(q.paper) + ' · ' + esc(q.finish.toLowerCase()) + '</div>',
    '<ul class="quote__lines">',
    '  <li><span>' + q.quantity + ' × ' + usd(q.per_print_usd) + '</span><span class="num">' + usd(b.prints_usd) + '</span></li>',
    '  <li><span>' + esc(q.finish) + '</span><span class="num">' + (b.finish_usd === 0 ? 'included' : usd(b.finish_usd)) + '</span></li>',
    '  <li><span>Press setup</span><span class="num' + (b.setup_usd === 0 ? ' waived' : '') + '">' + (b.setup_usd === 0 ? 'waived' : usd(b.setup_usd)) + '</span></li>',
    '</ul>',
    '<div class="quote__total"><span>Total</span><b class="num">' + usd(q.total_usd) + '</b></div>',
    '<p class="quote__ready">' + q.turnaround_days + ' press days. Earliest ready ' + q.earliest_ready + '.</p>'
  ].join('');
}

function renderSets() {
  const ids = state.filter ? new Set(state.filter.ids) : null;
  const shown = ids ? SETS.filter((s) => ids.has(s.id)) : SETS;
  el('sets-grid').innerHTML = shown.map((s) => {
    const from = quoteRun({ quantity: s.prints, size: '20x30', paper: s.paper, finish: 'matte' });
    return [
      '<article class="setcard' + (state.form.set === s.id ? ' setcard--picked' : '') + '">',
      '  <div class="setcard__art">' + printFrame(s, { className: 'setcard__print' }) + '</div>',
      '  <div class="setcard__body">',
      '    <button type="button" class="setcard__pick" data-pick="' + s.id + '"',
      '            aria-pressed="' + (state.form.set === s.id ? 'true' : 'false') + '">',
      '      <span class="setcard__name">' + esc(s.name) + '</span>',
      '    </button>',
      '    <div class="setcard__meta">' + s.prints + ' prints · edition of ' + s.edition + ' · from ' + usd(from.total_usd) + '</div>',
      '  </div>',
      '</article>'
    ].join('');
  }).join('');

  wirePrints(el('sets-grid'));

  const bar = el('set-filter');
  if (state.filter) {
    bar.hidden = false;
    el('set-filter-text').textContent = shown.length + ' of ' + SETS.length + ' sets match “' + state.filter.query + '”.';
  } else {
    bar.hidden = true;
  }
}

function renderCalendar() {
  const order = activeOrder();
  const held = order && order.slot ? order.slot.date : null;
  el('press-calendar').innerHTML = pressDays().map((d) => {
    const isHeld = d.date === held;
    const cls = 'day day--' + (isHeld ? 'held' : d.state);
    const label = isHeld ? 'yours' : d.state === 'open' ? 'free' : d.state === 'full' ? 'booked' : 'closed';
    return [
      '<button type="button" class="' + cls + '" data-date="' + d.date + '" data-state="' + d.state + '"',
      d.state === 'open' || isHeld ? '' : ' aria-disabled="true"',
      ' title="' + esc(d.date + ' · ' + d.note) + '">',
      '<span class="day__dow">' + esc(d.weekday) + '</span>',
      '<span class="day__num">' + esc(d.label.split(' ')[1]) + '</span>',
      '<span class="day__state">' + label + '</span>',
      '</button>'
    ].join('');
  }).join('');
  el('calendar-msg').textContent = state.message;
}

let lastOrderShown = null;

/* Step 3 — the proof, and the one button that approves it. */

function renderProof() {
  const order = activeOrder();
  const box = el('proof-card');
  if (!order) {
    box.innerHTML = '<div class="empty">No proof yet. Open an order in step 2 and its proof appears here.</div>';
    return;
  }
  const set = findSet(order.set_id);
  const approved = !!order.proof.approved_at;

  box.innerHTML = [
    '<div class="proof">',
    '  <div class="proof__sheet">',
    '    <i class="proof__mark proof__mark--tl"></i><i class="proof__mark proof__mark--tr"></i>',
    '    <i class="proof__mark proof__mark--bl"></i><i class="proof__mark proof__mark--br"></i>',
         printFrame(set, { className: 'proof__art' }),
    '  </div>',
    '  <div class="proof__caption">' + esc(order.proof.id) + ' · ' + esc(SIZE_LABELS[order.size]) + ' · ' +
         esc(approved ? 'approved' : 'awaiting approval') + '</div>',
    '</div>',
    '<div class="proof__foot">',
    '  <div class="proof__spec"><span class="order__id">' + esc(order.id) + '</span> · ' + order.quantity +
         ' sheets of ' + esc(order.set) + ' on ' + esc(order.paper) + ', ' + esc(order.finish.toLowerCase()) + '</div>',
         approved
           ? '<p class="fineprint">Proof approved. Pick a free press day on the calendar.</p>'
           : '<button type="button" class="btn btn--primary btn--small" id="approve-proof">Approve the proof</button>',
    '</div>'
  ].join('');

  wirePrints(box);
}

/* Step 4 — where the print leg stands. */

function renderOrder() {
  const order = activeOrder();
  const box = el('order-card');
  if (!order) {
    lastOrderShown = null;
    box.innerHTML = '<div class="empty">No order open. Build a specification in step 2 and create one, ' +
      'or ask your agent to run <code>create_order</code>.</div>';
    return;
  }
  const st = statusOf(order);
  const set = findSet(order.set_id);

  const others = state.orders.filter((o) => o.id !== order.id);
  const otherRow = others.length
    ? '<p class="fineprint">Earlier orders: ' + others.map((o) =>
        '<button type="button" class="link" data-show-order="' + o.id + '">' + esc(o.id) + '</button>' +
        ' (' + esc(STATUS_LABEL[statusOf(o)].toLowerCase()) + ')').join(', ') + '</p>'
    : '';

  const arriving = order.id !== lastOrderShown;
  lastOrderShown = order.id;

  box.innerHTML = [
    '<div class="order' + (arriving ? ' order--new' : '') + '">',
    '  <div class="order__head">',
    '    <div><span class="order__id">' + esc(order.id) + '</span> · ' + esc(order.set) + '</div>',
    '    <div><span class="status status--' + (st === 'quoted' ? 'wait' : 'ok') + '">' +
           esc(STATUS_LABEL[st]) + '</span> <span class="order__price num">' + usd(order.quote.total_usd) + '</span></div>',
    '  </div>',
    '  <div class="order__body">',
    '    <ul class="order__spec">',
    '      <li><span>Sheets</span>' + order.quantity + ' of a set of ' + set.prints + '</li>',
    '      <li><span>Size</span>' + esc(SIZE_LABELS[order.size]) + '</li>',
    '      <li><span>Paper</span>' + esc(order.paper) + '</li>',
    '      <li><span>Finish</span>' + esc(order.finish) + '</li>',
    '      <li><span>Proof</span>' + esc(order.proof.id) + (order.proof.approved_at ? ', approved' : ', awaiting approval') + '</li>',
    '      <li><span>Press</span>' + esc(order.slot ? order.slot.press + ', ' + order.slot.date : 'not held yet') + '</li>',
    '    </ul>',
    '    <ol class="timeline">' + timeline(order).map((t) =>
           '<li class="' + t.state + '"><span class="timeline__dot">' + (t.state === 'done' ? '\u2713' : '·') + '</span>' +
           '<span><span class="timeline__name">' + esc(t.name) + '</span><br>' +
           '<span class="timeline__when">' + esc(t.when) + '</span></span></li>').join('') + '</ol>',
    '    <div class="order__actions">',
    '      <button type="button" class="btn btn--small" id="edit-order">Change the specification</button>',
    '      <button type="button" class="btn btn--small" id="drop-order">Cancel this order</button>',
    '    </div>',
    '  </div>',
    '</div>',
    otherRow
  ].join('');
}

function renderAll() {
  formToDom();
  renderQuote();
  renderSets();
  renderProof();
  renderOrder();
  renderCalendar();
}

/* --------------------------------------------------------------- events */

let lastSetShown = state.form.set;
function formTouched() {
  domToForm();
  paintNotes();
  renderQuote();
  if (state.form.set !== lastSetShown) { lastSetShown = state.form.set; renderSets(); }
}
el('order-form').addEventListener('input', formTouched);
el('order-form').addEventListener('change', formTouched);

el('order-form').addEventListener('submit', (e) => {
  e.preventDefault();
  domToForm();
  if (!state.form.set) {
    el('form-msg').textContent = 'Pick one of the six sets to open an order.';
    return;
  }
  const made = makeOrder({
    set: state.form.set,
    quantity: totalSheets(state.form),
    size: state.form.size,
    paper: state.form.paper,
    finish: state.form.finish
  });
  if (!made.ok) { el('form-msg').textContent = made.error; return; }
  el('form-msg').textContent = 'Order ' + made.order.id + ' opened. Proof ' + made.order.proof.id + ' is waiting in step 3.';
  state.message = '';
  renderAll();
  showLegStatus(made.order);
  refreshTools();
  goToStep(2);
});

el('sets-grid').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-pick]');
  if (!btn) return;
  state.form.set = btn.dataset.pick;
  const s = findSet(state.form.set);
  state.form.paper = s.paper;
  save();
  renderAll();
  goToStep(2);
});

el('set-filter-clear').addEventListener('click', () => { state.filter = null; renderSets(); });

el('proof-card').addEventListener('click', (e) => {
  const order = activeOrder();
  if (!order) return;
  if (!e.target.closest('#approve-proof')) return;
  approveProof(order);
  state.message = 'Proof approved. Pick a free press day on the calendar.';
  renderAll();
  showLegStatus(order);
  goToStep(3);
});

el('order-card').addEventListener('click', (e) => {
  const order = activeOrder();
  if (!order) return;
  if (e.target.closest('#edit-order')) {
    Object.assign(state.form, {
      set: order.set_id, quantity: order.quantity, qmode: 'total',
      size: order.size, paper: order.paper_id, finish: order.finish_id
    });
    save();
    renderAll();
    goToStep(2);
    return;
  }
  if (e.target.closest('#drop-order')) {
    state.orders = state.orders.filter((o) => o.id !== order.id);
    state.activeId = state.orders.length ? state.orders[state.orders.length - 1].id : null;
    state.message = '';
    save();
    renderAll();
    showLegStatus(activeOrder());
    return;
  }
  const show = e.target.closest('[data-show-order]');
  if (show) { state.activeId = show.dataset.showOrder; save(); renderAll(); }
});

el('press-calendar').addEventListener('click', (e) => {
  const btn = e.target.closest('.day');
  if (!btn) return;
  const date = btn.dataset.date;
  const day = pressDay(date);
  const order = activeOrder();
  if (!order) { state.message = 'A press day is held against an order. Open one first.'; renderCalendar(); return; }
  if (!order.proof.approved_at) { state.message = 'Approve proof ' + order.proof.id + ' before holding a press day.'; renderCalendar(); return; }
  if (!day || day.state !== 'open') {
    const near = nearestFreeDays(date);
    state.message = date + ' is ' + (day && day.state === 'full' ? 'fully booked' : 'closed') +
      '. The nearest free days are ' + near.join(' and ') + '.';
    renderCalendar();
    return;
  }
  holdSlot(order, date);
  state.message = 'Press day ' + date + ' held for ' + order.id + ' (' + order.slot.slot_id + ').';
  renderAll();
  showLegStatus(order);
  goToStep(3);
});

/* ------------------------------------------------------------ the baton */

// The businesses on the route. config.js holds the addresses; these are the
// names, written into the mission when it starts so every later site can say
// where the baton goes next in words a person uses.
const STOP_NAMES = { print: 'Rivera Press', bind: 'Norte Bindery', deliver: 'Ruta Courier' };

const baton = mountBaton({
  ...SITE,
  route: ROUTE,
  // The catalogue is the source of truth for what the shop will take on.
  houseTerms: {
    ...SITE.houseTerms,
    sizes: SIZES,
    finishes: FINISHES.map((f) => f.id),
    requires_declared: ['quantity', 'size', 'paper'],
    max_quantity: MAX_RUN,
    notes: 'Print legs only. Quantity, size and paper are declared, a proof is approved, and then a press day is held.'
  },
  emptyHint: 'Missions begin at Rivera Press. Ask your agent to run baton_start. The baton appears here, ' +
    'then travels to the bindery and the courier with every leg signed.',
  // What an agent that lands here has to do, in one paragraph. baton_inspect
  // hands it back as brief.this_stop_must and the panel prints it on the page.
  stopBrief: 'Quote the run for the quantity on the baton, open the order, approve the proof, ' +
    'hold the first free press day that fits the instructions, sign the leg (the operator taps ' +
    'Confirm once), then mint the link and continue to the bindery.',
  panel: el('mission-panel'),
  toolsBox: el('site-tools')
});

if (!baton.hasWebMCP) el('no-webmcp').hidden = false;

function refreshTools() {
  try { baton.refreshToolsBox(); } catch { /* nothing registered */ }
}

/* Confirmation policy — one tap per site.
   The operator taps Confirm once here, for baton_complete_leg: the signature,
   which is also the money. Approving a proof and holding a press day apply the
   moment the agent asks for them, because both are provisional: the house terms
   release a held day if the leg is not signed within 48 hours. So the agent
   quotes, opens, approves and holds without stopping, and the person is asked
   once, at the point where it counts. */

/* The line the mission panel shows under Rivera's row while the leg is built. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDay = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  return m ? Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] : String(iso);
};

function legStatusLine(order) {
  if (!order) return '';
  const bits = ['Order ' + order.id];
  if (order.proof.approved_at) bits.push('proof approved');
  else bits.push(usd(order.quote.total_usd), 'proof ' + order.proof.id + ' waiting');
  if (order.slot) bits.push('press day ' + shortDay(order.slot.date) + ' held');
  else if (order.proof.approved_at) bits.push('press day to hold');
  if (order.slot && order.proof.approved_at) bits.push('ready to sign');
  return bits.join(' · ');
}

function showLegStatus(order) {
  try {
    const m = baton.mission;
    if (m && m.legs.some((l) => l.origin === location.origin)) return; // signed: the summary speaks now
    baton.setLegStatus(legStatusLine(order));
  } catch { /* older library, or no panel */ }
}

// What the agent should do next with the order in front of it.
function orderNext(order) {
  if (!order.proof.approved_at) return 'Call approve_proof for ' + order.id + '.';
  if (!order.slot) return 'Hold a press day with reserve_print_slot; list_press_days has the free ones.';
  return 'Call prepare_print_leg, then baton_complete_leg to sign the print leg.';
}

/* ----------------------------------------------------------- site tools */

baton.registerAlways((signal, register) => {

  register({
    name: 'list_sets',
    description: 'The six print sets Rivera Press keeps: how many prints in each, the edition size, the colour, the paper we recommend and what a full set costs at 20x30.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async () => {
      goToStep(1);
      return {
        ok: true,
        sets: SETS.map((s) => ({
          id: s.id,
          name: s.name,
          prints: s.prints,
          edition: s.edition,
          colour: s.colour,
          recommended_paper: s.paper,
          note: s.note,
          set_price_20x30_matte_usd: quoteRun({ quantity: s.prints, size: '20x30', paper: s.paper, finish: 'matte' }).total_usd
        })),
        next: 'Pick a set, then price the run with quote_run using quantity, size and paper.',
        page: pageNow()
      };
    }
  }, signal);

  register({
    name: 'list_papers',
    description: 'The four papers Rivera Press stocks with the price of one sheet at each size, the three finishes and their surcharges, and the press setup rule.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async () => ({
      ok: true,
      currency: 'USD',
      sizes: SIZES.map((s) => ({ id: s, label: SIZE_LABELS[s] })),
      papers: PAPERS,
      finishes: FINISHES.map((f) => ({ id: f.id, name: f.name, surcharge_per_print_usd: f.surcharge_usd, extra_days: f.extra_days, note: f.note })),
      setup_usd: SETUP_USD,
      setup_waived_from_sheets: SETUP_WAIVED_AT,
      max_run_sheets: MAX_RUN,
      next: 'Use quote_run with quantity, size and paper.',
      page: pageNow()
    })
  }, signal);

  register({
    name: 'search_catalog',
    description: 'Search the sets, papers and finishes by a word — a colour, a name, an edition size, a paper character — and filter the set list on the page to the matches.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'What to look for, for example "indigo", "cotton", "deckled" or "edition of 20".' } },
      required: ['query'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    execute: async (input) => {
      const found = searchCatalog(input.query);
      state.filter = found.sets.length ? { query: String(input.query), ids: found.sets.map((s) => s.id) } : null;
      renderSets();
      goToStep(1);
      return {
        ok: true,
        query: String(input.query),
        matches: found.count,
        sets: found.sets,
        papers: found.papers,
        finishes: found.finishes,
        next: found.sets.length
          ? 'Price one of the matches with quote_run.'
          : 'Nothing matched. Try another word, or call list_sets for all six.',
        page: found.sets.length
          ? 'The set list on the page is filtered to ' + found.sets.map((s) => s.name).join(', ') + '. ' + pageNow()
          : 'No set matched, so the page still shows all six. ' + pageNow()
      };
    }
  }, signal);

  register({
    name: 'quote_run',
    description: 'Price a print run and show it in the order builder: the sheet price, the finish, the press setup, the total and the number of press days. Nothing is reserved.',
    inputSchema: {
      type: 'object',
      properties: {
        set: { type: 'string', enum: SETS.map((s) => s.id), description: 'Which set is being printed. Leave it out for loose sheets.' },
        quantity: { type: 'integer', minimum: 1, maximum: MAX_RUN, description: 'Total sheets to print.' },
        size: { type: 'string', enum: SIZES, description: 'Print size in centimetres.' },
        paper: { type: 'string', enum: PAPERS.map((p) => p.id), description: 'Paper id from list_papers.' },
        finish: { type: 'string', enum: FINISHES.map((f) => f.id), description: 'Finish. Matte if left out.' }
      },
      required: ['quantity', 'size', 'paper'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    execute: async (input) => {
      const q = quoteRun(input);
      if (!q.ok) return { ...q, next: 'Fix the specification and call quote_run again; list_papers has the sizes and papers.', page: pageNow() };
      Object.assign(state.form, {
        set: q.set_id || '', quantity: q.quantity, qmode: 'total',
        size: q.size, paper: q.paper_id, finish: q.finish_id
      });
      save();
      formToDom();
      renderQuote();
      renderSets();
      goToStep(2);
      return {
        ...q,
        next: activeOrder()
          ? 'Apply it to the open order with update_order, or open a new one with create_order.'
          : 'Open the order with create_order using the same specification.',
        page: 'The order builder now shows ' + q.quantity + ' sheets, ' + q.size_label + ', ' + q.paper +
          ', ' + q.finish.toLowerCase() + ', total ' + usd(q.total_usd) + '. ' +
          (activeOrder() ? 'The open order is unchanged.' : 'No order opened yet.')
      };
    }
  }, signal);

  register({
    name: 'create_order',
    description: 'Open an order at Rivera Press for one of the sets. Returns the order id and the quote, and generates the proof that has to be approved before a press day can be held.',
    inputSchema: {
      type: 'object',
      properties: {
        set: { type: 'string', enum: SETS.map((s) => s.id), description: 'Which set to print.' },
        quantity: { type: 'integer', minimum: 1, maximum: MAX_RUN, description: 'Total sheets to print.' },
        size: { type: 'string', enum: SIZES, description: 'Print size in centimetres.' },
        paper: { type: 'string', enum: PAPERS.map((p) => p.id), description: 'Paper id from list_papers.' },
        finish: { type: 'string', enum: FINISHES.map((f) => f.id), description: 'Finish. Matte if left out.' }
      },
      required: ['set', 'quantity', 'size', 'paper'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false },
    execute: async (input) => {
      const made = makeOrder(input);
      if (!made.ok) return { ...made, next: 'Fix the specification and call create_order again.', page: pageNow() };
      state.message = '';
      renderAll();
      showLegStatus(made.order);
      goToStep(2);
      return {
        ok: true,
        order: orderView(made.order),
        next: 'Order ' + made.order.id + ' is open and proof ' + made.order.proof.id +
          ' is issued. Call approve_proof, then reserve_print_slot to hold a press day.',
        page: pageNow()
      };
    }
  }, signal);

  register({
    name: 'get_order',
    description: 'Read one order: specification, quote breakdown, proof state, press slot, the status timeline, and the evidence to hand to baton_complete_leg.',
    inputSchema: {
      type: 'object',
      properties: { order_id: { type: 'string', description: 'Order id, for example RP-1042. The order on the page if left out.' } },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    execute: async (input) => {
      const order = input && input.order_id ? orderById(input.order_id) : activeOrder();
      if (!order) {
        return {
          ok: false,
          error: 'no such order',
          open_orders: state.orders.map((o) => o.id),
          next: state.orders.length
            ? 'Call get_order again with one of the open order ids.'
            : 'Open an order first with create_order.',
          page: pageNow()
        };
      }
      goToStep(4);
      return {
        ok: true,
        order: orderView(order),
        leg_evidence: legEvidence(order),
        suggested_leg_summary: legSummary(order),
        next: orderNext(order),
        page: pageNow()
      };
    }
  }, signal);

  register({
    name: 'update_order',
    description: 'Change the quantity, size, paper or finish of an open order. The quote is redone; an approved proof is withdrawn and re-issued, and any held press day is released.',
    inputSchema: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'Order id. The order on the page if left out.' },
        quantity: { type: 'integer', minimum: 1, maximum: MAX_RUN, description: 'New total number of sheets.' },
        size: { type: 'string', enum: SIZES, description: 'New print size.' },
        paper: { type: 'string', enum: PAPERS.map((p) => p.id), description: 'New paper id.' },
        finish: { type: 'string', enum: FINISHES.map((f) => f.id), description: 'New finish.' }
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: false },
    execute: async (input) => {
      const order = input && input.order_id ? orderById(input.order_id) : activeOrder();
      if (!order) {
        return {
          ok: false,
          error: 'no such order',
          open_orders: state.orders.map((o) => o.id),
          next: 'Open an order with create_order, or pass one of the open order ids.',
          page: pageNow()
        };
      }
      const changes = {};
      for (const k of ['quantity', 'size', 'paper', 'finish']) if (input[k] !== undefined) changes[k] = input[k];
      if (Object.keys(changes).length === 0) {
        return {
          ok: false,
          error: 'nothing to change — pass at least one of quantity, size, paper or finish',
          next: 'Call update_order again with the field you want changed.',
          page: pageNow()
        };
      }
      const res = requote(order, changes);
      if (!res.ok) return { ...res, next: 'Fix the new specification and call update_order again.', page: pageNow() };
      state.activeId = order.id;
      state.message = res.slot_released ? 'The press day was released because the specification changed.' : state.message;
      renderAll();
      showLegStatus(order);
      goToStep(2);
      return {
        ok: true,
        changed: res.changed,
        proof_reissued: res.reproofed,
        slot_released: !!res.slot_released,
        order: orderView(order),
        next: res.changed
          ? 'The quote is redone and proof ' + order.proof.id + ' re-issued. ' + orderNext(order)
          : orderNext(order),
        page: pageNow()
      };
    }
  }, signal);

  register({
    name: 'approve_proof',
    description: 'Approve the proof on an order so a press day can be held. Applies straight away and returns the order; nothing is charged until the leg is signed.',
    inputSchema: {
      type: 'object',
      properties: { order_id: { type: 'string', description: 'Order id. The order on the page if left out.' } },
      additionalProperties: false
    },
    annotations: { readOnlyHint: false },
    execute: async (input) => {
      const order = input && input.order_id ? orderById(input.order_id) : activeOrder();
      if (!order) {
        return {
          ok: false,
          error: 'no such order',
          open_orders: state.orders.map((o) => o.id),
          next: 'Open an order with create_order, or pass one of the open order ids.',
          page: pageNow()
        };
      }

      const free = freeDays().slice(0, 5).map((d) => d.date);
      const nextLine = 'Proof approved. Hold a press day with reserve_print_slot' +
        (free[0] ? ' — ' + free[0] + ' is the first free one.' : '.');

      if (order.proof.approved_at) {
        goToStep(3);
        return {
          ok: true, already: true, order: orderView(order), free_days: free,
          next: order.slot
            ? 'The press day is already held until the leg is signed. Call prepare_print_leg, then baton_complete_leg.'
            : nextLine,
          page: pageNow()
        };
      }

      approveProof(order);
      state.message = 'Proof approved. Pick a free press day.';
      renderAll();
      showLegStatus(order);
      goToStep(3);
      return {
        ok: true,
        approved: true,
        order: orderView(order),
        free_days: free,
        next: nextLine,
        page: pageNow()
      };
    }
  }, signal);

  register({
    name: 'list_press_days',
    description: 'The next twenty-one days of press time and whether each one is free, fully booked or closed. The same grid the page shows.',
    inputSchema: {
      type: 'object',
      properties: { only_free: { type: 'boolean', description: 'Return only the days that can still be held.' } },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    execute: async (input) => {
      const all = pressDays();
      const days = input && input.only_free ? all.filter((d) => d.state === 'open') : all;
      goToStep(3);
      return {
        ok: true,
        from: todayISO(),
        days_shown: CALENDAR_DAYS,
        free_count: all.filter((d) => d.state === 'open').length,
        days: days.map((d) => ({ date: d.date, weekday: d.weekday, state: d.state, note: d.note })),
        next: 'Hold one of the free days with reserve_print_slot.',
        page: pageNow()
      };
    }
  }, signal);

  register({
    name: 'reserve_print_slot',
    description: 'Hold a press day for an order whose proof is approved. The hold applies straight away and stands until the leg is signed; the house terms release it after 48 hours if no leg is signed. Full and closed days are refused with the nearest free ones.',
    inputSchema: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'Order id. The order on the page if left out.' },
        date: { type: 'string', description: 'Press day as YYYY-MM-DD, from list_press_days.' }
      },
      required: ['date'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false },
    execute: async (input) => {
      if (!isDate(input.date)) {
        return { ok: false, error: 'date must look like YYYY-MM-DD', next: 'Call list_press_days and pass one of its dates.', page: pageNow() };
      }
      const order = input.order_id ? orderById(input.order_id) : activeOrder();
      if (!order) {
        return {
          ok: false,
          error: 'a press day is held against an order — open one with create_order first',
          open_orders: state.orders.map((o) => o.id),
          next: 'Call create_order, then reserve_print_slot again.',
          page: pageNow()
        };
      }

      if (!order.proof.approved_at) {
        return {
          ok: false,
          error: 'proof ' + order.proof.id + ' on ' + order.id + ' is not approved yet',
          next: 'Call approve_proof for ' + order.id + ' first.',
          page: pageNow()
        };
      }
      const day = pressDay(input.date);
      if (!day || day.state !== 'open') {
        const near = nearestFreeDays(input.date);
        state.message = input.date + ' cannot be held. Nearest free: ' + near.join(', ') + '.';
        renderCalendar();
        goToStep(3);
        return {
          ok: false,
          error: !day
            ? input.date + ' is outside the twenty-one days we schedule'
            : day.state === 'full'
              ? input.date + ' is fully booked — both bays are taken'
              : input.date + ' is closed: ' + day.note,
          nearest_free_days: near,
          next: 'Try ' + near.join(' or ') + ', or call list_press_days for the whole grid.',
          page: pageNow()
        };
      }
      if (baton.mission) {
        const check = baton.checkAction({ cost_usd: order.quote.total_usd, date: input.date });
        if (!check.allowed) {
          return {
            ok: false,
            error: 'blocked by the mission constraints',
            check,
            next: 'Pick an earlier day or a cheaper specification, then call reserve_print_slot again.',
            page: pageNow()
          };
        }
      }

      holdSlot(order, input.date);
      state.message = 'Press day ' + input.date + ' held for ' + order.id + '.';
      renderAll();
      showLegStatus(order);
      goToStep(3);
      return {
        ok: true,
        held: true,
        slot: orderView(order).press_slot,
        holds_until: 'the leg is signed',
        order: orderView(order),
        evidence: legEvidence(order),
        next: baton.mission
          ? 'Press day held until the leg is signed. Call prepare_print_leg, then baton_complete_leg — the ' +
            'operator taps Confirm once — then baton_mint to carry the mission to the bindery and go on there yourself.'
          : 'Press day held until the leg is signed. Call baton_start to put a mission on this page, then baton_complete_leg.',
        page: pageNow()
      };
    }
  }, signal);

  register({
    name: 'baton_start',
    description: 'Start a mission here at Rivera Press: the goal, the operator\'s standing instructions, the budget, the deadline and the quantity go into a baton, the route is set (print here, then the bindery, then the courier), and the baton appears on the page so the rest of the baton tools register. Everything written here travels to every site on the route, so nobody has to say it again.',
    inputSchema: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'What the whole job is, in one line.' },
        instructions: {
          type: 'string',
          maxLength: 400,
          description: 'What the operator wants every stop to follow, in their words, for example: fit the budget, keep the deadline, take the cheaper option when one does not fit, hold the first free day, sign each leg after my tap. Written once here and read by every site on the route.'
        },
        budget_usd: { type: 'number', description: 'Total budget for the whole job, in US dollars.' },
        deadline: { type: 'string', description: 'Final deadline as YYYY-MM-DD.' },
        quantity: { type: 'integer', minimum: 1, description: 'How many copies the whole job covers. Taken from the order if order_id is given.' },
        order_id: { type: 'string', description: 'An order at Rivera Press to base the mission on; its quantity is copied into the baton.' }
      },
      required: ['goal', 'budget_usd', 'deadline'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false },
    execute: async (input) => {
      const current = baton.mission;
      if (current && current.legs.length > 0) {
        return {
          ok: false,
          error: 'a mission with signed legs is already aboard (' + current.id + '); finish or drop it first',
          next: 'Call baton_inspect to see where that mission stands, then baton_mint to carry it on.',
          page: pageNow()
        };
      }
      if (!isDate(input.deadline)) {
        return { ok: false, error: 'deadline must look like YYYY-MM-DD', next: 'Call baton_start again with the deadline as YYYY-MM-DD.', page: pageNow() };
      }
      const instructions = String(input.instructions ?? '').trim();
      if (instructions.length > 400) {
        return {
          ok: false,
          error: 'instructions must be 400 characters or fewer (this one is ' + instructions.length + ')',
          next: 'Shorten the instructions to the rules every stop has to follow, then call baton_start again.',
          page: pageNow()
        };
      }

      let order = null;
      if (input.order_id) {
        order = orderById(input.order_id);
        if (!order) {
          return { ok: false, error: 'no such order', open_orders: state.orders.map((o) => o.id), next: 'Open an order with create_order, then call baton_start again.', page: pageNow() };
        }
        state.activeId = order.id;
      }
      const quantity = order ? order.quantity : Math.trunc(Number(input.quantity));
      if (!Number.isFinite(quantity) || quantity < 1) {
        return { ok: false, error: 'pass a quantity, or an order_id to take it from', next: 'Call baton_start again with a quantity or an order_id.', page: pageNow() };
      }
      const mission = newMission({
        goal: input.goal,
        instructions,
        budget_usd: input.budget_usd,
        deadline: input.deadline,
        quantity,
        // The names travel with the route, so the bindery can tell the agent to
        // continue to "Ruta Courier" rather than to a hostname.
        route: ROUTE.map((r) => ({ ...r, name: STOP_NAMES[r.role] || r.name }))
      });
      const set = await baton.setMission(mission, { source: 'baton_start' });
      if (!set.ok) return { ok: false, error: set.reason, next: 'Fix the goal, budget, deadline or quantity and call baton_start again.', page: pageNow() };
      renderAll();
      showLegStatus(order || activeOrder());
      goToStep(4);
      return {
        ok: true,
        mission: {
          id: mission.id,
          goal: mission.goal,
          instructions: mission.instructions || null,
          constraints: mission.constraints,
          route: mission.route
        },
        quantity_from: order ? order.id : 'the call',
        order: order ? orderView(order) : null,
        note: instructions
          ? 'The baton is on the page with the operator\'s instructions aboard; every site on the route reads them.'
          : 'The baton is on the page and the common baton tools are registered.',
        next: (instructions ? 'Mission started with your instructions aboard.' : 'Mission started.') +
          ' Do the print stop now: quote, order, proof, hold the first free press day, sign (one tap), ' +
          'mint; then continue to the bindery on your own.',
        page: pageNow()
      };
    }
  }, signal);
});

/* Only useful once a mission is aboard: hand baton_complete_leg exactly what
   the order says, already checked against the budget and the deadline. */
baton.registerWhenMissionAboard((signal, register) => {
  register({
    name: 'prepare_print_leg',
    description: 'Build the summary, cost and evidence for baton_complete_leg from the order on this page, and check them against the mission budget and deadline first.',
    inputSchema: {
      type: 'object',
      properties: { order_id: { type: 'string', description: 'Order id. The order on the page if left out.' } },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    execute: async (input) => {
      const order = input && input.order_id ? orderById(input.order_id) : activeOrder();
      if (!order) return { ok: false, error: 'no order is open on the page', next: 'Call create_order first.', page: pageNow() };
      goToStep(4);
      const evidence = legEvidence(order);
      const check = baton.checkAction({ cost_usd: order.quote.total_usd, date: order.slot ? order.slot.date : undefined });
      const missing = [];
      if (!order.proof.approved_at) missing.push('the proof is not approved (approve_proof)');
      if (!order.slot) missing.push('no press day is held (reserve_print_slot)');
      return {
        ok: missing.length === 0 && check.allowed,
        blocking: missing,
        check,
        complete_leg_input: {
          summary: legSummary(order),
          cost_usd: order.quote.total_usd,
          evidence
        },
        next: missing.length === 0 && check.allowed
          ? 'Call baton_complete_leg with complete_leg_input — the operator taps Confirm once on the page — then baton_mint to carry the mission to the bindery.'
          : 'Clear the blocking items above, then call prepare_print_leg again.',
        page: pageNow()
      };
    }
  }, signal);
});

/* ------------------------------------------------------------- bootstrap */

/* baton_complete_leg belongs to the library, so the page watches the mission
   panel instead: the moment a leg signed on this origin appears in the route,
   the order step comes forward. */

let legSeen = false;

function checkSignedLeg() {
  const m = baton.mission;
  const signed = !!(m && Array.isArray(m.legs) && m.legs.some((l) => l.origin === location.origin));
  if (signed && !legSeen) { legSeen = true; goToStep(4); }
  if (!signed) legSeen = false;
}

restore();
renderAll();
goToStep(1);
showLegStatus(activeOrder());

new MutationObserver(checkSignedLeg).observe(el('mission-panel'), { childList: true, subtree: true });
checkSignedLeg();
