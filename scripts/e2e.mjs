#!/usr/bin/env node
// End-to-end run of the whole Baton demo in a throwaway Chrome with native WebMCP.
// Start the three servers first:  node scripts/dev.mjs
//
//   node scripts/e2e.mjs
//
// It walks the mission across three origins and asserts the two-call shape of
// every consequential tool:
//
//   call 1 → { status: 'pending' } and a confirm card on the page
//   click Confirm in the page (the page does the work on the click)
//   call 2 → { status: 'confirmed' } with the result
//
// Legs are signed by each site's own /api/sign, which scripts/dev.mjs serves
// from keys/<site>.private.jwk.json — no private key is in any page. Then it
// verifies the chain, tampers with the budget in the URL fragment and shows the
// break. Screenshots land in the harness dir.

import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// BATON_HARNESS_DIR is where puppeteer-core is installed; BATON_SHOT_DIR is
// where the screenshots land. They are the same place unless you say otherwise.
const HARNESS = process.env.BATON_HARNESS_DIR ||
  '/private/tmp/claude-501/-Users-fernandobalino-Documents-AI-First-Life/11dd7d76-1f7d-4544-abca-c1bb803756e2/scratchpad/webmcp/harness';
const SHOTS = process.env.BATON_SHOT_DIR || HARNESS;
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const require = createRequire(join(HARNESS, 'package.json'));
const pptrModule = require('puppeteer-core');
const puppeteer = pptrModule.default ?? pptrModule;

// Matches BATON_PORTS in scripts/dev.mjs, so a second copy of the tree can be
// checked without stopping the first.
const PORTS = (process.env.BATON_PORTS || '4181,4182,4183').split(',').map((n) => n.trim());
const S1 = 'http://localhost:' + PORTS[0] + '/';
const S2 = 'http://localhost:' + PORTS[1] + '/';
const S3 = 'http://localhost:' + PORTS[2] + '/';
const origin = (s) => s.replace(/\/$/, '');

// Registered by lib/baton.js as soon as a mission is aboard, on every site.
const COMMON_WITH_MISSION = ['baton_inspect', 'baton_check', 'baton_verify', 'baton_complete_leg', 'baton_mint', 'baton_decline'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
let shotN = 0;
const errors = [];

const step = (t) => console.log('\n--- ' + t + ' ' + '-'.repeat(Math.max(0, 62 - t.length)));
function check(label, cond, detail) {
  if (cond) console.log('  PASS  ' + label + (detail ? ' — ' + detail : ''));
  else { failures++; console.log('  FAIL  ' + label + (detail ? ' — ' + detail : '')); }
}

async function shot(page, note) {
  shotN++;
  const name = 'baton-' + String(shotN).padStart(2, '0') + '.png';
  await page.screenshot({ path: join(SHOTS, name), fullPage: true });
  console.log('  shot  ' + name + '  (' + note + ')');
}

async function toolNames(page) {
  return page.evaluate(async () => (await document.modelContext.getTools()).map((t) => t.name).sort());
}

async function call(page, name, input = {}) {
  const raw = await page.evaluate(async (n, i) => {
    const tools = await document.modelContext.getTools();
    const t = tools.find((x) => x.name === n);
    if (!t) return JSON.stringify({ __error: 'no such tool: ' + n });
    try { return await document.modelContext.executeTool(t, JSON.stringify(i)); }
    catch (e) { return JSON.stringify({ __error: String(e) }); }
  }, name, input);
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

// The two-call confirmation pattern.
//
// A WebMCP call cannot stay open while a person decides, so a consequential
// tool answers pending straight away and puts a card on the page. The operator
// clicks Confirm, the PAGE does the work on the click, and the agent calls the
// same tool again with the same input to read the result back.
async function callConfirming(page, name, input = {}) {
  const first = await call(page, name, input);
  check('  call 1 answers pending', first.status === 'pending',
    first.status ? first.status + ' — ' + String(first.next || '').slice(0, 70) : JSON.stringify(first).slice(0, 120));
  const next = String(first.next || '');
  check('  it names the tool and the click the operator has to make',
    next.includes('Confirm') && next.includes(name), next.slice(0, 120) || '(no next)');

  const card = await page.$('.confirm');
  check('  a confirm card is on the page', !!card);
  const cardText = card ? (await page.$eval('.confirm__msg', (el) => el.textContent.trim()).catch(() => '')) : '';
  if (cardText) console.log('    card: ' + cardText.slice(0, 90));

  const btn = await page.$('[data-baton-confirm]');
  check('  the card has a Confirm button', !!btn);
  if (btn) await btn.click();

  // The click runs the work in the page; wait for the card to clear.
  await page.waitForFunction(() => !document.querySelector('[data-baton-confirm]'), { timeout: 8000 })
    .catch(() => {});
  const stillUp = await page.$('.confirm__error');
  if (stillUp) {
    const why = await page.$eval('.confirm__error', (el) => el.textContent.trim());
    check('  the page applied the change without an error', false, why);
  }

  const second = await call(page, name, input);
  second.__first_status = first.status;
  second.__clicked_confirm_in_page = !!btn;
  return second;
}

const debugLine = (page) => page.$eval('.baton__debug', (el) => el.textContent.trim()).catch(() => '(none)');
const toolCount = (page) => page.$eval('.tools__count', (el) => el.textContent.trim()).catch(() => '(none)');

/* ------------------------------------------------------------------- run */

mkdirSync(SHOTS, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'baton-e2e-'));
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  userDataDir: profile,
  args: ['--no-first-run', '--disable-gpu', '--enable-features=WebMCP', '--window-size=1280,900'],
  defaultViewport: { width: 1280, height: 900 },
  timeout: 20000
});

try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push('pageerror @' + page.url() + ': ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console @' + page.url() + ': ' + m.text()); });
  const open = async (url) => { await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 }); await sleep(500); };

  /* ---------------------------------------------------------------- leg 1 */
  step('Site 1 — Rivera Press, no mission yet');
  await open(S1);
  const riveraCold = await toolNames(page);
  let names = riveraCold;
  console.log('  tools: ' + names.join(', '));
  check('the press publishes its own tools before any mission exists', riveraCold.length >= 5, riveraCold.length + ' tools');
  check('the tools a mission starts from are all here',
    ['baton_house_terms', 'baton_start', 'list_papers', 'quote_run', 'reserve_print_slot'].every((n) => names.includes(n)));
  check('no common baton tools yet', !COMMON_WITH_MISSION.some((n) => names.includes(n)));
  check('the page count matches the browser', (await toolCount(page)).startsWith(riveraCold.length + ' site tool'), await toolCount(page));
  await shot(page, 'Rivera Press, ' + riveraCold.length + ' tools, no mission');

  step('baton_start — the mission is created here');
  let r = await call(page, 'baton_start', {
    goal: 'Print and bind 40 catalogues for the Norte studio open week, delivered by 14 September',
    budget_usd: 600,
    deadline: '2026-09-14',
    quantity: 40
  });
  console.log('  → ' + JSON.stringify(r).slice(0, 220));
  check('baton_start returned a mission', r.ok === true && !!r.mission?.id, r.mission?.id);
  check('the route carries all three sites', r.mission?.route?.length === 3,
    (r.mission?.route || []).map((x) => x.role).join(' → '));
  await sleep(300);
  names = await toolNames(page);
  console.log('  tools: ' + names.join(', '));
  check('the baton grew the tool list', names.length > riveraCold.length, riveraCold.length + ' → ' + names.length + ' tools');
  check('every tool from the cold page is still there', riveraCold.every((n) => names.includes(n)));
  check('the six common baton tools arrived with the mission', COMMON_WITH_MISSION.every((n) => names.includes(n)));
  check('the press added its own mission-gated tool too', names.includes('prepare_print_leg'));
  check('the page count matches the browser', (await toolCount(page)).startsWith(names.length + ' site tool'), await toolCount(page));
  await shot(page, 'Rivera Press, mission aboard, ' + names.length + ' tools');

  step('quote_run — 40 prints on Photo Rag at 20x30');
  r = await call(page, 'quote_run', { quantity: 40, size: '20x30', paper: 'photo_rag' });
  console.log('  → ' + JSON.stringify(r));
  check('the run costs $380', r.total_usd === 380, '$' + r.total_usd);
  check('$9.50 per print', r.per_print_usd === 9.5);

  step('create_order — the order a press day hangs off');
  r = await call(page, 'create_order', { set: 'cerro_signals', quantity: 40, size: '20x30', paper: 'photo_rag' });
  console.log('  → ' + JSON.stringify(r.order).slice(0, 200));
  check('an order was opened', r.ok === true && !!r.order?.order_id, r.order?.order_id);
  check('the order carries the same $380', r.order?.total_usd === 380, '$' + r.order?.total_usd);
  check('its proof is waiting for approval', r.order?.proof?.approved === false, r.order?.proof?.id);
  const orderId = r.order.order_id;

  step('approve_proof — two calls with a Confirm click between them');
  r = await callConfirming(page, 'approve_proof', { order_id: orderId });
  check('call 2 returned the confirmed result', r.ok === true && r.status !== 'pending', r.status || 'ok');
  check('the proof is approved on the order', r.order?.proof?.approved === true, r.order?.proof?.approved_at);

  step('list_press_days — ask the press which days are still free');
  r = await call(page, 'list_press_days', { only_free: true });
  check('the press has free days to offer', (r.days || []).length > 0, r.free_count + ' free of ' + r.days_shown);
  const pressDate = r.days[0].date;
  console.log('  holding the press on ' + pressDate);

  step('reserve_print_slot — two calls with a Confirm click between them');
  r = await callConfirming(page, 'reserve_print_slot', { order_id: orderId, date: pressDate });
  check('call 2 returned the confirmed result', r.ok === true && r.status !== 'pending', r.status || 'ok');
  check('a press slot came back', !!r.slot?.slot_id, r.slot?.slot_id + ' on ' + r.slot?.date);
  console.log('  ' + await debugLine(page));

  step('prepare_print_leg — the site assembles what baton_complete_leg needs');
  r = await call(page, 'prepare_print_leg', { order_id: orderId });
  check('nothing is blocking the leg', r.ok === true, (r.blocking || []).join('; ') || 'clear');
  check('it costs $380 against the $600 budget', r.complete_leg_input?.cost_usd === 380, '$' + r.complete_leg_input?.cost_usd);
  check('the budget check passes', r.check?.allowed === true);
  const printLegInput = r.complete_leg_input;

  step('baton_complete_leg — sign the print leg');
  r = await callConfirming(page, 'baton_complete_leg', printLegInput);
  console.log('  → ' + JSON.stringify(r).slice(0, 300));
  check('the leg is signed', r.ok === true && r.leg?.index === 0, 'signed by ' + r.leg?.kid);
  check('spent is now $380', r.mission?.spent_usd === 380, '$' + r.mission?.spent_usd);
  check('$220 left of the budget', r.mission?.remaining_usd === 220, '$' + r.mission?.remaining_usd);
  check('call 1 was pending, call 2 read the signed leg back', r.__first_status === 'pending' && r.leg?.sig);
  check('the page signed it through /api/sign, not with a key in the browser', r.signed_in === 'server', r.signed_in);
  console.log('  ' + await debugLine(page));
  await shot(page, 'print leg signed, chain strip green');

  step('baton_mint — the link to carry to the bindery');
  r = await call(page, 'baton_mint');
  check('a next link came back', r.ok === true && r.done === false, r.next_role);
  check('it points at the bindery origin', String(r.next_url).startsWith(S2), String(r.next_url).slice(0, 30) + '…');
  const carryText = await page.$eval('.carry', (el) => el.textContent.trim()).catch(() => '(none)');
  check('the page shows a Carry link', carryText.startsWith('Carry this to'), carryText);
  const linkToBindery = r.next_url;
  await shot(page, 'Carry this to bind at localhost:4182');

  /* ---------------------------------------------------------------- leg 2 */
  step('Site 2 — Norte Bindery, arriving with no baton first');
  await open(S2);
  const norteCold = await toolNames(page);
  console.log('  tools: ' + norteCold.join(', '));
  check('a cold bindery publishes only its always-on tools', norteCold.length === 2, norteCold.join(', '));
  check('no common baton tools on a cold site', !COMMON_WITH_MISSION.some((n) => norteCold.includes(n)));
  await shot(page, 'Norte Bindery, cold, ' + norteCold.length + ' tools');

  step('Following the carry link to Norte Bindery');
  await open(linkToBindery);
  names = await toolNames(page);
  console.log('  tools: ' + names.join(', '));
  check('the baton grew the tool list', names.length > norteCold.length, norteCold.length + ' → ' + names.length + ' tools');
  check('every cold tool is still there', norteCold.every((n) => names.includes(n)));
  check('the six common baton tools arrived with the mission', COMMON_WITH_MISSION.every((n) => names.includes(n)));
  check('bindery tools appeared', ['list_bindings', 'quote_binding_for_mission', 'reserve_press_slot'].every((n) => names.includes(n)));
  check('the page count matches the browser', (await toolCount(page)).startsWith(names.length + ' site tool'), await toolCount(page));
  await shot(page, 'Norte Bindery with the baton, ' + names.length + ' tools');

  step('baton_inspect — the mission survived the hop across origins');
  r = await call(page, 'baton_inspect');
  console.log('  → ' + JSON.stringify(r.mission));
  check('one leg done', r.mission?.legs_done === 1);
  check('$220 still left', r.mission?.remaining_usd === 220, '$' + r.mission?.remaining_usd);
  check('the print leg is signed by rivera-2026-09', r.legs?.[0]?.signed_by === 'rivera-2026-09');

  step('quote_binding_for_mission — the expensive one breaks the budget');
  r = await call(page, 'quote_binding_for_mission', { binding: 'coptic', cover: 'cloth_board' });
  console.log('  → $' + r.cost_usd + ', allowed=' + r.check?.allowed + ', ' + (r.check?.failures?.[0]?.message || ''));
  check('coptic + cloth board costs $260', r.cost_usd === 260, '$' + r.cost_usd);
  check('the budget check refuses it', r.check?.allowed === false);
  check('it says how much over: $40', r.check?.failures?.[0]?.over_by_usd === 40, '$' + r.check?.failures?.[0]?.over_by_usd + ' over ($380 + $260 = $640 against a $600 budget)');

  step('quote_binding_for_mission — the lighter cover fits');
  r = await call(page, 'quote_binding_for_mission', { binding: 'japanese_stab', cover: 'light_card' });
  console.log('  → $' + r.cost_usd + ', allowed=' + r.check?.allowed);
  check('japanese stab + light card costs $190', r.cost_usd === 190, '$' + r.cost_usd);
  check('the budget check allows it', r.check?.allowed === true, '$570 of $600 once signed');

  step('bench_availability — ask the bindery which days are open');
  let benchDay = '2026-09-10';
  if (names.includes('bench_availability')) {
    r = await call(page, 'bench_availability', {});
    check('the diary came back with a free day', !!r.first_free_day, 'free: ' + (r.free_days || []).slice(0, 4).join(', '));
    if (r.first_free_day) benchDay = r.first_free_day;
  }
  console.log('  holding the bench on ' + benchDay);

  step('reserve_press_slot — two calls with a Confirm click between them');
  r = await callConfirming(page, 'reserve_press_slot', { date: benchDay });
  check('call 2 returned the confirmed result', r.ok === true && r.status !== 'pending', r.status || 'ok');
  check('a bench day came back', !!r.evidence?.slot_id, r.evidence?.slot_id);
  const bindEvidence = r.evidence;

  step('baton_complete_leg — sign the binding leg');
  r = await callConfirming(page, 'baton_complete_leg', {
    summary: 'Japanese stab binding with a light card wrap, 40 copies, bench day ' + benchDay,
    cost_usd: 190,
    evidence: bindEvidence
  });
  console.log('  → ' + JSON.stringify(r.mission));
  check('the leg is signed', r.ok === true && r.leg?.index === 1, 'signed by ' + r.leg?.kid);
  check('Norte signed it on its own origin', r.signed_in === 'server', r.signed_in);
  check('spent is now $570', r.mission?.spent_usd === 570, '$' + r.mission?.spent_usd);
  check('$30 left', r.mission?.remaining_usd === 30, '$' + r.mission?.remaining_usd);
  console.log('  ' + await debugLine(page));
  await shot(page, 'binding leg signed, two green segments');

  step('baton_mint — the link to carry to the courier');
  r = await call(page, 'baton_mint');
  check('it points at the courier origin', String(r.next_url).startsWith(S3), r.next_role);
  const linkToCourier = r.next_url;

  /* ---------------------------------------------------------------- leg 3 */
  step('Site 3 — Ruta Courier, arriving with no baton first');
  await open(S3);
  const rutaCold = await toolNames(page);
  console.log('  tools: ' + rutaCold.join(', '));
  check('a cold courier publishes only its always-on tools', rutaCold.length === 2, rutaCold.join(', '));
  check('no common baton tools on a cold site', !COMMON_WITH_MISSION.some((n) => rutaCold.includes(n)));
  await shot(page, 'Ruta Courier, cold, ' + rutaCold.length + ' tools');

  step('Following the carry link to Ruta Courier');
  await open(linkToCourier);
  names = await toolNames(page);
  console.log('  tools: ' + names.join(', '));
  check('the baton grew the tool list', names.length > rutaCold.length, rutaCold.length + ' → ' + names.length + ' tools');
  check('every cold tool is still there', rutaCold.every((n) => names.includes(n)));
  check('the six common baton tools arrived with the mission', COMMON_WITH_MISSION.every((n) => names.includes(n)));
  check('courier tools appeared', ['quote_delivery_for_mission', 'book_collection'].every((n) => names.includes(n)));
  await shot(page, 'Ruta Courier with the baton, ' + names.length + ' tools');

  step('quote_delivery_for_mission — standard, at the courier\'s own next pickup');
  r = await call(page, 'quote_delivery_for_mission', { speed: 'standard' });
  console.log('  → ' + JSON.stringify(r).slice(0, 260));
  check('standard costs $24', r.cost_usd === 24, '$' + r.cost_usd);
  check('it arrives on or before the 14 September deadline', r.delivery_date <= '2026-09-14',
    'collected ' + r.pickup_date + ', delivered ' + r.delivery_date);
  check('both constraints pass', r.check?.allowed === true);
  const pickupDate = r.pickup_date;

  step('book_collection — two calls with a Confirm click between them');
  r = await callConfirming(page, 'book_collection', { pickup_date: pickupDate });
  check('call 2 returned the confirmed result', r.ok === true && r.status !== 'pending', r.status || 'ok');
  check('a tracking id came back', /^RUTA-/.test(r.evidence?.tracking_id || ''), r.evidence?.tracking_id);
  const deliverEvidence = r.evidence;

  step('baton_complete_leg — sign the delivery leg');
  r = await callConfirming(page, 'baton_complete_leg', {
    summary: 'Standard collection ' + pickupDate + ', 40 bound copies',
    cost_usd: 24,
    evidence: deliverEvidence
  });
  console.log('  → ' + JSON.stringify(r.mission));
  check('the last leg is signed', r.ok === true && r.leg?.index === 2, 'signed by ' + r.leg?.kid);
  check('Ruta signed it on its own origin', r.signed_in === 'server', r.signed_in);
  check('spent is $594 of $600', r.mission?.spent_usd === 594, '$' + r.mission?.spent_usd);

  step('baton_verify — every signature checked against its own origin');
  r = await call(page, 'baton_verify');
  console.log('  → ' + JSON.stringify(r.legs));
  check('the chain verifies', r.chain_ok === true);
  check('three legs, all ok', r.legs?.length === 3 && r.legs.every((l) => l.ok));
  check('each leg was checked against its own host',
    r.legs?.[0]?.origin === origin(S1) && r.legs?.[1]?.origin === origin(S2) && r.legs?.[2]?.origin === origin(S3),
    (r.legs || []).map((l) => l.origin).join(', '));
  check('the spent total matches the legs', r.spent_matches_legs === true, '$' + r.legs_sum_usd);
  await shot(page, 'all three legs verified, chain strip fully green');

  step('baton_mint at the end of the route');
  r = await call(page, 'baton_mint');
  check('there is nowhere left to carry it', r.done === true);

  /* --------------------------------------------------------- tamper link */
  step('Tamper link — the page offers a one-click copy with the budget raised');
  const tamperHref = await page.$eval('a.tamper__link', (a) => a.getAttribute('href')).catch(() => null);
  check('the panel shows the tamper link once the chain is green', typeof tamperHref === 'string' && tamperHref.includes('#baton='));
  await page.click('a.tamper__link');
  await sleep(1200);
  r = await call(page, 'baton_verify');
  check('one click breaks every signature', r.chain_ok === false && r.legs?.every((l) => !l.ok) === true);
  const restoreText = await page.$eval('a.tamper__link', (a) => a.textContent.trim()).catch(() => '(none)');
  check('a restore link appears', /restore/i.test(restoreText), restoreText);
  await shot(page, 'tamper link clicked, chain red, restore offered');
  await page.click('a.tamper__link');
  await sleep(1200);
  r = await call(page, 'baton_verify');
  check('restore brings the signed copy back', r.chain_ok === true, JSON.stringify(r.legs?.map((l) => l.ok)));

  /* --------------------------------------------------------------- tamper */
  step('Tamper — raise the budget inside the URL fragment');
  const stored = await page.evaluate(() => sessionStorage.getItem('baton.mission'));
  const tampered = JSON.parse(stored);
  const realBudget = tampered.constraints.budget_usd;
  tampered.constraints.budget_usd = 900;
  const fragment = Buffer.from(JSON.stringify(tampered), 'utf8').toString('base64url');
  console.log('  budget rewritten in the link: $' + realBudget + ' → $900 (nothing else touched)');
  await page.goto('about:blank');
  await open(S3 + '#baton=' + fragment);
  r = await call(page, 'baton_inspect');
  check('the page took the edited budget at face value', r.mission?.budget_usd === 900, '$' + r.mission?.budget_usd);
  r = await call(page, 'baton_verify');
  console.log('  → ' + JSON.stringify(r.legs));
  check('the chain no longer verifies', r.chain_ok === false);
  check('leg 1 is reported broken', r.legs?.[0]?.ok === false, r.legs?.[0]?.reason);
  check('every leg is broken, because the header is signed into all of them', r.legs?.every((l) => !l.ok) === true);
  const caption = await page.$eval('.strip__caption', (el) => el.textContent.trim()).catch(() => '(none)');
  check('the page says the chain is broken', /broken/i.test(caption), caption);
  await shot(page, 'tampered budget, chain strip red');

  /* --------------------------------------------------------------- errors */
  step('Page errors');
  if (errors.length === 0) console.log('  PASS  no page errors anywhere in the run');
  else { failures += errors.length; errors.forEach((e) => console.log('  FAIL  ' + e)); }

} finally {
  await browser.close();
  rmSync(profile, { recursive: true, force: true });
}

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
process.exit(failures === 0 ? 0 : 1);
