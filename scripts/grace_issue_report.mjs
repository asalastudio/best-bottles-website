#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

const ISSUE_PATH = path.join(process.cwd(), "data", "grace_audit_issues.json");

function byKey(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] ?? "unknown";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function printCounts(label, counts) {
  console.log(`\n${label}`);
  for (const [key, value] of Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${key}: ${value}`);
  }
}

async function main() {
  const raw = await readFile(ISSUE_PATH, "utf8");
  const db = JSON.parse(raw);
  const issues = db.issues ?? [];

  console.log("Grace Issue Report");
  console.log("==================");
  console.log(`Total issues: ${issues.length}`);
  console.log(`Last updated: ${db.lastUpdated ?? "never"}`);

  if (issues.length === 0) {
    console.log("\nNo Grace issues logged yet.");
    return;
  }

  printCounts("By status", byKey(issues, "status"));
  printCounts("By severity", byKey(issues, "severity"));
  printCounts("By category", byKey(issues, "category"));
  printCounts("By surface", byKey(issues, "surface"));

  const openIssues = issues.filter((issue) => !["fixed", "verified", "wontfix"].includes(issue.status));
  const priorityOrder = { P0: 0, P1: 1, P2: 2 };
  openIssues.sort((a, b) => {
    const severityCompare = (priorityOrder[a.severity] ?? 9) - (priorityOrder[b.severity] ?? 9);
    if (severityCompare !== 0) return severityCompare;
    return a.id.localeCompare(b.id);
  });

  console.log("\nOpen issue queue");
  for (const issue of openIssues) {
    console.log(`- ${issue.id} [${issue.severity}] ${issue.title}`);
    console.log(`  status=${issue.status} category=${issue.category} surface=${issue.surface}`);
    if (issue.fixScript) console.log(`  fixScript=${issue.fixScript}`);
    if (issue.owner) console.log(`  owner=${issue.owner}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
