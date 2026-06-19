import { describe, expect, it } from "vitest";

import {
    mediaFilename,
    planVariantAction,
} from "../scripts/aios-shopify-images/replace-plan.mjs";

// Guards the bug fix in push-shopify-pdp-media.mjs --replace: a variant that
// already has a Shopify image must be REPOINTED onto freshly-created media
// (productVariantsBulkUpdate), never appended (which Shopify rejects with
// "the given variant already has attached media") and never silently skipped.

describe("planVariantAction", () => {
    const withImage = { image: { url: "https://cdn.shopify.com/s/files/1/0/ABC.png?v=1" } };

    it("appends when the variant has no image — regardless of --replace", () => {
        expect(planVariantAction({ image: null }, false)).toBe("append");
        expect(planVariantAction({ image: null }, true)).toBe("append");
        expect(planVariantAction({ image: { url: "" } }, true)).toBe("append");
        expect(planVariantAction({}, true)).toBe("append");
        expect(planVariantAction(undefined, true)).toBe("append");
    });

    it("skips an already-imaged variant when --replace is off (idempotent default)", () => {
        expect(planVariantAction(withImage, false)).toBe("skip");
    });

    it("repoints an already-imaged variant when --replace is on (the fix)", () => {
        // Regression: the old code skipped here without --replace and, with
        // --replace, fell through to append → Shopify error + orphan media.
        expect(planVariantAction(withImage, true)).toBe("repoint");
    });
});

describe("mediaFilename", () => {
    it("strips the query string and path", () => {
        expect(
            mediaFilename("https://cdn.shopify.com/s/files/1/0/ABC123.png?v=99&width=2080"),
        ).toBe("ABC123.png");
    });

    it("is null/empty safe", () => {
        expect(mediaFilename("")).toBe("");
        expect(mediaFilename(null)).toBe("");
        expect(mediaFilename(undefined)).toBe("");
    });
});
