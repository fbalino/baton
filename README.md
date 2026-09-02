# Baton

Almost every real job crosses several companies' websites. Printing forty catalogues means a print
shop, then a bindery, then a courier. Today, the moment a person's agent leaves the first site it
forgets the job: the budget, the deadline, what was already agreed. The person types it all again on
the next site, and the third company cannot check what the first two did.

Baton makes the job itself a small, signed, human-readable object called a mission, and the mission
travels with the person in the link. A website that has never seen the task reads it on arrival,
checks it against its own house terms, and registers only the WebMCP tools that leg needs. Norte
Bindery hands an agent 2 tools on an ordinary visit and 12 when a mission arrives. Each site signs
its leg with a key held in a serverless function on its own origin and publishes the public half at
`/.well-known/baton/key.json`, so any later site can verify who wrote what. Editing the budget in the
link breaks every signature.

Baton is a convention with a reference implementation. It is not a standard.

## What it is

Three fictional businesses on three different hosts. They share no database, no login and no session.

| Site | Leg | Host | Live |
| --- | --- | --- | --- |
| Rivera Press | print | Vercel | https://baton-rivera-press.vercel.app |
| Norte Bindery | bind | Netlify | https://baton-norte-bindery.netlify.app |
| Ruta Courier | deliver | Cloudflare Pages | https://baton-ruta-courier.pages.dev |

**Open the first link only.** When a leg is signed the page produces the link to the next site, and
following that link is the demo.

The walkthrough, typed into the ChatGPT desktop app with its built-in browser open beside the chat:

1. **Rivera Press.** Type: *"Quote 40 prints of Cerro Signals at 20x30 on Photo Rag, open the order,
   and start a mission on it: 40 catalogues for the studio open week, $600 budget, deadline
   2026-09-14."*
   The run is $380. The page's tool list goes from 12 to 19 as the mission lands.
2. Type: *"Approve the proof, then hold the first free press day."*
   A confirm card appears on the page. **Tap Confirm** twice, once for the proof and once for the
   press day. Each tool answers `pending`, the page does the work on the tap, and the agent reads the
   result on its next call.
3. Type: *"Sign the print leg and give me the link to the bindery."*
   **Tap Confirm** for the signature, then **click the Carry this to bind link** on the page.
4. **Norte Bindery**, a site that has never seen this job. Type: *"Quote a coptic binding with a
   cloth board for this baton."*
   $260 against the $220 left, so the tool says it is $40 over the $600 budget. The bindery never
   asks how many copies there are; it reads 40 off the signed print leg.
5. Type: *"Find a binding and cover that fit, hold the first free bench day, sign the leg, and give
   me the link to the courier."*
   Japanese stab with a light card wrap is $190. **Tap Confirm** for the bench day, **Confirm** for
   the signature, then **click the Carry link**.
6. **Ruta Courier.** Type: *"Price the last leg standard, book the collection and sign the leg."*
   Standard is $24, collected the working day after the bindery finishes and landing two days later.
   In the recorded run that is a 12 September pickup arriving 14 September, the deadline.
   **Tap Confirm** twice.
7. Type: *"Verify every signature on this baton."*
   Three legs, each checked against the public key published by the origin that signed it. $594 of
   the $600 budget.

To break the chain by hand, decode the `#baton=` fragment, raise `budget_usd`, re-encode it and open
that link. Every leg goes red, because the mission header is signed into all of them.
`node scripts/e2e.mjs` does this at the end of its run.

## How to test

Two browsers implement WebMCP today.

- **The ChatGPT desktop app's built-in browser** (GPT-5.6 Sol or Terra). Open the browser pane beside
  the chat and navigate it to the first link. The tools each page registers become the agent's tools.
- **Chrome 149 or newer**, with `chrome://flags/#enable-webmcp-testing` enabled and the browser
  restarted. Tested on Chrome 152.

In any other browser the three sites are ordinary websites, and each says so in a banner.

**Resetting.** The mission lives in `sessionStorage` under `baton.mission` on each origin, and each
shop keeps its own state under its own key. Close the tab and open the first link again. Nothing is
stored on any server, so there is nothing else to clear. A plain reload keeps the mission that is
further along, so refreshing never loses a leg you just signed.

**Confirmations.** In the ChatGPT browser `client.requestUserInteraction` exists but fails when
called, and a tool call cannot stay open while a person decides. So every consequential tool answers
`pending` at once, the page shows the confirm card, the person taps Confirm, the page applies the
action, and the agent reads the result on its next call with the same input. Baton tries
`requestUserInteraction` first and falls back to this path, so it works either way.

## What people and agents do together that was hard before

- **A site quotes against a budget it was never told.** Norte Bindery reads 40 copies and $220
  remaining off the signed print leg, and answers "$40 over" instead of "how many copies?".
- **The third company can check the first two.** Ruta Courier verifies both earlier signatures
  against the origins that made them before adding its own.
- **The person keeps every consequential step.** Holding a press day, booking a van and signing a leg
  each stop for a tap on the page, next to the price.
- **The job survives the hop between companies**, so the agent's memory of it no longer has to.
- **Every business keeps its own rules.** No shared backend, no shared login, no shared vocabulary
  beyond the mission object.

## Why WebMCP rather than a chat integration or a backend server

A chat integration would need each business to build and publish an API, and each agent to hold
credentials for all three. A backend server would need three companies to hand one operator the job,
the budget and the route. Baton needs neither. The pages register the tools themselves, on the
origins that own the work, so a site can offer exactly what its leg needs and withdraw those tools
the moment the mission leaves. The person is already in the browser, already looking at the price,
already the one who taps Confirm.

## The mission object

```jsonc
{
  "v": 1,
  "id": "bt_k3f9x1a2",
  "goal": "Print and bind 40 catalogues for the studio open week",
  "constraints": { "budget_usd": 600, "deadline": "2026-09-14", "quantity": 40 },
  "route": [                                    // written once, by the site that starts the mission
    { "role": "print",   "url": "https://baton-rivera-press.vercel.app/" },
    { "role": "bind",    "url": "https://baton-norte-bindery.netlify.app/" },
    { "role": "deliver", "url": "https://baton-ruta-courier.pages.dev/" }
  ],
  "spent_usd": 380,                             // always the sum of the legs, checked on verify
  "legs": [                                     // one entry per site that finished its leg
    {
      "index": 0,
      "origin": "https://baton-rivera-press.vercel.app",
      "role": "print",
      "summary": "40 prints, 20x30, Photo Rag, matte, press day 11 September",
      "cost_usd": 380,
      "evidence": { "order_id": "RP-1042", "press_date": "2026-09-11" },
      "completed_at": "2026-09-03T10:22:04.118Z",
      "kid": "rivera-2026-09",                  // which published key checks this leg
      "sig": "MEUCIQ..."                        // over the header, this leg, and the previous sig
    }
  ],
  "declined": []                                // a site that turned a leg down, with its reason
}
```

## The tools of each site

Kind is the `readOnlyHint` annotation each tool publishes. "Common" marks the tools that
`lib/baton.js` gives every site.

**Rivera Press.** 12 tools cold, 19 with a mission aboard.

| Tool | Kind | When | What it does |
| --- | --- | --- | --- |
| `baton_house_terms` | read | always, common | What this site will take on, and what it needs declared |
| `list_sets` | read | always | The six editioned print sets and their prices |
| `list_papers` | read | always | Four papers, three finishes, the press setup rule |
| `search_catalog` | read | always | Search sets and papers by word, and filter the page |
| `quote_run` | read | always | Price a run and show it in the order builder |
| `create_order` | write | always | Open an order and issue its proof |
| `get_order` | read | always | Read one order, its proof and its press slot |
| `update_order` | write | always | Change the specification and requote |
| `approve_proof` | write | always | Approve the proof. Confirm on the page |
| `list_press_days` | read | always | Twenty-one days of press time |
| `reserve_print_slot` | write | always | Hold a press day. Confirm on the page |
| `baton_start` | write | always | Start a mission here and set the route |
| `baton_inspect` | read | mission, common | The whole mission: constraints, legs, money, days left |
| `baton_check` | read | mission, common | Test a cost or a date against the constraints |
| `baton_verify` | read | mission, common | Re-check every leg against the origin that signed it |
| `baton_complete_leg` | write | mission, common | Sign this site's leg. Confirm on the page |
| `baton_mint` | write | mission, common | Produce the link to the next stop |
| `baton_decline` | write | mission, common | Record a refusal, with the reason. Confirm on the page |
| `prepare_print_leg` | read | mission | Assemble the summary, cost and evidence for the signature |

**Norte Bindery.** 2 tools cold, 12 with a mission aboard.

| Tool | Kind | When | What it does |
| --- | --- | --- | --- |
| `baton_house_terms` | read | always, common | Binding legs only, 10 to 500 copies |
| `about_bindery` | read | always | Benches, capacity, what it will sign |
| `list_bindings` | read | mission | Three bindings, two covers, per copy |
| `quote_binding_for_mission` | read | mission | Price for the copies on the baton, checked against the budget |
| `bench_availability` | read | mission | The bench diary, three weeks ahead |
| `reserve_press_slot` | write | mission | Hold a bench day. Confirm on the page |

Plus the six common baton tools listed in the Rivera table, on the same terms.

**Ruta Courier.** 2 tools cold, 12 with a mission aboard.

| Tool | Kind | When | What it does |
| --- | --- | --- | --- |
| `baton_house_terms` | read | always, common | Delivery legs only, inside the listed zones |
| `service_areas` | read | always | Three zones, two speeds, cut-offs and transit |
| `quote_delivery_for_mission` | read | mission | Weight, parcels, cost and dates for the copies aboard |
| `pickup_windows` | read | mission | Collection windows still open on a day |
| `book_collection` | write | mission | Book the van. Confirm on the page |
| `track_parcel` | read | mission | Status and checkpoints for a tracking id |

Plus the six common baton tools, again on the same terms.

## How a site adopts the convention

```js
import { mountBaton } from './baton.js';

const baton = mountBaton({
  siteName: 'Norte Bindery',
  role: 'bind',                      // the leg this site is allowed to sign
  kid: 'norte-2026-09',              // the key id published at /.well-known/baton/key.json
  houseTerms: { accepts_roles: ['bind'], min_quantity: 10, max_quantity: 500 },
  panel: document.getElementById('mission-panel'),
  toolsBox: document.getElementById('site-tools')
});
// mountBaton reads #baton=..., validates it, verifies every signed leg against the
// origin that signed it, and registers baton_house_terms straight away. The six
// common baton tools register themselves as soon as a mission is aboard.

baton.registerWhenMissionAboard((signal, register) => {
  register({
    name: 'reserve_press_slot',
    description: 'Hold a bench day for the binding already quoted.',
    inputSchema: { type: 'object', properties: { date: { type: 'string' } }, required: ['date'] },
    annotations: { readOnlyHint: false },
    execute: async (input, client) => {
      const seen = baton.peekConfirm('reserve_press_slot', input);   // read the answer first
      if (seen.status === 'confirmed') return { ok: true, ...seen.result };

      const outcome = await baton.confirmAndApply({
        toolName: 'reserve_press_slot', input, client,
        message: 'Norte Bindery: hold Bench 1 on ' + input.date + '?',
        apply: () => { hold(input.date); return { evidence: { bench_date: input.date } }; }
      });
      // Call 1 returns { status: 'pending' } and puts the card up. The person taps
      // Confirm and the page runs apply(). Call 2 with the same input reads the result.
      return outcome.status === 'confirmed' ? { ok: true, ...outcome.result } : { ok: false, ...outcome };
    }
  }, signal);
});
```

Two files complete the adoption. `/.well-known/baton/key.json` publishes `{ kid, alg: "ES256", jwk }`
with `Access-Control-Allow-Origin: *`, so any other site can fetch it. `POST /api/sign` on the same
origin reads the private JWK from the `BATON_PRIVATE_JWK` environment variable, signs the canonical
payload, and returns `{ sig, kid }`. The repository has that function written three times, once per
host, and the browser cannot tell them apart.

## Trust model and its limits

A leg's signature proves that the origin holding that key wrote that summary, that cost and that
evidence, against that exact mission header, after that exact previous signature. That is all it
proves.

- It does not prove anyone was authorised. There is no identity for the person and none for the
  agent. Agent identity is not part of this.
- It does not prove the work will happen. It proves who said it would.
- Keys are fetched over TLS from each origin. Trust in a key is trust in that origin's certificate
  and DNS. There is no registry and no revocation.
- The mission travels in the URL fragment, so no server ever receives it. It is also visible to
  anyone who can see the link or the screen. Nothing private belongs in it.
- The keys here are demo keys. Earlier commits in this repository carried demo keys inside the pages;
  no page signs in the browser now.
- The chain covers the header and every leg, so changing the budget breaks all three signatures and
  the page says so. It does not stop anyone from discarding the chain and starting a fresh mission.

## Architecture

Static pages, three hosts, one serverless signing function per origin, no database, no accounts.

- **Transport.** The mission is JSON, base64url, in the URL fragment (`#baton=...`). Fragments are
  never sent to a server.
- **Persistence.** `sessionStorage` per origin, so a reload keeps the leg that origin signed.
- **Signing.** The page POSTs the canonical payload to `/api/sign` on its own origin. The function
  signs ECDSA P-256 with SHA-256 and returns the raw `r||s` signature, base64url. Rivera runs a
  Vercel function, Norte a Netlify function, Ruta a Cloudflare Pages function.
- **Verification.** Any page fetches `/.well-known/baton/key.json` from each leg's origin and checks
  the signature in the browser with Web Crypto.
- **Canonical JSON.** Keys sorted, `undefined` dropped, so every site hashes identical bytes.
- **Tools.** `document.modelContext.registerTool` with an `AbortController` per group, so the
  mission-gated tools disappear when the mission does.

## Running locally

```bash
node scripts/keygen.mjs     # one P-256 pair per site: public into the site, private into keys/
node scripts/dev.mjs        # three origins on 4181, 4182, 4183, plus a local /api/sign
node scripts/e2e.mjs        # the whole demo asserted in a throwaway Chrome with WebMCP
bash scripts/sync-lib.sh    # copy lib/ into each site folder after editing it
```

`keygen.mjs` leaves existing keys alone; `--force` regenerates and invalidates every old signature.
`e2e.mjs` needs `puppeteer-core` and walks all three legs, asserts the two-call shape of every
confirmation, verifies the chain, then raises the budget inside the fragment and asserts all three
legs go red. Deployment is per folder: `config.js` holds the three origins, and each host needs
`BATON_PRIVATE_JWK` set to the single line in the matching `keys/` file.

## Repo layout

```
lib/baton.js            mission model, fragment transport, signing, verification, mountBaton()
lib/baton-panel.css     the mission panel and tools box, identical on all three sites
sites/<site>/           index.html, site.js (its own tools), data.js (its prices), config.js
sites/<site>/.well-known/baton/key.json          the published public key
sites/rivera-press/api/sign.js                   Vercel signing function
sites/norte-bindery/netlify/functions/sign.mjs   Netlify signing function
sites/ruta-courier/functions/api/sign.js         Cloudflare Pages signing function
keys/                   private JWKs, gitignored, never deployed
scripts/                dev.mjs, keygen.mjs, sync-lib.sh, e2e.mjs
```

## License

MIT. See `LICENSE`.
