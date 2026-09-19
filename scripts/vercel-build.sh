#!/bin/sh
# Preview backend deployment is opt-in per branch until its catalog is seeded.
# Reject non-preview keys so this path can never deploy to a shared backend.
# The existing main-branch Production path continues to deploy Convex.
set -e
# Vercel's default container is 8 GB. Webpack already OOM-killed a preview
# worker here on 2026-09-14; keep the heap under the ceiling.
case "${NODE_OPTIONS:-}" in
  *max-old-space-size*) ;;
  *) export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=6144" ;;
esac
if [ "$VERCEL_ENV" = "preview" ] && [ "$BB_CONVEX_PREVIEW_DEPLOY" = "true" ]; then
  case "${CONVEX_DEPLOY_KEY:-}" in
    preview:*\|*)
      npx convex deploy --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL --cmd 'npx next build --webpack'
      ;;
    *)
      # Never deploy a shared/prod Convex with a preview flag. Still ship the
      # storefront so an accidental project-wide opt-in cannot fail every PR.
      echo "Preview backend deployment skipped: CONVEX_DEPLOY_KEY is not preview-scoped. Building the frontend only." >&2
      npx next build --webpack
      ;;
  esac
elif [ "$VERCEL_ENV" = "production" ] && [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then
  npx convex deploy --cmd 'npx next build --webpack'
else
  npx next build --webpack
fi
