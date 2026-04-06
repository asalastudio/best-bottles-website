#!/usr/bin/env node
/**
 * Shape Diagnostic — Tests whether Grace's search resolves natural-language
 * shape queries to the correct bottle families.
 *
 * Usage:  node scripts/shape-diagnostic.mjs
 *
 * Requires: npx convex CLI available and a running Convex deployment.
 * Reads from the products:searchProducts query.
 */

import { execSync } from "child_process";

// ── Shape Vocabulary → Expected Families ───────────────────────────────────
// Each test case simulates a real customer query and specifies which families
// MUST appear in the results for the query to be considered "passed."

const TEST_CASES = [
  // ── Square / Angular ──
  {
    query: "square bottle",
    expectedFamilies: ["Square"],
    alsoAcceptable: ["Elegant", "Flair", "Rectangle"],
    description: "Customer asks for a square bottle",
  },
  {
    query: "square 15ml",
    expectedFamilies: ["Square"],
    alsoAcceptable: ["Elegant"],
    description: "Specific size square request (exact match exists)",
  },
  {
    query: "square 50ml",
    expectedFamilies: ["Empire"],
    alsoAcceptable: ["Elegant", "Square"],
    description: "Empire 50ml is a true square — direct hit",
  },
  {
    query: "flat bottle",
    expectedFamilies: ["Elegant", "Flair"],
    alsoAcceptable: ["Rectangle", "Grace"],
    description: "Customer asks for a flat bottle",
  },
  {
    query: "rectangular bottle",
    expectedFamilies: ["Elegant", "Rectangle"],
    alsoAcceptable: ["Flair"],
    description: "Customer asks for a rectangular bottle",
  },
  {
    query: "boxy bottle",
    expectedFamilies: ["Square", "Elegant"],
    alsoAcceptable: ["Rectangle"],
    description: "Customer uses 'boxy' — angular/squared shape",
  },

  // ── Round ──
  {
    query: "round bottle",
    expectedFamilies: ["Round"],
    alsoAcceptable: ["Circle", "Boston Round", "Diva"],
    description: "Customer asks for round bottle",
  },
  {
    query: "circular bottle",
    expectedFamilies: ["Circle"],
    alsoAcceptable: ["Round", "Boston Round"],
    description: "Customer asks for circular bottle",
  },
  {
    query: "globe bottle",
    expectedFamilies: ["Round"],
    alsoAcceptable: ["Diva", "Circle"],
    description: "Customer asks for globe-shaped",
  },

  // ── Cylindrical ──
  {
    query: "cylindrical bottle",
    expectedFamilies: ["Cylinder"],
    alsoAcceptable: ["Slim", "Pillar", "Royal"],
    description: "Customer asks for a cylinder",
  },
  {
    query: "tube bottle",
    expectedFamilies: ["Cylinder"],
    alsoAcceptable: ["Slim", "Sleek"],
    description: "Customer uses 'tube' for cylindrical",
  },
  {
    query: "tall thin bottle",
    expectedFamilies: ["Sleek"],
    alsoAcceptable: ["Slim", "Cylinder"],
    description: "Customer wants a tall skinny bottle",
  },
  {
    query: "slim bottle",
    expectedFamilies: ["Slim"],
    alsoAcceptable: ["Sleek", "Cylinder"],
    description: "Customer says 'slim'",
  },

  // ── Specialty shapes ──
  {
    query: "teardrop bottle",
    expectedFamilies: ["Teardrop"],
    alsoAcceptable: ["Apothecary"],
    description: "Customer asks for teardrop",
  },
  {
    query: "diamond shaped bottle",
    expectedFamilies: ["Diamond"],
    alsoAcceptable: [],
    description: "Customer asks for diamond shape",
  },
  {
    query: "bell shaped bottle",
    expectedFamilies: ["Bell"],
    alsoAcceptable: [],
    description: "Customer asks for bell shape",
  },
  {
    query: "heart shaped bottle",
    expectedFamilies: ["Decorative"],
    alsoAcceptable: [],
    description: "Customer asks for heart shape",
  },
  {
    query: "apothecary bottle",
    expectedFamilies: ["Apothecary"],
    alsoAcceptable: ["Boston Round"],
    description: "Customer asks for apothecary style",
  },
  {
    query: "pear shaped bottle",
    expectedFamilies: ["Apothecary"],
    alsoAcceptable: ["Teardrop"],
    description: "Customer asks for pear shape",
  },
  {
    query: "oval bottle",
    expectedFamilies: ["Grace"],
    alsoAcceptable: ["Diva", "Circle"],
    description: "Customer asks for oval shape",
  },

  // ── Classic / Use-case ──
  {
    query: "classic perfume bottle",
    expectedFamilies: ["Diva", "Empire", "Elegant"],
    alsoAcceptable: ["Grace", "Diamond"],
    description: "Customer says 'classic perfume bottle'",
  },
  {
    query: "lab bottle",
    expectedFamilies: ["Boston Round"],
    alsoAcceptable: ["Apothecary"],
    description: "Customer asks for lab/pharmacy bottle",
  },

  // ── Adjacent Size Tests ──
  {
    query: "square 30ml",
    expectedFamilies: [],
    shouldSuggestAdjacent: { shape: "flat/angular", nearestSizes: [30] },
    alsoAcceptable: ["Elegant"],
    description: "30ml square doesn't exist — Elegant 30ml is the answer",
  },
  {
    query: "square 100ml",
    expectedFamilies: ["Empire"],
    alsoAcceptable: ["Elegant", "Square"],
    description: "Empire 100ml is a true square — direct hit, plus Elegant 100ml",
  },
  {
    query: "flat 50ml",
    expectedFamilies: ["Empire"],
    alsoAcceptable: ["Elegant", "Grace"],
    description: "Empire 50ml is a flat/angular 50ml — direct hit, plus Elegant 60ml or Grace 55ml",
  },
];

// ── Runner ─────────────────────────────────────────────────────────────────

function runSearch(searchTerm) {
  try {
    // Test grace:searchCatalog (Grace's actual search pipeline with shape detection)
    const raw = execSync(
      `npx convex run grace:searchCatalog '${JSON.stringify({ searchTerm })}' --no-push 2>&1`,
      { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 }
    );
    const families = [...raw.matchAll(/"family":\s*"([^"]+)"/g)].map((m) => m[1]);
    const capacities = [...raw.matchAll(/"capacityMl":\s*(\d+)/g)].map((m) => Number(m[1]));
    const uniqueFamilies = [...new Set(families)];
    const uniqueCaps = [...new Set(capacities)].sort((a, b) => a - b);
    return { families: uniqueFamilies, capacities: uniqueCaps, resultCount: families.length };
  } catch {
    return { families: [], capacities: [], resultCount: 0, error: true };
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   Best Bottles — Shape Query Diagnostic                 ║");
  console.log("║   Testing Grace's search resolution for shape queries   ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  let passed = 0;
  let failed = 0;
  let warnings = 0;
  const failures = [];

  for (const tc of TEST_CASES) {
    const result = runSearch(tc.query);
    const foundExpected = tc.expectedFamilies.every((f) => result.families.includes(f));
    const foundAny = tc.expectedFamilies.length === 0
      ? tc.alsoAcceptable.some((f) => result.families.includes(f))
      : foundExpected;
    const foundAlso = tc.alsoAcceptable.filter((f) => result.families.includes(f));

    let status;
    if (tc.expectedFamilies.length > 0 && foundExpected) {
      status = "✅ PASS";
      passed++;
    } else if (tc.expectedFamilies.length === 0 && foundAny) {
      status = "✅ PASS (adjacent)";
      passed++;
    } else if (tc.expectedFamilies.length === 0 && !foundAny) {
      status = "⚠️  ADJACENT MISS";
      warnings++;
      failures.push(tc);
    } else {
      status = "❌ FAIL";
      failed++;
      failures.push(tc);
    }

    const missing = tc.expectedFamilies.filter((f) => !result.families.includes(f));

    console.log(`${status}  "${tc.query}"`);
    console.log(`  ${tc.description}`);
    console.log(`  Results: ${result.resultCount} products across [${result.families.join(", ")}]`);
    if (missing.length > 0) console.log(`  MISSING: [${missing.join(", ")}]`);
    if (foundAlso.length > 0) console.log(`  Also found: [${foundAlso.join(", ")}]`);
    if (tc.shouldSuggestAdjacent) {
      console.log(`  Adjacent sizes in results: [${result.capacities.join(", ")}ml]`);
    }
    console.log();
  }

  console.log("══════════════════════════════════════════════════════════");
  console.log(`RESULTS: ${passed} passed, ${failed} failed, ${warnings} adjacent misses`);
  console.log(`Total tests: ${TEST_CASES.length}`);
  console.log();

  if (failures.length > 0) {
    console.log("FAILURES & WARNINGS:");
    for (const f of failures) {
      console.log(`  - "${f.query}" → expected [${f.expectedFamilies.join(", ")}${f.alsoAcceptable.length ? " or " + f.alsoAcceptable.join(", ") : ""}]`);
    }
  }

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("RECOMMENDATIONS:");
  if (failed > 0 || warnings > 0) {
    console.log("1. Add shape vocabulary → family mapping to Grace prompt");
    console.log("2. Add shape-based normalization to graceSearchUtils.ts");
    console.log("3. Populate the `shape` field on products table");
    console.log("4. Add adjacent-size suggestion logic for shape queries");
  } else {
    console.log("All shape queries resolved correctly.");
  }
}

main().catch(console.error);
