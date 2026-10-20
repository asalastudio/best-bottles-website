# Isolated preview deployment, 20 October 2026

Authorized scope: push the integration branch and deploy only the isolated preview/test backend. No merge, production activation or Diva publication.

The test backend now exposes 39 existing read-only queries through explicit wrappers in `preview-backend/convex`. No mutations, actions, HTTP handlers, cron jobs or analytics/AI components are deployed. The full additive schema is retained. All 26 media source guards pass remotely and only Empire/Round bottle families are present.

The frontend package contains application code, runtime data imports, interface assets, the 57 immutable release images and the exact previous hero images needed for rollback. Local pilots, review archives, PSD masters and unrelated catalog artwork are excluded. Vercel cron configuration is omitted in this preview package. The production source configuration is preserved.

`tsconfig.build.json` checks deployable app sources; the full `tsconfig.json` remains the CI/test check. This prevents omitted local review fixtures from breaking a remote production-mode build.

Deployment IDs, hosted acceptance, and rollback evidence will be added after verification. They are not yet claimed complete.
