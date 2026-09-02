// Ruta Courier — the signing function for this origin. Cloudflare Pages Function.
//
//   POST /api/sign   {"payload": "<canonical string>", "kid": "ruta-2026-09"}
//   → 200            {"sig": "<base64url r||s>", "kid": "ruta-2026-09"}
//
// The private key lives only here, in the BATON_PRIVATE_JWK secret (the JSON of
// the private JWK, one line). The public half is served from
// /.well-known/baton/key.json so any other site can check our signatures.
//
//   wrangler pages secret put BATON_PRIVATE_JWK --project-name baton-ruta-courier
//
// The bytes signed are exactly the bytes lib/baton.js would have signed in the
// browser: the canonical payload text, UTF-8, ECDSA P-256 with SHA-256, and the
// raw r||s signature encoded base64url. Nothing about verification changes.

const ALG = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN_ALG = { name: 'ECDSA', hash: { name: 'SHA-256' } };

const MAX_PAYLOAD_BYTES = 64 * 1024;

function b64u(buffer) {
  const bytes = new Uint8Array(buffer);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// CORS is deliberately narrow: the page that signs is the page served from this
// same origin, so no other origin needs to reach this function.
function corsHeaders(request, env) {
  const origin = env.BATON_SITE_ORIGIN || new URL(request.url).origin;
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
    'Cache-Control': 'no-store'
  };
}

const fail = (request, env, status, error) =>
  new Response(JSON.stringify({ error }), { status, headers: corsHeaders(request, env) });

export async function onRequestPost({ request, env }) {
  const raw = env.BATON_PRIVATE_JWK;
  if (!raw) {
    return fail(request, env, 500,
      'BATON_PRIVATE_JWK is not set on this deployment, so this site cannot sign a leg. ' +
      'Set it to the JSON of this site’s private JWK: wrangler pages secret put BATON_PRIVATE_JWK');
  }

  let jwk;
  try {
    jwk = JSON.parse(raw);
  } catch {
    return fail(request, env, 500, 'BATON_PRIVATE_JWK is set but is not valid JSON; it must be the private JWK object');
  }
  if (!jwk || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.d) {
    return fail(request, env, 500, 'BATON_PRIVATE_JWK is not a P-256 private JWK (needs kty "EC", crv "P-256" and d)');
  }

  let body = null;
  try {
    const text = await request.text();
    if (text.length > MAX_PAYLOAD_BYTES * 2) return fail(request, env, 413, 'request body is too large');
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  if (!body || typeof body.payload !== 'string' || !body.payload) {
    return fail(request, env, 400, 'send {"payload": "<canonical string>", "kid": "<key id>"}');
  }

  const bytes = new TextEncoder().encode(body.payload);
  if (bytes.length > MAX_PAYLOAD_BYTES) {
    return fail(request, env, 413, 'payload is larger than ' + MAX_PAYLOAD_BYTES + ' bytes');
  }

  const kid = jwk.kid || env.BATON_KID || null;
  if (body.kid && kid && body.kid !== kid) {
    return fail(request, env, 400, 'this site signs as ' + kid + ', not ' + body.kid);
  }

  try {
    const key = await crypto.subtle.importKey('jwk', jwk, ALG, false, ['sign']);
    const sig = await crypto.subtle.sign(SIGN_ALG, key, bytes);
    return new Response(JSON.stringify({ sig: b64u(sig), kid }), { status: 200, headers: corsHeaders(request, env) });
  } catch (err) {
    return fail(request, env, 500, 'signing failed: ' + ((err && err.message) || String(err)));
  }
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

// Anything but POST is refused, explicitly, on every other method.
const refuse = ({ request, env }) =>
  new Response(JSON.stringify({ error: 'this endpoint signs one payload per POST; ' + request.method + ' is not accepted' }), {
    status: 405,
    headers: { ...corsHeaders(request, env), Allow: 'POST, OPTIONS' }
  });

export const onRequestGet = refuse;
export const onRequestHead = refuse;
export const onRequestPut = refuse;
export const onRequestPatch = refuse;
export const onRequestDelete = refuse;
