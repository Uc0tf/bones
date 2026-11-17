#!/usr/bin/env bash
# Sestaví web a nahraje složku dist/ do větve gh-pages (GitHub Pages).
set -euo pipefail
cd "$(dirname "$0")/.."
REMOTE_URL="$(git remote get-url origin)"
npm run build
TMP="$(mktemp -d)"
cp -R dist/. "$TMP/"
touch "$TMP/.nojekyll"
cd "$TMP"
git init -q -b gh-pages
git add -A
git commit -q -m "Deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git push -q -f "$REMOTE_URL" gh-pages
rm -rf "$TMP"
echo "Nasazeno do větve gh-pages."
