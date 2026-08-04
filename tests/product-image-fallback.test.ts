import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveImageWithFallback } from "@/lib/products/image-fallback";

describe("product image fallback", () => {
    it("uses the preferred image until the browser reports that it failed", () => {
        const failed = new Set<string>();

        expect(resolveImageWithFallback("https://cdn.example.com/bottle.png", failed, "/assets/Cylinder-BB.png"))
            .toBe("https://cdn.example.com/bottle.png");
    });

    it("uses the approved family image after the preferred image fails", () => {
        const failed = new Set(["https://cdn.example.com/bottle.png"]);

        expect(resolveImageWithFallback("https://cdn.example.com/bottle.png", failed, "/assets/Cylinder-BB.png"))
            .toBe("/assets/Cylinder-BB.png");
    });

    it("returns null when both the preferred image and fallback have failed", () => {
        const failed = new Set(["https://cdn.example.com/bottle.png", "/assets/Cylinder-BB.png"]);

        expect(resolveImageWithFallback("https://cdn.example.com/bottle.png", failed, "/assets/Cylinder-BB.png"))
            .toBeNull();
    });

    it("removes a failed product-card image and renders the honest placeholder", () => {
        const source = readFileSync("src/components/products/ProductCardImagePreview.tsx", "utf8");

        expect(source).toContain("resolveImageWithFallback(displayImage.url, failedImages, fallbackImageUrl)");
        expect(source).toContain("onError={() => markImageFailed(resolvedImageUrl)}");
    });
});
