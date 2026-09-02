// Ruta Courier — deployment config.
// This is the ONE file to edit per deployment.

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

export const ROUTE = [
  { role: 'print', url: hosts.print + '/' },
  { role: 'bind', url: hosts.bind + '/' },
  { role: 'deliver', url: hosts.deliver + '/' }
];

export const SITE = {
  siteId: 'ruta-courier',
  siteName: 'Ruta Courier',
  role: 'deliver',
  kid: 'ruta-2026-09',
  emptyHint: 'No baton aboard. Two tools are registered. Arrive with a mission in the link and the rest appear.',
  houseTerms: {
    accepts_roles: ['deliver'],
    requires_declared: ['pickup_date'],
    booking_notice_days: 1,
    notes: 'Delivery legs only, inside the listed zones. Collection is booked at least one working day ahead.'
  }
};
