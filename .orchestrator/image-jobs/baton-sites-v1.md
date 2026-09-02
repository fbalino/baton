---
schema_version: 1
job_id: baton-sites-v1
project_root: /Users/fernandobalino/Projects/baton
controller: claude-code
created_by: claude-code
created_at: 2026-09-02T18:05:00Z
status: ready
output_root: sites
---

# Image Generation Manifest

## Shared visual direction

Three fictional small businesses in Montevideo, Uruguay, photographed as if for their own websites: a fine-art print co-op, a bookbinding workshop, and a city courier. Photorealistic, natural light, muted and honest colour, film-like grain, no HDR look, no stock-photo gloss. No people's faces anywhere; hands at work are fine. No text, lettering, logos, signage, watermarks, licence plates or numbers anywhere in any image. Nothing that reads as a screenshot or a render. The six "print set" images are photographs of physical fine-art prints lying on a pale wooden table, shot from above at a slight angle in soft north light, so the paper texture and matte surface are visible; the artwork on each print is a modern abstract screen-print composition described per image, and it must look printed on paper, not digital.

## Image: press-hero

- **ID:** press-hero
- **Purpose:** Rivera Press hero image, top of the main column
- **Output path:** `sites/rivera-press/assets/generated/press-hero.png`
- **File format:** png
- **Dimensions/aspect:** 1536x1024, 3:2 landscape
- **Required:** true

### Prompt

Interior of a small fine-art print studio in an old Montevideo building: two large-format pigment inkjet printers along a wall, a long pale wooden table with a few proofs laid out, rolls of cotton paper, a window with soft morning light, high ceiling, worn tile floor. Calm, warm, slightly desaturated palette: paper white, wood, oxide red accents from the proofs. Eye-level wide shot, 35mm look, shallow but not extreme depth of field. No people, no faces, no text or signage anywhere.

### Integration notes

- Displayed at about 1000 by 560 with object-fit cover, full width of the main column, no text overlay.
- Keep the centre third clear of clutter so the crop works at 16:9 on phones.

### Acceptance criteria

- File exists at the exact output path, png, 1536x1024.
- No text, logos or faces.

## Image: set-cerro-signals

- **ID:** set-cerro-signals
- **Purpose:** The "Cerro Signals" print set card
- **Output path:** `sites/rivera-press/assets/generated/set-cerro-signals.png`
- **File format:** png
- **Dimensions/aspect:** 1024x1280, 4:5 portrait
- **Required:** true

### Prompt

A single fine-art screen print on unbleached white cotton paper, lying on a pale wooden table, photographed from above at a slight angle in soft daylight. The artwork: a modern abstract composition of concentric arcs and thin radiating lines in oxide red and dark slate, echoing harbour signal charts, generous negative space, a small red mark near the lower edge. Matte surface, visible paper texture, a soft shadow under the sheet. No text or signature on the print, no hands, no other objects.

### Integration notes

- Shown as a 4:5 card image with object-fit cover; the print should fill most of the frame with a little table visible around it.

### Acceptance criteria

- File exists at the exact output path, png, 1024x1280.
- Reads as a physical print on paper, no text.

## Image: set-rambla-nocturne

- **ID:** set-rambla-nocturne
- **Purpose:** The "Rambla Nocturne" print set card
- **Output path:** `sites/rivera-press/assets/generated/set-rambla-nocturne.png`
- **File format:** png
- **Dimensions/aspect:** 1024x1280, 4:5 portrait
- **Required:** true

### Prompt

A single fine-art screen print on heavy paper, lying on a pale wooden table, photographed from above at a slight angle in soft daylight. The artwork is printed dark: a deep indigo field with a long horizontal seaside promenade at night rendered as a line of bone-white lamp dots and a pale horizontal band, very minimal, the paper's own bone colour used as the only light. Matte surface, visible paper texture, soft shadow under the sheet. No text on the print, no hands, no other objects.

### Integration notes

- 4:5 card image, object-fit cover.

### Acceptance criteria

- File exists at the exact output path, png, 1024x1280.
- Dark indigo and bone only, no text.

## Image: set-salt-field

- **ID:** set-salt-field
- **Purpose:** The "Salt Field" print set card
- **Output path:** `sites/rivera-press/assets/generated/set-salt-field.png`
- **File format:** png
- **Dimensions/aspect:** 1024x1280, 4:5 portrait
- **Required:** true

### Prompt

A single fine-art screen print on white cotton paper, lying on a pale wooden table, photographed from above at a slight angle in soft daylight. The artwork: a flat salt-field horizon printed in one warm grey at three densities, three horizontal bands, extremely quiet, the lightest band almost the paper itself. Matte surface, visible paper texture, soft shadow under the sheet. No text on the print, no hands, no other objects.

### Integration notes

- 4:5 card image, object-fit cover.

### Acceptance criteria

- File exists at the exact output path, png, 1024x1280.
- One warm grey only, no text.

## Image: set-palermo-grid

- **ID:** set-palermo-grid
- **Purpose:** The "Palermo Grid" print set card
- **Output path:** `sites/rivera-press/assets/generated/set-palermo-grid.png`
- **File format:** png
- **Dimensions/aspect:** 1024x1280, 4:5 portrait
- **Required:** true

### Prompt

A single fine-art screen print on unbleached white paper, lying on a pale wooden table, photographed from above at a slight angle in soft daylight. The artwork: block plans of eight city streets drawn as ochre rectangles with thin black outlines on an irregular grid, like a hand-cut map of a neighbourhood, slight misregistration between the ochre and the black as in a real screen print. Matte surface, visible paper texture, soft shadow under the sheet. No text, no street names, no hands, no other objects.

### Integration notes

- 4:5 card image, object-fit cover.

### Acceptance criteria

- File exists at the exact output path, png, 1024x1280.
- Ochre and black only, no text.

## Image: set-winter-ferry

- **ID:** set-winter-ferry
- **Purpose:** The "Winter Ferry" print set card
- **Output path:** `sites/rivera-press/assets/generated/set-winter-ferry.png`
- **File format:** png
- **Dimensions/aspect:** 1024x1280, 4:5 portrait
- **Required:** true

### Prompt

A single fine-art screen print on cool white paper, lying on a pale wooden table, photographed from above at a slight angle in soft daylight. The artwork: a ferry deck railing and a wide grey river in mist, reduced to four flat cold greys with hard edges, no gradients, a small dark shape of a distant boat. Matte surface, visible paper texture, soft shadow under the sheet. No text on the print, no hands, no other objects.

### Integration notes

- 4:5 card image, object-fit cover.

### Acceptance criteria

- File exists at the exact output path, png, 1024x1280.
- Four greys only, no text.

## Image: set-marea-baja

- **ID:** set-marea-baja
- **Purpose:** The "Marea Baja" print set card
- **Output path:** `sites/rivera-press/assets/generated/set-marea-baja.png`
- **File format:** png
- **Dimensions/aspect:** 1024x1280, 4:5 portrait
- **Required:** true

### Prompt

A single fine-art screen print on warm white paper, lying on a pale wooden table, photographed from above at a slight angle in soft daylight. The artwork: low tide at a rocky point on the Río de la Plata, rendered as flat shapes in teal and sand, dark rock silhouettes at the bottom, a wide pale sky, one thin teal line for the water's edge. Matte surface, visible paper texture, soft shadow under the sheet. No text on the print, no hands, no other objects.

### Integration notes

- 4:5 card image, object-fit cover.

### Acceptance criteria

- File exists at the exact output path, png, 1024x1280.
- Teal and sand only, no text.

## Image: bindery-hero

- **ID:** bindery-hero
- **Purpose:** Norte Bindery hero image, top of the main column
- **Output path:** `sites/norte-bindery/assets/generated/bindery-hero.png`
- **File format:** png
- **Dimensions/aspect:** 1536x1024, 3:2 landscape
- **Required:** true

### Prompt

A bookbinding bench in a small workshop by a north-facing window: a sewn text block held in a wooden finishing press, bolts of bookcloth in muted blues and a grey board stack beside it, a bone folder, waxed thread, a brass ruler, worn wood. Soft grey daylight, calm palette of bookcloth blue, board grey and pale wood. Eye-level, 50mm look, gentle depth of field. Hands at work are optional; no faces, no text, no labels.

### Integration notes

- Displayed at about 1000 by 560 with object-fit cover; keep the press near the centre.

### Acceptance criteria

- File exists at the exact output path, png, 1536x1024.
- No text, logos or faces.

## Image: courier-hero

- **ID:** courier-hero
- **Purpose:** Ruta Courier hero image, top of the main column
- **Output path:** `sites/ruta-courier/assets/generated/courier-hero.png`
- **File format:** png
- **Dimensions/aspect:** 1536x1024, 3:2 landscape
- **Required:** true

### Prompt

A small plain white delivery van parked on a quiet Montevideo street near the old port at dawn, low warm sun from the side, long shadows, cobblestones, a closed cargo door with one orange safety stripe, a cardboard parcel on the kerb. Honest documentary look, 35mm, slightly cool shadows and warm highlights. No people, no faces, no licence plate, no text, no logos.

### Integration notes

- Displayed at about 1000 by 560 with object-fit cover; keep the van left of centre so the right side can crop away on phones.

### Acceptance criteria

- File exists at the exact output path, png, 1536x1024.
- No text, plates, logos or faces.
