#!/usr/bin/env node

import { spawn } from "node:child_process";

function runAudit() {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["scripts/audit_grace_navigation.mjs", "--json"], {
      stdio: ["ignore", "pipe", "inherit"],
    });

    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Navigation audit exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(error);
      }
    });
  });
}

const report = await runAudit();
const fakeSlugCases = report.results.filter((row) => row.label.startsWith("[hallucination]"));
const broken = fakeSlugCases.filter((row) => row.status !== "pass");

console.log("GI-0003 verification");
console.log(JSON.stringify({
  summary: report.summary,
  fakeSlugCases: fakeSlugCases.map((row) => ({
    label: row.label,
    url: row.url,
    status: row.status,
    reason: row.reason,
  })),
}, null, 2));

if (report.summary.broken !== 0 || report.summary.warn !== 0 || report.summary.noResults !== 0) {
  console.error("\nGI-0003 verification failed: navigation audit is not clean.");
  process.exit(1);
}

if (broken.length > 0) {
  console.error("\nGI-0003 verification failed: some hallucination cases are still unsafe.");
  process.exit(1);
}

console.log("\nGI-0003 verification passed.");
