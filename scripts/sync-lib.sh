#!/usr/bin/env bash
# Copy the shared library into each site folder, so every folder deploys on its
# own to a different host with nothing above it in the tree.
#
#   bash scripts/sync-lib.sh
#
# Two files travel: baton.js (the mission model, transport, signing and the
# common WebMCP tools) and baton-panel.css (the mission panel and the tools
# box, so the panel is the same object on all three sites).
#
# sites/<site>/style.css is the site's own identity and is never touched here.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

for site in rivera-press norte-bindery ruta-courier; do
  cp "$root/lib/baton.js"        "$root/sites/$site/baton.js"
  cp "$root/lib/baton-panel.css" "$root/sites/$site/baton-panel.css"
  echo "synced baton.js + baton-panel.css → sites/$site"
done
