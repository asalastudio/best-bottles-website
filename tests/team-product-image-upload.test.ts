import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
    PRODUCT_IMAGE_ACCEPT,
    PRODUCT_IMAGE_MAX_BYTES,
    validateProductImageFile,
} from "@/lib/team/productImageUpload";

describe("Team Hub product image upload", () => {
    it("accepts PNG, JPEG, and WebP under 8 MB", () => {
        expect(validateProductImageFile({ name: "hero.png", type: "image/png", size: 1200 })).toBeNull();
        expect(validateProductImageFile({ name: "hero.jpg", type: "image/jpeg", size: 1200 })).toBeNull();
        expect(validateProductImageFile({ name: "hero.webp", type: "image/webp", size: 1200 })).toBeNull();
        expect(PRODUCT_IMAGE_ACCEPT).toContain("image/png");
        expect(PRODUCT_IMAGE_ACCEPT).toContain("image/jpeg");
        expect(PRODUCT_IMAGE_ACCEPT).toContain("image/webp");
    });

    it("accepts a photo with no MIME type when the extension is a product image", () => {
        expect(validateProductImageFile({ name: "IMG_0042.JPEG", type: "", size: 2400 })).toBeNull();
    });

    it("rejects empty, oversized, and non-image files", () => {
        expect(validateProductImageFile({ name: "hero.png", type: "image/png", size: 0 })).toMatch(/empty/i);
        expect(validateProductImageFile({
            name: "hero.png",
            type: "image/png",
            size: PRODUCT_IMAGE_MAX_BYTES + 1,
        })).toMatch(/8 MB/);
        expect(validateProductImageFile({ name: "mark.svg", type: "image/svg+xml", size: 400 })).toMatch(/PNG, JPEG, or WebP/);
        expect(validateProductImageFile({ name: "spec.pdf", type: "application/pdf", size: 400 })).toMatch(/PNG, JPEG, or WebP/);
        expect(validateProductImageFile({ name: "notes.txt", type: "", size: 400 })).toMatch(/PNG, JPEG, or WebP/);
    });

    it("wires Convex storage URLs and a desktop drop zone onto Create Products", () => {
        const actions = readFileSync("src/app/team/products/actions.ts", "utf8");
        const convex = readFileSync("convex/staffProducts.ts", "utf8");
        const form = readFileSync("src/components/team/CreateProductForm.tsx", "utf8");
        const drop = readFileSync("src/components/team/ProductImageDropField.tsx", "utf8");
        const config = readFileSync("next.config.ts", "utf8");

        expect(convex).toContain("generateImageUploadUrl");
        expect(convex).toContain("ctx.storage.generateUploadUrl");
        expect(convex).toContain("ctx.storage.getUrl");
        expect(actions).toContain("createProductImageUploadUrlAction");
        expect(actions).toContain("resolveProductImageUrlAction");
        expect(form).toContain("<ProductImageDropField");
        expect(form).toContain("heroImageUrl");
        expect(form).toContain("imageUrlCapOff");
        expect(drop).toContain("data-desktop-drop-zone");
        expect(drop).toContain("Drop an image here");
        expect(drop).toContain("Take or choose a photo");
        expect(drop).toContain('type="file"');
        expect(drop).toContain("onDrop");
        expect(config).toContain("convexStorageImagePatterns");
        expect(config).toContain("/api/storage/**");
    });
});
