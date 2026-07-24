#!/bin/sh
set -e

# Gate: every article with audio metadata must have timings that match the
# current markdown. Catches "edited an article, forgot to re-render" before
# the stale audio ships.
if [ -x tools/venv/bin/python ]; then
  echo "→ validating audio/timings parity"
  tools/venv/bin/python tools/render_article.py --validate
  echo "→ generating feed.xml"
  tools/venv/bin/python tools/build_feed.py
  echo "→ generating social share pages (a/<slug>/)"
  tools/venv/bin/python tools/build_share_pages.py
  echo "→ generating search index"
  tools/venv/bin/python tools/build_search_index.py
else
  echo "! tools/venv missing; skipping audio validation, feed, and share pages"
fi

# Exclusions live in .deployignore (single source of truth — keep it current).
rsync -vhrla --exclude-from="$PWD/.deployignore" $PWD/ vultr:/var/www/timbeach.com

# Share pages use content-hashed card filenames (a/<slug>/og-<hash>.png), so a
# changed image leaves the old hash orphaned server-side. A --delete pass scoped
# to the a/ subtree keeps it an exact mirror of the freshly generated local one.
if [ -d "$PWD/a" ]; then
  echo "→ mirroring a/ (prunes orphaned share-page cards)"
  rsync -vhrla --delete "$PWD/a/" vultr:/var/www/timbeach.com/a/
fi

