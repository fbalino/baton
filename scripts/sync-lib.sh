#!/usr/bin/env bash
# Copy the shared library into each site folder, so every folder deploys on its
# own to a different host with nothing above it in the tree.
#
#   bash scripts/sync-lib.sh
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

for site in rivera-press norte-bindery ruta-courier; do
  cp "$root/lib/baton.js"  "$root/sites/$site/baton.js"
  cp "$root/lib/style.css" "$root/sites/$site/style.css"
  echo "synced lib → sites/$site"
done
