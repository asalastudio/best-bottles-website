#!/usr/bin/env node

/**
 * Shopify Metafield & Metaobject Definitions
 *
 * Creates all metafield definitions needed for Best Bottles packaging
 * attributes on the bestbottles-1580 Shopify Plus store.
 *
 * Run once after store provisioning:
 *   node scripts/shopify-create-metafields.mjs
 *
 * Or use Shopify CLI (no Admin token in .env needed; uses `shopify store auth`):
 *   npx @shopify/cli@latest store auth -s YOUR.myshopify.com --scopes read_products,write_products
 *   node scripts/shopify-create-metafields.mjs --cli
 *
 * Safe to re-run: skips definitions that already exist.
 *
 * Prerequisites:
 *   Token mode: SHOPIFY_ADMIN_TOKEN + NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN in .env.local
 *   CLI mode:    NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN + prior `shopify store auth` for that store
 */

import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

// Load .env.local
const envPath = resolve(import.meta.dirname ?? ".", "..", ".env.local");
try {
    const raw = readFileSync(envPath, "utf-8");
    for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx < 0) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (val.includes("#")) val = val.slice(0, val.indexOf("#")).trim();
        if (!process.env[key]) process.env[key] = val;
    }
} catch { /* .env.local optional */ }

const USE_CLI =
    process.argv.includes("--cli") || process.env.SHOPIFY_USE_CLI === "1";

const DOMAIN = (process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? "")
    .replace(/^https?:\/\//, "").replace(/\/$/, "");
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION = "2025-01";

if (!DOMAIN) {
    console.error("Missing NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN");
    process.exit(1);
}
if (!USE_CLI && !TOKEN) {
    console.error(
        "Missing SHOPIFY_ADMIN_TOKEN (or pass --cli after `shopify store auth`)",
    );
    process.exit(1);
}

/** Admin GraphQL via HTTPS + custom app token */
async function adminGQLFetch(query, variables = {}) {
    const res = await fetch(`https://${DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": TOKEN,
        },
        body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`Shopify ${res.status}: ${await res.text()}`);
    const json = await res.json();
    if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join(", "));
    return json.data;
}

/** Admin GraphQL via `shopify store execute` (CLI session from `shopify store auth`) */
function adminGQLCli(query, variables) {
    const dir = mkdtempSync(join(tmpdir(), "bb-shopify-gql-"));
    const outFile = join(dir, "out.json");
    const varFile = join(dir, "vars.json");
    writeFileSync(varFile, JSON.stringify(variables), "utf-8");
    try {
        execFileSync(
            "npx",
            [
                "@shopify/cli@latest",
                "store",
                "execute",
                "-s",
                DOMAIN,
                "--allow-mutations",
                "--no-color",
                "-j",
                "-q",
                query.replace(/\s+/g, " ").trim(),
                "--variable-file",
                varFile,
                "--output-file",
                outFile,
            ],
            { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 50 * 1024 * 1024 },
        );
    } catch (e) {
        try {
            rmSync(dir, { recursive: true, force: true });
        } catch { /* ignore */ }
        throw new Error(e instanceof Error ? e.message : String(e));
    } finally {
        try {
            unlinkSync(varFile);
        } catch { /* ignore */ }
    }
    let raw;
    try {
        raw = readFileSync(outFile, "utf-8");
    } finally {
        try {
            rmSync(dir, { recursive: true, force: true });
        } catch { /* ignore */ }
    }
    const parsed = JSON.parse(raw);
    if (parsed.errors?.length) {
        throw new Error(parsed.errors.map(e => e.message).join(", "));
    }
    return parsed;
}

async function adminGQL(query, variables = {}) {
    if (USE_CLI) {
        return adminGQLCli(query, variables);
    }
    return adminGQLFetch(query, variables);
}

// ─── Product-level metafield definitions ────────────────────────────────────

const PRODUCT_METAFIELDS = [
    {
        name: "Bottle Family",
        namespace: "custom",
        key: "bottle_family",
        type: "single_line_text_field",
        description: "Design family name (e.g. Cylinder, Elegant, Boston Round)",
    },
    {
        name: "Capacity Label",
        namespace: "custom",
        key: "capacity_label",
        type: "single_line_text_field",
        description: "Human-readable capacity (e.g. 9 ml, 100 ml)",
    },
    {
        name: "Capacity (ml)",
        namespace: "custom",
        key: "capacity_ml",
        type: "number_integer",
        description: "Numeric capacity in milliliters for filtering/sorting",
    },
    {
        name: "Neck Thread Size",
        namespace: "custom",
        key: "neck_thread_size",
        type: "single_line_text_field",
        description: "Thread specification (e.g. 13-415, 18-415) for fitment matching",
    },
    {
        name: "Applicator Types",
        namespace: "custom",
        key: "applicator_types",
        type: "list.single_line_text_field",
        description: "Available applicator types for this product group",
    },
    {
        name: "Case Quantity",
        namespace: "custom",
        key: "case_quantity",
        type: "number_integer",
        description: "Units per case for B2B ordering",
    },
    {
        name: "Height With Cap",
        namespace: "custom",
        key: "height_with_cap",
        type: "single_line_text_field",
        description: "Product height with cap (e.g. 3.5 in)",
    },
    {
        name: "Height Without Cap",
        namespace: "custom",
        key: "height_without_cap",
        type: "single_line_text_field",
        description: "Product height without cap",
    },
    {
        name: "Diameter",
        namespace: "custom",
        key: "diameter",
        type: "single_line_text_field",
        description: "Product diameter",
    },
    {
        name: "Weight (grams)",
        namespace: "custom",
        key: "weight_grams",
        type: "number_decimal",
        description: "Bottle weight in grams",
    },
    {
        name: "Paper Doll Family Key",
        namespace: "custom",
        key: "paper_doll_family_key",
        type: "single_line_text_field",
        description: "Sanity Paper Doll reference key (e.g. CYL-9ML)",
    },
    {
        name: "Compatible Threads",
        namespace: "custom",
        key: "compatible_threads",
        type: "list.single_line_text_field",
        description: "Thread sizes this product is compatible with",
    },
];

// ─── Variant-level metafield definitions ────────────────────────────────────

const VARIANT_METAFIELDS = [
    {
        name: "Trim Color",
        namespace: "custom",
        key: "trim_color",
        type: "single_line_text_field",
        description: "Trim/accent color (e.g. Gold, Silver)",
    },
    {
        name: "Cap Style",
        namespace: "custom",
        key: "cap_style",
        type: "single_line_text_field",
        description: "Cap style descriptor (e.g. Dome, Flat)",
    },
    {
        name: "Cap Height",
        namespace: "custom",
        key: "cap_height",
        type: "single_line_text_field",
        description: "Cap height category: Short, Tall, or Leather",
    },
    {
        name: "Ball Material",
        namespace: "custom",
        key: "ball_material",
        type: "single_line_text_field",
        description: "Roller ball material (Metal, Plastic, Glass)",
    },
    {
        name: "Assembly Type",
        namespace: "custom",
        key: "assembly_type",
        type: "single_line_text_field",
        description: "Assembly type for components (2-part, 3-part, complete-set)",
    },
    {
        name: "Component Group",
        namespace: "custom",
        key: "component_group",
        type: "single_line_text_field",
        description: "Component classification (Fine Mist Sprayer, Roll-On Cap, etc.)",
    },
    {
        name: "Grace SKU",
        namespace: "custom",
        key: "grace_sku",
        type: "single_line_text_field",
        description: "Legacy Grace SKU if different from variant.sku",
    },
];

// ─── Create definitions ─────────────────────────────────────────────────────

const CREATE_MUTATION = `
    mutation CreateMetafieldDef($definition: MetafieldDefinitionInput!) {
        metafieldDefinitionCreate(definition: $definition) {
            createdDefinition { id name }
            userErrors { message field }
        }
    }
`;

async function createDefinition(def, ownerType) {
    try {
        const data = await adminGQL(CREATE_MUTATION, {
            definition: {
                name: def.name,
                namespace: def.namespace,
                key: def.key,
                type: def.type,
                ownerType,
                description: def.description,
            },
        });

        const result = data.metafieldDefinitionCreate;
        if (result.userErrors.length > 0) {
            const msg = result.userErrors.map(e => e.message).join(", ");
            if (msg.includes("already exists") || msg.includes("taken")) {
                console.log(`  ✓ ${ownerType} ${def.namespace}.${def.key} — already exists`);
                return;
            }
            console.error(`  ✗ ${def.key}: ${msg}`);
            return;
        }

        console.log(`  + ${ownerType} ${def.namespace}.${def.key} — created (${result.createdDefinition.id})`);
    } catch (err) {
        console.error(`  ✗ ${def.key}: ${err.message}`);
    }
}

async function main() {
    console.log("═══════════════════════════════════════════════════════");
    console.log("  Best Bottles — Shopify Metafield Definitions Setup");
    console.log(`  Store: ${DOMAIN}`);
    console.log(`  Mode:  ${USE_CLI ? "Shopify CLI (store execute)" : "Admin API token"}`);
    console.log("═══════════════════════════════════════════════════════\n");

    console.log("Product-level metafields:");
    for (const def of PRODUCT_METAFIELDS) {
        await createDefinition(def, "PRODUCT");
    }

    console.log("\nVariant-level metafields:");
    for (const def of VARIANT_METAFIELDS) {
        await createDefinition(def, "PRODUCTVARIANT");
    }

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  Done. Metafield definitions are ready.");
    console.log("═══════════════════════════════════════════════════════");
}

main().catch(err => {
    console.error("Fatal:", err);
    process.exit(1);
});
