// Rivera Press — the signing function for this origin. Vercel Node function.
//
//   POST /api/sign   {"payload": "<canonical string>", "kid": "rivera-2026-09"}
//   → 200            {"sig": "<base64url r||s>", "kid": "rivera-2026-09"}
//
// The private key lives only here, in the BATON_PRIVATE_JWK environment
// variable (the JSON of the private JWK, one line). The public half is served
// from /.well-known/baton/key.json so any other site can check our signatures.
//
//   vercel env add BATON_PRIVATE_JWK production
//
// The bytes signed are exactly the bytes lib/baton.js would have signed in the
// browser: the canonical payload text, UTF-8, ECDSA P-256 with SHA-256, and the
// raw r||s signature encoded base64url. Nothing about verification changes.

import { webcrypto } from 'node:crypto';

const ALG = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN_ALG = { name: 'ECDSA', hash: { name: 'SHA-256' } };

const MAX_PAYLOAD_BYTES = 64 * 1024;

// This site's own origin. CORS is deliberately narrow: the page that signs is
// the page served from here, so no other origin needs to reach this function.
function selfOrigin(req) {
  if (process.env.BATON_SITE_ORIGIN) return process.env.BATON_SITE_ORIGIN;
  const first = (v) => String(v || '').split(',')[0].trim();
  const proto = first(req.headers['x-forwarded-proto']) || 'https';
  const host = first(req.headers['x-forwarded-host']) || first(req.headers.host);
  return host ? proto + '://' + host : '';
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_PAYLOAD_BYTES) return null;
  }
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default async function handler(req, res) {
  const origin = selfOrigin(req);
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ error: 'this endpoint signs one payload per POST; ' + req.method + ' is not accepted' });
    return;
  }

  const raw = process.env.BATON_PRIVATE_JWK;
  if (!raw) {
    res.status(500).json({
      error: 'BATON_PRIVATE_JWK is not set on this deployment, so this site cannot sign a leg. ' +
        'Set it to the JSON of this site\'s private JWK: vercel env add BATON_PRIVATE_JWK'
    });
    return;
  }

  let jwk;
  try {
    jwk = JSON.parse(raw);
  } catch {
    res.status(500).json({ error: 'BATON_PRIVATE_JWK is set but is not valid JSON; it must be the private JWK object' });
    return;
  }
  if (!jwk || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.d) {
    res.status(500).json({ error: 'BATON_PRIVATE_JWK is not a P-256 private JWK (needs kty "EC", crv "P-256" and d)' });
    return;
  }

  const body = await readBody(req);
  if (!body || typeof body.payload !== 'string' || !body.payload) {
    res.status(400).json({ error: 'send {"payload": "<canonical string>", "kid": "<key id>"}' });
    return;
  }
  if (Buffer.byteLength(body.payload, 'utf8') > MAX_PAYLOAD_BYTES) {
    res.status(413).json({ error: 'payload is larger than ' + MAX_PAYLOAD_BYTES + ' bytes' });
    return;
  }

  const kid = jwk.kid || process.env.BATON_KID || null;
  if (body.kid && kid && body.kid !== kid) {
    res.status(400).json({ error: 'this site signs as ' + kid + ', not ' + body.kid });
    return;
  }

  try {
    const key = await webcrypto.subtle.importKey('jwk', jwk, ALG, false, ['sign']);
    const sig = await webcrypto.subtle.sign(SIGN_ALG, key, Buffer.from(body.payload, 'utf8'));
    res.status(200).json({ sig: Buffer.from(sig).toString('base64url'), kid });
  } catch (err) {
    res.status(500).json({ error: 'signing failed: ' + ((err && err.message) || String(err)) });
  }
}
