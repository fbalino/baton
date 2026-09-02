#!/usr/bin/env bash
# Copy the shared library into each site folder, so every folder deploys on its
# own to a different host with nothing above it in the tree.
#
#   bash scripts/sync-lib.sh
#
# Three files travel:
#
#   baton.js          the mission model, transport, signing and the common
#                     WebMCP tools, plus the panel's render markup
#   baton-panel.css   the mission card and the tools box
#   baton-shell.css   the two-column app shell: the static sidebar and the
#                     main column every site mounts the panel inside
#
# sites/<site>/style.css is the site's own identity and is never touched here.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

for site in rivera-press norte-bindery ruta-courier; do
  cp "$root/lib/baton.js"        "$root/sites/$site/baton.js"
  cp "$root/lib/baton-panel.css" "$root/sites/$site/baton-panel.css"
  cp "$root/lib/baton-shell.css" "$root/sites/$site/baton-shell.css"
  echo "synced baton.js + baton-panel.css + baton-shell.css → sites/$site"
done
