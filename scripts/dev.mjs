#!/usr/bin/env node
// Three static servers on three ports, so the three sites are three real origins
// during development: 4181 Rivera Press, 4182 Norte Bindery, 4183 Ruta Courier.
//
//   node scripts/dev.mjs
//
// Two things beyond serving files:
//
//   /.well-known/*  is served with Access-Control-Allow-Origin: * , the same rule
//                   the production host configs set, so verifyChain() can fetch
//                   each site's public key across origins.
//
//   POST /api/sign  stands in for the site's serverless signing function. It
//                   signs with keys/<site>.private.jwk.json and answers exactly
//                   what the deployed function answers, so nothing about local
//                   development or the end-to-end run needs the cloud.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// BATON_PORTS lets a second copy of the tree run alongside the first, e.g.
//   BATON_PORTS=4281,4282,4283 node scripts/dev.mjs
const PORTS = (process.env.BATON_PORTS || '4181,4182,4183').split(',').map((n) => Number(n.trim()));

const SITES = [
  { port: PORTS[0], dir: 'rivera-press', name: 'Rivera Press' },
  { port: PORTS[1], dir: 'norte-bindery', name: 'Norte Bindery' },
  { port: PORTS[2], dir: 'ruta-courier', name: 'Ruta Courier' }
];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

const ALG = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN_ALG = { name: 'ECDSA', hash: { name: 'SHA-256' } };
const MAX_PAYLOAD_BYTES = 64 * 1024;

/* --------------------------------------------------------- local signing */

const keyCache = new Map(); // site dir -> private JWK

async function privateJwkFor(dir) {
  if (keyCache.has(dir)) return keyCache.get(dir);
  const path = join(ROOT, 'keys', dir + '.private.jwk.json');
  const jwk = JSON.parse(await readFile(path, 'utf8'));
  keyCache.set(dir, jwk);
  return jwk;
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > MAX_PAYLOAD_BYTES * 2) { req.destroy(); resolve(null); }
    });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}

async function handleSign(site, req, res, origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
    'Cache-Control': 'no-store'
  };
  const send = (status, body) => { res.writeHead(status, headers); res.end(JSON.stringify(body)); };

  if (req.method === 'OPTIONS') { res.writeHead(204, headers); res.end(); return; }
  if (req.method !== 'POST') {
    res.writeHead(405, { ...headers, Allow: 'POST, OPTIONS' });
    res.end(JSON.stringify({ error: 'this endpoint signs one payload per POST; ' + req.method + ' is not accepted' }));
    return;
  }

  let jwk;
  try {
    jwk = await privateJwkFor(site.dir);
  } catch {
    send(500, { error: 'keys/' + site.dir + '.private.jwk.json is missing. Run: node scripts/keygen.mjs' });
    return;
  }

  const body = await readJsonBody(req);
  if (!body || typeof body.payload !== 'string' || !body.payload) {
    send(400, { error: 'send {"payload": "<canonical string>", "kid": "<key id>"}' });
    return;
  }
  if (Buffer.byteLength(body.payload, 'utf8') > MAX_PAYLOAD_BYTES) {
    send(413, { error: 'payload is larger than ' + MAX_PAYLOAD_BYTES + ' bytes' });
    return;
  }
  if (body.kid && jwk.kid && body.kid !== jwk.kid) {
    send(400, { error: 'this site signs as ' + jwk.kid + ', not ' + body.kid });
    return;
  }

  try {
    const key = await webcrypto.subtle.importKey('jwk', jwk, ALG, false, ['sign']);
    const sig = await webcrypto.subtle.sign(SIGN_ALG, key, Buffer.from(body.payload, 'utf8'));
    send(200, { sig: Buffer.from(sig).toString('base64url'), kid: jwk.kid || null });
  } catch (err) {
    send(500, { error: 'signing failed: ' + ((err && err.message) || String(err)) });
  }
}

/* ------------------------------------------------------------- the server */

function serve(site) {
  const base = join(ROOT, 'sites', site.dir);
  const origin = 'http://localhost:' + site.port;

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, origin);
    let pathname = decodeURIComponent(url.pathname);

    if (pathname === '/api/sign') { await handleSign(site, req, res, origin); return; }

    if (pathname.endsWith('/')) pathname += 'index.html';
    const rel = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    const file = join(base, rel);

    const headers = { 'Cache-Control': 'no-store' };
    if (pathname.startsWith('/.well-known/')) {
      headers['Access-Control-Allow-Origin'] = '*';
      headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    }
    if (req.method === 'OPTIONS') { res.writeHead(204, headers); res.end(); return; }

    try {
      const info = await stat(file);
      if (info.isDirectory()) throw new Error('is a directory');
      const body = await readFile(file);
      headers['Content-Type'] = TYPES[extname(file)] || 'application/octet-stream';
      res.writeHead(200, headers);
      res.end(body);
    } catch {
      res.writeHead(404, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 ' + pathname);
    }
  });

  server.listen(site.port, () => {
    console.log(`${site.name.padEnd(16)} ${origin}/   (POST ${origin}/api/sign signs from keys/${site.dir}.private.jwk.json)`);
  });
  return server;
}

const servers = SITES.map(serve);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { servers.forEach((s) => s.close()); process.exit(0); });
}
