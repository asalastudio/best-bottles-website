#!/bin/sh
# Preview backend deployment is opt-in per branch until its catalog is seeded.
# Reject non-preview keys so this path can never deploy to a shared backend.
# The existing main-branch Production path continues to deploy Convex.
set -e
if [ "$VERCEL_ENV" = "preview" ] && [ "$BB_CONVEX_PREVIEW_DEPLOY" = "true" ]; then
  case "${CONVEX_DEPLOY_KEY:-}" in
    preview:*\|*) ;;
    *) echo "Preview backend deployment requires a preview-scoped CONVEX_DEPLOY_KEY." >&2; exit 1 ;;
  esac
  npx convex deploy --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL --cmd 'npx next build --webpack'
elif [ "$VERCEL_ENV" = "production" ] && [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then
  npx convex deploy --cmd 'npx next build --webpack'
else
  npx next build --webpack
fi
