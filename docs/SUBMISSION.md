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
Nothing consequential happens behind my back either. Holding a press day, booking a van and signing a
leg each stop the agent and put a card on the page with the price on it. I tap Confirm, the page does the work,
and the agent picks the result up on its next call. After an afternoon of testing I did not want it
any other way.

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
so the mission-gated tools go away when the mission does. Consequential tools answer `pending` and
finish on a tap, because a tool call cannot stay open while a person decides. Signing happens in a
serverless function on each origin, so no private key is ever in a page. Three sites, three hosts,
three function runtimes, one identical request and response.

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

You need a browser with WebMCP: the ChatGPT desktop app's built-in browser, or Chrome 149 or newer
with `chrome://flags/#enable-webmcp-testing` enabled. Anywhere else the three sites are ordinary
websites and say so in a banner.

**Open the first link only.** Each site produces the link to the next one when its leg is signed.

1. On Rivera Press: *"Quote 40 prints of Cerro Signals at 20x30 on Photo Rag, open the order, and
   start a mission on it: 40 catalogues for the studio open week, $600 budget, deadline 2026-09-14."*
   The run is $380 and the page's tool list goes from 12 to 19.
2. *"Approve the proof, then hold the first free press day."* Tap Confirm on the page each time the
   card appears.
3. *"Sign the print leg and give me the link to the bindery."* Tap Confirm, then click the Carry link
   on the page.
4. On Norte Bindery: *"Quote a coptic binding with a cloth board for this baton."* It comes back $40
   over the budget, using a quantity nobody typed here.
5. *"Find a binding and cover that fit, hold the first free bench day, sign the leg, and give me the
   link to the courier."* Japanese stab with a light card wrap is $190. Tap Confirm twice, then click
   the Carry link.
6. On Ruta Courier: *"Price the last leg standard, book the collection and sign the leg."* $24. Tap
   Confirm twice.
7. *"Verify every signature on this baton."* Three legs verified against three origins, $594 of $600.

To reset, close the tab and open the first link again. Nothing is stored on a server: the mission
lives in the URL fragment and in `sessionStorage`.

Signatures prove which origin wrote which leg. They do not prove anyone was authorised, and agent
identity is not part of this. The keys in the demo are demo keys.
