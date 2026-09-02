// Norte Bindery — deployment config.
// This is the ONE file to edit per deployment. Norte does not write the route
// (Rivera Press does, when the mission starts) but it keeps the same table so a
// mission can be restarted from any site during testing.

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
  siteId: 'norte-bindery',
  siteName: 'Norte Bindery',
  role: 'bind',
  kid: 'norte-2026-09',
  emptyHint: 'No baton aboard. Two tools are registered. Arrive with a mission in the link and the rest appear.',
  houseTerms: {
    accepts_roles: ['bind'],
    requires_declared: ['quantity', 'binding', 'cover'],
    min_quantity: 10,
    max_quantity: 500,
    notes: 'Binding legs only. The mission must already carry a signed print leg. Every quote is binding plus cover.'
  }
};
