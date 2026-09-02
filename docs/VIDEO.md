# Demo video script

Under three minutes. Recorded in the ChatGPT desktop app, with the built-in browser open beside the
chat, so the tools panel on the page and the agent's replies are visible in the same frame.

Target running time: 2:58. Every spoken line is written to be said in the seconds given. If a beat
runs long, cut words, not shots.

---

## 1. Cold open, on camera

**0:00 to 0:04 (4s)**

- **Screen:** Fernando on camera, no slide, no title card.
- **Types:** nothing.
- **Says:** "A print job goes through three companies. Your agent forgets it at the first one."

## 2. Rivera Press, the mission starts

**0:04 to 0:22 (18s)**

- **Screen:** Cut to the ChatGPT app. Chat on the left, Rivera Press open in the browser pane on the
  right. The page's tools panel shows 12 tools.
- **Types:** *"Quote 40 prints of Cerro Signals at 20x30 on Photo Rag, open the order, and start a
  mission on it: 40 catalogues for the studio open week, $600 budget, deadline 2026-09-14."*
- **Says:** "This is a print shop. It gives my agent twelve tools. I ask for forty prints and I put a
  budget and a deadline on the whole job. That job is now an object, and it is going to travel."
- **On screen to catch:** the quote at $380, and the mission panel appearing with 19 tools.

## 3. The person confirms, not the agent

**0:22 to 0:40 (18s)**

- **Types:** *"Approve the proof, then hold the first free press day."*
- **Does:** taps **Confirm** on the card in the page, twice, slowly enough to see.
- **Says:** "Anything that costs money or holds a day stops here. The card is on the page, with the
  price on it. I tap. The page does the work, and the agent reads the result on its next call."

## 4. Signing the print leg

**0:40 to 0:55 (15s)**

- **Types:** *"Sign the print leg and give me the link to the bindery."*
- **Does:** taps **Confirm**. The green chain strip appears. Then clicks **Carry this to bind**.
- **Says:** "The shop signs its leg with its own key, and hands me a link. Everything I have agreed
  so far is inside it."

## 5. Arriving at the bindery: 2 tools to 12

**0:55 to 1:12 (17s)**

- **Screen:** Norte Bindery loads, a different company on a different host. Hold on the tools panel
  for a full two seconds as it goes from 2 to 12.
- **Types:** nothing.
- **Says:** "This is a bindery. It has never seen this job. Cold, it offers an agent two tools. The
  mission arrives in the link, it checks it, and it turns on ten more. Only for this job."

## 6. The budget stops a quote

**1:12 to 1:30 (18s)**

- **Types:** *"Quote a coptic binding with a cloth board for this baton."*
- **Says:** "I never told this site how many copies. It read forty off the leg the printer signed.
  And it will not sell me this one. Two hundred and sixty dollars, forty over what is left."
- **On screen to catch:** `$260`, and the failure line naming the budget, `$40 over`.

## 7. The lighter cover fits

**1:30 to 1:48 (18s)**

- **Types:** *"Find a binding and cover that fit, hold the first free bench day, sign the leg, and
  give me the link to the courier."*
- **Does:** taps **Confirm** for the bench day, **Confirm** for the signature, then clicks the
  **Carry link**.
- **Says:** "Japanese stab with a light card wrap, one hundred and ninety. That fits. Two taps: one
  for the bench, one for the signature."

## 8. The courier leg

**1:48 to 2:08 (20s)**

- **Screen:** Ruta Courier, a third host. Tools panel again goes 2 to 12.
- **Types:** *"Price the last leg standard, book the collection and sign the leg."*
- **Does:** taps **Confirm** twice.
- **Says:** "Third company, third host. It works out the weight from the copies on the baton, picks
  up the day after the bindery finishes, and lands on the fourteenth. Twenty-four dollars."

## 9. Verifying the chain

**2:08 to 2:26 (18s)**

- **Types:** *"Verify every signature on this baton."*
- **Says:** "Now the last site checks the other two. It fetches each company's public key from that
  company's own domain and checks the signature it made. Three legs, all green. Five hundred and
  ninety-four dollars of six hundred."
- **On screen to catch:** the three green segments and `baton_verify` in the tool call.

## 10. Tampering with the link

**2:26 to 2:46 (20s)**

- **Screen:** Fernando clicks the small link under the legs on the page, "See what happens if
  someone raises the budget to $900 in the link". It opens the same mission with the budget
  rewritten. Nothing else is changed.
- **Types:** nothing in chat. One click.
- **Says:** "Here is the same job, with the budget raised in the link by hand. The page believes the
  number, because it is only a number. The signatures do not."
- **On screen to catch:** the chain strip going red, and the line saying the mission was edited after
  signing.

## 11. Close

**2:46 to 2:58 (12s)**

- **Screen:** back on the red chain, then a slow cut to Fernando on camera.
- **Says:** "The signatures prove which company wrote which part. They do not prove anyone had
  permission, and they never touch a server. And every step that costs money still waits for me."

---

## Recording checklist

**Windows and layout**

- ChatGPT desktop app at 1440 x 900 or larger, recorded at 1080p or better.
- Browser pane beside the chat, not behind it. Both visible in every screen beat.
- Browser pane wide enough that the tools panel count and the confirm card are readable without
  zooming. Check by watching the recording at 50% size before keeping it.
- macOS menu bar and dock hidden. Notifications off, Do Not Disturb on.
- Page theme: pick light or dark and keep it for all three sites.

**Before rolling**

- All three sites deployed and warm: open each one once so the first request is not a cold start.
- Nothing to prepare for beat 10: the tamper link is on the page under the legs once the chain is
  verified, and "Restore the signed copy" appears after it.
- The prompt text for beats 2, 3, 4, 6, 7, 8, 9 in a notes window, so nothing is typed wrong on
  camera. Paste, do not type live.
- The chat scrolled to the top of a fresh conversation.

**Resetting between takes**

- Close every tab for the three sites, then open Rivera Press again. That clears `sessionStorage`,
  which is where the mission and each shop's state live.
- Nothing lives on a server, so there is nothing else to reset.
- If a press day or bench day was held in an earlier take, the diary shows it as taken for the rest
  of that session. Reset the tabs and pick the first free day again.

**Sound and captions**

- No music. Room tone only, speaking straight into the microphone.
- Captions burned in, and the tool names spelled correctly when they appear on screen:
  `baton_start`, `baton_check`, `baton_complete_leg`, `baton_mint`, `baton_verify`,
  `quote_binding_for_mission`, `reserve_press_slot`, `book_collection`.
- Caption the two numbers people need to read: `$260, $40 over` at beat 6 and `$594 of $600` at
  beat 9.
- No stingers, no zoom effects, no lower thirds beyond the captions.
