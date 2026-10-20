import { describe, expect, it } from "vitest";
import { migratedFinishImageUrl } from "../src/lib/bottle-builder/legacy-finish-images";
import patches from "../data/migrations/legacy-finish-images-2026-10-02/patches.json";
import manifest from "../data/migrations/legacy-finish-images-2026-10-02/manifest.json";

describe("finish image release bridge", () => {
    it("removes old-host dependencies for every audited reference", () => {
        let references = 0;
        for (const entry of patches) {
            const source = manifest.assets.find(a => a.legacyUrl === entry.expectedUrl)!;
            expect(migratedFinishImageUrl(entry.websiteSku, entry.expectedUrl)).toBe(entry.imageUrl);
            expect(new URL(entry.imageUrl).hostname).toBe("yzy7l20k4yt6znzz.public.blob.vercel-storage.com");
            references += source.affectedConfigurationSkus.length;
        }
        expect(references).toBe(1345);
    });
    it("preserves new approved artwork, absent images and mismatched identities", () => {
        const entry = patches[0];
        expect(migratedFinishImageUrl(entry.websiteSku, "https://example.test/approved.png")).toBe("https://example.test/approved.png");
        expect(migratedFinishImageUrl(entry.websiteSku, entry.imageUrl)).toBe(entry.imageUrl);
        expect(migratedFinishImageUrl(entry.websiteSku, null)).toBeNull();
        expect(migratedFinishImageUrl("different-sku", entry.expectedUrl)).toBe(entry.expectedUrl);
        expect(migratedFinishImageUrl(entry.websiteSku, patches[1].expectedUrl)).toBe(patches[1].expectedUrl);
    });
});
