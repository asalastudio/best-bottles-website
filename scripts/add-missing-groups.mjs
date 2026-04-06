/**
 * Add 2 missing product groups to Convex:
 *   1. Pillar 9ml Clear Roll-On (13-415)
 *   2. Cylinder 30ml Clear Roll-On (18-415)
 *
 * Prerequisites: 
 *   - The addProductGroup mutation must be deployed (in convex/migrations.ts)
 *   - Run: npx convex deploy  (or push via Vercel)
 *
 * Usage:
 *   node scripts/add-missing-groups.mjs
 *   node scripts/add-missing-groups.mjs --dry-run
 */

import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://helpful-elephant-638.convex.cloud");
const DRY_RUN = process.argv.includes('--dry-run');

const missingGroups = [
  {
    slug: "pillar-9ml-clear-13-415-rollon",
    displayName: "9 ml Clear Pillar Bottle with Roll-On",
    family: "Pillar",
    capacity: "9 ml",
    capacityMl: 9,
    color: "Clear",
    category: "Glass Bottle",
    bottleCollection: null,
    neckThreadSize: "13-415",
    variantCount: 2,  // GBPillar9MtlRollBlkdot + GBPillar9RollBlkDot
    priceRangeMin: 0.83,
    priceRangeMax: 0.89,
    applicatorTypes: ["Roll-On"],
  },
  {
    slug: "cylinder-30ml-clear-18-415-rollon",
    displayName: "30 ml Clear Cylinder Bottle with Roll-On",
    family: "Cylinder",
    capacity: "30 ml",
    capacityMl: 30,
    color: "Clear",
    category: "Glass Bottle",
    bottleCollection: null,
    neckThreadSize: "18-415",
    variantCount: 1,  // GBCyl1ozRollWht from live site
    priceRangeMin: null,
    priceRangeMax: null,
    applicatorTypes: ["Roll-On"],
  },
];

console.log("=== Adding 2 Missing Product Groups ===\n");

for (const group of missingGroups) {
  console.log(`${group.slug}`);
  console.log(`  ${group.displayName} | ${group.family} ${group.capacityMl}ml ${group.color} | ${group.neckThreadSize}`);
  console.log(`  Applicator: ${group.applicatorTypes.join(', ')} | Variants: ${group.variantCount}`);
  
  if (!DRY_RUN) {
    try {
      const result = await client.mutation("migrations:addProductGroup", group);
      if (result.skipped) {
        console.log(`  → SKIPPED (slug already exists, id: ${result.id})`);
      } else {
        console.log(`  → CREATED (id: ${result.id})`);
      }
    } catch (err) {
      console.error(`  → ERROR: ${err.message}`);
    }
  } else {
    console.log(`  → [DRY RUN] Would create`);
  }
  console.log();
}

if (!DRY_RUN) {
  // Also need to reassign the 2 Pillar roll-on products from the cap group to the new roll-on group
  console.log("=== Reassigning Pillar Roll-On Products ===\n");
  
  // Look up the new group
  const groups = await client.query("products:getAllCatalogGroups", {});
  const pillarRollon = groups.find(g => g.slug === "pillar-9ml-clear-13-415-rollon");
  
  if (pillarRollon) {
    // Find the roll-on products currently in the cap group
    const pillarCap = groups.find(g => g.slug === "pillar-9ml-clear-13-415");
    if (pillarCap) {
      // Patch the roll-on products to point to the new group
      // SKUs: GB-PIL-CLR-9ML-MRL-BDOT and GB-PIL-CLR-9ML-RBL-BDOT
      const rollonSkus = ["GB-PIL-CLR-9ML-MRL-BDOT", "GB-PIL-CLR-9ML-RBL-BDOT"];
      
      for (const sku of rollonSkus) {
        const product = await client.query("products:getBySku", { graceSku: sku });
        if (product) {
          await client.mutation("migrations:patchProductField", {
            id: product._id,
            fields: { productGroupId: pillarRollon._id }
          });
          console.log(`  ${sku} → reassigned to ${pillarRollon.slug}`);
        } else {
          console.log(`  ${sku} → NOT FOUND in products table`);
        }
      }
      
      // Update the cap group variant count (was 3, now 1 after removing 2 roll-ons)
      await client.mutation("migrations:patchProductGroupFields", {
        id: pillarCap._id,
        fields: { variantCount: 1 }
      });
      console.log(`\n  Updated ${pillarCap.slug} variantCount: 3 → 1`);
    }
  } else {
    console.log("  Pillar roll-on group not found — was it just created?");
  }
}

console.log("\nDone!");
