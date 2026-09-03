---
schema_version: 1
job_id: baton-courier-logo-v1
project_root: /Users/fernandobalino/Projects/baton
controller: claude-code
created_by: claude-code
created_at: 2026-09-03T04:05:00Z
status: ready
output_root: sites
---

# Image Generation Manifest

## Shared visual direction

One repair of an existing photograph. The first reference is the photograph to keep; the second reference is the website mockup that shows how the company wordmark is drawn. The only change is adding that wordmark to the jacket and the cargo box. Everything else in the photo stays as it is: the rider seen from behind, the bike, the street, the tower, the light, the framing. No faces, no licence plates, no other text or logos anywhere.

## Image: courier-hero-logo

- **ID:** courier-hero-logo
- **Purpose:** Ruta Courier hero photograph with the company wordmark on the jacket and the box
- **Output path:** `sites/ruta-courier/assets/generated/v2/courier-hero-logo.png`
- **File format:** png
- **Dimensions/aspect:** 1536x1024, 3:2 landscape
- **Required:** true
- **References:**
  - `/Users/fernandobalino/Projects/baton/.orchestrator/references/courier-hero-v2.png`
  - `/Users/fernandobalino/Projects/baton/.orchestrator/references/mockup-ruta-courier.png`

### Prompt

Use the first reference photograph as the image, unchanged, and add the company wordmark exactly as it appears on the rider and the box in the second reference (the mockup). On the back of the red jacket, across the shoulder blades: the word RUTA in bold white italic capitals with three short speed lines to its left, and COURIER beneath it in smaller white italic capitals, printed flat on the fabric and following its folds. On the side of the canvas cargo box facing the camera: the same wordmark, RUTA above COURIER, in the jacket's red, plus a small plain white shipping label with no readable text. The spelling must be exactly RUTA and COURIER, nothing else written anywhere. Keep the rider, bike, street, tower, light, colours and framing identical to the first reference. No faces, no licence plates.

### Integration notes

- Same crop and use as the original: about 820 by 360 with object-fit cover, positioned 60% from the left, with a diagonal cut on the left edge. The wordmark on the jacket and the box must both sit inside the right two thirds of the frame.

### Acceptance criteria

- File exists at the exact output path, png, 1536x1024.
- The photo is the same scene as the first reference; the only change is the wordmark on the jacket and on the box.
- The wordmark reads exactly RUTA / COURIER on both, and there is no other text anywhere.
