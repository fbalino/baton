// Norte Bindery — leg signing on Netlify Functions.
// The private key lives only in the BATON_PRIVATE_JWK environment variable on
// this site; the browser posts the canonical payload and gets a signature back.
// The public half is published at /.well-known/baton/key.json.
export const config = { path: '/api/sign' };

const enc = new TextEncoder();
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const json = (body, status, headers) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

export default async (req) => {
  const origin = new URL(req.url).origin;
  const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Cache-Control': 'no-store' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, cors);
  const raw = process.env.BATON_PRIVATE_JWK;
  if (!raw) return json({ error: 'BATON_PRIVATE_JWK is not set on this site, so it cannot sign legs.' }, 500, cors);
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Body must be JSON: { payload, kid }' }, 400, cors); }
  if (typeof body?.payload !== 'string' || body.payload.length === 0) return json({ error: 'payload must be a non-empty string' }, 400, cors);
  let jwk;
  try { jwk = JSON.parse(raw); } catch { return json({ error: 'BATON_PRIVATE_JWK is not valid JSON' }, 500, cors); }
  if (body.kid && jwk.kid && body.kid !== jwk.kid) return json({ error: 'kid mismatch; this origin signs as ' + jwk.kid }, 400, cors);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(body.payload));
  return json({ sig: b64url(sig), kid: jwk.kid }, 200, cors);
};
