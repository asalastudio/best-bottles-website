#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const FIX_DIR = path.join(process.cwd(), "scripts", "grace-fixes");

function usage() {
  console.log(`Usage:
  node scripts/create_grace_fix_stub.mjs GI-0001 normalize-rollon-applicators

Creates:
  scripts/grace-fixes/GI-0001-normalize-rollon-applicators.mjs`);
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const [issueId, label] = process.argv.slice(2);
  if (!issueId || !label) {
    usage();
    process.exit(1);
  }

  const filename = `${issueId}-${slugify(label)}.mjs`;
  const target = path.join(FIX_DIR, filename);
  await mkdir(FIX_DIR, { recursive: true });

  const contents = `#!/usr/bin/env node

/**
 * Grace fix stub
 * Issue: ${issueId}
 * Label: ${label}
 *
 * Follow-up:
 * 1. Link this path in data/grace_audit_issues.json as fixScript
 * 2. Document the affected prompt, data shape, and verification step
 * 3. Re-run the matching regression case after the fix
 */

console.log("TODO: implement fix logic for ${issueId} (${label})");
`;

  await writeFile(target, contents, "utf8");
  console.log(target);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
