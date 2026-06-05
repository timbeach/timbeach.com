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
else
  echo "! tools/venv missing; skipping audio validation, feed, and share pages"
fi

# Exclusions live in .deployignore (single source of truth — keep it current).
rsync -vhrla --exclude-from="$PWD/.deployignore" $PWD/ vultr:/var/www/timbeach.com

