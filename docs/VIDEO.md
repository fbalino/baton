# Demo video script

Under three minutes. Recorded in the ChatGPT desktop app, with the built-in browser open beside the
chat, so the page's sidebar and the agent's replies are in the same frame.

Target running time: 2:56. Three prompts, three taps, and a browser that moves itself between the
companies. Every spoken line is written to be said in the seconds given. If a beat runs long, cut
words, not shots.

---

## 1. Cold open, on camera

**0:00 to 0:06 (6s)**

- **Screen:** Fernando on camera, no slide, no title card.
- **Types:** nothing.
- **Says:** "A print job goes through three companies. Your agent forgets it at the first one. This
  is three prompts and three taps."

## 2. Rivera Press, the whole print leg in one turn

**0:06 to 0:34 (28s)**

- **Screen:** Cut to the ChatGPT app. Chat on the left, Rivera Press open in the browser pane on the
  right. The page's tools panel shows 12 tools.
- **Pastes:**

  ```text
  @Browser Use the site tools on this page. Quote 40 prints of Cerro Signals at 20x30 on Photo Rag, open the order, approve the proof, hold the first free press day, and start a mission on it: 40 catalogues for the studio open week, $600 budget, deadline 2026-09-14. Then sign the print leg and carry it to the bindery.
  ```

- **Says:** "One message. The shop quotes the run, opens the order, approves the proof and holds a
  press day without stopping once, because none of that costs anything yet. Watch the sidebar keep
  score while it works."
- **On screen to catch:** the quote at $380, the tool list going 12 to 19 as the mission lands, and
  the progress line under "this site":
  `Order RP-1042 · proof approved · press day 3 Sep held · ready to sign`.

## 3. One tap, and the browser leaves

**0:34 to 0:50 (16s)**

- **Screen:** the confirm card on the page, with the leg and the price on it.
- **Does:** taps **Confirm** once, slowly enough to see.
- **Says:** "The signature is the money, so the signature waits for me. One tap. The shop signs with
  its own key, and then the page takes itself to the bindery with the job in the link."
- **On screen to catch:** the progress line clearing, the first chain segment going green, and the
  browser navigating on its own.

## 4. Arriving at the bindery: 2 tools to 12

**0:50 to 1:06 (16s)**

- **Screen:** Norte Bindery, a different company on a different host. Hold on the tools panel for two
  full seconds as the chips arrive, 2 to 12.
- **Types:** nothing.
- **Says:** "A bindery that has never seen this job. Cold, it offers an agent two tools. The mission
  arrives in the link, it checks the signature, and it turns on ten more. Only for this job."

## 5. The budget stops a quote, and the agent finds one that fits

**1:06 to 1:34 (28s)**

- **Pastes:**

  ```text
  @Browser Use the site tools on this page. Quote a coptic binding with a cloth board for this baton and check it against the budget; if it does not fit, find a binding and cover that do, hold the first free bench day, sign the leg, and carry it to the courier.
  ```

- **Says:** "I never told this site how many copies. It read forty off the leg the printer signed.
  Coptic and cloth is two hundred and sixty, forty over what is left, so it takes Japanese stab with
  a light card wrap at one hundred and ninety and holds a bench."
- **On screen to catch:** `$260` with the line naming the budget, `$40 over`, then `$190`, and the
  progress line filling in under "this site".

## 6. The second tap

**1:34 to 1:48 (14s)**

- **Does:** taps **Confirm** once.
- **Says:** "Second company, second tap. Same rule: the hold was free, the signature is not."
- **On screen to catch:** the second chain segment going green, then the browser moving to the
  courier by itself.

## 7. The courier leg and the check on the other two

**1:48 to 2:20 (32s)**

- **Screen:** Ruta Courier, a third host. Tools panel again goes 2 to 12.
- **Pastes:**

  ```text
  @Browser Use the site tools on this page. Price the last leg standard, book the collection, sign the leg, and verify every signature on the baton.
  ```

- **Does:** taps **Confirm** once.
- **Says:** "Third company, third host, third tap. It works out the weight from the copies on the
  baton, collects the day after the bindery finishes, and lands inside the deadline. Then it fetches
  each company's public key from that company's own domain and checks the two signatures made before
  it. Three legs. Five hundred and ninety-four dollars of six hundred."
- **On screen to catch:** `$24`, the three green segments, and `baton_verify` in the tool call.

## 8. Tampering with the link, and back

**2:20 to 2:42 (22s)**

- **Screen:** Fernando clicks the small link under the legs, "See what happens if someone raises the
  budget to $900 in the link". It opens the same mission with the budget rewritten and nothing else
  touched. Then he clicks "Restore the signed copy".
- **Types:** nothing in chat. Two clicks.
- **Says:** "Here is the same job with the budget raised in the link by hand. The page believes the
  number, because it is only a number. The signatures do not. And here is the signed copy back."
- **On screen to catch:** the chain strip going red, the line saying the mission was edited after
  signing, then all three green again.

## 9. Close

**2:42 to 2:56 (14s)**

- **Screen:** back on the green chain, then a slow cut to Fernando on camera.
- **Says:** "The signatures prove which company wrote which part. They do not prove anyone had
  permission, and they never touch a server. Everything that costs money still waits for me."

---

## Recording checklist

**Windows and layout**

- ChatGPT desktop app at 1440 x 900 or larger, recorded at 1080p or better.
- Browser pane beside the chat, not behind it. Both visible in every screen beat.
- Browser pane wide enough that the tools panel count, the progress line under "this site" and the
  confirm card are readable without zooming. Check by watching the recording at 50% size before
  keeping it.
- The arrow in the browser pane's address bar in frame, so the tool list and its blue running state
  are visible.
- macOS menu bar and dock hidden. Notifications off, Do Not Disturb on.
- Page theme: pick light or dark and keep it for all three sites.

**Before rolling**

- All three sites deployed and warm: open each one once so the first request is not a cold start.
- The three prompts in a notes window, `@Browser` prefix included, and pasted rather than typed.
- Nothing to prepare for beat 8: the tamper link is on the page under the legs once the chain is
  verified, and "Restore the signed copy" appears after it.
- The chat scrolled to the top of a fresh conversation.
- Do not touch the browser after each Confirm. The page navigates itself a second and a half later,
  and that is the shot.

**Resetting between takes**

- Close every tab for the three sites, then open Rivera Press again. That clears `sessionStorage`,
  which is where the mission, the progress line and each shop's state live.
- Nothing lives on a server, so there is nothing else to reset.
- If a press day or bench day was held in an earlier take, the diary shows it as taken for the rest
  of that session. Reset the tabs and pick the first free day again.

**Sound and captions**

- No music. Room tone only, speaking straight into the microphone.
- Captions burned in, and the tool names spelled correctly when they appear on screen:
  `baton_start`, `baton_check`, `baton_complete_leg`, `baton_mint`, `baton_verify`,
  `quote_binding_for_mission`, `reserve_press_slot`, `book_collection`.
- Caption the three numbers people need to read: `$380` at beat 2, `$260, $40 over` at beat 5, and
  `$594 of $600` at beat 7.
- No stingers, no zoom effects, no lower thirds beyond the captions.

---

## Recorded from Chrome

A version of the same nine beats for a recording made without the ChatGPT app. Chrome 152 with
`chrome://flags/#enable-webmcp-testing` enabled and the browser restarted; the page registers the
same tools, so the beats, the money and the taps are identical.

What changes:

- **The page is the whole frame.** There is no chat pane, so the sidebar carries the story: the tools
  box, the mission panel with the route, the debug line under it, and the confirm card.
- **The prompts drop the `@Browser` prefix.** Give the same three sentences to whichever agent is
  driving the tools in Chrome. For a scripted take, run `node scripts/dev.mjs` and then
  `node scripts/e2e.mjs` with `headless` set to `false` in its launch options: it fires the same
  calls in the same order against the three local origins, taps Confirm on the page for the two
  signatures, and ends on the tamper.
- **Tool calls are read off the page, not the chat.** The chips arrive one at a time as tools
  register, so the 2 to 12 jump at the bindery and the courier reads as a sequence. Hold on it.
- **The debug line under the panel names each step as it happens**, including
  `carrying the mission to ... the page moves in 1.5s` just before the browser leaves. It is the
  clearest on-screen proof that the page moves itself.

What to catch in each beat, in order: the tools box at 12 on Rivera and the progress line building
under "this site"; one confirm card and the first segment going green; the chips arriving 2 to 12 at
the bindery; `$260` refused against the budget and `$190` held; the second card; the courier's three
green segments and `$594 of $600`; the chain going red on the tampered link and green again on
"Restore the signed copy".

The scripted take runs on `localhost:4181`, `4182` and `4183` rather than the three public hosts. If
the recording is meant to show three separate companies, use the deployed sites and drive them by
hand.
