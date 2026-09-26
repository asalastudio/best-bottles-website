// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductVariant } from "@/app/products/[slug]/ProductDetailClient";
import type { PdpRedesignPayload } from "@/components/pdp/PdpRedesignPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ── the page's collaborators, stubbed ────────────────────────────────────────
type CartLine = { graceSku: string; quantity: number; unitPrice: number | null; productGroupSlug?: string | null; color?: string; applicator?: string | null; capColor?: string | null; itemName: string };
const cart: { items: CartLine[] } = { items: [] };
let rerender: (() => void) | null = null;
const analyticsCalls: Array<[string, unknown]> = [];
const graceOpens: unknown[] = [];
const pushes: string[] = [];

vi.mock("@/components/Navbar", () => ({ default: () => createElement("header", { "data-testid": "navbar" }) }));
vi.mock("@/components/CartProvider", () => ({
    useCart: () => ({
        items: cart.items,
        addItems: (lines: CartLine[]) => {
            for (const line of lines) {
                const existing = cart.items.find((item) => item.graceSku === line.graceSku);
                if (existing) existing.quantity += line.quantity;
                else cart.items.push({ ...line });
            }
            cart.items = [...cart.items];
            rerender?.();
        },
        removeItem: (graceSku: string) => { cart.items = cart.items.filter((item) => item.graceSku !== graceSku); rerender?.(); },
    }),
}));
vi.mock("@/components/RegionProvider", () => ({ useRegion: () => ({ formatPrice: (usd: number) => `$${usd.toFixed(2)}` }) }));
vi.mock("@/components/useGrace", () => ({ useGrace: () => ({ openPanel: (options: unknown) => { graceOpens.push(options); } }) }));
vi.mock("@/lib/analytics", () => ({
    analytics: new Proxy({}, { get: (_target, name) => (properties: unknown) => { analyticsCalls.push([String(name), properties]); } }),
}));
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: (href: string) => { pushes.push(href); }, replace: () => {}, prefetch: () => {} }),
    usePathname: () => "/products/cylinder-9ml-cobalt-blue-17-415-rollon",
    useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: unknown }) => createElement("a", { href, ...rest }, children as never) }));

// ── fixtures ─────────────────────────────────────────────────────────────────
function variant(overrides: Partial<ProductVariant> & { websiteSku: string; graceSku: string }): ProductVariant {
    return {
        _id: `id-${overrides.websiteSku}`, itemName: overrides.websiteSku, itemDescription: null, imageUrl: "https://example.test/photo.webp",
        stockStatus: "In Stock", webPrice1pc: 0.85, webPrice10pc: null, webPrice12pc: 0.81,
        priceTiers: [{ minQty: 1, unitPrice: 0.85 }, { minQty: 12, unitPrice: 0.81 }, { minQty: 144, unitPrice: 0.77 }],
        category: "Glass Bottle", family: "Cylinder", shape: null, color: "Cobalt Blue", capacity: "9 ml (0.3 oz)", capacityMl: 9, capacityOz: 0.3,
        heightWithCap: "85 ±1 mm", heightWithoutCap: "70 ±1 mm", diameter: "20 ±0.5 mm", bottleWeightG: 30, neckThreadSize: "17-415",
        bottleCollection: "Cylinder", caseQuantity: 724, applicator: "Metal Roller Ball", capStyle: "Roll-On", capColor: "Shiny Black", trimColor: null,
        shopifyVariantId: "gid://shopify/ProductVariant/1", shopifySellable: true, ...overrides,
    };
}

const kit = (sku: string) => ({
    sku, canvas: { width: 1000, height: 1100 }, anchors: { axisX: 500, neckAxisX: 500, seatY: 283, baselineY: 1057 },
    parts: [
        { slot: "roller", zOrder: 1, explodeIndex: 1, bounds: { left: 424, top: 186, right: 575, bottom: 307 }, assembled: { x: 0, y: 0 }, exploded: { dx: 0, dy: -181 }, image: { url: `https://example.test/${sku}.roller.webp`, width: 1000, height: 1100 } },
        { slot: "body", zOrder: 0, explodeIndex: 0, bounds: { left: 402, top: 283, right: 605, bottom: 1057 }, assembled: { x: 0, y: 0 }, exploded: { dx: 0, dy: 0 }, image: { url: `https://example.test/${sku}.body.webp`, width: 1000, height: 1100 } },
        { slot: "cap", zOrder: 2, explodeIndex: 2, bounds: { left: 400, top: 144, right: 604, bottom: 427 }, assembled: { x: 0, y: 0 }, exploded: { dx: 0, dy: -455 }, image: { url: `https://example.test/${sku}.cap.webp`, width: 1000, height: 1100 } },
    ],
});

const VARIANTS = [
    variant({ websiteSku: "GBCylBlu9MtlRollBlkDot", graceSku: "GB-CYL-BLU-9ML-MRL-BKDT", capColor: "Black Dotted", capStyle: "Dot Cap" }),
    variant({ websiteSku: "GBCylBlu9MtlRollMattCu", graceSku: "GB-CYL-BLU-9ML-MRL-MCPR", capColor: "Matte Copper", webPrice1pc: 0.77, priceTiers: [{ minQty: 1, unitPrice: 0.77 }] }),
    variant({ websiteSku: "GBCylBlu9RollBlkDot", graceSku: "GB-CYL-BLU-9ML-ROL-BKDT", applicator: "Plastic Roller Ball", capColor: "Black Dotted", capStyle: "Dot Cap", webPrice1pc: 0.76, priceTiers: [{ minQty: 1, unitPrice: 0.76 }] }),
];

const payload: PdpRedesignPayload = {
    slug: "cylinder-9ml-cobalt-blue-17-415-rollon",
    group: {
        _id: "g1", slug: "cylinder-9ml-cobalt-blue-17-415-rollon", displayName: "Cylinder 9ml Cobalt Blue", family: "Cylinder", capacity: "9 ml (0.3 oz)", capacityMl: 9,
        color: "Cobalt Blue", category: "Glass Bottle", neckThreadSize: "17-415", primaryWebsiteSku: "GBCylBlu9RollBlkDot", primaryGraceSku: "GB-CYL-BLU-9ML-ROL-BKDT",
        applicatorTypes: ["Metal Roller Ball", "Plastic Roller Ball"], variantCount: 3, heroImageUrl: null,
    },
    variants: VARIANTS,
    siblings: [{ slug: "cylinder-9ml-amber-17-415-rollon", color: "Amber", displayName: "Cylinder 9ml Amber", primaryWebsiteSku: "GBCylAmb9RollBlkDot", primaryGraceSku: null }],
    kitsBySku: {
        GBCylBlu9MtlRollBlkDot: kit("GBCylBlu9MtlRollBlkDot"),
        GBCylBlu9MtlRollMattCu: kit("GBCylBlu9MtlRollMattCu"),
        GBCylBlu9RollBlkDot: kit("GBCylBlu9RollBlkDot"),
        GBCylAmb9RollBlkDot: kit("GBCylAmb9RollBlkDot"),
    },
    platesBySku: {},
    descriptions: {
        GBCylBlu9RollBlkDot: { description: "Plastic roller copy.", itemType: "Roll-on bottles", source: "curated", legacyUrl: null },
        GBCylBlu9MtlRollBlkDot: { description: "Steel roller copy.", itemType: "Roll-on bottles", source: "curated", legacyUrl: null },
        GBCylBlu9MtlRollMattCu: { description: "Matte copper copy.", itemType: "Roll-on bottles", source: "curated", legacyUrl: null },
    },
    collection: { band: { key: "roll-on-bottles", title: "Roll-On Bottles", subtitle: "A precise, personal application.", href: "/catalog?shop=roll-on-bottles&sort=capacity-asc", image: "/assets/homepage/collection-roll-on-bottles-bone-v3.webp" }, description: "A precise, personal application. 30 roll-on bottles." },
    familyHref: "/catalog?family=Cylinder",
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    cart.items = [];
    analyticsCalls.length = 0;
    graceOpens.length = 0;
    pushes.length = 0;
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    });
    container = document.createElement("div");
    document.body.append(container);
});

afterEach(async () => {
    await act(async () => { root?.unmount(); });
    container.remove();
});

async function mount() {
    const { default: PdpRedesignPage } = await import("@/components/pdp/PdpRedesignPage");
    root = createRoot(container);
    const render = () => root.render(createElement(PdpRedesignPage, payload));
    rerender = () => { act(() => { render(); }); };
    await act(async () => { render(); });
}

const text = (selector: string) => container.querySelector(selector)?.textContent ?? null;
const click = async (selector: string) => {
    const element = container.querySelector<HTMLButtonElement>(selector);
    expect(element, selector).not.toBeNull();
    await act(async () => { element!.click(); });
};

describe("redesigned product page", () => {
    it("opens on the group's primary SKU with the canvas, buy box and curated description", async () => {
        await mount();
        expect(text('[data-testid="pdp-eyebrow"]')).toBe("CYLINDER · 9 ML · 17-415");
        expect(text('[data-testid="pdp-title"]')).toBe("9 ml Cobalt Blue Cylinder Roll-On Bottle");
        expect(text('[data-testid="pdp-pick-line"]')).toBe("COBALT · PLASTIC ROLLER · BLACK WITH DOTS");
        expect(text('[data-testid="pdp-item-name"]')).toBe("GBCylBlu9RollBlkDot");
        expect(text('[data-testid="pdp-item-description"]')).toBe("Plastic roller copy.");
        expect(text('[data-testid="pdp-status"]')).toContain("In stock · ships in 1–3 business days · 724 per case");
        expect(container.querySelectorAll('[data-testid="pdp-stage"] img[data-slot]').length).toBe(3);
        expect(container.querySelector('[data-testid="pdp-stage"]')?.getAttribute("data-view")).toBe("sidecar");
        expect(text('[data-testid="pdp-add"]')).toBe("Add to cart · $0.76");
        expect(container.querySelector('[data-testid="pdp-order-lines"]')).toBeNull();
        expect(analyticsCalls.some(([name]) => name === "pdpView")).toBe(true);
    });

    it("switches to EXPLODED on a roller pick, keeps the view on a cap pick, and updates SKU, price and copy", async () => {
        await mount();
        await click('[data-testid="pdp-roller-toggle"] [data-roller="metal"]');
        expect(container.querySelector('[data-testid="pdp-stage"]')?.getAttribute("data-view")).toBe("exploded");
        expect(text('[data-testid="pdp-item-name"]')).toBe("GBCylBlu9MtlRollBlkDot");
        expect(text('[data-testid="pdp-item-description"]')).toBe("Steel roller copy.");
        expect(container.querySelector('[data-testid="pdp-callouts"]')?.getAttribute("data-on")).toBe("true");
        expect(container.querySelectorAll('[data-testid="pdp-callouts"] [data-callout]').length).toBe(4);
        await click('[data-testid="pdp-cap-rail"] [data-cap-id="matte-copper"]');
        expect(container.querySelector('[data-testid="pdp-stage"]')?.getAttribute("data-view")).toBe("exploded");
        expect(text('[data-testid="pdp-pick-line"]')).toBe("COBALT · METAL ROLLER · MATTE COPPER");
        expect(text('[data-testid="pdp-item-name"]')).toBe("GBCylBlu9MtlRollMattCu");
        expect(text('[data-testid="pdp-add"]')).toBe("Add to cart · $0.77");
        expect(window.location.search).toBe("?roller=metal&cap=matte-copper");
        // matte copper is not sold on the plastic roller: switching back lands on the first plastic cap
        await click('[data-testid="pdp-roller-toggle"] [data-roller="plastic"]');
        expect(text('[data-testid="pdp-item-name"]')).toBe("GBCylBlu9RollBlkDot");
    });

    it("appends cart lines that the In this order panel lists with the minimum meter", async () => {
        await mount();
        await click('[data-testid="pdp-add"]');
        expect(cart.items).toHaveLength(1);
        expect(cart.items[0]).toMatchObject({ graceSku: "GB-CYL-BLU-9ML-ROL-BKDT", quantity: 1, productGroupSlug: "cylinder-9ml-cobalt-blue-17-415-rollon", capColor: "Black with Dots" });
        const lines = [...container.querySelectorAll('[data-testid="pdp-order-line"]')].map((line) => line.textContent);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain("Cobalt · Plastic · Black with Dots");
        expect(text('[data-testid="pdp-order-minimum"]')).toContain("Add $49.24 more");
        expect(analyticsCalls.some(([name]) => name === "pdpAddLine")).toBe(true);
        await click('[data-testid="pdp-order-line"] button');
        expect(container.querySelector('[data-testid="pdp-order-lines"]')).toBeNull();
    });

    it("navigates to the sibling glass with the picks carried and opens Grace from the fitment button", async () => {
        await mount();
        await click('[data-testid="pdp-glass-lineup"] [data-glass-slug="cylinder-9ml-amber-17-415-rollon"]');
        expect(pushes).toEqual(["/products/cylinder-9ml-amber-17-415-rollon?roller=plastic&cap=black-with-dots"]);
        await click('[data-testid="pdp-ask-grace"]');
        expect(graceOpens).toEqual([{ source: "pdp" }]);
        expect(container.querySelector('[data-testid="pdp-build-cta"]')?.getAttribute("href")).toBe("/matrix?family=Cylinder&shop=roll-on-bottles&from=pdp");
        expect(text('[data-testid="pdp-collection"] h2')).toBe("Roll-On Bottles");
    });
});
