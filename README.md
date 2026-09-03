# Baton

Almost every real job crosses several companies' websites. Printing forty catalogues means a print
shop, then a bindery, then a courier. Today, the moment a person's agent leaves the first site it
forgets the job: the budget, the deadline, what was already agreed. The person types it all again on
the next site, and the third company cannot check what the first two did.

Baton makes the job itself a small, signed, human-readable object called a mission, and the mission
travels with the person in the link. It carries the operator's own standing instructions, in the
operator's words, so a website that has never seen the task reads both the job and the rules on
arrival, checks them against its own house terms, and registers only the WebMCP tools that leg needs.
Norte Bindery hands an agent 2 tools on an ordinary visit and 12 when a mission arrives. Each site
signs its leg with a key held in a serverless function on its own origin and publishes the public
half at `/.well-known/baton/key.json`, so any later site can verify who wrote what. Editing the budget
in the link breaks every signature. The job is described once, on the first site. After that each leg
runs in one turn: the agent reads its brief off the baton, quotes, orders and holds without stopping,
the person taps Confirm once for the signature, and the page carries the mission to the next site
itself.

Baton is a convention with a reference implementation. It is not a standard.

## What it is

Three fictional businesses on three different hosts. They share no database, no login and no session.

| Site | Leg | Host | Live |
| --- | --- | --- | --- |
| Rivera Press | print | Vercel | https://baton-rivera-press.vercel.app |
| Norte Bindery | bind | Netlify | https://baton-norte-bindery.netlify.app |
| Ruta Courier | deliver | Cloudflare Pages | https://baton-ruta-courier.pages.dev |

**Open the first link only, and say the job once.** When a leg is signed the page produces the link
to the next site and the browser follows it by itself. Your instructions travel in the mission, so
the site you land on reads what you want instead of asking you for it again. The whole demo is one
prompt and three taps.

Typed into the ChatGPT desktop app, with the built-in browser open beside the chat and pointed at
Rivera Press:

```text
@Browser Use the site tools on this page. Print and bind 40 catalogues for the studio open week, delivered by 2026-09-14, budget $600. Instructions for every stop: fit the budget, keep the deadline, take the cheaper option when one does not fit, hold the first free day, and sign each leg after my tap. Start with 40 prints of Cerro Signals at 20x30 on Photo Rag, then carry the baton through the bindery and the courier.
```

With nothing else typed, here is what happens.

1. **Rivera Press.** The agent quotes the run at $380, opens the order, approves the proof and holds
   the first free press day without stopping once, because none of that costs anything until the leg
   is signed. It calls `baton_start` with the goal, the budget, the deadline and your instructions in
   your own words, and the page's tool list goes from 12 to 19 as the mission lands. The sidebar
   prints the instructions under "Instructions for every stop" and keeps a line under "this site"
   while the leg is built: `Order RP-1042 · proof approved · press day 3 Sep held · ready to sign`.
   Then the confirm card comes up, saying what is being signed and for how much. **Tap Confirm
   once.** The line clears, the leg turns green, and the page carries the mission to the bindery by
   itself; the agent does not have to call anything.

2. **Norte Bindery**, a site that has never seen this job. Nothing is typed here. The agent calls
   `baton_inspect`, reads the brief for this stop, and works from it. It quotes coptic binding with a
   cloth board at $260, which is $40 over what is left of the $600, so it takes Japanese stab with a
   light card wrap at $190, because the instructions say to take the cheaper option when one does not
   fit. It never asks how many copies there are: it reads 40 and the money left off the signed print
   leg. It holds the first free bench day and asks for the signature. **Tap Confirm once.** The leg
   is signed and the page moves to the courier by itself.

3. **Ruta Courier.** Nothing is typed here either. The agent reads its brief, prices the last leg
   standard at $24, and books the collection that lands inside the 14 September deadline, the working
   day after the bindery finishes. **Tap Confirm once.** Then it verifies the chain, checking all
   three signatures against the origins that made them: three legs verified, $594 of the $600 budget.

To break the chain, click the small link under the legs, "See what happens if someone raises the
budget to $900 in the link". It opens a copy of the same mission with `budget_usd` rewritten and
nothing else touched. Every leg goes red, because the mission header, instructions included, is
signed into all of them, and a "Restore the signed copy" link brings the real one back.
`node scripts/e2e.mjs` does the same edit by hand at the end of its run.

**If the agent pauses after the page changes.** In the ChatGPT desktop browser a navigation can end
the agent's turn. If it stops after the browser has moved to the next site, type `continue` and
nothing else. The brief on the page tells it which leg it is on and what that leg needs, so the job
never has to be described twice.

## How to test

Two browsers implement WebMCP today.

- **The ChatGPT desktop app's built-in browser** (GPT-5.6 Sol or Terra). Open it with Cmd+Shift+B
  beside the chat and navigate it to the first link. The tools each page registers become the agent's
  tools.
- **Chrome 149 or newer**, with `chrome://flags/#enable-webmcp-testing` enabled and the browser
  restarted. Tested on Chrome 152.

In any other browser the three sites are ordinary websites, and each says so in a banner.

**Point the agent at the page.** Testing in the ChatGPT desktop app on 2 September 2026 showed the
model answers from the chat unless the prompt sends it to the browser, so the prompt starts with
`@Browser` and the sentence "Use the site tools on this page". The arrow in the browser pane's
address bar lists the tools the page has registered, and it turns blue while a tool is running, which
is how you can see the work happening on the site.

**Resetting.** The mission lives in `sessionStorage` under `baton.mission` on each origin, and each
shop keeps its own state under its own key. Close the tab and open the first link again. Nothing is
stored on any server, so there is nothing else to clear. A plain reload keeps the mission that is
further along, so refreshing never loses a leg you just signed.

**Confirmations.** One tap per site. Only `baton_complete_leg`, the signature, which is also the
money, and `baton_decline` stop for a person. Holds and bookings apply the moment the agent asks for
them and are provisional until the leg is signed, so `create_order`, `update_order`, `approve_proof`,
`reserve_print_slot`, `reserve_press_slot` and `book_collection` answer with their result straight
away. Nothing is charged before the signature, and Rivera's house terms release a held press day if
the leg is not signed within 48 hours. For the two tools that do stop: a tool call cannot stay open
while a person decides, and in the ChatGPT browser `client.requestUserInteraction` exists but fails
when called. So the tool answers `pending` at once, the page shows the confirm card with what is
being signed and for how much, the person taps Confirm, the page applies the action, and the agent
reads the result on its next call with the same input. Baton tries `requestUserInteraction` first and
falls back to this path, so it works either way.

**The instructions ride along.** `baton_start` takes an optional `instructions` string, up to 400
characters, kept in the operator's words. It goes into the mission header, which is signed into every
leg, so no site can quietly change the rules it was given, and the sidebar shows it on every stop
under "Instructions for every stop".

**The brief on every site.** `baton_inspect` answers with a `brief` written for the stop the agent is
standing on: which leg this is, the goal, the instructions, the budget, what is spent, what is left,
the deadline and the days to it, the quantity, and what the earlier legs did. `this_stop_must` is the
exact sequence this site needs, `then_next` is what follows the signature, and the brief carries one
rule: do not ask the operator to repeat the job, the baton carries it, ask only when the instructions
cannot be met. The same "This stop" text is printed in the sidebar, so an agent that reads the page
rather than the tool result gets it too.

**Every result says what to do next.** Each tool result carries a `next` sentence, so the agent
finishes a leg in one turn instead of stopping to ask. `baton_mint` returns the link, shows the
"Carry this to ..." link on the page for a person, and moves the browser to the next site itself a
second and a half later; its `next` tells the agent to carry on there on its own, by calling
`baton_inspect`, reading `brief.this_stop_must` and doing it. Pass `stay: true` to get the link
without moving. On the last leg it returns `done: true` and nothing to carry.

**The leg while it is being built.** Each site writes a short line under its own row in the sidebar
as it works: the order it opened, the proof it approved, the day it is holding. The line is cleared
when the leg is signed and the signed summary takes over.

## What people and agents do together that was hard before

- **You say the job once.** Every company on the route reads your instructions off the baton and
  carries on without asking. The second and third sites are worked with nothing typed into the chat.
- **A site quotes against a budget it was never told.** Norte Bindery reads 40 copies and $220
  remaining off the signed print leg, and answers "$40 over" instead of "how many copies?".
- **A site knows what to do with that answer.** The instructions say to take the cheaper option when
  one does not fit, so the bindery drops to $190 by itself rather than coming back to ask.
- **The third company can check the first two.** Ruta Courier verifies both earlier signatures
  against the origins that made them before adding its own.
- **The person signs the money, once per site.** The agent quotes, orders and holds without
  stopping, because a hold costs nothing until the leg is signed. The signature is the one thing
  that waits for a tap, on a card that says what is being signed and for how much.
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
  "instructions": "Fit the budget, keep the deadline, take the cheaper option when one does not fit, hold the first free day, and sign each leg after my tap.",
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

The header covers `goal`, `instructions` and `constraints`, and every leg signs it, so a site cannot
loosen the rules it was handed without breaking the chain.

## The tools of each site

Kind is the `readOnlyHint` annotation each tool publishes. "Common" marks the tools that
`lib/baton.js` gives every site. Every result carries a `next` sentence telling the agent what to
do now, and only the two tools marked "Confirm on the page" stop for a person.

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
| `approve_proof` | write | always | Approve the proof so a press day can be held. Applies at once |
| `list_press_days` | read | always | Twenty-one days of press time |
| `reserve_print_slot` | write | always | Hold a press day. Applies at once, released if the leg is not signed within 48 hours |
| `baton_start` | write | always | Start a mission here: goal, constraints, route, and the operator's standing `instructions` in their own words, up to 400 characters |
| `baton_inspect` | read | mission, common | The whole mission, plus a `brief` for this stop: instructions, money, deadline, what earlier legs did, `this_stop_must` and `then_next` |
| `baton_check` | read | mission, common | Test a cost or a date against the constraints |
| `baton_verify` | read | mission, common | Re-check every leg against the origin that signed it |
| `baton_complete_leg` | write | mission, common | Sign this site's leg. Confirm on the page |
| `baton_mint` | write | mission, common | Produce the link to the next stop, take the browser there, and tell the agent to carry on |
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
| `reserve_press_slot` | write | mission | Hold a bench day. Applies at once, stands until the leg is signed |

Plus the six common baton tools listed in the Rivera table, on the same terms.

**Ruta Courier.** 2 tools cold, 12 with a mission aboard.

| Tool | Kind | When | What it does |
| --- | --- | --- | --- |
| `baton_house_terms` | read | always, common | Delivery legs only, inside the listed zones |
| `service_areas` | read | always | Three zones, two speeds, cut-offs and transit |
| `quote_delivery_for_mission` | read | mission | Weight, parcels, cost and dates for the copies aboard |
| `pickup_windows` | read | mission | Collection windows still open on a day |
| `book_collection` | write | mission | Book the van. Applies at once, stands until the leg is signed |
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
  stopBrief: 'Quote the binding for the copies on the baton, check the price against the money ' +
    'left, take a cheaper binding or cover if it does not fit, hold the first free bench day, ' +
    'then call baton_complete_leg.',
  panel: document.getElementById('mission-panel'),
  toolsBox: document.getElementById('site-tools')
});
// mountBaton reads #baton=..., validates it, verifies every signed leg against the
// origin that signed it, and registers baton_house_terms straight away. The six
// common baton tools register themselves as soon as a mission is aboard.
```

`stopBrief` is the one thing a site writes for the arriving agent. The library puts it into
`brief.this_stop_must` in every `baton_inspect` result, alongside the operator's instructions, the
money and the deadline, and prints the same sentence in the sidebar under "This stop". Nothing else
needs to be said to the agent when it lands.

```js
baton.registerWhenMissionAboard((signal, register) => {
  register({
    name: 'reserve_press_slot',
    description: 'Hold a bench day for the binding already quoted. The hold applies straight ' +
      'away and stands until the leg is signed; nothing is charged before that.',
    inputSchema: { type: 'object', properties: { date: { type: 'string' } }, required: ['date'] },
    annotations: { readOnlyHint: false },
    execute: async (input) => {
      const day = benchDay(input.date);
      if (day.state !== 'open') {
        return {
          ok: false,
          error: 'both benches are taken on ' + input.date,
          nearest_free_days: nearestFreeDays(input.date),
          next: 'Pick one of the nearest free days and call reserve_press_slot again.'
        };
      }

      hold(input.date);                    // applies now: no card, no second call, no waiting
      baton.setLegStatus(quote.copies + ' copies · ' + quote.binding_name.toLowerCase() +
        ' · bench ' + input.date + ' held until the leg is signed · ready to sign');

      return {
        ok: true,
        held: true,
        holds_until: 'the leg is signed',
        evidence: { bench_date: input.date, copies: quote.copies, cost_usd: quote.cost_usd },
        next: 'Bench day held. Call baton_complete_leg with this evidence and cost_usd ' +
          quote.cost_usd + '; the operator taps Confirm once on the page.'
      };
    }
  }, signal);
});
```

`baton.setLegStatus(line)` writes that short sentence under this site's row in the sidebar, so a
person watching the panel sees the leg being assembled before anything is signed. The library clears
it the moment the leg is signed and the signed summary takes over.

`baton.confirmAndApply` is reserved for signatures. Only `baton_complete_leg`, which is also the
money, and `baton_decline` use it. It answers `{ status: 'pending' }` on the first call and puts the
card up, runs `apply()` when the person taps Confirm, and hands the stored result back when the agent
calls again with the same input; `baton.peekConfirm` reads that stored result before any guard runs.

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
  anyone who can see the link or the screen. Nothing private belongs in it, instructions included.
- The keys here are demo keys. Earlier commits in this repository carried demo keys inside the pages;
  no page signs in the browser now.
- The chain covers the header and every leg, so changing the budget or the instructions breaks all
  three signatures and the page says so. It does not stop anyone from discarding the chain and
  starting a fresh mission.

## What this does not solve

Baton is three websites I built, agreeing on one small convention. The obvious question is whether
it only works because the sites know each other, so here is the plain answer.

- **The sites share a document format, not code.** At run time they share no database, no login, no
  session and no server. Each one reads the mission out of the link, checks the earlier signatures
  against the other origins' published keys, and registers its own tools under its own names. The
  bindery does not know what the printer's tools are called and does not need to. What the three do
  share is the shape of the mission, the rule for signing a leg, and the habit of publishing a public
  key at `/.well-known/baton/key.json`. That is the same kind of agreement that makes a calendar
  invite open in any calendar. Today only three sites have made it.
- **The route is written in advance.** The first site puts the bindery's and the courier's addresses
  into the mission. A real agent would have to find a bindery on its own, and neither WebMCP nor
  Baton says anything about how an agent discovers which sites offer tools.
- **An agent already remembers.** The conversation is the agent's memory, so "the agent forgets the
  job between sites" is the weaker argument for Baton. The stronger one is what the agent's memory
  cannot do. The bindery can check that the printer really signed for 40 copies at $380 without
  taking the agent's word for it. The link outlives the conversation and can be handed to another
  person or another agent. And the site itself knows the mission, which is why ten tools appear
  only when a signed baton is aboard.
- **Signatures prove authorship, not authority.** See the trust model above: a leg proves which
  origin wrote it, against which header, and nothing about who was allowed to.
- **The agent has to be pointed at the page.** In the ChatGPT desktop browser the model answered from
  chat until the prompt said `@Browser` and "use the site tools on this page", and a navigation can
  end its turn. That is the state of the clients, not of the pages, but it is what a person meets
  today.
- **The money is invented and the keys are demo keys.**

## Where WebMCP is, and where I think it goes

Checked on 3 September 2026. My own knowledge of the protocol stops in June 2026, so the facts
below come from the sources linked, not from memory.

**Where it is.**

- WebMCP is a [Draft Community Group Report](https://webmachinelearning.github.io/webmcp/) of the
  W3C Web Machine Learning Community Group, dated 2 September 2026, edited by people from Microsoft
  and Google. It is not on the standards track. It grew out of
  [MCP-B](https://www.arcade.dev/blog/web-mcp-alex-nahas-interview/), Alex Nahas's browser-side MCP,
  which merged into the proposal in early 2026.
- The API that shipped is the imperative one this repo uses, `document.modelContext.registerTool`,
  renamed from `navigator.modelContext` around 10 August 2026. The declarative form, HTML attributes
  on a `<form>`, is still an
  [explainer](https://github.com/webmachinelearning/webmcp/blob/main/declarative-api-explainer.md)
  with open questions about schemas and responses.
- Chrome runs an origin trial from Chrome 149 to 156 and exposes the API locally behind
  `chrome://flags/#enable-webmcp-testing`; Edge runs its own trial in Edge 150; Brave has it in Leo.
  Firefox and Safari have open, unresolved
  [standards-position](https://github.com/mozilla/standards-positions/issues/1412)
  [issues](https://github.com/WebKit/standards-positions/issues/670). See the
  [implementation status](https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md).
- The ChatGPT desktop app's built-in browser [reads site tools](https://learn.chatgpt.com/docs/webmcp)
  from the top-level page only, imperative API only, with GPT-5.6 Sol or Terra, and treats tool
  definitions and results as untrusted content.
- There is no discovery in the spec. Nothing tells an agent which sites have tools; third-party
  directories such as those listed in
  [awesome-webmcp](https://github.com/webmachinelearning/awesome-webmcp) are filling the gap. Tools
  are scoped to their origin. Nothing in the spec or next to it signs or verifies what a site did
  for a person; Cloudflare's
  [Web Bot Auth](https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth/)
  signs agent traffic, which is a different problem.
- Chrome's own [security guidance](https://developer.chrome.com/docs/ai/webmcp/secure-tools) exists
  because prompt injection through tool descriptions and results is real and unsolved; the
  `readOnlyHint` and `untrustedContentHint` annotations are the current answer.

**Where I think it goes.** The first wins will be single sites with forms: checkouts, bookings,
dashboards, anything where driving the page by clicking is fragile and a declared tool is
reliable. The quiet advantage is that the browser already holds the person's logins, so an agent
can act on a site as that person without anyone issuing API keys. The next layer, which the spec
does not have, is work that crosses sites: how an agent finds the next site, how the job travels,
and how the third site can trust what the first two did without a shared backend. Baton is a
sketch of that layer, made of things that already exist: a JSON object in a link, a key file at a
well-known path, and a signature per leg. If the protocol grows a `.well-known` for agents, a signed
receipt for what a tool did, and a way to hand a task from one origin to another, then the three
sites here are what a print shop, a bindery and a courier would look like the day after.

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
`e2e.mjs` needs `puppeteer-core` and walks all three legs, asserts that every hold applies on the
first call and that only the signature takes two calls with a tap between them, verifies the chain,
then raises the budget inside the fragment and asserts all three legs go red. Deployment is per
folder: `config.js` holds the three origins, and each host needs `BATON_PRIVATE_JWK` set to the
single line in the matching `keys/` file.

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
