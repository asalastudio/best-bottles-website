// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { ProductGroupPayload, ProductVariant } from "@/app/products/[slug]/ProductDetailClient";
import evidence from "../docs/audits/pdp-jar-spec-truth-2026-10-02/production-evidence.json";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const navigation = vi.hoisted(() => ({
    params: new URLSearchParams(),
    router: { replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() },
    convex: { query: vi.fn() },
}));
vi.mock("next/navigation", () => ({
    useRouter: () => navigation.router, useSearchParams: () => navigation.params,
    usePathname: () => "/products/cream-jar-30ml-mixed",
}));
vi.mock("convex/react", () => ({ useQuery: () => null, useConvex: () => navigation.convex }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/CartProvider", () => ({ useCart: () => ({ addItems: vi.fn(), itemCount: 0 }) }));
vi.mock("@/components/useGrace", () => ({ useGrace: () => ({ openPanel: vi.fn() }) }));
vi.mock("@/lib/analytics", () => ({ analytics: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock("@/components/PdpBlocks", () => ({ PdpInlineBadges: () => null, PdpInlinePromo: () => null, PdpEditorialZone: () => null }));
vi.mock("@/components/products/PdpDiscoverySections", () => ({ default: () => null, PdpDiscoveryMatrixLink: () => null }));

// Observe the real page's child boundary. Do not manufacture glassOptions:
// ProductDetailClient must resolve the URL SKU and feed both surfaces itself.
vi.mock("@/components/products/ConfiguratorPdp", () => ({
    default: (props: { websiteSku?: string; variantFacts?: { color: string | null } }) => createElement("output", {
        "data-testid": "desktop-facts", "data-sku": props.websiteSku, "data-color": props.variantFacts?.color ?? "",
    }),
}));
vi.mock("@/components/products/mobile/MobileProductPdp", () => ({
    default: (props: { selectedVariant?: ProductVariant; glassOptions: Array<{ id: string; label: string; active: boolean }> }) => {
        const active = props.glassOptions.find((option) => option.active);
        return createElement("output", {
            "data-testid": "mobile-facts", "data-sku": props.selectedVariant?.websiteSku,
            "data-color": active?.label ?? "", "data-glass-id": active?.id ?? "",
        });
    },
}));
const { default: ProductDetailClient } = await import("@/app/products/[slug]/ProductDetailClient");

function fixture(slug: string): ProductGroupPayload {
    const variants: ProductVariant[] = evidence.groups[0].variants.map((row) => ({
        ...row, _id: row.websiteSku, itemDescription: null, imageUrl: "https://example.test/jar.webp",
        stockStatus: "In Stock", webPrice1pc: 0.9, webPrice10pc: null, webPrice12pc: 0.86,
        category: "Glass Jar", family: "Cream Jar", shape: null, capacity: "30 ml", capacityMl: 30,
        heightWithCap: null, heightWithoutCap: null, diameter: null, bottleWeightG: null,
        neckThreadSize: "45mm", bottleCollection: null, caseQuantity: null, trimColor: null,
    }));
    return { group: { _id: "jar-group", slug, displayName: "Cream Jar 30 ml", family: "Cream Jar", category: "Glass Jar", color: null, capacity: "30 ml", neckThreadSize: "45mm", variantCount: 4 }, variants };
}

describe("classic PDP selected-SKU wiring", () => {
    it.each(["cream-jar-30ml-mixed", "cream-jar-30ml-amber-45mm"])("updates both child surfaces on URL SKU transitions in %s", async (slug) => {
        const payload = fixture(slug);
        const initialPdpBlocks: [] = [];
        const host = document.createElement("div");
        const root = createRoot(host);
        try {
            for (const [sku, color] of [["CJAmb30BlkCap", "Amber"], ["CJFrst30SlCap", "Frosted"], ["CJAmb30SlCap", "Amber"]]) {
                navigation.params = new URLSearchParams({ sku });
                await act(async () => { root.render(createElement(ProductDetailClient, { slug, initialData: payload, initialPdpBlocks })); });
                for (const surface of ["desktop-facts", "mobile-facts"]) {
                    const output = host.querySelector(`[data-testid='${surface}']`);
                    expect(output?.getAttribute("data-sku")).toBe(sku);
                    expect(output?.getAttribute("data-color")).toBe(color);
                }
                expect(host.querySelector("[data-testid='mobile-facts']")?.getAttribute("data-glass-id")).toBe(color.toLowerCase());
            }
        } finally {
            await act(async () => { root.unmount(); });
        }
    });
});
