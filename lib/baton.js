// Baton v0 — a mission that travels with a person across independent websites.
//
// This module is dependency-free and runs in the browser. It owns:
//   - the mission model and its constraint rules
//   - the URL-fragment transport (#baton=<base64url JSON>)
//   - leg signing / chain verification with Web Crypto ECDSA P-256
//   - mountBaton(siteConfig): panel rendering + the common WebMCP tools
//
// Signing. With no `privateJwk` in the site config the page asks its own origin:
//   POST /api/sign  {"payload": "<canonical string>", "kid": "<key id>"}
//   → 200           {"sig": "<base64url r||s>", "kid": "<key id>"}
// so the private key stays in the serverless function. Passing `privateJwk`
// signs in the browser instead, which is for development and tests only.
//
// WebMCP notes, verified in Chrome 152 (--enable-features=WebMCP) and in the
// ChatGPT desktop browser on 2026-09-02:
//   - document.modelContext.registerTool(def, { signal }) ; abort() unregisters
//   - "toolchange" fires in the ChatGPT browser but not everywhere, so this
//     module keeps its own registry and refreshes the tools box itself
//   - execute(input, client) gets client === undefined in Chrome; in the
//     ChatGPT browser client.requestUserInteraction exists but throws when
//     called, so it is tried inside try/catch and never assumed
//   - a tool call cannot stay open waiting for a page click, so a confirmation
//     answers { status: 'pending' } at once and the page applies the change on
//     the click — see confirmAndApply
//   - executeTool() returns the JSON string of whatever execute() returned,
//     so every tool here returns a compact plain object

export const BATON_VERSION = 1;
export const ROLES = ['print', 'bind', 'deliver'];

const TE = new TextEncoder();
const TD = new TextDecoder();

/* ------------------------------------------------------------------ bytes */

export function bytesToB64u(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64uToBytes(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/* ----------------------------------------------------------- canonicalize */

// Stable JSON: object keys sorted, undefined dropped. Signatures are taken
// over this text, so two agents always hash the same bytes.
export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}';
}

/* --------------------------------------------------------------- transport */

export function encodeMission(mission) {
  return bytesToB64u(TE.encode(JSON.stringify(mission)));
}

export function decodeMission(encoded) {
  return JSON.parse(TD.decode(b64uToBytes(encoded)));
}

export function missionLink(nextUrl, mission) {
  const base = String(nextUrl).split('#')[0];
  return base + '#baton=' + encodeMission(mission);
}

export function readMissionFromHash(hash) {
  const h = String(hash ?? (typeof location !== 'undefined' ? location.hash : '') ?? '');
  const m = h.match(/[#&]baton=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try { return decodeMission(m[1]); } catch { return null; }
}

/* ------------------------------------------------------------------- model */

export function newMission({ goal, budget_usd, deadline, quantity, route }) {
  return {
    v: BATON_VERSION,
    id: 'bt_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4),
    created_at: new Date().toISOString(),
    goal: String(goal),
    constraints: {
      budget_usd: round2(budget_usd),
      deadline: String(deadline),
      quantity: Math.trunc(quantity)
    },
    route: route.map((r) => ({ role: r.role, url: String(r.url).split('#')[0] })),
    spent_usd: 0,
    legs: [],
    declined: []
  };
}

export function missionHeader(mission) {
  return {
    id: mission.id,
    goal: mission.goal,
    constraints: mission.constraints,
    route: mission.route
  };
}

export function stripSig(leg) {
  const { sig, ...rest } = leg;
  return rest;
}

export function validateMission(mission) {
  if (!mission || typeof mission !== 'object') return { ok: false, reason: 'not an object' };
  if (mission.v !== BATON_VERSION) return { ok: false, reason: 'unsupported baton version ' + mission.v };
  if (!mission.id || !mission.goal) return { ok: false, reason: 'missing id or goal' };
  const c = mission.constraints;
  if (!c || typeof c.budget_usd !== 'number' || !/^\d{4}-\d{2}-\d{2}$/.test(String(c.deadline || ''))) {
    return { ok: false, reason: 'malformed constraints' };
  }
  if (!Array.isArray(mission.route) || mission.route.length === 0) return { ok: false, reason: 'empty route' };
  if (!Array.isArray(mission.legs)) return { ok: false, reason: 'missing legs' };
  return { ok: true, reason: 'ok' };
}

export function legIndexFor(mission, role) {
  return mission.route.findIndex((r) => r.role === role);
}

export function nextStop(mission) {
  const done = mission.legs.length;
  return done < mission.route.length ? mission.route[done] : null;
}

/* ------------------------------------------------------------------ crypto */

const subtle = () => globalThis.crypto.subtle;
const ALG = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN_ALG = { name: 'ECDSA', hash: { name: 'SHA-256' } };

export function signingPayload(mission, legWithoutSig, prevSig) {
  return canonicalize({
    mission_header: missionHeader(mission),
    leg_without_sig: legWithoutSig,
    prev_sig: prevSig ?? null
  });
}

// Sign the canonical payload text in the page. Development and tests only: a
// private key that reaches the browser is a private key anybody can read.
export async function signPayloadInPage(payload, privateJwk) {
  const key = await subtle().importKey('jwk', privateJwk, ALG, false, ['sign']);
  const sig = await subtle().sign(SIGN_ALG, key, TE.encode(payload));
  return bytesToB64u(new Uint8Array(sig));
}

// Ask this origin's own signing function for a signature over the same text.
// Request:  POST /api/sign  {"payload": "<canonical string>", "kid": "<key id>"}
// Response: 200            {"sig": "<base64url r||s>", "kid": "<key id>"}
export async function signPayloadOnServer(payload, kid, endpoint = '/api/sign') {
  const url = new URL(endpoint, location.origin).toString();
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ payload, kid })
    });
  } catch (err) {
    throw new Error('could not reach the signing function at ' + url + ': ' + ((err && err.message) || err));
  }
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) {
    throw new Error('the signing function at ' + url + ' answered ' + res.status +
      (body?.error ? ': ' + body.error : text ? ': ' + text.slice(0, 160) : ''));
  }
  if (!body || typeof body.sig !== 'string' || !body.sig) {
    throw new Error('the signing function at ' + url + ' returned no signature');
  }
  if (kid && body.kid && body.kid !== kid) {
    throw new Error('the signing function signed as ' + body.kid + ', but this site publishes ' + kid);
  }
  return body.sig;
}

export async function signLeg(mission, legWithoutSig, prevSig, privateJwk) {
  return signPayloadInPage(signingPayload(mission, legWithoutSig, prevSig), privateJwk);
}

// The one path the site uses. With a privateJwk in the config it signs in the
// page (dev/test); without one it asks /api/sign on its own origin, so the
// private key never ships to the browser. Both sign the identical bytes.
export async function signLegWith(mission, legWithoutSig, prevSig, cfg = {}) {
  const payload = signingPayload(mission, legWithoutSig, prevSig);
  if (cfg.privateJwk) {
    return { sig: await signPayloadInPage(payload, cfg.privateJwk), signed_in: 'page' };
  }
  return { sig: await signPayloadOnServer(payload, cfg.kid, cfg.signEndpoint || '/api/sign'), signed_in: 'server' };
}

export async function verifyLegSignature(mission, leg, prevSig, publicJwk) {
  const key = await subtle().importKey('jwk', publicJwk, ALG, false, ['verify']);
  const bytes = TE.encode(signingPayload(mission, stripSig(leg), prevSig));
  return subtle().verify(SIGN_ALG, key, b64uToBytes(leg.sig || ''), bytes);
}

/* ------------------------------------------------------- chain verification */

const KEY_CACHE = new Map(); // origin -> published key document

export async function fetchOriginKey(origin) {
  if (KEY_CACHE.has(origin)) return KEY_CACHE.get(origin);
  const res = await fetch(origin.replace(/\/$/, '') + '/.well-known/baton/key.json', {
    mode: 'cors',
    cache: 'no-store'
  });
  if (!res.ok) throw new Error('key fetch failed (' + res.status + ')');
  const doc = await res.json();
  KEY_CACHE.set(origin, doc);
  return doc;
}

export async function verifyChain(mission) {
  const legs = Array.isArray(mission?.legs) ? mission.legs : [];
  const results = [];
  let prevSig = null;
  let sum = 0;
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    let ok = false;
    let reason = 'ok';
    try {
      if (leg.index !== i) throw new Error('leg is out of order (says ' + leg.index + ', sits at ' + i + ')');
      const doc = await fetchOriginKey(leg.origin);
      const jwk = doc.jwk || doc;
      if (doc.kid && leg.kid && doc.kid !== leg.kid) {
        throw new Error('key id mismatch: leg says ' + leg.kid + ', ' + leg.origin + ' publishes ' + doc.kid);
      }
      ok = await verifyLegSignature(mission, leg, prevSig, jwk);
      if (!ok) reason = 'signature does not match — the mission or this leg was edited after signing';
    } catch (err) {
      ok = false;
      reason = err.message || String(err);
    }
    results.push({ index: i, origin: leg.origin, role: leg.role, signed_by: leg.kid, ok, reason: ok ? 'ok' : reason });
    prevSig = leg.sig ?? null;
    sum = round2(sum + (Number(leg.cost_usd) || 0));
  }
  const spentMatches = round2(mission?.spent_usd || 0) === sum;
  return {
    ok: results.every((r) => r.ok) && spentMatches,
    legs: results,
    spent_usd: round2(mission?.spent_usd || 0),
    legs_sum_usd: sum,
    spent_matches_legs: spentMatches
  };
}

/* -------------------------------------------------------------- constraints */

export function dayDiff(fromISO, toISO) {
  const a = Date.parse(fromISO + 'T12:00:00Z');
  const b = Date.parse(toISO + 'T12:00:00Z');
  return Math.round((b - a) / 86400000);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(dateISO, n) {
  const t = Date.parse(dateISO + 'T12:00:00Z') + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

export function checkAction(mission, { cost_usd, date } = {}) {
  const budget = mission.constraints.budget_usd;
  const spent = round2(mission.spent_usd || 0);
  const remaining = round2(budget - spent);
  const failures = [];
  if (typeof cost_usd === 'number' && Number.isFinite(cost_usd)) {
    if (round2(cost_usd) > remaining + 1e-9) {
      failures.push({
        constraint: 'budget_usd',
        over_by_usd: round2(cost_usd - remaining),
        message: '$' + round2(cost_usd) + ' is $' + round2(cost_usd - remaining) + ' more than the $' + remaining + ' left of the $' + budget + ' budget'
      });
    }
  }
  if (date) {
    const late = dayDiff(mission.constraints.deadline, date);
    if (late > 0) {
      failures.push({
        constraint: 'deadline',
        late_by_days: late,
        message: date + ' is ' + late + ' day(s) after the ' + mission.constraints.deadline + ' deadline'
      });
    }
  }
  return {
    allowed: failures.length === 0,
    budget_usd: budget,
    spent_usd: spent,
    remaining_usd: remaining,
    deadline: mission.constraints.deadline,
    days_to_deadline: dayDiff(todayISO(), mission.constraints.deadline),
    checked: { cost_usd: cost_usd ?? null, date: date ?? null },
    failures
  };
}

export function missionSummary(mission) {
  const stop = nextStop(mission);
  return {
    id: mission.id,
    goal: mission.goal,
    quantity: mission.constraints.quantity,
    budget_usd: mission.constraints.budget_usd,
    spent_usd: round2(mission.spent_usd || 0),
    remaining_usd: round2(mission.constraints.budget_usd - (mission.spent_usd || 0)),
    deadline: mission.constraints.deadline,
    days_to_deadline: dayDiff(todayISO(), mission.constraints.deadline),
    legs_done: mission.legs.length,
    legs_total: mission.route.length,
    next_stop: stop ? { role: stop.role, url: stop.url } : null
  };
}

/* --------------------------------------------------------------- rendering */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const host = (u) => { try { return new URL(u).host; } catch { return String(u); } };
const money = (n) => '$' + round2(n).toFixed(2);

/* ------------------------------------------------------------- mountBaton */

export function mountBaton(siteConfig) {
  const cfg = siteConfig;
  const panel = cfg.panel;
  const toolsBox = cfg.toolsBox;
  const storageKey = 'baton.mission';

  let mission = null;
  let commonAbort = null;
  let carryLink = null;
  const siteRegistrars = []; // callbacks that register mission-gated site tools
  const siteRegistered = new Set();
  const alwaysAborts = []; // kept so their signals stay alive for the page's life
  let siteAbort = null;

  /* ---- panel skeleton (built once; the confirm card must survive renders) */
  panel.innerHTML = [
    '<div class="baton" data-state="empty">',
    '  <div class="baton__body"></div>',
    '  <div class="baton__carry" hidden></div>',
    '  <div class="baton__confirm" hidden></div>',
    '  <div class="baton__debug">debug: waiting</div>',
    '</div>'
  ].join('\n');
  const root = panel.querySelector('.baton');
  const bodyEl = panel.querySelector('.baton__body');
  const carryEl = panel.querySelector('.baton__carry');
  const confirmEl = panel.querySelector('.baton__confirm');
  const debugEl = panel.querySelector('.baton__debug');

  function debug(text) {
    debugEl.textContent = 'debug: ' + text;
  }

  /* ------------------------------------------------------------- storage */

  function save() {
    try {
      if (mission) sessionStorage.setItem(storageKey, JSON.stringify(mission));
      else sessionStorage.removeItem(storageKey);
    } catch { /* private mode: memory only */ }
  }

  function load() {
    try {
      const raw = sessionStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  /* --------------------------------------------------------- verification */

  let chain = null;
  async function verifyAndRender() {
    if (!mission) { chain = null; render(); return null; }
    try {
      chain = await verifyChain(mission);
    } catch (err) {
      chain = { ok: false, legs: [], error: String(err) };
    }
    render();
    return chain;
  }

  /* -------------------------------------------------------------- render */

  function render() {
    root.dataset.state = mission ? 'aboard' : 'empty';
    if (!mission) {
      bodyEl.innerHTML =
        '<h2 class="baton__title">No mission aboard</h2>' +
        '<p class="baton__hint">' + esc(cfg.emptyHint || 'This site is waiting for a baton. A mission arrives in the link.') + '</p>';
      carryEl.hidden = true;
      return;
    }
    const s = missionSummary(mission);
    const rows = mission.route.map((stop, i) => {
      const leg = mission.legs[i];
      const v = chain?.legs?.[i];
      const mark = !leg ? '·' : v ? (v.ok ? '✓' : '✗') : '…';
      const cls = !leg ? 'leg leg--todo' : v ? (v.ok ? 'leg leg--ok' : 'leg leg--bad') : 'leg leg--pending';
      const hereNow = i === mission.legs.length && stop.role === cfg.role;
      return [
        '<li class="' + cls + (hereNow ? ' leg--here' : '') + '">',
        '  <span class="leg__mark" aria-hidden="true">' + mark + '</span>',
        '  <div class="leg__main">',
        '    <div class="leg__head"><b class="leg__role">' + esc(stop.role) + '</b> <span class="leg__host">' + esc(host(stop.url)) + '</span>' +
             (leg ? '<span class="leg__cost">' + money(leg.cost_usd) + '</span>'
                  : '<span class="leg__cost leg__cost--todo">' + (hereNow ? 'this site' : 'waiting') + '</span>') + '</div>',
        leg ? '    <div class="leg__summary">' + esc(leg.summary) + '</div>' : '',
        leg ? '    <div class="leg__meta">signed by ' + esc(leg.kid) + ' · ' + esc(String(leg.completed_at).slice(0, 16).replace('T', ' ')) +
              (v ? ' · ' + esc(v.ok ? 'signature verified' : v.reason) : ' · checking…') + '</div>' : '',
        '  </div>',
        '</li>'
      ].join('');
    }).join('');

    const strip = mission.route.map((stop, i) => {
      const leg = mission.legs[i];
      const v = chain?.legs?.[i];
      const state = !leg ? 'todo' : v ? (v.ok ? 'ok' : 'bad') : 'pending';
      return '<span class="strip__seg strip__seg--' + state + '" title="' + esc(stop.role + ' · ' + host(stop.url)) + '"></span>';
    }).join('');

    const declined = (mission.declined || []).map((d) =>
      '<li class="declined">' + esc(host(d.origin)) + ' declined the <b>' + esc(d.role) + '</b> leg: ' + esc(d.reason) + '</li>'
    ).join('');

    bodyEl.innerHTML = [
      '<h2 class="baton__title">' + esc(mission.goal) + '</h2>',
      '<div class="baton__id">Baton ' + esc(mission.id) + ' · ' + s.legs_done + ' of ' + s.legs_total + ' legs signed</div>',
      '<dl class="baton__facts">',
      '  <div><dt>Quantity</dt><dd>' + esc(s.quantity) + '</dd></div>',
      '  <div><dt>Budget</dt><dd>' + money(s.budget_usd) + '</dd></div>',
      '  <div><dt>Spent</dt><dd>' + money(s.spent_usd) + '</dd></div>',
      '  <div><dt>Remaining</dt><dd class="' + (s.remaining_usd < 0 ? 'over' : 'good') + '">' + money(s.remaining_usd) + '</dd></div>',
      '  <div><dt>Deadline</dt><dd>' + esc(s.deadline) + ' <span class="muted">(' + s.days_to_deadline + ' days)</span></dd></div>',
      '</dl>',
      '<div class="strip" aria-label="signature chain">' + strip + '</div>',
      '<div class="strip__caption">' + (chain
        ? (mission.legs.length === 0 ? 'No legs signed yet.'
          : chain.ok ? 'Every signed leg checks out against the site that signed it.'
          : 'Chain broken — ' + esc(chain.legs.find((l) => !l.ok)?.reason || 'spent total does not match the legs') + '.')
        : 'Checking signatures…') + '</div>',
      '<ol class="legs">' + rows + '</ol>',
      declined ? '<ul class="declines">' + declined + '</ul>' : ''
    ].join('\n');

    if (carryLink) {
      carryEl.hidden = false;
      carryEl.innerHTML =
        '<a class="carry" href="' + esc(carryLink.url) + '">Carry this to ' + esc(carryLink.label) + ' →</a>' +
        '<div class="carry__note">Opens ' + esc(host(carryLink.url)) + ' with the mission in the link.</div>';
    } else {
      carryEl.hidden = true;
    }
  }

  /* --------------------------------------------------- confirm-and-apply */

  // A WebMCP tool call cannot stay open while a person decides. So the page,
  // not the agent, owns the consequential half of the work:
  //
  //   call 1  → the card goes up, the tool answers { status: 'pending' }
  //   click   → the PAGE runs apply(), stores what it returned, re-renders
  //   call 2  → the same input finds the stored result: { status: 'confirmed' }
  //
  // The key is the tool name plus the canonical input, so a repeat call with
  // the same input reads the result back and a call with different input is a
  // new proposal.

  const applied = new Map();   // key -> whatever apply() returned on the click
  const cancelled = new Set(); // keys the operator turned down
  let pendingConfirm = null;   // { key, toolName, supersede }

  const confirmKey = (toolName, input) => toolName + ':' + canonicalize(input ?? {});

  const pendingText = (toolName) =>
    'Ask the operator to click Confirm on the page, then call ' + toolName +
    ' again with the same input (or baton_inspect) to see the result.';

  const cancelledText = (toolName) =>
    'The operator clicked Cancel on the page. Ask what to change, then call ' + toolName +
    ' again with the corrected input.';

  function hideConfirmCard() {
    confirmEl.hidden = true;
    confirmEl.innerHTML = '';
  }

  function paintConfirmCard(message, { busy = false, error = null } = {}) {
    confirmEl.hidden = false;
    confirmEl.innerHTML = [
      '<div class="confirm">',
      '  <p class="confirm__msg">' + esc(message) + '</p>',
      error ? '  <p class="confirm__error">' + esc(error) + '</p>' : '',
      '  <div class="confirm__actions">',
      '    <button type="button" class="btn btn--primary" data-baton-confirm' + (busy ? ' disabled' : '') + '>' +
           (busy ? 'Working…' : 'Confirm') + '</button>',
      '    <button type="button" class="btn" data-baton-cancel' + (busy ? ' disabled' : '') + '>Cancel</button>',
      '  </div>',
      '</div>'
    ].filter(Boolean).join('\n');
  }

  // Puts the card up and resolves when the person answers. Confirm runs apply()
  // here, on the click, so the work is finished before the agent asks again.
  function askInPage(message, key, toolName, apply) {
    return new Promise((resolve) => {
      let settled = false;
      const settle = (outcome) => {
        if (settled) return;
        settled = true;
        if (pendingConfirm && pendingConfirm.key === key) {
          pendingConfirm = null;
          hideConfirmCard();
        }
        resolve(outcome);
      };

      const onCancel = () => {
        cancelled.add(key);
        debug(toolName + ' cancelled on the page');
        settle({ status: 'cancelled' });
      };

      const onConfirm = async () => {
        paint({ busy: true });
        let result;
        try {
          result = await apply();
        } catch (err) {
          const why = (err && err.message) || String(err);
          debug(toolName + ' failed after Confirm: ' + why);
          paint({ error: why });
          return; // the card stays up so the operator can try again
        }
        applied.set(key, result);
        cancelled.delete(key);
        save();
        await verifyAndRender();
        await refreshToolsBox();
        debug(toolName + ' confirmed on the page and applied — the agent can read the result back now');
        settle({ status: 'confirmed', result });
      };

      function paint(state) {
        paintConfirmCard(message, state);
        const yes = confirmEl.querySelector('[data-baton-confirm]');
        const no = confirmEl.querySelector('[data-baton-cancel]');
        if (yes && !yes.disabled) yes.addEventListener('click', onConfirm, { once: true });
        if (no && !no.disabled) no.addEventListener('click', onCancel, { once: true });
      }

      pendingConfirm = { key, toolName, supersede: () => settle({ status: 'superseded' }) };
      paint({});
    });
  }

  // A new proposal from the same tool retires the old card and the old Cancel.
  function retireOtherKeys(toolName, key) {
    const prefix = toolName + ':';
    for (const k of [...cancelled]) if (k !== key && k.startsWith(prefix)) cancelled.delete(k);
    if (pendingConfirm && pendingConfirm.key !== key && pendingConfirm.key.startsWith(prefix)) {
      pendingConfirm.supersede();
    }
  }

  // The shared engine. confirmAndApply and the older confirmInPage are both
  // thin wrappers over this, so there is exactly one confirmation path.
  async function confirmFlow({ toolName, input, message, apply, client }) {
    const name = String(toolName || 'this tool');
    const key = confirmKey(name, input);
    const started = Date.now();

    if (applied.has(key)) {
      debug(name + ' was already confirmed on the page — returning the stored result');
      return { status: 'confirmed', result: applied.get(key), path: 'already-confirmed', waited_ms: 0 };
    }
    if (cancelled.has(key)) {
      return { status: 'cancelled', path: 'cancelled', waited_ms: 0 };
    }
    if (pendingConfirm && pendingConfirm.key === key) {
      // The card is already up for this exact call: leave it alone.
      return { status: 'pending', path: 'confirm-card', waited_ms: 0 };
    }
    retireOtherKeys(name, key);

    const run = typeof apply === 'function' ? apply : async () => true;

    // Verified in the ChatGPT desktop browser, 2026-09-02: requestUserInteraction
    // exists on the second execute argument but throws when called. Try it, and
    // fall through to the immediate-pending path when it does not work.
    if (typeof client?.requestUserInteraction === 'function') {
      try {
        let outcome = null;
        await client.requestUserInteraction(async () => {
          outcome = await askInPage(message, key, name, run);
        });
        const waited = Date.now() - started;
        if (outcome?.status === 'confirmed') {
          debug('requestUserInteraction held ' + name + ' open for ' + waited + 'ms → confirmed');
          return { status: 'confirmed', result: outcome.result, path: 'requestUserInteraction', waited_ms: waited };
        }
        if (outcome?.status === 'cancelled') {
          debug('requestUserInteraction held ' + name + ' open for ' + waited + 'ms → cancelled');
          return { status: 'cancelled', path: 'requestUserInteraction', waited_ms: waited };
        }
        debug('requestUserInteraction returned without an answer for ' + name);
        return { status: 'pending', path: 'requestUserInteraction', waited_ms: waited };
      } catch (e) {
        debug('requestUserInteraction failed — falling back to the page card: ' + ((e && e.message) || e));
      }
    }

    if (pendingConfirm && pendingConfirm.key === key) {
      return { status: 'pending', path: 'confirm-card', waited_ms: Date.now() - started };
    }
    askInPage(message, key, name, run); // deliberately not awaited
    const waited = Date.now() - started;
    debug(name + ' is waiting for Confirm on the page — answered pending after ' + waited + 'ms');
    return { status: 'pending', path: 'confirm-card', waited_ms: waited };
  }

  // The contract site tools code against.
  async function confirmAndApply(options) {
    const o = options || {};
    const name = String(o.toolName || 'this tool');
    const r = await confirmFlow({
      toolName: name, input: o.input, message: o.message, apply: o.apply, client: o.client
    });
    if (r.status === 'confirmed') return { status: 'confirmed', result: r.result };
    if (r.status === 'cancelled') return { status: 'cancelled', next: cancelledText(name) };
    return { status: 'pending', next: pendingText(name) };
  }

  // Read the answer for a call without putting a card up. Call this first in a
  // consequential tool, before the guards: once apply() has run, a guard like
  // "this leg is already signed" would otherwise hide the stored result from
  // the agent's second call.
  function peekConfirm(toolName, input) {
    const key = confirmKey(String(toolName), input);
    if (applied.has(key)) return { status: 'confirmed', result: applied.get(key) };
    if (cancelled.has(key)) return { status: 'cancelled', next: cancelledText(String(toolName)) };
    return { status: 'none' };
  }

  /* ---- kept for the tools written against the older two-step helpers ---- */

  async function confirmInPage(client, message, toolName, input) {
    const r = await confirmFlow({ toolName, input, message, client, apply: async () => true });
    return { status: r.status, path: r.path, waited_ms: r.waited_ms };
  }

  function needsConfirm(result, toolName) {
    if (result.status === 'confirmed') return null;
    if (result.status === 'pending') {
      return { ok: false, status: 'pending', next: pendingText(toolName) };
    }
    return { ok: false, status: 'cancelled', next: cancelledText(toolName) };
  }

  /* ------------------------------------------------------- tool plumbing */

  const hasWebMCP = typeof document.modelContext?.registerTool === 'function';

  // Our own record of what is registered, so the tools box works even in
  // browsers whose modelContext has no getTools() or toolchange event.
  const registry = new Map();

  function register(def, signal) {
    if (!hasWebMCP) return; // ordinary browser: the page still works, it just grows no tools
    registry.set(def.name, def);
    if (signal) signal.addEventListener('abort', () => { registry.delete(def.name); refreshToolsBox(); }, { once: true });
    let result;
    try {
      result = document.modelContext.registerTool(def, { signal });
    } catch (e) {
      // Some implementations reject the options bag; register without it.
      try {
        result = document.modelContext.registerTool(def);
        debug('registered ' + def.name + ' without options: ' + (e && e.message));
      } catch (e2) {
        registry.delete(def.name);
        debug('could not register ' + def.name + ': ' + (e2 && e2.message));
        return;
      }
    }
    Promise.resolve(result).catch((e) => {
      registry.delete(def.name);
      debug('registerTool rejected ' + def.name + ': ' + (e && e.message));
      refreshToolsBox();
    });
    refreshToolsBox();
  }

  async function refreshToolsBox() {
    if (!toolsBox) return;
    if (!hasWebMCP) {
      toolsBox.innerHTML = '<div class="tools__count">No WebMCP in this browser</div>';
      return;
    }
    let tools = null;
    try {
      if (typeof document.modelContext.getTools === 'function') tools = await document.modelContext.getTools();
    } catch (e) {
      tools = null;
    }
    if (!Array.isArray(tools)) tools = [...registry.values()];
    const items = tools
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => {
        const ro = t.annotations?.readOnlyHint;
        return '<li class="tool"><code>' + esc(t.name) + '</code><span class="tool__kind tool__kind--' + (ro ? 'read' : 'write') + '">' +
          (ro ? 'read' : 'write') + '</span></li>';
      })
      .join('');
    toolsBox.innerHTML =
      '<div class="tools__count"><b>' + tools.length + '</b> site tool' + (tools.length === 1 ? '' : 's') + ' registered right now</div>' +
      '<ul class="tools__list">' + items + '</ul>';
  }

  /* --------------------------------------------------------- common tools */

  function registerCommonTools() {
    if (commonAbort) return;
    commonAbort = new AbortController();
    const signal = commonAbort.signal;

    register({
      name: 'baton_inspect',
      description: 'Read the whole mission travelling with this person: goal, constraints, route, the legs signed so far and by whom, money spent and left, and days to the deadline.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: async () => ({
        ok: true,
        mission: missionSummary(mission),
        constraints: mission.constraints,
        route: mission.route.map((r, i) => ({ ...r, status: i < mission.legs.length ? 'done' : 'pending' })),
        legs: mission.legs.map((l) => ({
          index: l.index, origin: l.origin, role: l.role, summary: l.summary,
          cost_usd: l.cost_usd, evidence: l.evidence, completed_at: l.completed_at, signed_by: l.kid
        })),
        declined: mission.declined || []
      })
    }, signal);

    register({
      name: 'baton_check',
      description: 'Test a cost and/or a date against the mission constraints before committing to it. Says whether it is allowed, and if not which constraint fails and by how much.',
      inputSchema: {
        type: 'object',
        properties: {
          cost_usd: { type: 'number', description: 'Money this step would spend, in US dollars.' },
          date: { type: 'string', description: 'Date this step would land on, as YYYY-MM-DD.' }
        },
        additionalProperties: false
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => ({ ok: true, ...checkAction(mission, input || {}) })
    }, signal);

    register({
      name: 'baton_verify',
      description: 'Re-check every signed leg of the mission against the public key published by the site that signed it, and confirm the spent total matches the legs.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: async () => {
        const result = await verifyAndRender();
        return { ok: true, chain_ok: result.ok, ...result };
      }
    }, signal);

    register({
      name: 'baton_complete_leg',
      description: 'Finish this site\'s leg of the mission. Needs the operator to click Confirm on the page. Signs the leg with this site\'s key, adds it to the mission and updates the money spent.',
      inputSchema: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'One line describing what this site did.' },
          cost_usd: { type: 'number', description: 'What this leg costs, in US dollars.' },
          evidence: { type: 'object', description: 'Booking references, dates, specifications — whatever proves the work was arranged.' }
        },
        required: ['summary', 'cost_usd', 'evidence'],
        additionalProperties: false
      },
      annotations: { readOnlyHint: false },
      execute: async (input, client) => {
        // Read the answer first: once the leg is signed, the guards below are
        // true again and would hide the stored result from the second call.
        const seen = peekConfirm('baton_complete_leg', input);
        if (seen.status === 'confirmed') return { ok: true, ...seen.result };
        if (seen.status === 'cancelled') return { ok: false, status: 'cancelled', next: seen.next };

        const expected = mission.route[mission.legs.length];
        if (!expected) return { ok: false, error: 'every leg of this mission is already signed' };
        if (expected.role !== cfg.role) {
          return { ok: false, error: 'this mission is waiting for the ' + expected.role + ' leg at ' + host(expected.url) + ', not for ' + cfg.siteName };
        }
        if (mission.legs.some((l) => l.origin === location.origin)) {
          return { ok: false, error: cfg.siteName + ' has already signed a leg on this mission' };
        }
        const check = checkAction(mission, { cost_usd: input.cost_usd });
        if (!check.allowed) {
          return { ok: false, error: 'blocked by the mission constraints', check };
        }

        const outcome = await confirmAndApply({
          toolName: 'baton_complete_leg',
          input,
          client,
          message: cfg.siteName + ' — sign the ' + cfg.role + ' leg for ' + money(input.cost_usd) + '? ' + input.summary,
          apply: async () => {
            const index = mission.legs.length;
            const legWithoutSig = {
              index,
              origin: location.origin,
              role: cfg.role,
              summary: String(input.summary),
              cost_usd: round2(input.cost_usd),
              evidence: input.evidence || {},
              completed_at: new Date().toISOString(),
              kid: cfg.kid
            };
            const prevSig = index > 0 ? mission.legs[index - 1].sig : null;
            const signed = await signLegWith(mission, legWithoutSig, prevSig, cfg);
            mission.legs.push({ ...legWithoutSig, sig: signed.sig });
            mission.spent_usd = round2(mission.legs.reduce((a, l) => a + (Number(l.cost_usd) || 0), 0));
            return {
              leg: { ...legWithoutSig, sig: signed.sig.slice(0, 12) + '…' },
              signed_in: signed.signed_in,
              mission: missionSummary(mission)
            };
          }
        });
        if (outcome.status === 'confirmed') return { ok: true, ...outcome.result };
        return { ok: false, ...outcome };
      }
    }, signal);

    register({
      name: 'baton_mint',
      description: 'Produce the link that carries this mission to the next site on the route, and show it on the page as a big "Carry this to …" link for the operator to click.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false },
      execute: async () => {
        const stop = nextStop(mission);
        if (!stop) {
          carryLink = null;
          render();
          return { ok: true, done: true, mission: missionSummary(mission), note: 'The route is finished. Nothing left to carry.' };
        }
        const url = missionLink(stop.url, mission);
        carryLink = { url, label: stop.role + ' at ' + host(stop.url) };
        render();
        return { ok: true, done: false, next_role: stop.role, next_url: url, mission: missionSummary(mission) };
      }
    }, signal);

    register({
      name: 'baton_decline',
      description: 'Record that this site will not take its leg of the mission, with the reason. Needs the operator to click Confirm on the page. The marker travels with the mission but is not signed.',
      inputSchema: {
        type: 'object',
        properties: { reason: { type: 'string', description: 'Why this site is turning the leg down.' } },
        required: ['reason'],
        additionalProperties: false
      },
      annotations: { readOnlyHint: false },
      execute: async (input, client) => {
        const seen = peekConfirm('baton_decline', input);
        if (seen.status === 'confirmed') return { ok: true, ...seen.result };

        const outcome = await confirmAndApply({
          toolName: 'baton_decline',
          input,
          client,
          message: cfg.siteName + ' — turn down the ' + cfg.role + ' leg? ' + input.reason,
          apply: async () => {
            const marker = {
              origin: location.origin,
              role: cfg.role,
              reason: String(input.reason),
              declined_at: new Date().toISOString(),
              signed: false
            };
            mission.declined = mission.declined || [];
            mission.declined.push(marker);
            return { declined: marker, mission: missionSummary(mission) };
          }
        });
        if (outcome.status === 'confirmed') return { ok: true, ...outcome.result };
        return { ok: false, ...outcome };
      }
    }, signal);
  }

  function unregisterCommonTools() {
    if (commonAbort) { commonAbort.abort(); commonAbort = null; }
    if (siteAbort) { siteAbort.abort(); siteAbort = null; }
    siteRegistered.clear();
  }

  function registerMissionGatedSiteTools() {
    if (siteRegistrars.length === 0) return;
    if (!siteAbort) siteAbort = new AbortController();
    for (const fn of siteRegistrars) {
      if (siteRegistered.has(fn)) continue;
      siteRegistered.add(fn);
      fn(siteAbort.signal, register);
    }
  }

  /* ---- baton_house_terms is published whether or not a mission is aboard */
  function registerAlwaysOnTools() {
    const ac = new AbortController(); // never aborted; the page owns it for its lifetime
    alwaysAborts.push(ac);
    register({
      name: 'baton_house_terms',
      description: 'The conditions ' + cfg.siteName + ' publishes for taking a leg of a mission: which roles it accepts, what it needs declared, and its limits.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: async () => ({ ok: true, site: cfg.siteName, origin: location.origin, role: cfg.role, ...cfg.houseTerms })
    }, ac.signal);
  }

  /* ---------------------------------------------------------- mission set */

  async function setMission(next, { source } = {}) {
    const check = validateMission(next);
    if (!check.ok) {
      debug('rejected an incoming mission: ' + check.reason);
      return { ok: false, reason: check.reason };
    }
    mission = next;
    save();
    registerCommonTools();
    registerMissionGatedSiteTools();
    await refreshToolsBox();
    await verifyAndRender();
    if (source) debug('mission ' + mission.id + ' loaded from ' + source);
    return { ok: true };
  }

  function clearMission() {
    mission = null;
    carryLink = null;
    chain = null;
    applied.clear();
    cancelled.clear();
    if (pendingConfirm) pendingConfirm.supersede();
    save();
    unregisterCommonTools();
    render();
    refreshToolsBox();
  }

  /* ----------------------------------------------------------- bootstrap */

  const api = {
    get mission() { return mission; },
    get hasWebMCP() { return hasWebMCP; },
    config: cfg,
    setMission,
    clearMission,
    render,
    debug,
    // The confirmation contract site tools use.
    confirmAndApply,
    peekConfirm,
    // Kept working for tools written against the older two-step helpers.
    confirmInPage,
    needsConfirm,
    checkAction: (args) => checkAction(mission, args),
    refreshToolsBox,
    verifyAndRender,
    // site.js calls these to add its own tools
    registerAlways(defFactory) {
      const ac = new AbortController();
      alwaysAborts.push(ac);
      defFactory(ac.signal, register);
    },
    registerWhenMissionAboard(defFactory) {
      siteRegistrars.push(defFactory);
      if (mission) { registerMissionGatedSiteTools(); refreshToolsBox(); }
    }
  };

  if (!hasWebMCP) {
    render();
    if (toolsBox) toolsBox.innerHTML = '<div class="tools__count">No WebMCP in this browser</div>';
    debug('document.modelContext.registerTool is missing — no tools registered');
  } else {
    try {
      registerAlwaysOnTools();
      // Not every WebMCP implementation exposes the optional toolchange event
      // or getTools(); the page keeps its own registry and refreshes itself.
      if (typeof document.modelContext.addEventListener === 'function') {
        document.modelContext.addEventListener('toolchange', () => { refreshToolsBox(); });
      }
      render();
      refreshToolsBox();
      const caps = ['registerTool',
        typeof document.modelContext.getTools === 'function' ? 'getTools' : 'no getTools',
        typeof document.modelContext.addEventListener === 'function' ? 'toolchange' : 'no toolchange'].join(', ');
      debug('WebMCP ready on ' + location.origin + ' (' + caps + ')');
    } catch (e) {
      render();
      refreshToolsBox();
      debug('WebMCP setup problem: ' + (e && e.message));
    }
  }

  // A mission in the link wins over stored state, unless the stored copy is
  // the same mission further along (a plain reload after signing a leg).
  const fromHash = readMissionFromHash();
  const stored = load();
  let initial = fromHash;
  if (stored && (!fromHash || (stored.id === fromHash.id && stored.legs.length > fromHash.legs.length))) initial = stored;
  if (initial) setMission(initial, { source: initial === stored ? 'this tab' : 'the link' });

  addEventListener('hashchange', () => {
    const m = readMissionFromHash();
    if (m) setMission(m, { source: 'the link' });
  });

  return api;
}
