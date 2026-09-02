# Devpost submission text

Paste-ready copy for the OpenAI WebMCP Challenge form.

## Project name

Baton

## Tagline

The job travels with the person, in the link, signed by every website that touches it.

## Description

### Why this use case is a strong fit for WebMCP

I have run jobs like this for real: a print shop, a bindery and a courier, three companies that have
never spoken to each other and never will. Nobody is going to build a shared API across those three,
and nobody should have to. What each of them already has is a website. WebMCP lets each website hand
my agent the few tools its own part of the job needs, on its own origin, under its own rules, with no
integration between them at all. That is exactly the shape of this problem. The bindery does not need
to know what the printer charges. It needs to know how many copies there are and how much money is
left, and it needs to be able to check that the printer really said so.

### How it creates a better user experience

The thing I hate about doing this by hand is repeating myself. Quantity, deadline, budget, whatever
the last shop already agreed, typed again at every stop, and then held together in my head. With
Baton the job rides in the link. I open the bindery, and the bindery already knows it is 40 copies
with $220 left and a 14 September deadline, because it read that off a leg the printer signed. When a
binding does not fit, it tells me it is $40 over instead of quoting me something I cannot afford.
The whole leg runs in one go now. The agent quotes, opens the order, approves the proof and holds the
day without stopping, because none of that costs anything until the leg is signed. The signature is
where it waits for me: one card on the page, saying what is being signed and for how much, and I tap
Confirm once per company. Then the page takes itself to the next site with the job in the link. Three
prompts and three taps for a job that used to be three conversations.

### What people and agents can do together that was difficult or impossible before

A website that has never seen my job can now act on it correctly the moment I arrive. That is the
part I could not do before. The tools panel on the bindery goes from 2 tools to 12 as the mission
lands, and those ten only exist while it is aboard. The courier, the third company in the chain, can
check the printer's and the bindery's signatures against public keys those companies publish
themselves, so the last stop can satisfy itself about the first two without phoning anyone. And if
someone edits the budget in the link to make a job fit, every signature breaks and the page turns
red. I could always describe a job to an agent. I could not hand a stranger's website something it
was able to verify.

### How WebMCP was implemented

Each page registers its tools with `document.modelContext.registerTool`. One small shared library
mounts on all three sites: it reads the mission out of the URL fragment, validates it, verifies every
signed leg against the public key at that origin's `/.well-known/baton/key.json`, and registers six
common tools, with each site adding its own on top. Registration is grouped under AbortControllers,
so the mission-gated tools go away when the mission does. Every result carries a `next` sentence, so
the agent runs a whole leg in one turn, and the page carries the mission to the following site
itself once the leg is signed. One tool stops for a person, the signature, because a tool call
cannot stay open while someone decides: it answers `pending`, the page shows the card, and the
page applies the work on the tap. Signing happens in a serverless function on each origin, so no
private key is ever in a page. Three sites, three hosts, three function runtimes, one identical
request and response.

I am not a programmer. I built this with coding agents and tested every step by hand in the ChatGPT
browser and in Chrome, which is the same kind of collaboration this challenge is about.

## Built with

webmcp, javascript, html, css, web-crypto-api, ecdsa-p256, json, serverless, vercel, netlify,
cloudflare-pages, node.js, puppeteer, chatgpt

## Try it out

- Rivera Press (print, on Vercel): https://baton-rivera-press.vercel.app
- Norte Bindery (bind, on Netlify): https://baton-norte-bindery.netlify.app
- Ruta Courier (deliver, on Cloudflare Pages): https://baton-ruta-courier.pages.dev
- Source: https://github.com/fbalino/baton

## Testing instructions for judges

You need a browser with WebMCP: the ChatGPT desktop app's built-in browser (GPT-5.6 Sol or Terra),
or Chrome 149 or newer with `chrome://flags/#enable-webmcp-testing` enabled. Anywhere else the three
sites are ordinary websites and say so in a banner.

In the ChatGPT desktop app, open the built-in browser with Cmd+Shift+B and put it on the first link.
Start every prompt with `@Browser`, and keep the sentence "Use the site tools on this page" in it:
testing on 2 September 2026 showed the model answers from the chat unless the prompt sends it to the
browser. The arrow in the browser pane's address bar lists the tools the page has registered, and it
turns blue while a tool is running.

**Open the first link only.** When a leg is signed the browser takes itself to the next site. Three
prompts, three taps.

1. On Rivera Press, paste:

   ```text
   @Browser Use the site tools on this page. Quote 40 prints of Cerro Signals at 20x30 on Photo Rag, open the order, approve the proof, hold the first free press day, and start a mission on it: 40 catalogues for the studio open week, $600 budget, deadline 2026-09-14. Then sign the print leg and carry it to the bindery.
   ```

   The run is $380 and the page's tool list goes from 12 to 19. Nothing stops the agent while it
   quotes, orders, approves and holds, because all of that is provisional until the leg is signed.
   The sidebar shows the leg being assembled:
   `Order RP-1042 · proof approved · press day 3 Sep held · ready to sign`. Then one confirm card,
   for the signature and the money. **Tap Confirm once.** The browser goes to the bindery on its own.

2. On Norte Bindery, a site that has never seen this job, paste:

   ```text
   @Browser Use the site tools on this page. Quote a coptic binding with a cloth board for this baton and check it against the budget; if it does not fit, find a binding and cover that do, hold the first free bench day, sign the leg, and carry it to the courier.
   ```

   Coptic with a cloth board is $260, which it reports as $40 over, using a quantity nobody typed
   here. It takes Japanese stab with a light card wrap at $190 instead and holds a bench day. **Tap
   Confirm once.** The browser goes to the courier.

3. On Ruta Courier, paste:

   ```text
   @Browser Use the site tools on this page. Price the last leg standard, book the collection, sign the leg, and verify every signature on the baton.
   ```

   Standard is $24, collected the working day after the bindery finishes and landing inside the
   deadline. **Tap Confirm once.** Then three legs are verified against three origins, $594 of $600.

Under the legs there is a link, "See what happens if someone raises the budget to $900 in the link".
One click opens the same mission with the budget rewritten and every signature turns red. "Restore
the signed copy" brings the real one back.

To reset, close the tab and open the first link again. Nothing is stored on a server: the mission
lives in the URL fragment and in `sessionStorage`.

Signatures prove which origin wrote which leg. They do not prove anyone was authorised, and agent
identity is not part of this. The keys in the demo are demo keys.
