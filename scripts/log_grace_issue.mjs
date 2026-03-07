#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const ISSUE_PATH = path.join(DATA_DIR, "grace_audit_issues.json");

const VALID_SEVERITIES = new Set(["P0", "P1", "P2"]);
const VALID_STATUSES = new Set(["open", "triaged", "in_progress", "fixed", "verified", "wontfix"]);

function usage() {
  console.log(`Usage:
  node scripts/log_grace_issue.mjs \\
    --title "Roll-on filter mismatch" \\
    --severity P0 \\
    --category retrieval \\
    --surface homepage-chat \\
    --source manual-audit \\
    --prompt "Show me roll-on bottles" \\
    --expected "Roll-on products should be returned" \\
    --actual "Grace returned no results" \\
    --root-cause "Applicator vocabulary drift" \\
    --affected-files "convex/grace.ts,convex/schema.ts" \\
    --fix-script "scripts/grace-fixes/GI-0001-normalize-rollons.mjs"

Optional:
  --status open|triaged|in_progress|fixed|verified|wontfix
  --owner "Jordan"
  --notes "Any extra context"
  --regression-case "S1"

This script appends a new issue to data/grace_audit_issues.json.`);
}

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
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

async function loadDb() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(ISSUE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return { version: 1, lastUpdated: null, issues: [] };
  }
}

function nextId(issues) {
  const max = issues.reduce((acc, issue) => {
    const match = /^GI-(\d+)$/.exec(issue.id ?? "");
    return match ? Math.max(acc, Number(match[1])) : acc;
  }, 0);
  return `GI-${String(max + 1).padStart(4, "0")}`;
}

function splitList(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function requireField(args, key) {
  if (!args[key]) {
    throw new Error(`Missing required flag --${key}`);
  }
  return args[key];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "true") {
    usage();
    return;
  }

  const severity = requireField(args, "severity");
  const status = args.status ?? "open";

  if (!VALID_SEVERITIES.has(severity)) {
    throw new Error(`Invalid severity "${severity}". Use one of: ${[...VALID_SEVERITIES].join(", ")}`);
  }
  if (!VALID_STATUSES.has(status)) {
    throw new Error(`Invalid status "${status}". Use one of: ${[...VALID_STATUSES].join(", ")}`);
  }

  const db = await loadDb();
  const createdAt = new Date().toISOString();
  const issue = {
    id: nextId(db.issues),
    createdAt,
    updatedAt: createdAt,
    status,
    severity,
    title: requireField(args, "title"),
    category: requireField(args, "category"),
    surface: requireField(args, "surface"),
    source: requireField(args, "source"),
    prompt: requireField(args, "prompt"),
    expected: requireField(args, "expected"),
    actual: requireField(args, "actual"),
    rootCause: args["root-cause"] ?? null,
    affectedFiles: splitList(args["affected-files"]),
    fixScript: args["fix-script"] ?? null,
    owner: args.owner ?? null,
    regressionCase: args["regression-case"] ?? null,
    notes: args.notes ?? null
  };

  db.issues.push(issue);
  db.lastUpdated = createdAt;
  await writeFile(ISSUE_PATH, `${JSON.stringify(db, null, 2)}\n`, "utf8");

  console.log(`Logged Grace issue ${issue.id}`);
  console.log(`Title: ${issue.title}`);
  console.log(`Severity: ${issue.severity}`);
  console.log(`Status: ${issue.status}`);
}

main().catch((error) => {
  console.error(error.message);
  usage();
  process.exit(1);
});
