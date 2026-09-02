// Ruta Courier — the delivery leg, usually the last one on the baton.
//
// Signing happens on this origin's server (the library POSTs /api/sign); no
// private key ships to the browser any more.

import { mountBaton, canonicalize, round2, todayISO } from './baton.js';
import { SITE } from './config.js';
import {
  ZONES, SPEEDS, DEPOT, CHECKPOINTS,
  boardParcels, daysBetween, findSpeed, findZone, isDate, isSunday,
  newTrackingId, pickupWindows, priceDelivery, shiftDays, weekdayName
} from './data.js';

const $ = (id) => document.getElementById(id);
const usd = (n) => '$' + round2(n).toFixed(2);
const SAMPLE_COPIES = 40; // the parcel the published rate card is priced for

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
  try { localStorage.setItem('ruta.theme', next); } catch { /* private mode */ }
  paintThemeButton();
});
systemDark.addEventListener('change', paintThemeButton);
paintThemeButton();

/* ------------------------------------------------------------------- page */

$('host-label').textContent = location.host || 'file://';

const standard = findSpeed('standard');
const express = findSpeed('express');
const sampleWeight = priceDelivery({ speed: standard, zone: ZONES[0], copies: SAMPLE_COPIES }).est_weight_kg;

$('figures').innerHTML = [
  ['Vans', DEPOT.vans],
  ['Bikes', DEPOT.bikes],
  ['Zones', ZONES.length],
  ['Speeds', SPEEDS.length],
  ['Parcel limit', DEPOT.max_parcel_kg + ' kg']
].map(([k, v]) => '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>').join('');

$('rates').innerHTML = ZONES.map((z) => {
  const s = priceDelivery({ speed: standard, zone: z, copies: SAMPLE_COPIES });
  const e = priceDelivery({ speed: express, zone: z, copies: SAMPLE_COPIES });
  return '<tr>' +
    '<td class="name">' + z.name + '</td>' +
    '<td class="covers covers-col">' + z.covers + '</td>' +
    '<td class="num">' + z.cutoff + '</td>' +
    '<td class="num price">' + usd(s.cost_usd) + '<br><span class="covers">' + s.transit_days + ' days</span></td>' +
    '<td class="num price price--express">' + usd(e.cost_usd) + '<br><span class="covers">' + e.transit_days + ' day' + (e.transit_days === 1 ? '' : 's') + '</span></td>' +
    '</tr>';
}).join('');

$('rates-note').textContent =
  'Priced for a ' + SAMPLE_COPIES + '-copy parcel, about ' + sampleWeight + ' kg. ' +
  'A quote against a real baton uses the copy count already signed onto it.';

function drawWindows(dateISO) {
  const windows = pickupWindows(dateISO);
  $('windows-intro').textContent =
    'Windows for ' + weekdayName(dateISO) + ' ' + dateISO + ', the next day we can collect.';
  $('windows').innerHTML = windows.map((w) => {
    const cls = w.state === 'open' ? 'open' : w.state === 'full' ? 'full' : 'closed';
    const note = w.state === 'closed' ? 'no collections' : w.state === 'full' ? 'full' :
      w.slots_left + ' of ' + w.slots + ' free';
    return '<li class="window window--' + cls + '">' +
      '<div class="window__label">' + w.label + '</div>' +
      '<div class="window__slots">' + note + '</div></li>';
  }).join('');
}

// Parcels booked during this visit, newest first, in front of the standing board.
const bookedHere = [];
const arrived = new Set(); // rows that have already played their entrance

function drawBoard() {
  const today = todayISO();
  const rows = [...bookedHere, ...boardParcels(today)].map((p) => {
    const cls = p.status === 'delivered' ? ' status--delivered' : p.status === 'out for delivery' ? ' status--out' : '';
    const fresh = bookedHere.includes(p) && !arrived.has(p.tracking_id);
    if (fresh) arrived.add(p.tracking_id);
    return '<tr' + (fresh ? ' class="row--new"' : '') + '>' +
      '<td><div class="tid">' + p.tracking_id + '</div>' +
      '<div class="covers">' + p.route + '</div></td>' +
      '<td><span class="status' + cls + '">' + p.status + '</span></td>' +
      '<td class="num">' + p.delivery_date + '</td>' +
      '</tr>';
  });
  $('board').innerHTML = rows.join('');
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
  panel: $('mission-panel'),
  toolsBox: $('site-tools')
});

if (!baton.hasWebMCP) $('no-webmcp').hidden = false;

// The day the work is ready: the latest date signed onto the baton so far.
function readyDate() {
  let latest = todayISO();
  for (const leg of baton.mission?.legs || []) {
    for (const value of Object.values(leg.evidence || {})) {
      if (typeof value === 'string' && isDate(value) && value > latest) latest = value;
    }
  }
  return latest;
}

// We collect the working day after that, never on a Sunday.
function defaultPickupDate() {
  let day = shiftDays(readyDate(), DEPOT.booking_notice_days);
  while (isSunday(day)) day = shiftDays(day, 1);
  return day;
}

drawWindows(defaultPickupDate());
drawBoard();

/* ---- confirm gate -------------------------------------------------------
   The library owns confirmAndApply/peekConfirm. Until that version is synced
   into this folder, the same semantics run locally on top of confirmInPage:
   first call shows the card and returns pending, the operator clicks Confirm,
   the second call applies the work once and caches the result. */

const gate = (() => {
  if (typeof baton.confirmAndApply === 'function' && typeof baton.peekConfirm === 'function') {
    return {
      confirmAndApply: (args) => baton.confirmAndApply(args),
      peekConfirm: (toolName, input) => baton.peekConfirm(toolName, input)
    };
  }
  const done = new Map();
  const dropped = new Map();
  const keyOf = (toolName, input) => toolName + ':' + canonicalize(input ?? {});
  return {
    peekConfirm(toolName, input) {
      const key = keyOf(toolName, input);
      if (done.has(key)) return { status: 'confirmed', result: done.get(key) };
      if (dropped.has(key)) return { status: 'cancelled', next: dropped.get(key) };
      return { status: 'none' };
    },
    async confirmAndApply({ toolName, input, message, apply, client }) {
      const key = keyOf(toolName, input);
      if (done.has(key)) return { status: 'confirmed', result: done.get(key) };
      const asked = await baton.confirmInPage(client, message, toolName, input);
      if (asked.status === 'confirmed') {
        const result = await apply();
        done.set(key, result);
        dropped.delete(key);
        await baton.refreshToolsBox();
        return { status: 'confirmed', result };
      }
      const blocked = baton.needsConfirm(asked, toolName);
      if (asked.status === 'cancelled') dropped.set(key, blocked.next);
      return { status: asked.status, next: blocked.next };
    }
  };
})();

/* ------------------------------------------- always on: one plain read tool */

baton.registerAlways((signal, register) => {
  register({
    name: 'service_areas',
    description: 'The three zones Ruta Courier collects from and delivers to, their daily cut-off and surcharge, and the two speeds with their transit times.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async () => ({
      ok: true,
      depot: DEPOT.name,
      vans: DEPOT.vans,
      bikes: DEPOT.bikes,
      zones: ZONES,
      speeds: SPEEDS.map((s) => ({ id: s.id, transit_days: s.transit_days })),
      max_parcel_kg: DEPOT.max_parcel_kg,
      booking_notice_days: DEPOT.booking_notice_days,
      note: 'Pricing a delivery needs a mission aboard. Arrive with a baton in the link and the rest of the tools appear.'
    })
  }, signal);
});

/* -------------------------------------- only while a mission is on the page */

let lastQuote = null; // what book_collection books against

baton.registerWhenMissionAboard((signal, register) => {
  register({
    name: 'quote_delivery_for_mission',
    description: 'Price the last leg for the copies already on the baton: weight, parcels, cost, the day we collect and the day it lands, checked against the money left and the deadline. Ruta never asks how many copies there are: it reads that from the legs already signed.',
    inputSchema: {
      type: 'object',
      properties: {
        speed: { type: 'string', enum: ['standard', 'express'], description: 'How fast it travels.' },
        zone: { type: 'string', enum: ['city', 'metro', 'interior'], description: 'Delivery address zone. Defaults to city.' }
      },
      required: ['speed'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    execute: async (input) => {
      const speed = findSpeed(input?.speed);
      if (!speed) return { ok: false, error: 'speed must be standard or express', choices: SPEEDS.map((s) => s.id) };
      const zoneAssumed = !input?.zone;
      const zone = findZone(input?.zone || 'city');
      if (!zone) return { ok: false, error: 'no such zone', choices: ZONES.map((z) => z.id) };

      const copies = baton.mission.constraints.quantity;
      const priced = priceDelivery({ speed, zone, copies });
      const pickup_date = defaultPickupDate();
      const delivery_date = shiftDays(pickup_date, priced.transit_days);
      const check = baton.checkAction({ cost_usd: priced.cost_usd, date: delivery_date });

      lastQuote = {
        speed: speed.id, zone: zone.id, copies, pickup_date, delivery_date,
        cost_usd: priced.cost_usd, parcels: priced.parcels, est_weight_kg: priced.est_weight_kg
      };

      return {
        ok: true,
        speed: speed.id,
        zone: zone.id,
        zone_assumed: zoneAssumed,
        copies,
        est_weight_kg: priced.est_weight_kg,
        parcels: priced.parcels,
        max_parcel_kg: DEPOT.max_parcel_kg,
        pickup_date,
        pickup_cutoff: zone.cutoff,
        transit_days: priced.transit_days,
        delivery_date,
        cost_usd: priced.cost_usd,
        check,
        note: 'Collection is the working day after the last date signed onto this baton, so nothing had to be re-asked.'
      };
    }
  }, signal);

  register({
    name: 'pickup_windows',
    description: 'The collection windows Ruta still has on a given day, with how many slots are left in each. Sundays are closed.',
    inputSchema: {
      type: 'object',
      properties: { date: { type: 'string', description: 'Collection day as YYYY-MM-DD.' } },
      required: ['date'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    execute: async (input) => {
      const date = String(input?.date || '');
      if (!isDate(date)) return { ok: false, error: 'date must look like YYYY-MM-DD' };
      const today = todayISO();
      if (daysBetween(today, date) < 0) return { ok: false, error: date + ' has already gone by', today };
      const windows = pickupWindows(date);
      const open = windows.filter((w) => w.state === 'open');
      return {
        ok: true,
        date,
        weekday: weekdayName(date),
        closed: isSunday(date),
        windows,
        open_windows: open.map((w) => w.id),
        first_open_window: open[0]?.id ?? null,
        zone_cutoffs: ZONES.map((z) => ({ zone: z.id, cutoff: z.cutoff })),
        booking_notice_days: DEPOT.booking_notice_days
      };
    }
  }, signal);

  register({
    name: 'book_collection',
    description: 'Book the van for the delivery already quoted. Needs the operator to click Confirm on the page: the first call shows the card and returns pending, the second call returns the booking. Hands back the tracking id, pickup date, delivery date and cost for baton_complete_leg.',
    inputSchema: {
      type: 'object',
      properties: {
        pickup_date: { type: 'string', description: 'Collection day as YYYY-MM-DD.' },
        window: { type: 'string', enum: ['am', 'midday', 'pm'], description: 'Which collection window. Defaults to the first one still open.' }
      },
      required: ['pickup_date'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false },
    execute: async (input, client) => {
      // Read the confirm state before the guards, so the second call returns the
      // booking rather than tripping over a slot this very call has just taken.
      const seen = gate.peekConfirm('book_collection', input);
      if (seen.status === 'confirmed') return { ok: true, ...seen.result };
      if (seen.status === 'cancelled') return { ok: false, status: 'cancelled', next: seen.next };

      const date = String(input?.pickup_date || '');
      if (!isDate(date)) return { ok: false, error: 'pickup_date must look like YYYY-MM-DD' };

      const today = todayISO();
      const notice = daysBetween(today, date);
      if (notice < 0) return { ok: false, error: date + ' has already gone by', today };
      if (notice < DEPOT.booking_notice_days) {
        return {
          ok: false,
          error: 'collection is booked at least ' + DEPOT.booking_notice_days + ' working day ahead',
          earliest_pickup_date: shiftDays(today, DEPOT.booking_notice_days)
        };
      }
      if (isSunday(date)) {
        return { ok: false, error: 'Ruta does not collect on Sundays', next_working_day: shiftDays(date, 1) };
      }

      const windows = pickupWindows(date);
      const open = windows.filter((w) => w.state === 'open');
      const wanted = input?.window ? windows.find((w) => w.id === input.window) : open[0];
      if (input?.window && !wanted) {
        return { ok: false, error: 'no such window', choices: windows.map((w) => w.id) };
      }
      if (!wanted || wanted.state !== 'open') {
        return {
          ok: false,
          error: wanted ? 'the ' + wanted.label + ' window is full on ' + date : 'every window is full on ' + date,
          open_windows: open.map((w) => ({ id: w.id, label: w.label, slots_left: w.slots_left })),
          next: open.length ? 'Call book_collection again with one of the open windows.'
            : 'Call pickup_windows on another day and book that instead.'
        };
      }

      if (!lastQuote) {
        return {
          ok: false,
          error: 'nothing has been quoted yet, and Ruta books a van against a priced job rather than a bare date',
          next: 'Call quote_delivery_for_mission with a speed, then book_collection again.'
        };
      }

      const q = lastQuote;
      const delivery_date = shiftDays(date, daysBetween(q.pickup_date, q.delivery_date));
      const zone = findZone(q.zone);

      const outcome = await gate.confirmAndApply({
        toolName: 'book_collection',
        input,
        client,
        message: 'Ruta Courier: collect ' + q.parcels + ' parcel' + (q.parcels === 1 ? '' : 's') +
          ' on ' + date + ', ' + wanted.label + ', ' + q.speed + ' to the ' + zone.name.toLowerCase() +
          ' zone, landing ' + delivery_date + ' for ' + usd(q.cost_usd) + '?',
        apply: () => {
          const tracking_id = newTrackingId();
          bookedHere.unshift({
            tracking_id,
            route: 'This mission to the ' + zone.name.toLowerCase() + ' zone',
            speed: q.speed,
            zone: q.zone,
            status: 'booked',
            pickup_date: date,
            pickup_window: wanted.id,
            delivery_date,
            cost_usd: q.cost_usd,
            copies: q.copies
          });
          drawBoard();
          drawWindows(date);
          baton.debug('collection booked for ' + date + ' — ' + tracking_id);
          return {
            booked: true,
            evidence: {
              tracking_id,
              pickup_date: date,
              pickup_window: wanted.label,
              delivery_date,
              zone: q.zone,
              speed: q.speed,
              parcels: q.parcels,
              cost_usd: q.cost_usd
            },
            next: 'Call baton_complete_leg with this evidence, cost_usd ' + q.cost_usd + ', and a one-line summary.'
          };
        }
      });

      if (outcome.status !== 'confirmed') return { ok: false, status: outcome.status, next: outcome.next };
      return { ok: true, ...outcome.result };
    }
  }, signal);

  register({
    name: 'track_parcel',
    description: 'Where a parcel is: status, the checkpoints it has passed, and the day it is due. Works for anything booked on this page and for the jobs already on the board.',
    inputSchema: {
      type: 'object',
      properties: { tracking_id: { type: 'string', description: 'A Ruta tracking id, e.g. RUTA-8K3QP1.' } },
      required: ['tracking_id'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    execute: async (input) => {
      const id = String(input?.tracking_id || '').trim().toUpperCase();
      const all = [...bookedHere, ...boardParcels(todayISO())];
      const parcel = all.find((p) => p.tracking_id === id);
      if (!parcel) {
        return { ok: false, error: 'no parcel with that tracking id', known_ids: all.map((p) => p.tracking_id) };
      }
      return {
        ok: true,
        tracking_id: parcel.tracking_id,
        status: parcel.status,
        checkpoints: CHECKPOINTS[parcel.status] || [parcel.status],
        route: parcel.route,
        speed: parcel.speed,
        zone: parcel.zone,
        pickup_date: parcel.pickup_date,
        delivery_date: parcel.delivery_date,
        ...(parcel.cost_usd ? { cost_usd: parcel.cost_usd } : {})
      };
    }
  }, signal);
});
