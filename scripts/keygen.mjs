#!/usr/bin/env node
// One ECDSA P-256 key pair per site.
//
//   - the PUBLIC half goes to sites/<site>/.well-known/baton/key.json, served
//     with Access-Control-Allow-Origin: * so any site can check our signatures
//   - the PRIVATE half goes to keys/<site>.private.jwk.json, which is gitignored
//     and never copied into a site folder
//
// No private key is written into any site.js. The browser does not sign: it
// POSTs the canonical payload to /api/sign on its own origin, and that function
// reads the private JWK from the BATON_PRIVATE_JWK environment variable.
// scripts/dev.mjs serves the same route locally from keys/, so development and
// the end-to-end run need no cloud function at all.
//
//   node scripts/keygen.mjs          # only fills sites that have no key yet
//   node scripts/keygen.mjs --force  # regenerate (invalidates every old signature)

import { webcrypto } from 'node:crypto';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEYS_DIR = join(ROOT, 'keys');
const force = process.argv.includes('--force');

const SITES = [
  { dir: 'rivera-press',  name: 'Rivera Press',  kid: 'rivera-2026-09', host: 'vercel',     project: 'baton-rivera-press' },
  { dir: 'norte-bindery', name: 'Norte Bindery', kid: 'norte-2026-09',  host: 'netlify',    project: 'baton-norte-bindery' },
  { dir: 'ruta-courier',  name: 'Ruta Courier',  kid: 'ruta-2026-09',   host: 'cloudflare', project: 'baton-ruta-courier' }
];

const secretCommand = (site) => site.host === 'vercel'
  ? 'vercel env add BATON_PRIVATE_JWK production'
  : site.host === 'netlify'
    ? 'netlify env:set BATON_PRIVATE_JWK "$(cat keys/' + site.dir + '.private.jwk.json)" --site <netlify site id> --context production'
    : 'wrangler pages secret put BATON_PRIVATE_JWK --project-name ' + site.project;

mkdirSync(KEYS_DIR, { recursive: true });
const touched = [];

for (const site of SITES) {
  const privPath = join(KEYS_DIR, site.dir + '.private.jwk.json');
  const pubPath = join(ROOT, 'sites', site.dir, '.well-known', 'baton', 'key.json');

  if (existsSync(privPath) && existsSync(pubPath) && !force) {
    console.log(`${site.dir}: key already in place, left alone (use --force to replace)`);
    continue;
  }

  const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
  const priv = await webcrypto.subtle.exportKey('jwk', pair.privateKey);

  const publicDoc = {
    kid: site.kid,
    site: site.name,
    alg: 'ES256',
    use: 'baton-leg-signature',
    created: new Date().toISOString().slice(0, 10),
    jwk: { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }
  };
  mkdirSync(dirname(pubPath), { recursive: true });
  writeFileSync(pubPath, JSON.stringify(publicDoc, null, 2) + '\n');

  // One line, so it pastes straight into a secret prompt.
  const privateJwk = { kty: priv.kty, crv: priv.crv, d: priv.d, x: priv.x, y: priv.y, kid: site.kid };
  writeFileSync(privPath, JSON.stringify(privateJwk) + '\n', { mode: 0o600 });

  console.log(`${site.dir}: new key ${site.kid} → sites/${site.dir}/.well-known/baton/key.json + keys/${site.dir}.private.jwk.json`);
  touched.push(site);
}

if (touched.length) {
  console.log('\nkeys/ is gitignored and never deploys. Give each host its own private JWK,');
  console.log('pasting the single line from the matching file in keys/ :\n');
  for (const site of touched) {
    console.log('  ' + site.name);
    console.log('    ' + secretCommand(site));
    console.log('    value: keys/' + site.dir + '.private.jwk.json');
  }
  console.log('\nWithout it /api/sign answers 500 in production. Locally, scripts/dev.mjs signs from keys/.');
}
