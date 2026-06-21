#!/usr/bin/env node
/**
 * Read-only Best Bottles product truth reconciliation audit.
 *
 * Compares Convex catalog rows with legacy bestbottles.com product evidence and
 * optional Madison target SKUs. This script writes report files only.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEFAULT_BROWSERLESS_BASE_URL = "https://production-sfo.browserless.io";
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121 Safari/537.36";

export function clean(value) {
    return typeof value === "string" ? value.trim() : "";
}

export function compactSku(value) {
    return clean(value).replace(/[^a-z0-9]/gi, "").toUpperCase();
}

export function normalizeText(value) {
    return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeCapacityMl(value) {
    const match = clean(value).match(/(\d+(?:\.\d+)?)\s*ml\b/i);
    return match ? Number(match[1]) : null;
}

export function stripHtmlToText(html) {
    return clean(html)
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/\s+/g, " ")
        .trim();
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractLabeledText(pageText, label, stopLabels) {
    const stopPattern = stopLabels.map(escapeRegExp).join("|");
    const pattern = new RegExp(`${escapeRegExp(label)}\\s*:\\s*(.+?)(?=(?:${stopPattern})\\s*:|1\\s*pcs?\\s*[-–]|$)`, "i");
    const match = pageText.match(pattern);
    return match ? cleanSpecValue(match[1]) : null;
}

function cleanSpecValue(value) {
    return clean(value)
        .replace(/\s+/g, " ")
        .replace(/\s*Nemat International.*$/i, "")
        .replace(/\s*Copyright\s+\d{4}.*$/i, "")
        .trim();
}

function normalizeNeckThread(value) {
    const match = clean(value).match(/\b\d{2}-\d{3}\b/);
    return match ? match[0] : clean(value) || null;
}

export function inferLegacyIdentity(fields) {
    const haystack = normalizeText([
        fields.productUrl,
        fields.itemType,
        fields.itemName,
        fields.itemDescription,
    ].filter(Boolean).join(" "));

    const family = /\bvial\b|\bvials\b/.test(haystack)
        ? "Vial"
        : /\bboston round\b/.test(haystack)
            ? "Boston Round"
        : /\bcylinder\b/.test(haystack)
            ? "Cylinder"
            : null;

    const color =
        /\bcobalt blue\b|\bblue glass\b/.test(haystack) ? "Cobalt Blue" :
        /\bamber glass\b|\bamber bottle\b/.test(haystack) ? "Amber" :
        /\bfrosted glass\b|\bfrosted bottle\b/.test(haystack) ? "Frosted" :
        /\bclear glass\b|\bclear bottle\b|\bclear vial\b/.test(haystack) ? "Clear" :
        /\bgreen glass\b|\bgreen bottle\b/.test(haystack) ? "Green" :
        /\bwhite glass\b|\bwhite bottle\b/.test(haystack) ? "White" :
        null;

    const applicator =
        /\bglass rod\b|\bglass wand\b/.test(haystack) ? "Glass Rod" :
        /\broll on\b|\broll-on\b|\broller\b/.test(haystack) ? "Roll-On" :
        /\bfine mist\b|\bspray\b|\bsprayer\b/.test(haystack) ? "Sprayer" :
        /\blotion pump\b/.test(haystack) ? "Lotion Pump" :
        null;

    const capFinish =
        /\bblack cap\b/.test(haystack) ? "Black" :
        /\bwhite cap\b/.test(haystack) ? "White" :
        /\bcopper\b/.test(haystack) ? "Copper" :
        /\bshiny gold\b|\bgold cap\b/.test(haystack) ? "Shiny Gold" :
        /\bshiny silver\b|\bsilver cap\b/.test(haystack) ? "Shiny Silver" :
        null;

    return { family, color, applicator, capFinish };
}

export function parseLegacyProductPage({ html, url }) {
    const pageText = stripHtmlToText(html);
    const labels = [
        "Item Type",
        "Item Name",
        "Item Description",
        "Item Capacity",
        "Item Height with Cap",
        "Item Height without Cap",
        "Item Diameter",
        "Item Width",
        "Item Depth",
        "Neck Thread Size",
        "Closure Type",
    ];

    const itemType = extractLabeledText(pageText, "Item Type", labels);
    const itemName = extractLabeledText(pageText, "Item Name", labels);
    const itemDescription = extractLabeledText(pageText, "Item Description", labels);
    const capacityRaw = extractLabeledText(pageText, "Item Capacity", labels);
    const neckThreadSize = normalizeNeckThread(extractLabeledText(pageText, "Neck Thread Size", labels));
    const closureType = extractLabeledText(pageText, "Closure Type", labels);
    const imageMatch = html.match(/src=["'][^"']*(?:enlarged_pics|store\/capped)\/([^"'/]+\.(?:gif|jpg|jpeg|png|webp))["']/i);
    const imageFile = imageMatch ? imageMatch[1] : null;
    const websiteSku = itemName || (imageFile ? imageFile.replace(/\.[^.]+$/, "") : null);
    const identity = inferLegacyIdentity({ productUrl: url, itemType, itemName, itemDescription });

    return {
        productUrl: url,
        websiteSku,
        itemType,
        itemName,
        itemDescription,
        capacityRaw,
        capacityMl: normalizeCapacityMl(capacityRaw || itemDescription || ""),
        neckThreadSize,
        closureType,
        imageFile,
        ...identity,
    };
}

function absoluteLegacyUrl(value, baseUrl) {
    if (!value) return null;
    try {
        return new URL(value, baseUrl || "https://www.bestbottles.com/").href;
    } catch {
        return value;
    }
}

function extractLegacySku(value) {
    const compacted = clean(value).match(/\b(?:GB|LB)[A-Za-z0-9-]{3,}\b/);
    return compacted ? compacted[0] : null;
}

function parseLegacySearchCard(cardHtml, baseUrl) {
    const linkMatch = cardHtml.match(/href=["']([^"']*(?:\/product\/|product\/)[^"']+)["']/i);
    const imageMatch = cardHtml.match(/(?:data-original|data-src|src)=["']([^"']+\.(?:gif|jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/i);
    const text = stripHtmlToText(cardHtml);
    const productUrl = absoluteLegacyUrl(linkMatch?.[1], baseUrl);
    const imageUrl = absoluteLegacyUrl(imageMatch?.[1], baseUrl);
    const imageFile = imageUrl ? imageUrl.split("/").pop()?.split("?")[0] ?? null : null;
    const websiteSku = extractLegacySku(text) || extractLegacySku(productUrl || "") || extractLegacySku(imageFile || "");
    const identity = inferLegacyIdentity({
        productUrl,
        itemType: text,
        itemName: websiteSku,
        itemDescription: text,
    });

    return {
        productUrl,
        websiteSku,
        itemName: websiteSku,
        itemDescription: text,
        capacityRaw: text.match(/\b\d+(?:\.\d+)?\s*ml\b/i)?.[0] ?? null,
        capacityMl: normalizeCapacityMl(text),
        neckThreadSize: normalizeNeckThread(text),
        imageUrl,
        imageFile,
        ...identity,
    };
}

export function parseLegacySearchPage({ html, url }) {
    const products = [];
    const seen = new Set();
    const cardPatterns = [
        /<div[^>]*class=["'][^"']*product-list-item[^"']*["'][\s\S]*?(?=<div[^>]*class=["'][^"']*product-list-item|<\/body>|$)/gi,
        /<div[^>]*class=["'][^"']*ProdDetailsDiv[^"']*["'][\s\S]*?(?=<div[^>]*class=["'][^"']*ProdDetailsDiv|<\/body>|$)/gi,
        /<a[^>]+href=["'][^"']*(?:\/product\/|product\/)[^"']+["'][\s\S]*?<\/a>/gi,
    ];

    for (const pattern of cardPatterns) {
        for (const match of html.matchAll(pattern)) {
            const product = parseLegacySearchCard(match[0], url);
            const key = compactSku(product.websiteSku) || normalizeText(product.productUrl);
            if (!key || seen.has(key)) continue;
            seen.add(key);
            products.push(product);
        }
    }

    return {
        searchUrl: url,
        searchText: stripHtmlToText(html).slice(0, 1000),
        products,
    };
}

export function loadRouteOverrides(filePath = resolve(ROOT, "src/lib/products/legacy-product-route-overrides.ts")) {
    if (!existsSync(filePath)) return {};
    const content = readFileSync(filePath, "utf8");
    const overrides = {};
    for (const match of content.matchAll(/["']([^"']+)["']\s*:\s*["']([^"']+)["']/g)) {
        overrides[match[1]] = match[2];
    }
    return overrides;
}

function productMatchesFilters(product, filters) {
    if (filters.sku) {
        const wanted = compactSku(filters.sku);
        if (compactSku(product.websiteSku) !== wanted && compactSku(product.graceSku) !== wanted) return false;
    }
    if (filters.families.length > 0) {
        const family = normalizeText(product.family);
        if (!filters.families.map(normalizeText).includes(family)) return false;
    }
    if (filters.capacityMl != null && Number(product.capacityMl) !== filters.capacityMl) return false;
    return true;
}

function findMatchingConvexProducts(products, legacyProduct) {
    const legacySku = compactSku(legacyProduct.websiteSku);
    const urlTail = normalizeText((legacyProduct.productUrl || "").split("/").pop() || "");
    const itemName = normalizeText(legacyProduct.itemName);

    const exact = products.filter((product) =>
        compactSku(product.websiteSku) === legacySku ||
        compactSku(product.graceSku) === legacySku
    );
    if (exact.length > 0) return { strategy: "websiteSku_or_graceSku", matches: exact };

    const urlMatches = products.filter((product) => {
        const productUrl = normalizeText(product.productUrl || "");
        const slug = normalizeText(product.slug || "");
        return Boolean(urlTail) && (productUrl.includes(urlTail) || slug.includes(urlTail));
    });
    if (urlMatches.length > 0) return { strategy: "legacy_url_tail", matches: urlMatches };

    const weak = products.filter((product) => itemName && normalizeText(product.itemName).includes(itemName));
    return { strategy: weak.length ? "item_name_weak" : "none", matches: weak };
}

function fieldMismatch(issueType, severity, message, evidence = {}) {
    return { issueType, severity, message, evidence };
}

function mediaSource(product) {
    const urls = [
        product?.shopifyMediaUrl,
        product?.shopifyImageUrl,
        product?.imageUrl,
        product?.imageUrlCapOff,
    ].map(clean).filter(Boolean);
    if (urls.some((url) => /cdn\.shopify\.com/i.test(url))) return "shopify";
    if (urls.some((url) => /bestbottles\.com|nematinternational/i.test(url))) return "legacy";
    if (urls.length > 0) return "other";
    return "missing";
}

function hasShopifyMedia(product) {
    return mediaSource(product) === "shopify";
}

function summarizeConvexProduct(product) {
    return {
        slug: product.slug,
        websiteSku: product.websiteSku,
        graceSku: product.graceSku,
        itemName: product.itemName,
        family: product.family,
        color: product.color,
        applicator: product.applicator,
        neckThreadSize: product.neckThreadSize,
        capacityMl: product.capacityMl,
        imageUrl: product.imageUrl ?? null,
        imageUrlCapOff: product.imageUrlCapOff ?? null,
        mediaSource: mediaSource(product),
        productUrl: product.productUrl ?? null,
    };
}

function familyFromGraceSkuPrefix(graceSku) {
    const sku = clean(graceSku).toUpperCase();
    if (sku.startsWith("GB-CYL-")) return "Cylinder";
    if (sku.startsWith("GB-VIAL-") || sku.startsWith("GB-VIL-")) return "Vial";
    if (sku.startsWith("GB-BR-")) return "Boston Round";
    if (sku.startsWith("GB-DVA-")) return "Diva";
    if (sku.startsWith("GB-GRC-")) return "Grace";
    if (sku.startsWith("GB-EMP-")) return "Empire";
    return null;
}

function findFamilyPrefixRisk(product) {
    const prefixFamily = familyFromGraceSkuPrefix(product.graceSku);
    if (!prefixFamily || !product.family) return null;
    if (normalizeText(prefixFamily) === normalizeText(product.family)) return null;

    return fieldMismatch("madison_resolver_risk", "medium", "Convex family and Grace SKU prefix disagree. Madison should prefer websiteSku, Convex family, and explicit product metadata over the Grace SKU prefix for this row.", {
        slug: product.slug,
        websiteSku: product.websiteSku,
        graceSku: product.graceSku,
        convexFamily: product.family,
        graceSkuPrefixFamily: prefixFamily,
        itemName: product.itemName,
    });
}

function reconcileFilteredCatalogProducts({ convexProducts, enabled }) {
    const issues = [];
    if (!enabled) return { issues };

    for (const product of convexProducts) {
        const familyPrefixRisk = findFamilyPrefixRisk(product);
        if (familyPrefixRisk) issues.push(familyPrefixRisk);

        const family = normalizeText(product.family);
        const text = normalizeText([product.itemName, product.applicator, product.slug].filter(Boolean).join(" "));
        if (family === "vial" && /\broll\b|\brollon\b|\broller\b/.test(text)) {
            issues.push(fieldMismatch("applicator_mismatch", "high", "A Vial catalog row still looks like a roll-on/roller product. Confirm it is not being surfaced under roll-on shopping paths.", {
                slug: product.slug,
                websiteSku: product.websiteSku,
                graceSku: product.graceSku,
                itemName: product.itemName,
                applicator: product.applicator,
            }));
        }

        if (!hasShopifyMedia(product)) {
            issues.push(fieldMismatch("missing_shopify_media", "medium", "Filtered product is findable, but does not have a Shopify CDN media URL in Convex. It may still render a placeholder or legacy/non-production image in the UI.", {
                slug: product.slug,
                websiteSku: product.websiteSku,
                graceSku: product.graceSku,
                mediaSource: mediaSource(product),
                imageUrl: product.imageUrl ?? null,
            }));
        }
    }

    return { issues };
}

function reconcileLegacySearchProducts({ convexProducts, legacySearch = null }) {
    const issues = [];
    const matchedProducts = [];
    if (!legacySearch) {
        return { issues, matchedProducts, summary: null };
    }

    if (legacySearch.products.length === 0) {
        issues.push(fieldMismatch("missing_legacy_match", "medium", "Legacy search page did not expose product cards in static HTML. Use browser-rendered capture or the underlying AJAX endpoint for this family.", {
            legacySearchUrl: legacySearch.searchUrl,
        }));
    }

    for (const legacyProduct of legacySearch.products) {
        const matchInfo = findMatchingConvexProducts(convexProducts, legacyProduct);
        if (matchInfo.matches.length === 0) {
            issues.push(fieldMismatch("missing_convex_match", "high", "Legacy search product did not match any Convex product.", {
                legacyWebsiteSku: legacyProduct.websiteSku,
                legacyUrl: legacyProduct.productUrl,
                legacyImageUrl: legacyProduct.imageUrl,
            }));
            continue;
        }

        for (const product of matchInfo.matches) {
            matchedProducts.push(product);
            if (!hasShopifyMedia(product)) {
                issues.push(fieldMismatch("missing_shopify_media", "medium", "Legacy search product matched Convex, but the Convex row has no obvious cached Shopify/media image URL.", {
                    legacyWebsiteSku: legacyProduct.websiteSku,
                    websiteSku: product.websiteSku,
                    graceSku: product.graceSku,
                    slug: product.slug,
                    legacyImageUrl: legacyProduct.imageUrl,
                }));
            }
        }
    }

    return {
        issues,
        matchedProducts,
        summary: {
            legacySearchCount: legacySearch.products.length,
            legacySearchMatched: new Set(matchedProducts.map((product) => compactSku(product.websiteSku) || compactSku(product.graceSku))).size,
            legacySearchMissingInConvex: issues.filter((issue) => issue.issueType === "missing_convex_match").length,
            legacySearchMissingMedia: issues.filter((issue) => issue.issueType === "missing_shopify_media").length,
        },
    };
}

export function reconcileProductTruth({ convexProducts, legacyProduct = null, legacySearch = null, routeOverrides = {}, madisonTargetSku = null }) {
    const issues = [];
    const searchReconciliation = reconcileLegacySearchProducts({ convexProducts, legacySearch });
    issues.push(...searchReconciliation.issues);
    const shouldAuditFilteredCatalog = !legacyProduct && !legacySearch && !madisonTargetSku;
    const filteredCatalogReconciliation = reconcileFilteredCatalogProducts({
        convexProducts,
        enabled: shouldAuditFilteredCatalog,
    });
    issues.push(...filteredCatalogReconciliation.issues);
    const targetSkuCompact = compactSku(madisonTargetSku);
    const targetProduct = targetSkuCompact
        ? convexProducts.find((product) => compactSku(product.websiteSku) === targetSkuCompact || compactSku(product.graceSku) === targetSkuCompact)
        : null;

    let matchInfo = { strategy: "none", matches: [] };
    if (legacyProduct) {
        matchInfo = findMatchingConvexProducts(convexProducts, legacyProduct);
        if (matchInfo.matches.length === 0) {
            issues.push(fieldMismatch("missing_convex_match", "high", "No Convex product matched the legacy product evidence.", {
                legacyWebsiteSku: legacyProduct.websiteSku,
                legacyUrl: legacyProduct.productUrl,
            }));
        }
    }

    for (const product of matchInfo.matches) {
        if (legacyProduct?.family && product.family && normalizeText(legacyProduct.family) !== normalizeText(product.family)) {
            issues.push(fieldMismatch("family_mismatch", "high", "Legacy family evidence differs from Convex family.", {
                websiteSku: product.websiteSku,
                convexFamily: product.family,
                legacyFamily: legacyProduct.family,
            }));
        }
        if (legacyProduct?.color && product.color && normalizeText(legacyProduct.color) !== normalizeText(product.color)) {
            issues.push(fieldMismatch("fake_glass_color", "high", "Legacy glass color evidence differs from Convex color.", {
                websiteSku: product.websiteSku,
                convexColor: product.color,
                legacyColor: legacyProduct.color,
            }));
        }
        if (legacyProduct?.applicator && product.applicator && !normalizeText(product.applicator).includes(normalizeText(legacyProduct.applicator))) {
            issues.push(fieldMismatch("applicator_mismatch", "high", "Legacy applicator evidence differs from Convex applicator.", {
                websiteSku: product.websiteSku,
                convexApplicator: product.applicator,
                legacyApplicator: legacyProduct.applicator,
            }));
        }
        if (legacyProduct?.neckThreadSize && product.neckThreadSize && clean(legacyProduct.neckThreadSize) !== clean(product.neckThreadSize)) {
            issues.push(fieldMismatch("neck_mismatch", "medium", "Legacy neck thread differs from Convex neck thread.", {
                websiteSku: product.websiteSku,
                convexNeck: product.neckThreadSize,
                legacyNeck: legacyProduct.neckThreadSize,
            }));
        }
        if (legacyProduct?.capacityMl != null && product.capacityMl != null && Number(product.capacityMl) !== Number(legacyProduct.capacityMl)) {
            issues.push(fieldMismatch("capacity_mismatch", "medium", "Legacy capacity differs from Convex capacity.", {
                websiteSku: product.websiteSku,
                convexCapacityMl: product.capacityMl,
                legacyCapacityMl: legacyProduct.capacityMl,
            }));
        }
        if (!hasShopifyMedia(product)) {
            issues.push(fieldMismatch("missing_shopify_media", "medium", "Product has no Shopify CDN media URL in Convex export.", {
                websiteSku: product.websiteSku,
                graceSku: product.graceSku,
                mediaSource: mediaSource(product),
                imageUrl: product.imageUrl ?? null,
            }));
        }
        if (product.slug && routeOverrides[product.slug]) {
            issues.push(fieldMismatch("duplicate_canonical_page", "medium", "Product slug is configured to route to a canonical product page.", {
                from: product.slug,
                to: routeOverrides[product.slug],
            }));
        }
    }

    for (const product of matchInfo.matches) {
        const familyPrefixRisk = findFamilyPrefixRisk(product);
        if (familyPrefixRisk) issues.push(familyPrefixRisk);
    }

    if (legacyProduct && targetProduct) {
        const targetText = normalizeText([
            targetProduct.websiteSku,
            targetProduct.graceSku,
            targetProduct.itemName,
            targetProduct.family,
            targetProduct.applicator,
            targetProduct.neckThreadSize,
        ].join(" "));
        const legacyText = normalizeText([
            legacyProduct.websiteSku,
            legacyProduct.itemName,
            legacyProduct.itemDescription,
            legacyProduct.family,
            legacyProduct.applicator,
            legacyProduct.neckThreadSize,
        ].join(" "));
        const targetLooksRollOn = /\broll\b|\broller\b|\brollon\b/.test(targetText);
        const legacyLooksVial = /\bvial\b|\bglass rod\b|\bglass wand\b/.test(legacyText);
        if (legacyLooksVial && targetLooksRollOn) {
            issues.push(fieldMismatch("madison_resolver_risk", "critical", "Madison target appears to map a vial/glass-wand product image to a roll-on SKU.", {
                legacyWebsiteSku: legacyProduct.websiteSku,
                madisonTargetSku,
                targetWebsiteSku: targetProduct.websiteSku,
                targetGraceSku: targetProduct.graceSku,
                targetItemName: targetProduct.itemName,
            }));
            issues.push(fieldMismatch("applicator_mismatch", "critical", "Madison target applicator does not match legacy vial/glass-wand evidence.", {
                legacyApplicator: legacyProduct.applicator,
                targetApplicator: targetProduct.applicator,
            }));
        }
    } else if (madisonTargetSku && !targetProduct) {
        issues.push(fieldMismatch("missing_convex_match", "high", "Madison target SKU did not match any Convex product.", {
            madisonTargetSku,
        }));
    }

    if (legacyProduct?.websiteSku === "GB09BlackCapApp") {
        const canonical = "vial-9ml-clear-18-400-glasswand";
        issues.push(fieldMismatch("route_override_recommended", "info", "GB09BlackCapApp should resolve to the canonical 9 ml vial glass-wand PDP.", {
            canonicalSlug: canonical,
            graceSku: "GB-CYL-CLR-9ML-T-01",
            avoidSkuPattern: "GBCyl9MtlRoll* / GB-CYL-CLR-9ML-T-03",
        }));
    }

    return {
        generatedAt: new Date().toISOString(),
        mode: "read-only",
        legacyProduct,
        legacySearch,
        matchStrategy: matchInfo.strategy,
        filteredConvexProducts: shouldAuditFilteredCatalog
            ? convexProducts.slice(0, 250).map(summarizeConvexProduct)
            : [],
        matchedConvexProducts: matchInfo.matches.map(summarizeConvexProduct),
        legacySearchMatchedConvexProducts: searchReconciliation.matchedProducts.map(summarizeConvexProduct),
        madisonTargetSku,
        madisonTargetProduct: targetProduct ? {
            slug: targetProduct.slug,
            websiteSku: targetProduct.websiteSku,
            graceSku: targetProduct.graceSku,
            itemName: targetProduct.itemName,
            family: targetProduct.family,
            applicator: targetProduct.applicator,
        } : null,
        summary: {
            issueCount: issues.length,
            filteredConvexCount: shouldAuditFilteredCatalog ? convexProducts.length : 0,
            critical: issues.filter((issue) => issue.severity === "critical").length,
            high: issues.filter((issue) => issue.severity === "high").length,
            medium: issues.filter((issue) => issue.severity === "medium").length,
            low: issues.filter((issue) => issue.severity === "low").length,
            info: issues.filter((issue) => issue.severity === "info").length,
            ...(searchReconciliation.summary ?? {}),
        },
        issues,
    };
}

function loadEnvLocal() {
    const envPath = resolve(ROOT, ".env.local");
    if (!existsSync(envPath)) return;
    for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#") || !line.includes("=")) continue;
        const [key, ...rest] = line.split("=");
        if (!process.env[key.trim()]) {
            process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
        }
    }
}

function argValues(name) {
    const values = [];
    for (let i = 2; i < process.argv.length; i += 1) {
        if (process.argv[i] === name && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) values.push(process.argv[i + 1]);
    }
    return values;
}

function parseArgs() {
    const get = (name) => argValues(name).at(-1) ?? null;
    const families = argValues("--family").flatMap((value) => value.split(",")).map(clean).filter(Boolean);
    return {
        sku: get("--sku"),
        legacyUrl: get("--legacy-url"),
        legacySearchUrl: get("--legacy-search-url"),
        madisonSku: get("--madison-sku"),
        families,
        capacityMl: normalizeCapacityMl(get("--capacity") ?? "") ?? null,
        json: process.argv.includes("--json"),
        outDir: get("--out") ?? resolve(ROOT, "data/audits/product-truth", new Date().toISOString().slice(0, 10)),
        limit: Number(get("--limit") ?? "0") || null,
    };
}

async function fetchConvexProducts({ sku, families, capacityMl, limit }) {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) throw new Error("Missing NEXT_PUBLIC_CONVEX_URL in .env.local or environment.");
    const client = new ConvexHttpClient(convexUrl);
    const products = [];
    let cursor = null;
    while (true) {
        const page = await client.action(api.products.getProductExportPage, { cursor, numItems: 250 });
        for (const product of page.page) {
            if (productMatchesFilters(product, { sku, families, capacityMl })) products.push(product);
            if (limit && products.length >= limit) return products;
        }
        if (page.isDone) return products;
        cursor = page.continueCursor;
    }
}

async function fetchTextDirect(url) {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
}

async function fetchTextBrowserless(url) {
    const token = process.env.BROWSERLESS_API_TOKEN;
    if (!token) throw new Error("Missing BROWSERLESS_API_TOKEN");
    const baseUrl = (process.env.BROWSERLESS_BASE_URL || DEFAULT_BROWSERLESS_BASE_URL).replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/content?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
        body: JSON.stringify({ url }),
    });
    if (!response.ok) throw new Error(`Browserless HTTP ${response.status}`);
    return response.text();
}

async function fetchLegacyProduct(url) {
    try {
        return parseLegacyProductPage({ html: await fetchTextDirect(url), url });
    } catch (directError) {
        try {
            return parseLegacyProductPage({ html: await fetchTextBrowserless(url), url });
        } catch (browserlessError) {
            throw new Error(`Unable to fetch legacy product page. Direct: ${directError.message}; Browserless: ${browserlessError.message}`);
        }
    }
}

async function fetchLegacySearch(url) {
    try {
        const direct = parseLegacySearchPage({ html: await fetchTextDirect(url), url });
        if (direct.products.length > 0) return direct;
        try {
            const rendered = parseLegacySearchPage({ html: await fetchTextBrowserless(url), url });
            return rendered.products.length > 0 ? rendered : direct;
        } catch {
            return direct;
        }
    } catch (directError) {
        try {
            return parseLegacySearchPage({ html: await fetchTextBrowserless(url), url });
        } catch (browserlessError) {
            throw new Error(`Unable to fetch legacy search page. Direct: ${directError.message}; Browserless: ${browserlessError.message}`);
        }
    }
}

function reportMarkdown(report) {
    const lines = [
        "# Product Truth Reconciliation Report",
        "",
        `Generated: ${report.generatedAt}`,
        `Mode: ${report.mode}`,
        "",
        "## Summary",
        "",
        `- Filtered Convex products: ${report.summary.filteredConvexCount ?? 0}`,
        `- Matched Convex products: ${report.matchedConvexProducts.length}`,
        `- Legacy search products: ${report.summary.legacySearchCount ?? 0}`,
        `- Legacy search products matched in Convex: ${report.summary.legacySearchMatched ?? 0}`,
        `- Legacy search products missing media: ${report.summary.legacySearchMissingMedia ?? 0}`,
        `- Issues: ${report.summary.issueCount}`,
        `- Critical: ${report.summary.critical}`,
        `- High: ${report.summary.high}`,
        `- Medium: ${report.summary.medium}`,
        "",
        "## Legacy Evidence",
        "",
    ];
    if (report.legacyProduct) {
        lines.push(`- Website SKU: ${report.legacyProduct.websiteSku ?? "unknown"}`);
        lines.push(`- URL: ${report.legacyProduct.productUrl ?? "unknown"}`);
        lines.push(`- Family: ${report.legacyProduct.family ?? "unknown"}`);
        lines.push(`- Color: ${report.legacyProduct.color ?? "unknown"}`);
        lines.push(`- Applicator: ${report.legacyProduct.applicator ?? "unknown"}`);
        lines.push(`- Neck: ${report.legacyProduct.neckThreadSize ?? "unknown"}`);
        lines.push(`- Capacity: ${report.legacyProduct.capacityMl ?? "unknown"} ml`);
    } else {
        lines.push("- No legacy URL provided.");
    }
    lines.push("", "## Matched Convex Products", "");
    if (report.matchedConvexProducts.length === 0) lines.push("- None");
    for (const product of report.matchedConvexProducts) {
        lines.push(`- \`${product.websiteSku}\` / \`${product.graceSku}\` — ${product.itemName} (${product.slug})`);
    }
    lines.push("", "## Filtered Convex Products", "");
    if (!report.filteredConvexProducts || report.filteredConvexProducts.length === 0) {
        lines.push("- None");
    } else {
        for (const product of report.filteredConvexProducts) {
            const mediaStatus = product.mediaSource === "shopify"
                ? "Shopify media present"
                : product.mediaSource === "missing"
                    ? "Shopify media missing"
                    : `non-Shopify media (${product.mediaSource})`;
            lines.push(`- \`${product.websiteSku}\` / \`${product.graceSku}\` — ${product.itemName} (${product.slug}) — ${mediaStatus}`);
        }
        if ((report.summary.filteredConvexCount ?? 0) > report.filteredConvexProducts.length) {
            lines.push(`- ...${report.summary.filteredConvexCount - report.filteredConvexProducts.length} more Convex products omitted from Markdown preview.`);
        }
    }
    lines.push("", "## Legacy Search Evidence", "");
    if (report.legacySearch) {
        lines.push(`- Search URL: ${report.legacySearch.searchUrl}`);
        lines.push(`- Products exposed in fetched HTML: ${report.legacySearch.products.length}`);
        for (const product of report.legacySearch.products.slice(0, 25)) {
            lines.push(`- \`${product.websiteSku ?? "unknown"}\` — ${product.productUrl ?? "no URL"}${product.imageUrl ? ` — image: ${product.imageUrl}` : ""}`);
        }
        if (report.legacySearch.products.length > 25) lines.push(`- ...${report.legacySearch.products.length - 25} more legacy products omitted from Markdown preview.`);
    } else {
        lines.push("- No legacy search URL provided.");
    }
    lines.push("", "## Issues", "");
    if (report.issues.length === 0) lines.push("- None");
    for (const issue of report.issues) {
        lines.push(`- **${issue.severity.toUpperCase()}** \`${issue.issueType}\`: ${issue.message}`);
    }
    return `${lines.join("\n")}\n`;
}

function reportCsv(report) {
    const header = ["severity", "issueType", "message", "evidence"];
    const rows = report.issues.map((issue) => [
        issue.severity,
        issue.issueType,
        issue.message,
        JSON.stringify(issue.evidence ?? {}).replace(/"/g, '""'),
    ]);
    return [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
}

async function main() {
    loadEnvLocal();
    const args = parseArgs();
    const [convexProducts, legacyProduct, legacySearch] = await Promise.all([
        fetchConvexProducts({ sku: args.sku, families: args.families, capacityMl: args.capacityMl, limit: args.limit }),
        args.legacyUrl ? fetchLegacyProduct(args.legacyUrl) : Promise.resolve(null),
        args.legacySearchUrl ? fetchLegacySearch(args.legacySearchUrl) : Promise.resolve(null),
    ]);
    const routeOverrides = loadRouteOverrides();
    const report = reconcileProductTruth({
        convexProducts,
        legacyProduct,
        legacySearch,
        routeOverrides,
        madisonTargetSku: args.madisonSku,
    });

    mkdirSync(args.outDir, { recursive: true });
    const jsonPath = resolve(args.outDir, "product_truth_reconciliation.json");
    const mdPath = resolve(args.outDir, "product_truth_reconciliation.md");
    const csvPath = resolve(args.outDir, "product_truth_reconciliation.csv");
    writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    writeFileSync(mdPath, reportMarkdown(report));
    writeFileSync(csvPath, reportCsv(report));

    if (args.json) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        console.log(`Saved JSON: ${jsonPath}`);
        console.log(`Saved Markdown: ${mdPath}`);
        console.log(`Saved CSV: ${csvPath}`);
        console.log(JSON.stringify(report.summary, null, 2));
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
}
