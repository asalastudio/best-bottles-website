import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BuilderKit, CatalogRow } from "@/lib/bottle-builder/model";
import { builderBodyIdentity } from "@/lib/bottle-builder/model";
import { storefrontFamily, sourceFamilies, sourceFamilyForProduct, withStorefrontFamily } from "@/lib/products/storefront-family";
import { familyFromSlug, familyFinderPath } from "@/lib/products/focused-shopping";
import { buildCatalogSearchResult, type CatalogSearchGroup } from "@/lib/catalogSearchFallback";
import { EMPTY_FILTERS } from "@/lib/catalogFilters";
import { buildHomeBrowseData } from "@/lib/homepageBrowse";
import { loadBuilderEntry } from "@/lib/bottle-builder/entry";
import { isOptimizableImageUrl, displayImageUrl } from "@/lib/products/optimizable-image";
import { displayDerivativeUrl } from "@/lib/products/display-derivative";
import { stageLayout } from "@/lib/products/pdp-redesign/stage";
import manifest from "@/lib/paper-doll/approved-kits.generated.json";
import index from "@/lib/paper-doll/approved-kit-index.json";
vi.mock("server-only", () => ({}));
import { GET } from "@/app/api/bottle-masters/approved/route";
import { approvedComponentKit } from "@/lib/paper-doll/approved-component-kits";
import { localPdpComponentKits } from "@/lib/paper-doll/local-component-kits";
import { cylinderMasterSource, cylinderMasterSku, masterProductHref } from "@/lib/products/cylinder-master";
const directory = "docs/reviews/hosted-masters-tulip-2026-11-01/";
const plan = JSON.parse(readFileSync(directory + "upload-plan.json", "utf8"));
const receipt = JSON.parse(readFileSync(directory + "asset-receipt.json", "utf8"));
const hosted = manifest.rows as unknown as Record<string, BuilderKit>;
const originals: Record<string, BuilderKit> = {};
for (const source of plan.sources) {
    const rows = JSON.parse(readFileSync(source.file, "utf8")).rows;
    for (const sku of source.selected) originals[sku] = rows[sku];
}
// Explicit owner-requested shoulder and amber-compositing revision; body pixels remain unchanged.
Object.assign(originals, JSON.parse(readFileSync("public/local-kits/tulip-amber-seating-2026-11-01/kits.json", "utf8")).rows);
// Scoped clear-glass optical revision, with unchanged pixels and placement.
Object.assign(originals, JSON.parse(readFileSync("public/local-kits/tulip6-glass-depth-2026-11-01/kits.json", "utf8")).rows);
// Owner's tube-only 25 ml reference correction. Its separate invariant test
// asserts that every original 9 ml body and exterior part remains identical.
Object.assign(originals, JSON.parse(readFileSync("docs/reviews/cylinder-lotion-pumps-2026-11-02/after-kits.json", "utf8")).rows);
afterEach(() => vi.unstubAllEnvs());

describe("approved hosted master release", () => {
    it("serves lossless approved display copies while retaining historical master URLs", () => {
        const png = Object.values(receipt).find((a: unknown) => (a as { url: string }).url.endsWith(".png")) as { url: string };
        const svg = Object.values(receipt).find((a: unknown) => (a as { url: string }).url.endsWith(".svg")) as { url: string };
        expect(isOptimizableImageUrl(png.url)).toBe(true);
        const pngCopy = displayDerivativeUrl(png.url, 640), svgCopy = displayDerivativeUrl(svg.url, 640);
        if (pngCopy) expect(displayImageUrl(png.url, 640)).toBe(pngCopy);
        else expect(displayImageUrl(png.url, 640)).toContain("w=640&q=90");
        expect(isOptimizableImageUrl(svg.url)).toBe(Boolean(svgCopy));
        expect(displayImageUrl(svg.url, 640)).toBe(svgCopy ?? svg.url);
    });
    it("preserves the original 267 approved configurations alongside the scoped small-sprayer extension", () => {
        expect(Object.keys(originals)).toHaveLength(267);
        expect(Object.keys(hosted)).toHaveLength(463);
        expect(Object.keys(hosted)).toEqual(expect.arrayContaining(Object.keys(originals)));
        expect(index.skus).toEqual(Object.keys(hosted).sort());
        expect(hosted.GBTallCyl9SpryGlMatt).toBeDefined();
        expect(hosted.GBSleek5SpryGlMatt).toBeDefined();
        expect(hosted.GBFlair15SpryBlkMatt).toBeUndefined();
        expect(hosted.GBSpry3mlClBlk).toBeDefined();
        expect(JSON.stringify(hosted)).not.toContain('"url":"/local-kits/');
    });
    it("retains exact body geometry, cap seating, roller plug and tube placement in all three views", () => {
        for (const [sku, original] of Object.entries(originals)) {
            const kit = hosted[sku];
            const restored = structuredClone(kit);
            restored.parts.forEach((part, i) => { part.image = original.parts[i].image; });
            expect(restored, sku).toEqual(original);
            for (const view of ["sidecar", "capon", "exploded"] as const) {
                const before = stageLayout(original, view, { websiteSku: sku })!, after = stageLayout(kit, view, { websiteSku: sku })!;
                const placement = (part: typeof after.parts[number]) => ({ slot: part.slot, box: part.box, dxPct: part.dxPct, dyPct: part.dyPct });
                expect(after.parts.map(placement), sku + view).toEqual(before.parts.map(placement));
            }
        }
    });
    it("pins every image to a verified immutable public Blob and its exact source hash", () => {
        expect(Object.keys(receipt)).toHaveLength(68);
        for (const entry of Object.values(receipt) as Array<{ file: string; sha256: string; bytes: number; url: string; verified: boolean }>) {
            const bytes = readFileSync(entry.file);
            expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
            expect(bytes.length).toBe(entry.bytes);
            expect(entry.verified).toBe(true);
            expect(new URL(entry.url).hostname).toBe("yzy7l20k4yt6znzz.public.blob.vercel-storage.com");
            expect(entry.url).toContain(entry.sha256);
        }
    });
    it("serves exact approved recipes on hosted production mode, while candidate overrides stay disabled", async () => {
        vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("VERCEL", "1");
        for (const sku of ["GBCyl5SpryBlkMatt", "GBCylAmb9MtlRollBlkDot", "LBCyl9LtnBlk", "GBTulipAmb5RollSlSh"]) {
            const actual = index.skus.includes(sku) ? sku : index.skus.find(s => s.startsWith(sku.split("Roll")[0]))!;
            expect(actual).toBeTruthy();
            const response = await GET(new Request(`https://preview.vercel.app/api/bottle-masters/approved?sku=${actual}&v=${index.version}`));
            expect(response.status).toBe(200);
            expect((await response.json()).kit).toEqual(hosted[actual]);
            expect(response.headers.get("cache-control")).toContain("immutable");
            const expectedVersion = actual.startsWith("GBCylAmb9") ? index.version + "-cylinder9-colors-v2-20261102"
                : actual === "LBCyl9LtnBlk" ? index.version + "-lotion9-physical-reference-v1" : index.version;
            expect(cylinderMasterSource(actual)).toEqual({ family: "approved", version: expectedVersion });
            const current = await GET(new Request(`https://preview.vercel.app/api/bottle-masters/approved?sku=${actual}&v=${expectedVersion}`));
            expect(current.status).toBe(200);
            const currentBody = await current.json();
            expect(currentBody.version).toBe(expectedVersion);
            expect(currentBody.kit).toEqual(expectedVersion === index.version ? hosted[actual] : approvedComponentKit(actual));
            expect(current.headers.get("cache-control")).toContain("immutable");
        }
        expect(cylinderMasterSku("not-a-sku")).toBeNull();
        expect((await GET(new Request("https://preview.vercel.app/api/bottle-masters/approved?sku=not-a-sku"))).status).toBe(404);
        expect((await GET(new Request(`https://preview.vercel.app/api/bottle-masters/approved?sku=${index.skus[0]}&v=old`))).status).toBe(404);
        expect(localPdpComponentKits("localhost", "gpt13", index.skus.map(websiteSku => ({ websiteSku })))).toEqual({});
    });
});

const group = (slug: string, family: string, ml: number): CatalogSearchGroup => ({
    _id: slug, slug, family, displayName: `${ml} ml Clear ${family} Bottle`, capacity: `${ml} ml`, capacityMl: ml,
    color: "Clear", category: "Glass Bottle", bottleCollection: null, neckThreadSize: "13-415", variantCount: 1,
    priceRangeMin: 1, priceRangeMax: 1, applicatorTypes: ["Fine Mist Sprayer"],
});
describe("Tulip storefront regrouping without changing product identities", () => {
    it("keeps a single exact SKU in catalog links while preserving the return path and anchor", () => {
        const href = masterProductHref("/es/products/tulip-5ml-amber-13-415-rollon?sku=old&from=%2Fcatalog%3Ffamily%3DCylinder&sku=duplicate#details", "GBTulipAmb5RollBlkDot");
        const url = new URL(href, "https://www.bestbottles.com");
        expect(url.searchParams.getAll("sku")).toEqual(["GBTulipAmb5RollBlkDot"]);
        expect(url.searchParams.get("from")).toBe("/catalog?family=Cylinder");
        expect(url.pathname).toBe("/es/products/tulip-5ml-amber-13-415-rollon");
        expect(url.hash).toBe("#details");
        expect(masterProductHref("/products/other?sku=old", null)).toBe("/products/other?sku=old");
    });
    it("retains product slugs and distinct 5/6 ml body IDs under Cylinder", () => {
        for (const ml of [5, 6]) {
            const row = { family: "Tulip", color: "Clear", capacityMl: ml, neckThreadSize: "13-415", category: "Glass Bottle", productGroupSlug: `tulip-${ml}ml-clear-13-415-finemist` } as CatalogRow;
            const before = builderBodyIdentity(row), after = builderBodyIdentity(withStorefrontFamily(row));
            expect(after).toEqual(before);
            expect(after.bodyId).toContain(`tulip-${ml}ml|13-415`);
            expect(withStorefrontFamily(row).productGroupSlug).toBe(row.productGroupSlug);
            expect(row.family).toBe("Tulip");
            expect(sourceFamilyForProduct(row.productGroupSlug!, "Cylinder")).toBe("Tulip");
        }
        expect(storefrontFamily("Tulip")).toBe("Cylinder");
        expect(sourceFamilies("Cylinder")).toEqual(["Cylinder", "Tulip"]);
        expect(sourceFamilies("Tulip")).toEqual(["Cylinder", "Tulip"]);
    });
    it("combines complete families before filtering, sorting and pagination, keeping old Tulip entry links usable", () => {
        const groups = [group("cylinder-5ml-clear-13-415-finemist", "Cylinder", 5), group("tulip-5ml-amber-13-415-finemist", "Tulip", 5), group("tulip-6ml-clear-13-415-finemist", "Tulip", 6), group("sleek-5ml-clear-13-415-finemist", "Sleek", 5)];
        for (const family of ["Cylinder", "Tulip"]) {
            const result = buildCatalogSearchResult({ groups, primarySkus: [], variantPreviewRows: [], filters: { ...EMPTY_FILTERS, families: [family] }, sort: "capacity-asc", view: "visual", limit: 20 });
            expect(result.totalCount).toBe(3);
            expect(result.items.map(g => g.slug)).toEqual(expect.arrayContaining(groups.slice(0, 3).map(g => g.slug)));
            expect(result.items.every(g => g.family === "Cylinder")).toBe(true);
            expect(result.facets.families.Tulip).toBeUndefined();
            expect(result.facets.families.Cylinder).toBe(3);
        }
        const browse = buildHomeBrowseData(groups.map(g => ({ ...g, family: g.family! })), []);
        expect(browse.familyCounts.Cylinder).toBe(3);
        expect(browse.families.filter(f => f.label === "Cylinder")).toHaveLength(1);
        expect(browse.families.some(f => f.label === "Tulip")).toBe(false);
        expect(familyFromSlug("tulip")).toBe("Cylinder");
        expect(familyFinderPath("Tulip")).toBe("/catalog/cylinder");
    });
    it("opens legacy Tulip builder links in Cylinder without resetting their exact body selection", async () => {
        const family = vi.fn(async () => []);
        await loadBuilderEntry("Tulip", { family, families: async () => [] });
        expect(family).toHaveBeenCalledWith("Cylinder");
    });
});
