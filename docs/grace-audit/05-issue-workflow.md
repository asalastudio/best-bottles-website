# Grace Issue Logging And Fix Workflow

## Objective

Every Grace mistake should leave a paper trail and a fix path.

That means:

1. The mistake gets logged in `data/grace_audit_issues.json`.
2. The issue is classified by severity, category, surface, and prompt.
3. A matching fix script is created in `scripts/grace-fixes/`.
4. The issue status is updated as work progresses.
5. The matching regression case is re-run before the issue is marked `verified`.

## Canonical Files

- Issue ledger: `data/grace_audit_issues.json`
- Issue logger: `scripts/log_grace_issue.mjs`
- Issue updater: `scripts/update_grace_issue.mjs`
- Issue summary report: `scripts/grace_issue_report.mjs`
- Fix script generator: `scripts/create_grace_fix_stub.mjs`
- Fix script folder: `scripts/grace-fixes/`
- Regression matrix: `docs/grace-audit/02-test-matrix.md`

## Required Fields For Every Issue

- `title`
- `severity`
- `category`
- `surface`
- `source`
- `prompt`
- `expected`
- `actual`

Recommended whenever known:

- `rootCause`
- `affectedFiles`
- `fixScript`
- `owner`
- `regressionCase`
- `notes`

## Severity Rules

- `P0`
  - Wrong product recommendation
  - Wrong fitment
  - Wrong policy answer
  - Broken voice entry point
  - Broken navigation
- `P1`
  - Correct answer exists but Grace misses it
  - Performance is too slow for a critical journey
  - Vocabulary drift or grouped data drift
  - Audit tooling broken
- `P2`
  - Polish, noisy logs, non-blocking UX inconsistencies

## Status Rules

- `open`
  - Newly logged, not triaged yet
- `triaged`
  - Root cause and owner identified
- `in_progress`
  - Fix is being actively worked
- `fixed`
  - Code or data remediation is complete
- `verified`
  - Regression case re-run and issue confirmed resolved
- `wontfix`
  - Intentionally accepted or superseded

## Standard Operating Procedure

### 1. Log the mistake immediately

Example:

```bash
node scripts/log_grace_issue.mjs \
  --title "Grace returned no roll-on products" \
  --severity P0 \
  --category retrieval \
  --surface homepage-chat \
  --source customer-report \
  --prompt "Show me roll-on bottles" \
  --expected "Roll-on products should be returned" \
  --actual "Grace returned no matching products" \
  --root-cause "Applicator vocabulary drift" \
  --affected-files "convex/grace.ts,convex/schema.ts" \
  --regression-case "S1"
```

### 2. Create the matching fix script

Example:

```bash
node scripts/create_grace_fix_stub.mjs GI-0006 normalize-rollon-routing
```

Then link that path back into the issue:

```bash
node scripts/update_grace_issue.mjs GI-0006 \
  --status triaged \
  --fix-script "scripts/grace-fixes/GI-0006-normalize-rollon-routing.mjs"
```

### 3. Move the issue through the queue

Examples:

```bash
node scripts/update_grace_issue.mjs GI-0006 --status in_progress --owner "Jordan"
node scripts/update_grace_issue.mjs GI-0006 --status fixed
node scripts/update_grace_issue.mjs GI-0006 --status verified --notes "Re-tested with case S1"
```

### 4. Review the queue frequently

```bash
node scripts/grace_issue_report.mjs
```

## What Counts As "Documented"

An issue is only fully documented when all of the following are true:

1. It exists in `data/grace_audit_issues.json`
2. The triggering prompt or behavior is captured
3. The expected behavior is captured
4. The affected surface is captured
5. There is either a linked fix script or a clear reason why no script is needed
6. There is a regression case to re-run

## Fix Promptness Rules

- `P0` issues should be triaged the same day and moved to `in_progress` as soon as practical.
- `P1` issues should be triaged in the next active QA/fix cycle.
- `P2` issues can queue behind correctness and conversion blockers.

## Current Seeded Queue

The current ledger is already seeded with the first audit findings:

- `GI-0001` roll-on applicator filter mismatch
- `GI-0002` navbar voice-search route mismatch
- `GI-0003` invalid Grace PDP slug navigation
- `GI-0004` grouped applicator vocabulary drift
- `GI-0005` oversized data quality audit

These should be treated as the first active Grace remediation backlog.
