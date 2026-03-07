# Grace Fix Scripts

Each file in this folder should map to one logged Grace issue from `data/grace_audit_issues.json`.

Recommended naming:

- `GI-0001-normalize-rollon-applicators.mjs`
- `GI-0002-navbar-voice-transcribe-route.mjs`

Rules:

1. One issue, one fix script or fix entry point.
2. The matching issue should include the script path in its `fixScript` field.
3. Every fix should end with a verification step tied to a regression case from `docs/grace-audit/02-test-matrix.md`.
