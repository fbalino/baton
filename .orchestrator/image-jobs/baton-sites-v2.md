---
schema_version: 1
job_id: baton-sites-v2
project_root: /Users/fernandobalino/Projects/baton
controller: claude-code
created_by: claude-code
created_at: 2026-09-03T03:50:00Z
status: ready
output_root: sites
---

# Image Generation Manifest

## Shared visual direction

Photographs for the websites of three fictional Montevideo businesses: Rivera Press (a fine-art print studio), Norte Bindery (a hand bookbindery) and Ruta Courier (a city courier). Photorealistic, natural or practical light, honest colour, a little film grain, no HDR gloss, no stock-photo look, no render look.

Hard exclusions for every image: no text, lettering, numbers, logos, monograms, signage, labels, stickers or watermarks anywhere, including on clothing, bags, boxes, book covers, spines, walls and vehicles. No faces: people, when present, are seen from behind or only as hands.

Two kinds of reference are used:

1. A website mockup. Reproduce ONLY the photograph that appears inside that mockup, as a standalone full-frame photo with the same subject, light, palette and mood. Leave out every piece of interface that overlays it in the mockup: headings, cards, buttons, lines, icons, navigation. Where the mockup crops the photo, extend the scene naturally to fill the requested frame.
2. An artwork file. Reproduce that artwork faithfully — same composition, colours, proportions and grain — as a physical printed sheet. Do not restyle, recolour or reinterpret the artwork.

Read each reference from the absolute path given before generating. Say in your result, for each image, whether the reference was used.

## Image: press-hero

- **ID:** press-hero
- **Purpose:** Rivera Press hero photograph, right side of the hero, bleeds to the top and right edges of the page
- **Output path:** `sites/rivera-press/assets/generated/v2/press-hero.png`
- **File format:** png
- **Dimensions/aspect:** 1536x1024, 3:2 landscape
- **Required:** true
- **References:**
  - `/Users/fernandobalino/Projects/baton/.orchestrator/references/mockup-rivera-press.png`

### Prompt

Only the photograph in the top-right of the reference mockup, as a full-frame photo: a printmaker's two hands, in a dark apron, lifting a large deckle-edged sheet of thick white cotton paper off a worktable, revealing beneath it a freshly printed black-and-white photographic print of a rocky shoreline on another white sheet. Ink tins and a printing plate on the table, a window with soft daylight behind, warm grey-beige palette, matte surfaces, visible paper texture. Eye-level, slightly above the table, 50mm look, gentle depth of field. No text, no faces, no interface elements of any kind.

### Integration notes

- Displayed at about 760 by 340 with object-fit cover on the right half of the hero; keep the hands and the sheet in the centre-right, with a quieter left third that can crop away on phones.
- No overlay text on the photo.

### Acceptance criteria

- File exists at the exact output path, png, 1536x1024.
- Matches the mockup's photo in subject, light and palette; contains none of the mockup's interface.
- No text, logos or faces.

## Image: bindery-hero

- **ID:** bindery-hero
- **Purpose:** Norte Bindery hero photograph, the whole hero background with a cream text card sitting over its left third
- **Output path:** `sites/norte-bindery/assets/generated/v2/bindery-hero.png`
- **File format:** png
- **Dimensions/aspect:** 1536x1024, 3:2 landscape
- **Required:** true
- **References:**
  - `/Users/fernandobalino/Projects/baton/.orchestrator/references/mockup-norte-bindery.png`

### Prompt

Only the photograph behind the cream card in the reference mockup, as a full-frame photo: a bookbinder's hand pulling waxed linen thread through the sewn spine of a thick text block clamped on a dark wooden sewing frame; on the bench below, marbled papers in blue, red and cream, a closed burgundy leather book with a plain blank cover, a brass awl and a spool of thread. Warm low tungsten light from the right, deep shadows, navy and gold tones, dark wood. Close, slightly above the bench, 50mm look, shallow depth of field. No monogram, lettering or gilt marks on any book. No faces, no text, no interface elements.

### Integration notes

- Displayed at about 1400 by 360 with object-fit cover across the whole hero; a cream card with the headline sits over the left third, so keep that third darker and quieter and put the hand and thread in the right two thirds.
- No overlay text on the photo.

### Acceptance criteria

- File exists at the exact output path, png, 1536x1024.
- Matches the mockup's photo in subject, light and palette; contains none of the mockup's interface.
- No text, monograms, logos or faces.

## Image: courier-hero

- **ID:** courier-hero
- **Purpose:** Ruta Courier hero photograph, right side of the hero with a diagonal cut on its left edge
- **Output path:** `sites/ruta-courier/assets/generated/v2/courier-hero.png`
- **File format:** png
- **Dimensions/aspect:** 1536x1024, 3:2 landscape
- **Required:** true
- **References:**
  - `/Users/fernandobalino/Projects/baton/.orchestrator/references/mockup-ruta-courier.png`

### Prompt

Only the photograph in the reference mockup, as a full-frame photo: a courier in a plain red windbreaker, seen from behind, riding a cargo bicycle with a canvas cargo box on the rear rack down a sunlit Montevideo avenue lined with trees and old ochre and cream buildings, a tall ornate stone tower in the distance, golden-hour light from the front-left, long shadows, warm cobbles. Documentary look, 35mm, natural colour. The jacket, the box, the walls and the street carry no lettering, stickers or logos; there are no licence plates, no signs and no faces. No interface elements.

### Integration notes

- Displayed at about 820 by 360 with object-fit cover on the right side of the hero; the left edge is cut diagonally by the page, so keep the rider and the box in the right two thirds and the left third as street and trees.
- No overlay text on the photo.

### Acceptance criteria

- File exists at the exact output path, png, 1536x1024.
- Matches the mockup's photo in subject, light and palette; contains none of the mockup's interface.
- No text, plates, logos or faces.

## Image: set-cerro-signals

- **ID:** set-cerro-signals
- **Purpose:** The "Cerro Signals" print set card
- **Output path:** `sites/rivera-press/assets/generated/v2/set-cerro-signals.png`
- **File format:** png
- **Dimensions/aspect:** 1024x1280, 4:5 portrait
- **Required:** true
- **References:**
  - `/Users/fernandobalino/Projects/baton/.orchestrator/references/art-cerro-signals.png`

### Prompt

The reference artwork, reproduced faithfully, printed as a pigment print on a sheet of thick matte white cotton paper with an even white border, lying flat on a pale wooden studio table, photographed from directly above with a slight angle in soft north daylight. Faint paper texture, a soft shadow along the sheet's edge. Same image, same colours, same proportions as the reference; do not restyle it. The print fills most of the frame with a little table visible around it. No hands, no other objects, no text.

### Integration notes

- 4:5 card image in a grid of six, object-fit cover.

### Acceptance criteria

- File exists at the exact output path, png, 1024x1280.
- The artwork is recognisably the reference; it reads as a physical print on paper; no text.

## Image: set-rambla-nocturne

- **ID:** set-rambla-nocturne
- **Purpose:** The "Rambla Nocturne" print set card
- **Output path:** `sites/rivera-press/assets/generated/v2/set-rambla-nocturne.png`
- **File format:** png
- **Dimensions/aspect:** 1024x1280, 4:5 portrait
- **Required:** true
- **References:**
  - `/Users/fernandobalino/Projects/baton/.orchestrator/references/art-rambla-nocturne.png`

### Prompt

The reference artwork, reproduced faithfully, printed as a pigment print on a sheet of thick matte white cotton paper with an even white border, lying flat on a pale wooden studio table, photographed from directly above with a slight angle in soft north daylight. Faint paper texture, a soft shadow along the sheet's edge. Same image, same colours, same proportions as the reference; do not restyle it. The print fills most of the frame with a little table visible around it. No hands, no other objects, no text.

### Integration notes

- 4:5 card image in a grid of six, object-fit cover.

### Acceptance criteria

- File exists at the exact output path, png, 1024x1280.
- The artwork is recognisably the reference; it reads as a physical print on paper; no text.

## Image: set-salt-field

- **ID:** set-salt-field
- **Purpose:** The "Salt Field" print set card
- **Output path:** `sites/rivera-press/assets/generated/v2/set-salt-field.png`
- **File format:** png
- **Dimensions/aspect:** 1024x1280, 4:5 portrait
- **Required:** true
- **References:**
  - `/Users/fernandobalino/Projects/baton/.orchestrator/references/art-salt-field.png`

### Prompt

The reference artwork, reproduced faithfully, printed as a pigment print on a sheet of thick matte white cotton paper with an even white border, lying flat on a pale wooden studio table, photographed from directly above with a slight angle in soft north daylight. Faint paper texture, a soft shadow along the sheet's edge. Same image, same colours, same proportions as the reference; do not restyle it. The print fills most of the frame with a little table visible around it. No hands, no other objects, no text.

### Integration notes

- 4:5 card image in a grid of six, object-fit cover.

### Acceptance criteria

- File exists at the exact output path, png, 1024x1280.
- The artwork is recognisably the reference; it reads as a physical print on paper; no text.

## Image: set-palermo-grid

- **ID:** set-palermo-grid
- **Purpose:** The "Palermo Grid" print set card
- **Output path:** `sites/rivera-press/assets/generated/v2/set-palermo-grid.png`
- **File format:** png
- **Dimensions/aspect:** 1024x1280, 4:5 portrait
- **Required:** true
- **References:**
  - `/Users/fernandobalino/Projects/baton/.orchestrator/references/art-palermo-grid.png`

### Prompt

The reference artwork, reproduced faithfully, printed as a pigment print on a sheet of thick matte white cotton paper with an even white border, lying flat on a pale wooden studio table, photographed from directly above with a slight angle in soft north daylight. Faint paper texture, a soft shadow along the sheet's edge. Same image, same colours, same proportions as the reference; do not restyle it. The print fills most of the frame with a little table visible around it. No hands, no other objects, no text.

### Integration notes

- 4:5 card image in a grid of six, object-fit cover.

### Acceptance criteria

- File exists at the exact output path, png, 1024x1280.
- The artwork is recognisably the reference; it reads as a physical print on paper; no text.

## Image: set-winter-ferry

- **ID:** set-winter-ferry
- **Purpose:** The "Winter Ferry" print set card
- **Output path:** `sites/rivera-press/assets/generated/v2/set-winter-ferry.png`
- **File format:** png
- **Dimensions/aspect:** 1024x1280, 4:5 portrait
- **Required:** true
- **References:**
  - `/Users/fernandobalino/Projects/baton/.orchestrator/references/art-winter-ferry.png`

### Prompt

The reference artwork, reproduced faithfully, printed as a pigment print on a sheet of thick matte white cotton paper with an even white border, lying flat on a pale wooden studio table, photographed from directly above with a slight angle in soft north daylight. Faint paper texture, a soft shadow along the sheet's edge. Same image, same colours, same proportions as the reference; do not restyle it. The print fills most of the frame with a little table visible around it. No hands, no other objects, no text.

### Integration notes

- 4:5 card image in a grid of six, object-fit cover.

### Acceptance criteria

- File exists at the exact output path, png, 1024x1280.
- The artwork is recognisably the reference; it reads as a physical print on paper; no text.

## Image: set-marea-baja

- **ID:** set-marea-baja
- **Purpose:** The "Marea Baja" print set card
- **Output path:** `sites/rivera-press/assets/generated/v2/set-marea-baja.png`
- **File format:** png
- **Dimensions/aspect:** 1024x1280, 4:5 portrait
- **Required:** true
- **References:**
  - `/Users/fernandobalino/Projects/baton/.orchestrator/references/art-marea-baja.png`

### Prompt

The reference artwork, reproduced faithfully, printed as a pigment print on a sheet of thick matte white cotton paper with an even white border, lying flat on a pale wooden studio table, photographed from directly above with a slight angle in soft north daylight. Faint paper texture, a soft shadow along the sheet's edge. Same image, same colours, same proportions as the reference; do not restyle it. The print fills most of the frame with a little table visible around it. No hands, no other objects, no text.

### Integration notes

- 4:5 card image in a grid of six, object-fit cover.

### Acceptance criteria

- File exists at the exact output path, png, 1024x1280.
- The artwork is recognisably the reference; it reads as a physical print on paper; no text.

## Image: bind-coptic

- **ID:** bind-coptic
- **Purpose:** Norte Bindery card for the coptic stitch binding
- **Output path:** `sites/norte-bindery/assets/generated/v2/bind-coptic.png`
- **File format:** png
- **Dimensions/aspect:** 1024x1280, 4:5 portrait
- **Required:** true

### Prompt

A hand-bound book with an exposed coptic-stitched spine, chain stitches of natural linen thread running across the signatures, dark blue cloth boards with nothing on them, standing slightly open so the spine faces the camera, on a dark wooden bench. Warm low tungsten light from one side, deep shadows, navy, cream and gold tones, the same mood as a bookbinder's workshop at night. Close, 50mm look, shallow depth of field. No text, lettering, monograms or labels anywhere. No hands.

### Integration notes

- 4:5 card image with the name and price under it; the spine should be the clear subject.

### Acceptance criteria

- File exists at the exact output path, png, 1024x1280.
- The exposed coptic spine is unmistakable; blank covers; no text.

## Image: bind-japanese-stab

- **ID:** bind-japanese-stab
- **Purpose:** Norte Bindery card for the Japanese stab binding
- **Output path:** `sites/norte-bindery/assets/generated/v2/bind-japanese-stab.png`
- **File format:** png
- **Dimensions/aspect:** 1024x1280, 4:5 portrait
- **Required:** true

### Prompt

A Japanese stab-bound book: a soft cover of plain natural card, side-sewn along its left edge with a visible four-hole pattern of dark thread wrapping over the spine edge, lying flat on a dark wooden bench with the sewn edge nearest the camera. Warm low tungsten light from one side, deep shadows, navy, cream and gold tones, a bookbinder's workshop at night. Close, from slightly above, 50mm look, shallow depth of field. No text, lettering, monograms or labels anywhere. No hands.

### Integration notes

- 4:5 card image with the name and price under it; the thread pattern along the edge should be the clear subject.

### Acceptance criteria

- File exists at the exact output path, png, 1024x1280.
- The side-sewn edge with its thread pattern is unmistakable; blank cover; no text.

## Image: bind-saddle-folio

- **ID:** bind-saddle-folio
- **Purpose:** Norte Bindery card for the saddle-stitched folio
- **Output path:** `sites/norte-bindery/assets/generated/v2/bind-saddle-folio.png`
- **File format:** png
- **Dimensions/aspect:** 1024x1280, 4:5 portrait
- **Required:** true

### Prompt

A slim saddle-stitched folio of folded cream sheets, sewn through the fold with pale linen thread, lying open at its centre spread so the line of stitches down the fold is visible, pages blank, on a dark wooden bench. Warm low tungsten light from one side, deep shadows, navy, cream and gold tones, a bookbinder's workshop at night. Close, from slightly above, 50mm look, shallow depth of field. No text, lettering or marks on the pages. No hands.

### Integration notes

- 4:5 card image with the name and price under it; the stitched fold should be the clear subject.

### Acceptance criteria

- File exists at the exact output path, png, 1024x1280.
- The open folio with the stitched fold is unmistakable; blank pages; no text.

## Image: cover-cloth-board

- **ID:** cover-cloth-board
- **Purpose:** Norte Bindery card for the cloth-wrapped board cover
- **Output path:** `sites/norte-bindery/assets/generated/v2/cover-cloth-board.png`
- **File format:** png
- **Dimensions/aspect:** 1024x1280, 4:5 portrait
- **Required:** true

### Prompt

A closed hardcover book wrapped in deep blue book cloth, the weave of the cloth visible, a single blind-debossed rectangle on the front with nothing inside it, lying on a dark wooden bench beside a bone folder. Warm low tungsten light from one side, deep shadows, navy, cream and gold tones, a bookbinder's workshop at night. Close, from slightly above, 50mm look, shallow depth of field. No text, lettering, monograms or gilt anywhere. No hands.

### Integration notes

- 4:5 card image with the name and price under it; the cloth texture should read at card size.

### Acceptance criteria

- File exists at the exact output path, png, 1024x1280.
- A blue cloth hardcover with a blank front; no text.

## Image: cover-light-card

- **ID:** cover-light-card
- **Purpose:** Norte Bindery card for the light card wrap cover
- **Output path:** `sites/norte-bindery/assets/generated/v2/cover-light-card.png`
- **File format:** png
- **Dimensions/aspect:** 1024x1280, 4:5 portrait
- **Required:** true

### Prompt

A closed softcover book with a plain wrap of warm natural card, slightly textured, the cover bare, its edges crisp, lying on a dark wooden bench with a small stack of the same books behind it. Warm low tungsten light from one side, deep shadows, navy, cream and gold tones, a bookbinder's workshop at night. Close, from slightly above, 50mm look, shallow depth of field. No text, lettering, monograms or labels anywhere. No hands.

### Integration notes

- 4:5 card image with the name and price under it; the card's texture and colour should read at card size.

### Acceptance criteria

- File exists at the exact output path, png, 1024x1280.
- A plain card-covered softcover with a blank front; no text.
