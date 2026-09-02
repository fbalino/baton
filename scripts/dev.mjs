#!/usr/bin/env node
// Three static servers on three ports, so the three sites are three real origins
// during development: 4181 Rivera Press, 4182 Norte Bindery, 4183 Ruta Courier.
//
//   node scripts/dev.mjs
//
// /.well-known/* is served with Access-Control-Allow-Origin: * , the same rule the
// production host configs set, so verifyChain() can fetch each site's public key.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SITES = [
  { port: 4181, dir: 'rivera-press', name: 'Rivera Press' },
  { port: 4182, dir: 'norte-bindery', name: 'Norte Bindery' },
  { port: 4183, dir: 'ruta-courier', name: 'Ruta Courier' }
];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function serve(site) {
  const base = join(ROOT, 'sites', site.dir);
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
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
    console.log(`${site.name.padEnd(16)} http://localhost:${site.port}/`);
  });
  return server;
}

const servers = SITES.map(serve);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { servers.forEach((s) => s.close()); process.exit(0); });
}
