#!/usr/bin/env node
// End-to-end run of the whole Baton demo in a throwaway Chrome with native WebMCP.
// Start the three servers first:  node scripts/dev.mjs
//
//   node scripts/e2e.mjs
//
// It walks the mission across three origins, clicks Confirm in the page where a
// tool asks for it, verifies the signature chain, then tampers with the budget in
// the URL fragment and shows the chain break. Screenshots land in the harness dir.

import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HARNESS = process.env.BATON_SHOT_DIR ||
  '/private/tmp/claude-501/-Users-fernandobalino-Documents-AI-First-Life/11dd7d76-1f7d-4544-abca-c1bb803756e2/scratchpad/webmcp/harness';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const require = createRequire(join(HARNESS, 'package.json'));
const pptrModule = require('puppeteer-core');
const puppeteer = pptrModule.default ?? pptrModule;

const S1 = 'http://localhost:4181/';
const S2 = 'http://localhost:4182/';
const S3 = 'http://localhost:4183/';

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
  await page.screenshot({ path: join(HARNESS, name), fullPage: true });
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

// Start the tool, click Confirm in the page while it waits, then collect the result.
async function callConfirming(page, name, input = {}) {
  await page.evaluate((n, i) => {
    window.__batonDone = false;
    window.__batonCall = (async () => {
      const tools = await document.modelContext.getTools();
      const t = tools.find((x) => x.name === n);
      if (!t) return JSON.stringify({ __error: 'no such tool: ' + n });
      try { return await document.modelContext.executeTool(t, JSON.stringify(i)); }
      catch (e) { return JSON.stringify({ __error: String(e) }); }
    })().then((r) => { window.__batonDone = true; return r; });
  }, name, input);

  const until = Date.now() + 8000;
  let clicked = false;
  while (Date.now() < until) {
    const btn = await page.$('[data-baton-confirm]');
    if (btn) { await btn.click(); clicked = true; break; }
    if (await page.evaluate(() => window.__batonDone === true)) break;
    await sleep(80);
  }
  const raw = await page.evaluate(() => window.__batonCall);
  const out = typeof raw === 'string' ? JSON.parse(raw) : raw;
  out.__clicked_confirm_in_page = clicked;
  return out;
}

const debugLine = (page) => page.$eval('.baton__debug', (el) => el.textContent.trim()).catch(() => '(none)');
const toolCount = (page) => page.$eval('.tools__count', (el) => el.textContent.trim()).catch(() => '(none)');

/* ------------------------------------------------------------------- run */

mkdirSync(HARNESS, { recursive: true });
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
  let names = await toolNames(page);
  console.log('  tools: ' + names.join(', '));
  check('5 tools before a mission exists', names.length === 5, names.length + ' tools');
  check('the four Rivera tools plus house terms',
    ['baton_house_terms', 'baton_start', 'list_papers', 'quote_run', 'reserve_print_slot'].every((n) => names.includes(n)));
  check('no common baton tools yet', !names.includes('baton_inspect') && !names.includes('baton_complete_leg'));
  check('the page says so too', (await toolCount(page)).startsWith('5 site tools'), await toolCount(page));
  await shot(page, 'Rivera Press, 5 tools, no mission');

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
  check('common baton tools appeared', names.length === 11, names.length + ' tools');
  check('every common tool is registered',
    ['baton_inspect', 'baton_check', 'baton_house_terms', 'baton_verify', 'baton_complete_leg', 'baton_mint', 'baton_decline'].every((n) => names.includes(n)));
  await shot(page, 'Rivera Press, mission aboard, 11 tools');

  step('quote_run — 40 prints on Photo Rag at 20x30');
  r = await call(page, 'quote_run', { quantity: 40, size: '20x30', paper: 'photo_rag' });
  console.log('  → ' + JSON.stringify(r));
  check('the run costs $380', r.total_usd === 380, '$' + r.total_usd);
  check('$9.50 per print', r.per_print_usd === 9.5);

  step('reserve_print_slot — confirmation clicked in the page');
  r = await callConfirming(page, 'reserve_print_slot', { date: '2026-09-08' });
  console.log('  → ' + JSON.stringify(r).slice(0, 240));
  check('Confirm was clicked on the page', r.__clicked_confirm_in_page === true);
  check('a press slot came back', r.ok === true && !!r.evidence?.slot_id, r.evidence?.slot_id);
  console.log('  ' + await debugLine(page));
  const printEvidence = r.evidence;

  step('baton_complete_leg — sign the print leg');
  r = await callConfirming(page, 'baton_complete_leg', {
    summary: '40 prints, 20x30 cm, Hahnemuhle Photo Rag 308, press day 8 September',
    cost_usd: 380,
    evidence: printEvidence
  });
  console.log('  → ' + JSON.stringify(r).slice(0, 300));
  check('the leg is signed', r.ok === true && r.leg?.index === 0, 'signed by ' + r.leg?.kid);
  check('spent is now $380', r.mission?.spent_usd === 380, '$' + r.mission?.spent_usd);
  check('$220 left of the budget', r.mission?.remaining_usd === 220, '$' + r.mission?.remaining_usd);
  check('the confirmation used the page card', r.confirm_path === 'confirm-card', r.confirm_path);
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
  names = await toolNames(page);
  console.log('  tools: ' + names.join(', '));
  check('only 2 tools without a mission', names.length === 2, names.join(', '));
  await shot(page, 'Norte Bindery, cold, 2 tools');

  step('Following the carry link to Norte Bindery');
  await open(linkToBindery);
  names = await toolNames(page);
  console.log('  tools: ' + names.join(', '));
  check('the tool list grew from 2 to 11', names.length === 11, names.length + ' tools');
  check('bindery tools appeared', ['list_bindings', 'quote_binding_for_mission', 'reserve_press_slot'].every((n) => names.includes(n)));
  check('the page count matches', (await toolCount(page)).startsWith('11 site tools'), await toolCount(page));
  await shot(page, 'Norte Bindery with the baton, 11 tools');

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

  step('reserve_press_slot — confirmation clicked in the page');
  r = await callConfirming(page, 'reserve_press_slot', { date: '2026-09-10' });
  check('Confirm was clicked on the page', r.__clicked_confirm_in_page === true);
  check('a bench day came back', r.ok === true && !!r.evidence?.slot_id, r.evidence?.slot_id);
  const bindEvidence = r.evidence;

  step('baton_complete_leg — sign the binding leg');
  r = await callConfirming(page, 'baton_complete_leg', {
    summary: 'Japanese stab binding with a light card wrap, 40 copies, bench day 10 September',
    cost_usd: 190,
    evidence: bindEvidence
  });
  console.log('  → ' + JSON.stringify(r.mission));
  check('the leg is signed', r.ok === true && r.leg?.index === 1, 'signed by ' + r.leg?.kid);
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
  names = await toolNames(page);
  console.log('  tools: ' + names.join(', '));
  check('only 2 tools without a mission', names.length === 2, names.join(', '));
  await shot(page, 'Ruta Courier, cold, 2 tools');

  step('Following the carry link to Ruta Courier');
  await open(linkToCourier);
  names = await toolNames(page);
  console.log('  tools: ' + names.join(', '));
  check('the tool list grew from 2 to 10', names.length === 10, names.length + ' tools');
  check('courier tools appeared', ['quote_delivery_for_mission', 'book_collection'].every((n) => names.includes(n)));
  await shot(page, 'Ruta Courier with the baton, 10 tools');

  step('quote_delivery_for_mission — standard, collected 12 September');
  r = await call(page, 'quote_delivery_for_mission', { speed: 'standard', pickup_date: '2026-09-12' });
  console.log('  → ' + JSON.stringify(r).slice(0, 260));
  check('standard costs $24', r.cost_usd === 24, '$' + r.cost_usd);
  check('it lands on the deadline, 14 September', r.delivery_date === '2026-09-14', r.delivery_date);
  check('both constraints pass', r.check?.allowed === true);

  step('book_collection — confirmation clicked in the page');
  r = await callConfirming(page, 'book_collection', { pickup_date: '2026-09-12' });
  check('Confirm was clicked on the page', r.__clicked_confirm_in_page === true);
  check('a tracking id came back', r.ok === true && /^RUTA-/.test(r.evidence?.tracking_id || ''), r.evidence?.tracking_id);
  const deliverEvidence = r.evidence;

  step('baton_complete_leg — sign the delivery leg');
  r = await callConfirming(page, 'baton_complete_leg', {
    summary: 'Standard collection 12 September, delivered 14 September, 40 bound copies',
    cost_usd: 24,
    evidence: deliverEvidence
  });
  console.log('  → ' + JSON.stringify(r.mission));
  check('the last leg is signed', r.ok === true && r.leg?.index === 2, 'signed by ' + r.leg?.kid);
  check('spent is $594 of $600', r.mission?.spent_usd === 594, '$' + r.mission?.spent_usd);

  step('baton_verify — every signature checked against its own origin');
  r = await call(page, 'baton_verify');
  console.log('  → ' + JSON.stringify(r.legs));
  check('the chain verifies', r.chain_ok === true);
  check('three legs, all ok', r.legs?.length === 3 && r.legs.every((l) => l.ok));
  check('each leg was checked against its own host',
    r.legs?.[0]?.origin === 'http://localhost:4181' && r.legs?.[1]?.origin === 'http://localhost:4182' && r.legs?.[2]?.origin === 'http://localhost:4183');
  check('the spent total matches the legs', r.spent_matches_legs === true, '$' + r.legs_sum_usd);
  await shot(page, 'all three legs verified, chain strip fully green');

  step('baton_mint at the end of the route');
  r = await call(page, 'baton_mint');
  check('there is nowhere left to carry it', r.done === true);

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
