import { expect, it } from "vitest";
import { displayImageUrl, isOptimizableImageUrl } from "@/lib/products/optimizable-image";

it("optimizes approved local and supplier images without proxying arbitrary hosts", () => {
    expect(isOptimizableImageUrl("/images/catalog/hero.png")).toBe(true);
    expect(isOptimizableImageUrl("https://cdn.shopify.com/s/files/hero.png")).toBe(true);
    expect(isOptimizableImageUrl("https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/plates/hero.webp")).toBe(false);
    expect(isOptimizableImageUrl("https://unknown-supplier.example/hero.png")).toBe(false);
    expect(isOptimizableImageUrl("//unknown-supplier.example/hero.png")).toBe(false);
    expect(displayImageUrl("/images/catalog/hero.png", 640)).toBe("/_next/image?url=%2Fimages%2Fcatalog%2Fhero.png&w=640&q=75");
    expect(displayImageUrl("https://unknown-supplier.example/hero.png")).toBe("https://unknown-supplier.example/hero.png");
});
