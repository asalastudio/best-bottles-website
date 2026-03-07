#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ISSUE_PATH = path.join(process.cwd(), "data", "grace_audit_issues.json");
const VALID_SEVERITIES = new Set(["P0", "P1", "P2"]);
const VALID_STATUSES = new Set(["open", "triaged", "in_progress", "fixed", "verified", "wontfix"]);

function usage() {
  console.log(`Usage:
  node scripts/update_grace_issue.mjs GI-0001 --status in_progress --owner "Jordan"

Optional fields:
  --status open|triaged|in_progress|fixed|verified|wontfix
  --severity P0|P1|P2
  --owner "Name"
  --title "Updated title"
  --category retrieval
  --surface homepage-chat
  --source manual-audit
  --prompt "Original prompt"
  --expected "Expected behavior"
  --actual "Observed behavior"
  --root-cause "Cause"
  --affected-files "fileA,fileB"
  --fix-script "scripts/grace-fixes/GI-0001-fix.mjs"
  --regression-case "S1"
  --notes "Latest notes"`);
}

function parseArgs(argv) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      result._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      result[key] = "true";
      continue;
    }
    result[key] = next;
    i += 1;
  }
  return result;
}

function splitList(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "true" || args._.length === 0) {
    usage();
    return;
  }

  if (args.status && !VALID_STATUSES.has(args.status)) {
    throw new Error(`Invalid status "${args.status}"`);
  }
  if (args.severity && !VALID_SEVERITIES.has(args.severity)) {
    throw new Error(`Invalid severity "${args.severity}"`);
  }

  const issueId = args._[0];
  const raw = await readFile(ISSUE_PATH, "utf8");
  const db = JSON.parse(raw);
  const issue = db.issues.find((entry) => entry.id === issueId);

  if (!issue) {
    throw new Error(`Issue ${issueId} not found in data/grace_audit_issues.json`);
  }

  const fieldMap = {
    status: "status",
    severity: "severity",
    owner: "owner",
    title: "title",
    category: "category",
    surface: "surface",
    source: "source",
    prompt: "prompt",
    expected: "expected",
    actual: "actual",
    "root-cause": "rootCause",
    "fix-script": "fixScript",
    "regression-case": "regressionCase",
    notes: "notes"
  };

  for (const [flag, field] of Object.entries(fieldMap)) {
    if (args[flag] !== undefined) {
      issue[field] = args[flag];
    }
  }

  if (args["affected-files"] !== undefined) {
    issue.affectedFiles = splitList(args["affected-files"]);
  }

  issue.updatedAt = new Date().toISOString();
  db.lastUpdated = issue.updatedAt;
  await writeFile(ISSUE_PATH, `${JSON.stringify(db, null, 2)}\n`, "utf8");

  console.log(`Updated ${issue.id}`);
  console.log(`Status: ${issue.status}`);
}

main().catch((error) => {
  console.error(error.message);
  usage();
  process.exit(1);
});
