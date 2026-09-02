# Baton

A job travels with a person across three websites that have never heard of each other.
Each site grows exactly the tools its leg of the job needs, and signs what it did.

Three fictional businesses, three separate hosts:

| Site | Role | Local port |
| --- | --- | --- |
| Rivera Press | print — missions start here | 4181 |
| Norte Bindery | bind | 4182 |
| Ruta Courier | deliver | 4183 |

The mission travels in the URL fragment (`#baton=<base64url JSON>`), so nothing is
stored on a server and nothing leaves the browser. Each site signs its leg with an
ECDSA P-256 key and publishes the public half at `/.well-known/baton/key.json`, so
any site can check the whole chain. Editing the budget in the link breaks every
signature, and the page says so.

## Run it locally

```bash
node scripts/dev.mjs        # three origins: 4181, 4182, 4183
node scripts/e2e.mjs        # full run in Chrome with WebMCP, screenshots + assertions
```

`scripts/e2e.mjs` needs `puppeteer-core`; it resolves it from the harness directory
(override with `BATON_SHOT_DIR`).

## Browsers

Tools only appear in a browser that implements WebMCP: the ChatGPT desktop app's
built-in browser, or Chrome 152+ launched with `--enable-features=WebMCP`. Anywhere
else the pages are ordinary websites and say so in a banner.

Verified in Chrome 152 on 2026-09-02: `execute(input, client)` is called with
`client === undefined`, so `client.requestUserInteraction()` does not exist yet.
Confirmation therefore falls back to a card in the page, with a 25-second window
after which the tool returns `{ status: 'pending' }` and tells the agent to ask the
operator to click Confirm and call again. Both paths are logged on the page's debug
line. `document.modelContext.executeTool()` returns the JSON string of whatever
`execute` returned, so every tool here returns a compact plain object.

## Deploying

Each folder under `sites/` deploys on its own, to a different host, with nothing
above it in the tree — that is the point of the demo. `scripts/sync-lib.sh` copies
`lib/baton.js` and `lib/style.css` into each site folder; run it after editing `lib/`.

Per site, `config.js` is the only file to edit: put the three real origins in
`PROD_HOSTS`. `vercel.json` (Vercel) and `_headers` (Netlify and Cloudflare Pages
both read it) set `Access-Control-Allow-Origin: *` on `/.well-known/*` so the
signature check can fetch each site's public key cross-origin.

## Keys

```bash
node scripts/keygen.mjs           # fills any site that has no key yet
node scripts/keygen.mjs --force   # regenerate (invalidates existing signatures)
```

The private key sits in each site's `site.js` between the `DEMO KEY` markers. That
is fine for this demo and nothing else: in a real deployment signing happens in a
serverless function on that origin and the private key never ships to the browser.

## Layout

```
lib/baton.js          mission model, transport, signing, verification, mountBaton()
lib/style.css         one stylesheet, one accent colour per site
sites/<site>/         index.html, site.js, config.js + synced baton.js, style.css
sites/<site>/.well-known/baton/key.json    published public key
scripts/dev.mjs       three static servers on three ports
scripts/keygen.mjs    key generation
scripts/sync-lib.sh   lib → sites
scripts/e2e.mjs       the whole demo, asserted, in a real browser
```

MIT licensed.
