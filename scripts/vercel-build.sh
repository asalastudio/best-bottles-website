#!/bin/sh
# Frontend-only release. Backend changes must use a separately reviewed workflow.
set -eu
node --import tsx scripts/media-release/preflight.ts
case "${NODE_OPTIONS:-}" in
  *max-old-space-size*) ;;
  *) export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=6144" ;;
esac
rm -rf .next/cache/webpack
exec npx next build --webpack
