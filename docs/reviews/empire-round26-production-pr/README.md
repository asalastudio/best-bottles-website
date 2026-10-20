# Empire and Round 26-variant production candidate

This PR carries the approved media into a focused branch from `main`. It leaves the media release off. Preparing or merging this PR does not authorize a production deployment or traffic change.

Base: `c0a861f85b0508304343c4202ccd2fa59c248f53`.
Branch: `release/empire-round26-production`.
Media revision: `empire-round26-03baed749353`.

## Scope

| Included | Held or excluded |
| --- | --- |
| 12 Empire sprays and two Empire white pumps | Diva, Round lotion, other families |
| 12 Round 78 ml sprays, clear and frosted | Local candidate routes, source art and Photoshop masters |
| 57 immutable images, approved recipes and exact-SKU catalog heroes | Shopify or Convex media publication, catalog data edits |
| Shared dip-tube lighting, cavity clipping and measured registration | Ring schema, Convex functions or schema changes |
| Builder cache revision and refresh handling | Unrelated navigation, image-retry and product-page changes |

The manifest is the complete SKU allowlist. `scope.csv` lists its 26 variants and stages. Frozen recipes retain the approved image pixels, geometry and detached parts. Current source assemblies, glass plates, body dimensions and component definitions must match the captured sources before a recipe can replace a kit. Strict cached loaders reject a mismatch rather than cache unreviewed imagery.

## Release controls in this diff

- The default is `off`. Supported active selections are `empire-round26-03baed749353:canary` (2), `:empire` (14), and `:all` (26). These are compiled settings; changing an environment value alone cannot change an existing deployment.
- The Vercel build wrapper runs preflight and then Next. It has no Convex deployment path. Backend deployment keys and the previous backend-deploy opt-in are rejected, including with the media release off.
- Direct Next builds run the same gate. Production startup does not recheck an expired build approval.
- Production builds, including the new-code/off baseline, require a server-only `BB_MEDIA_PRODUCTION_APPROVAL` record. It must match the release, full commit SHA, project, backend and one stage, name an operator and approval reference, identify a rollback deployment, and expire within 24 hours. No live approval record is included or supplied.
- The production target is `asala/best-bottles-website`, project `prj_GHwEFaEB2YYcMKetaompX9fGC4mR`, team `team_CGyACzn1BhcZitDAKUiZRzax`, backend `https://precise-raccoon-123.convex.cloud`. Production authentication must stay enabled.
- Active isolated preview builds, and off builds on this release branch, are restricted to project `prj_JFb1sYpDTmvfUR2qfOOL9TJmF5yt` and backend `https://beloved-wildcat-265.convex.cloud`. They reject inherited service write credentials.
- Automatic Git deployments are disabled for `main`, this release branch and the preserved integration branch, with no wildcard enabling rule. This changes the workflow after merge: future production releases require manual staging until a separately reviewed change restores automation. [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration).

The approval record is an operator declaration, not a signature or a substitute for Jordan's consent. Repository controls do not prevent a Vercel administrator from using another deployment path. Do not bypass them with a prebuilt upload or promote an isolated-preview deployment into production.

## Review and remaining approvals

1. Review this exact diff and its checks. Confirm the 26-SKU scope and the frontend-only/manual production workflow. CI must pass on the final PR head. The earlier hosted preview validated the broader integration branch, not this focused commit.
2. Before merge, authorize an isolated preview deployment of this focused commit and repeat hosted catalog, PDP, Builder, mobile and old-tab checks. No deployment is performed by this PR-preparation task.
3. Approve merge separately. If `main` advances, integrate it, inspect the new diff and rerun the checks. Record the resulting full main SHA; do not reuse an approval bound to the pre-merge SHA.
4. Approve production staging and its build-environment changes: withhold/remove `CONVEX_DEPLOY_KEY` and the backend-deploy opt-in from this frontend build, confirm the pinned project/team metadata (`VERCEL_PROJECT_ID` and `VERCEL_ORG_ID`), normal production authentication and backend settings, and supply a short-lived approval for the exact commit and `off` mode. Do not change runtime business credentials or deploy Convex.
5. Approve traffic promotion of the tested new-code/off baseline. Then approve the two-SKU canary, the 14-SKU Empire stage and the 26-SKU final stage individually, after their checks. Confirm an operator, release window, observation period and authority to roll back immediately on the stop conditions below.

Diva and Round lotion require their own future release review. None of these approvals includes them.

## Staging and rollout sequence

Each production build must be staged without assigning production domains, using Vercel's staged production workflow. Verify project, commit, `target=production`, mode and backend on the resulting deployment. Record the deployment ID before testing. A staged production build can later be promoted without rebuilding. [Vercel staging and promotion](https://vercel.com/docs/deployments/promoting-a-deployment#staging-and-promoting-a-production-deployment).

| Step | Selection | Acceptance before traffic or expansion |
| --- | --- | --- |
| Baseline | `off` | Full storefront routes and authentication work; images match the existing baseline; rollback target recorded |
| Canary | `:canary` | Empire 50 and 100 ml Matte Gold: catalog hero, PDP sidecar/cap-on/exploded, Builder body/finish/cover states, desktop and mobile |
| Empire | `:empire` | All 14 Empire variants and both white pumps; Round, Diva and lotion unchanged |
| Final | `:all` | All 26 variants; clear/frosted Round, six spray finishes, catalog selection and exact-SKU links; holdouts unchanged |

At every step: rerun `scripts/media-release/check-production-sources.ts`; require 26 accepted recipes and 26 matching product/Shopify identities; verify all 57 asset hashes; check image responses and browser errors; confirm Builder request/header revisions; open an older tab and verify refresh behavior; check price, quantity, stock and cart line identity without placing a live order. Verify normal customer/staff authentication with authorized test accounts. Check Sentry/Vercel logs for new media, API or authentication failures. Require explicit visual acceptance before the next stage.

Keep a new-code/off production deployment available. It must serve production traffic successfully before relying on it for Instant Rollback. A preview/off deployment is not a production rollback target. [Vercel rollback eligibility](https://vercel.com/docs/instant-rollback#eligible-deployments).

## Rollback

Stop expansion on any missing or wrong image, detached/incorrect tube or sprayer, changed held-family imagery, source mismatch, stale-revision loop, authentication regression, wrong SKU/cart identity, or new repeated route failures.

Preferred target: the tested new-code/off production deployment, once it has served production traffic. Its deployment ID is **pending** because production staging has not been authorized.

Secondary target: the current pre-release production deployment, `dpl_FZdQy7vDFtxNDCTqgZxMTWQTmk2G`, observed on the production alias before this PR. Recheck its identity, availability and eligibility immediately before rollout.

With rollback authority in place, use Vercel Instant Rollback to the recorded eligible production deployment. Confirm all production aliases, backend, image selection, catalog/PDP/Builder, authentication and cart identities. Recheck an old tab and a fresh tab. Do not restore the database, alter a schema, redeploy old Convex code or delete media files. This release changes frontend media only.

Vercel rollback restores an existing build and its original configuration; an environment edit is not a rollback. Check domain auto-assignment state afterward, since promotion can restore it. Keep Git deployment exclusions in place. [Vercel Instant Rollback](https://vercel.com/docs/instant-rollback).

## Approval record shape

This is a deliberately invalid example, not authorization. Supply a completed record as a build-only server-side environment value only after approval. Do not commit it or expose it through `NEXT_PUBLIC_*`.

```json
{
  "release": "empire-round26-03baed749353",
  "commit": "FULL_REVIEWED_40_CHARACTER_COMMIT_SHA",
  "projectId": "prj_GHwEFaEB2YYcMKetaompX9fGC4mR",
  "convexUrl": "https://precise-raccoon-123.convex.cloud",
  "mode": "off",
  "rollbackDeploymentId": "VERIFIED_ELIGIBLE_PRODUCTION_DEPLOYMENT_ID",
  "reference": "EXPLICIT_APPROVAL_REFERENCE",
  "approvedBy": "APPROVING_OPERATOR",
  "expiresAt": "UTC_TIME_WITHIN_24_HOURS",
  "intent": "stage-without-traffic"
}
```

## Evidence

`checks.json` records checks completed at commit time and the remaining validation. The final PR head's CI check and `media-release-smoke` artifact provide the automated results. `production-source-check.json` records public read-only production checks, not production deployment approval. `diff-inventory.txt` lists every changed path against the recorded main base. The draft PR's Files changed tab is the exact patch, including binary assets.

No production deployment, backend deployment, traffic promotion, live cart/order submission or production settings change is part of this preparation.
