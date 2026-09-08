import { describe, expect, it } from "vitest";
import { resolveListedComponents, type ActiveComponent } from "@/lib/bottle-builder/components";
import { compatibleFinishComponent, isBuilderCandidate, type CatalogRow } from "@/lib/bottle-builder/model";
import { sourceComponentLinks } from "@/lib/bottle-builder/source-component-links";

function fixture(index = 0) {
    const link = sourceComponentLinks[index];
    const row = { websiteSku: link.assemblySku, graceSku: link.assemblyGraceSku, family: link.family,
        capacityMl: link.capacityMl, color: link.color, neckThreadSize: link.neck, applicator: link.applicator,
        capColor: link.finish, itemName: "5 ml blue bottle with short cap", category: "Glass Bottle",
        resolution: "unknown", components: {}, shopifySellable: true, shopifyVariantId: "assembly-variant", webPrice1pc: 1,
    } as CatalogRow;
    const component: ActiveComponent = { websiteSku: index === 0 ? "" : link.componentSku,
        graceSku: link.componentGraceSku, neckThreadSize: link.neck, category: "Component",
        productUrl: link.componentSourceUrl, itemName: link.componentName, shopifyVariantId: "loose-part-variant",
        shopifySellable: false, stockStatus: "In Stock" };
    return { link, row, component };
}

describe("source-reviewed missing short-cap links", () => {
    it.each(sourceComponentLinks.map((link, i) => [link.assemblySku, i] as const))("restores only the exact included cap for %s", async (_, index) => {
        const { link, row, component } = fixture(index);
        const before = structuredClone(row);
        const [resolved] = await resolveListedComponents([row], async sku => sku === component.graceSku ? component : null);
        expect(resolved.resolution).toBe("source_verified");
        expect(resolved.compatibilitySources).toEqual([link.assemblySourceUrl, link.componentSourceUrl]);
        expect(compatibleFinishComponent(resolved)?.websiteSku).toBe(link.componentSku);
        expect(isBuilderCandidate(resolved)).toBe(true);
        expect(resolved.shopifyVariantId).toBe("assembly-variant");
        expect(resolved.components.Cap[0].shopifySellable).toBe(false);
        expect(isBuilderCandidate({ ...resolved, shopifySellable: false })).toBe(false);
        expect(row).toEqual(before);
    });
    it("rejects changed bottle identity and preserves authoritative relationships", async () => {
        const { row, component } = fixture();
        for (const change of [{ websiteSku: "another-bottle" }, { graceSku: "another-record" }, { family: "Circle" },
            { capacityMl: 9 }, { color: "Clear" }, { neckThreadSize: "17-415" }, { applicator: "Metal Roller Ball" },
            { capColor: "Shiny Black" },
            { components: { Cap: [{ websiteSku: component.websiteSku, graceSku: component.graceSku }] } }]) {
            const input = { ...row, ...change } as CatalogRow;
            const [result] = await resolveListedComponents([input], async () => component);
            expect(result).toEqual(input);
        }
    });
    it("rejects missing, retired, wrong and unavailable component records", async () => {
        const { row, component } = fixture();
        for (const replacement of [null, { ...component, websiteSku: "wrong" },
            { ...component, websiteSku: "CP13-415BlkShShtMtl__RETIRED__old" },
            { ...component, graceSku: "wrong" }, { ...component, neckThreadSize: "18-415" },
            { ...component, category: "Glass Bottle" }, { ...component, shopifyVariantId: null },
            { ...component, stockStatus: "Out of Stock" }, { ...component, stockStatus: "Discontinued" },
            { ...component, productUrl: "https://example.com/unverified" }, { ...component, itemName: "Different cap" }]) {
            const [result] = await resolveListedComponents([row], async () => replacement);
            expect(result).toEqual(row);
            expect(isBuilderCandidate(result)).toBe(false);
        }
    });
    it("supplements a missing exact cap without changing the original matrix evidence", async () => {
        const { row, component } = fixture(1);
        const other: CatalogRow["components"][string][number] = {
            websiteSku: "CP13-415GlSh", graceSku: "other-cap", itemName: "Shiny gold cap",
            productGroupSlug: null, shopifyVariantId: null, shopifySellable: null,
            imageUrl: null, webPrice1pc: null, webPrice12pc: null, capColor: "Shiny Gold", stockStatus: null,
        };
        const input: CatalogRow = { ...row, resolution: "fitment_rule", components: { Cap: [other] } };
        const [resolved] = await resolveListedComponents([input], async () => component);
        expect(resolved.resolution).toBe("fitment_rule");
        expect(resolved.components.Cap[0]).toEqual(other);
        expect(resolved.components.Cap).toHaveLength(2);
        expect(compatibleFinishComponent(resolved)?.websiteSku).toBe(component.websiteSku);
        expect(input.components.Cap).toEqual([other]);
    });
});
