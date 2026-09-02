// Ruta Courier — the depot's own numbers.
// No dependency on the baton library: this is what the business knows about
// itself, mission or no mission.

export const ZONES = [
  {
    id: 'city',
    name: 'City',
    covers: 'Everything inside the ring road, plus the old port',
    cutoff: '15:00',
    surcharge_usd: 0,
    extra_transit_days: 0
  },
  {
    id: 'metro',
    name: 'Metro',
    covers: 'The four suburbs, the airport road and the industrial belt',
    cutoff: '13:00',
    surcharge_usd: 6.50,
    extra_transit_days: 0
  },
  {
    id: 'interior',
    name: 'Interior',
    covers: 'Valley towns and the two university campuses',
    cutoff: '11:00',
    surcharge_usd: 14.00,
    extra_transit_days: 1
  }
];

export const SPEEDS = [
  { id: 'standard', name: 'Standard', transit_days: 2, base_usd: 18.00, per_copy_usd: 0.15 },
  { id: 'express', name: 'Express', transit_days: 1, base_usd: 26.00, per_copy_usd: 0.35 }
];

export const DEPOT = {
  name: 'Ruta Courier',
  vans: 4,
  bikes: 1,
  weight_per_copy_kg: 0.32,
  max_parcel_kg: 25,
  booking_notice_days: 1,
  windows: [
    { id: 'am', label: '08:00 to 11:00', slots: 2 },
    { id: 'midday', label: '11:00 to 14:00', slots: 3 },
    { id: 'pm', label: '14:00 to 17:00', slots: 2 }
  ]
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
export const isSunday = (dateISO) => new Date(noon(dateISO)).getUTCDay() === 0;

/* ------------------------------------------------------------ collections */

// A stable, unglamorous way to make some windows look busy: the same date
// always shows the same round, whoever loads the page.
function dateSeed(dateISO) {
  let n = 0;
  for (const ch of dateISO) n = (n * 31 + ch.charCodeAt(0)) % 9973;
  return n;
}

export function pickupWindows(dateISO) {
  const seed = dateSeed(dateISO);
  // One window on every working day is kept open: a depot that answers "all
  // full, try another day" to every question is not a depot.
  const keptOpen = seed % DEPOT.windows.length;
  return DEPOT.windows.map((w, i) => {
    if (isSunday(dateISO)) {
      return { id: w.id, label: w.label, slots: w.slots, slots_left: 0, state: 'closed' };
    }
    const taken = i === keptOpen
      ? (seed >> (i * 3)) % w.slots
      : (seed >> (i * 3)) % (w.slots + 1);
    const left = Math.max(0, w.slots - taken);
    return {
      id: w.id,
      label: w.label,
      slots: w.slots,
      slots_left: left,
      state: left > 0 ? 'open' : 'full'
    };
  });
}

export const findZone = (q) => {
  const s = String(q || '').toLowerCase().trim();
  return ZONES.find((z) => z.id === s) || ZONES.find((z) => z.name.toLowerCase() === s) || null;
};

export const findSpeed = (q) => {
  const s = String(q || '').toLowerCase().trim();
  return SPEEDS.find((z) => z.id === s) || SPEEDS.find((z) => z.name.toLowerCase() === s) || null;
};

/* --------------------------------------------------------------- pricing */

export function priceDelivery({ speed, zone, copies }) {
  const est_weight_kg = Math.round(copies * DEPOT.weight_per_copy_kg * 100) / 100;
  const parcels = Math.max(1, Math.ceil(est_weight_kg / DEPOT.max_parcel_kg));
  const cost = parcels * speed.base_usd + speed.per_copy_usd * copies + zone.surcharge_usd;
  return {
    parcels,
    est_weight_kg,
    transit_days: speed.transit_days + zone.extra_transit_days,
    cost_usd: Math.round((cost + Number.EPSILON) * 100) / 100
  };
}

/* --------------------------------------------------------- tracking board */

// Four jobs already on the road, so the board is not empty on a first visit.
export function boardParcels(todayISO) {
  return [
    {
      tracking_id: 'RUTA-8K3QP1',
      route: 'Rivera Press to Calle Mayor 18',
      speed: 'express',
      zone: 'city',
      status: 'out for delivery',
      pickup_date: shiftDays(todayISO, -1),
      delivery_date: todayISO
    },
    {
      tracking_id: 'RUTA-2WD7NA',
      route: 'Norte Bindery to the Valle campus library',
      speed: 'standard',
      zone: 'interior',
      status: 'in transit',
      pickup_date: shiftDays(todayISO, -1),
      delivery_date: shiftDays(todayISO, 2)
    },
    {
      tracking_id: 'RUTA-5FJ0RE',
      route: 'Puerto warehouse to Norte Bindery',
      speed: 'standard',
      zone: 'metro',
      status: 'collected',
      pickup_date: todayISO,
      delivery_date: shiftDays(todayISO, 2)
    },
    {
      tracking_id: 'RUTA-QX41MB',
      route: 'Rivera Press to the art school',
      speed: 'standard',
      zone: 'city',
      status: 'delivered',
      pickup_date: shiftDays(todayISO, -3),
      delivery_date: shiftDays(todayISO, -1)
    }
  ];
}

export const CHECKPOINTS = {
  booked: ['collection booked'],
  collected: ['collection booked', 'collected from sender'],
  'in transit': ['collection booked', 'collected from sender', 'sorted at the depot'],
  'out for delivery': ['collection booked', 'collected from sender', 'sorted at the depot', 'loaded on the round'],
  delivered: ['collection booked', 'collected from sender', 'sorted at the depot', 'loaded on the round', 'signed for']
};

export function newTrackingId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return 'RUTA-' + out;
}
