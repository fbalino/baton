// Rivera Press — deployment config.
// This is the ONE file to edit per deployment. Put the real hostnames in PROD_HOSTS
// once the three sites are live; localhost is used automatically during development.

const PROD_HOSTS = {
  print: 'https://baton-rivera-press.vercel.app',
  bind: 'https://baton-norte-bindery.pages.dev',
  deliver: 'https://baton-ruta-courier.pages.dev'
};

const LOCAL_HOSTS = {
  print: 'http://localhost:4181',
  bind: 'http://localhost:4182',
  deliver: 'http://localhost:4183'
};

const local = ['localhost', '127.0.0.1'].includes(location.hostname);
const hosts = local ? LOCAL_HOSTS : PROD_HOSTS;

// The route a mission takes. Site 1 writes it into the mission when it starts.
export const ROUTE = [
  { role: 'print', url: hosts.print + '/' },
  { role: 'bind', url: hosts.bind + '/' },
  { role: 'deliver', url: hosts.deliver + '/' }
];

export const SITE = {
  siteId: 'rivera-press',
  siteName: 'Rivera Press',
  role: 'print',
  kid: 'rivera-2026-09',
  emptyHint: 'No mission yet. Ask the agent to start one with baton_start and it will appear here.',
  houseTerms: {
    accepts_roles: ['print'],
    requires_declared: ['quantity', 'size'],
    max_quantity: 400,
    sizes: ['20x30', '30x40'],
    slot_hold_hours: 48,
    notes: 'Print legs only. Quantity and print size must be declared before a press slot is held.'
  }
};
