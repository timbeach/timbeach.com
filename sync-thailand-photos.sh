#!/bin/sh
# Sync full-resolution Thailand photos directly to VPS
# These are too large for git (1.5GB) — rsynced separately from originals
rsync -vhrla --progress \
  /home/trashh_panda/Pictures/thailand_2026-03-04/faves/ \
  vultr:/var/www/timbeach.com/thailand_2026/photos/
