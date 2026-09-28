import { describe, expect, it } from "vitest";
import { buildWorkspaceFamilies } from "@/lib/grace/workspaceFamilies";
import type { CatalogVisibilitySnapshot } from "@/lib/catalogServer";

function snapshot(rows: Array<{ family: string; slug?: string; count?: number; image?: string; category?: string }>): CatalogVisibilitySnapshot {
    return { primarySkus: [], variantPreviewRows: [], groups: rows.map((row, i) => ({
        _id: `id-${i}`, family: row.family, slug: row.slug ?? `test-family-${i}`, displayName: row.family,
        variantCount: row.count ?? 1, heroImageUrl: row.image ?? `https://images.example/${i}.png`,
        category: row.category ?? "Glass Bottle", capacity: null, capacityMl: null, color: null,
        bottleCollection: null, neckThreadSize: null, priceRangeMin: null, priceRangeMax: null,
    })) };
}
describe("workspace family coverage", () => {
    it("includes families beyond the old ten-row cap, including packaging and components", () => {
        const data = snapshot([...Array.from({length: 20}, (_, i) => ({family: `Family ${i}`})), {family:"Gift Bag"}, {family:"Sprayer"}]);
        expect(buildWorkspaceFamilies(data, new Map())).toHaveLength(22);
    });
    it("keeps storefront source holds, hidden records, and empty families out of the rail", () => {
        const data = snapshot([{family:"Listed",count:3},{family:"Held",slug:"unknown-0ml-clear"},{family:"Hidden",slug:"lotion-bottle-30ml-clear-18mm"},{family:"Empty",count:0},{family:"Internal",category:"Internal"}]);
        expect(buildWorkspaceFamilies(data,new Map()).map(f=>f.family)).toEqual(["Listed"]);
    });
    it("uses editorial art first and retains real same-family image fallbacks", () => {
        const data = snapshot([{family:"Rectangle",image:"https://images.example/rectangle.png"},{family:"Rectangle",image:"https://images.example/rectangle-2.png"},{family:"Square",image:"https://images.example/square.png"}]);
        const rows=buildWorkspaceFamilies(data,new Map([["Rectangle","https://images.example/rectangle-art.png"]]));
        expect(rows[0]).toMatchObject({family:"Rectangle",variantCount:2,images:[
            {url:"https://images.example/rectangle-art.png",kind:"editorial"},
            {url:"https://images.example/rectangle.png",kind:"product"},
            {url:"https://images.example/rectangle-2.png",kind:"product"},
        ]});
        expect(rows[0].images.some(image=>image.url.includes("square"))).toBe(false);
    });
    it("does not silently drop a listed family when an image is absent", () => {
        const data=snapshot([{family:"A new family"}]);data.groups[0].heroImageUrl=null;
        expect(buildWorkspaceFamilies(data,new Map())).toMatchObject([{family:"A new family",images:[]}]);
    });
});
