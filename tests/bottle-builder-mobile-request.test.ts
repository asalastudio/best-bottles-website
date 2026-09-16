import { expect, it } from "vitest";
import { chooserPreloadUrls, preferMobileRequest } from "@/lib/bottle-builder/mobile-request";
import type { BuilderBody, BuilderConfiguration } from "@/lib/bottle-builder/model";

const headers = (entries: Record<string, string>) => ({ get: (name: string) => entries[name] ?? entries[name.toLowerCase()] ?? null });

it("prefers mobile from the client hint or a phone user agent", () => {
    expect(preferMobileRequest(headers({ "sec-ch-ua-mobile": "?1" }))).toBe(true);
    expect(preferMobileRequest(headers({ "sec-ch-ua-mobile": "?0" }))).toBe(false);
    expect(preferMobileRequest(headers({ "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" }))).toBe(true);
    expect(preferMobileRequest(headers({ "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" }))).toBe(false);
});

it("preloads the first unique chooser body images", () => {
    const config = (id: string, url: string) => ({
        id, bodyId: id, color: "Clear", fitment: "Metal Roller", closure: "Gold", family: "Cylinder",
        capacityMl: 9, neck: "13-415", profileLabel: "Cylinder", kit: null, previewKit: undefined,
        bodyImage: { url, width: 400, height: 520 }, photoUrl: null,
        finishComponent: { websiteSku: "x", imageUrl: null, name: "Gold" },
        caseQuantity: 24, product: { graceSku: id, webPrice1pc: 1, shopifyVariantId: "1", shopifySellable: true },
    } as BuilderConfiguration);
    const body = (id: string, url: string) => ({
        id, family: "Cylinder", capacityMl: 9, neck: "13-415", profileLabel: "Cylinder", configurations: [config(id, url)],
    } as BuilderBody);
    expect(chooserPreloadUrls([body("a", "/a.webp"), body("b", "/b.webp"), body("c", "/a.webp"), body("d", "/d.webp")], 2)).toEqual(["/a.webp", "/b.webp"]);
});
