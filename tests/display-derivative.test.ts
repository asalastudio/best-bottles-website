import { expect, it } from "vitest";
import approved from "@/lib/paper-doll/approved-kits.generated.json";
import delivery from "@/lib/products/display-images.generated.json";
import { displayDerivativeSrcSet, displayDerivativeUrl, registeredImageSizes } from "@/lib/products/display-derivative";
import { displayImageUrl } from "@/lib/products/optimizable-image";
import { registerImageSrc, registerImageSrcSet, markRegisterOptimizerUnavailable } from "@/lib/products/register-image";
import { pdpHeroImageUrls } from "@/lib/products/pdp-image-preloads";
import { stageLayout, type KitLike } from "@/lib/products/pdp-redesign/stage";

it("covers every approved source with immutable display copies and leaves unknown images alone", () => {
    const urls = new Set(Object.values(approved.rows).flatMap(kit => kit.parts.flatMap(part =>
        [part.image.url, (part as { detached?: { image: { url: string } } }).detached?.image.url].filter((url): url is string => Boolean(url)))));
    expect(urls.size).toBe(377);   // 126 + the Elegant masters' layers (2026-11-03) + the Vial masters' and the Diva masters' (2026-11-04)
    for (const source of urls) {
        for (const width of [128, 256, 640, 1200]) {
            expect(displayDerivativeUrl(source, width)).toMatch(/^https:\/\/yzy7l20k4yt6znzz\.public\.blob\.vercel-storage\.com\/product-display\/v1\/[a-f0-9]{64}\/(128|256|640|1200)-[a-f0-9]{64}\.webp$/);
            expect(displayImageUrl(source, width as 128 | 256 | 640 | 1200)).toBe(displayDerivativeUrl(source, width));
        }
    }
    expect(Object.keys(delivery.sources)).toHaveLength(419); // Includes Tola, the cleaned 25 ml copper overcap, the Elegant masters (128 + 58 + 80), the Vial masters (22), the Diva masters (127) and the four Diva glass plates.
    expect(displayDerivativeUrl("https://unknown.example/master.png", 640)).toBeNull();
    expect(displayDerivativeUrl("/local-kits/unapproved-candidate.svg", 640)).toBeNull();
    for (const [alias, source] of Object.entries(delivery.aliases)) {
        expect(displayDerivativeUrl(alias, 640)).toBe(displayDerivativeUrl(source, 640));
    }
});

it("a failed delivery copy falls back for that source without downloading other full-size masters", () => {
    const [first, second] = Object.keys(delivery.sources);
    expect(markRegisterOptimizerUnavailable(first)).toBe(true);
    expect(registerImageSrc(first, 640)).toBe(first);
    expect(registerImageSrcSet(first)).toBeUndefined();
    expect(registerImageSrc(second, 640)).toBe(displayDerivativeUrl(second, 640));
    expect(registerImageSrcSet(second)).toBe(displayDerivativeSrcSet(second));
});

it("offers resolution choices without changing registered dimensions and increases detail for zoom", () => {
    const source = Object.keys(delivery.sources)[0];
    expect(displayDerivativeSrcSet(source)).toContain(" 128w, ");
    const maximum = Math.max(...Object.values(delivery.pixelWidths[source as keyof typeof delivery.pixelWidths]));
    expect(displayDerivativeSrcSet(source)).toContain(` ${maximum}w`);
    expect(displayDerivativeSrcSet(source)?.split(", ")).toHaveLength(new Set(Object.values(delivery.pixelWidths[source as keyof typeof delivery.pixelWidths])).size);
    expect(registeredImageSizes(20, 1)).toBe("(max-width: 767px) 20vw, 11vw");
    expect(registeredImageSizes(20, 1, 2)).toBe("(max-width: 767px) 40vw, 22vw");
});

it("preloads the exact selected assembly URLs without fetching every finish or changing registration", () => {
    const kit = approved.rows.GBSleek8SpryGlMatt as unknown as KitLike;
    const before = JSON.stringify(kit);
    const layout = stageLayout(kit, "sidecar", { websiteSku: kit.sku })!;
    expect(pdpHeroImageUrls(kit, kit.sku)).toEqual([...new Set(layout.parts.map(part => displayImageUrl(part.url, part.box ? 640 : 1200)))]);
    expect(pdpHeroImageUrls(kit, kit.sku)).toHaveLength(layout.parts.length);
    expect(pdpHeroImageUrls(null, null)).toEqual([]);
    expect(JSON.stringify(kit)).toBe(before);
    const frosted = approved.rows.GBTallCylFrst9SpryBlkMatt as unknown as KitLike;
    const frostedLayout = stageLayout(frosted, "sidecar", { websiteSku: frosted.sku })!;
    expect(frostedLayout.backdrop).toBeTruthy();
    expect(pdpHeroImageUrls(frosted, frosted.sku)).toContain(frostedLayout.backdrop!.url);
});
