// @vitest-environment jsdom
import { act, createElement, type ImgHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import CatalogCardPreview from "@/components/catalog/CatalogCardPreview";
import { APPROVED_KIT_VERSION, CYLINDER28_KIT_VERSION } from "@/lib/paper-doll/approved-kit-index";
vi.mock("server-only", () => ({}));
import { GET } from "@/app/api/bottle-masters/approved/route";
vi.mock("convex/react", () => ({ useQuery: () => undefined }));
vi.mock("next/image", () => ({ default: (props: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    const p = { ...props } as Record<string, unknown>; delete p.fill; delete p.unoptimized; return createElement("img", p);
}, getImageProps: ({ src }: { src: string }) => ({ props: { src } }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
afterEach(() => { act(() => root?.unmount()); container?.remove(); vi.unstubAllGlobals(); });

// Production showed "Product image coming soon" on the 28 ml Frosted roll-on card while its Clear twin drew the
// approved master. The Frosted SKUs are approved masters from 24 Nov 2026, so the card draws the frosted recipe.
it("draws the 28 ml Frosted roll-on card from its approved master, not the placeholder", async () => {
    const requested: string[] = [];
    vi.stubGlobal("fetch", (input: string) => {
        requested.push(input);
        return GET(new Request(new URL(input, "https://example.com")));
    });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
    await act(async () => root.render(createElement(CatalogCardPreview, {
        title: "Cylinder 28 ml Frosted Roll-On", catalogHero: null, imageUrl: null,
        href: "/products/cylinder-28ml-frosted-16mm-rollon", family: "Cylinder", slug: "cylinder-28ml-frosted-16mm-rollon",
        variants: [
            { id: "mtl-blk", label: "Black", websiteSku: "GBCylFrst28MtlRollBlk", optionType: "capColor" },
            { id: "mtl-wht", label: "White", websiteSku: "GBCylFrst28MtlRollWht", optionType: "capColor" },
        ],
    })));
    await vi.waitFor(() => expect(container.querySelector("svg[data-bb-master-sku]")).not.toBeNull());
    const svg = container.querySelector("svg[data-bb-master-sku]")!;
    expect(svg.getAttribute("data-bb-master-sku")).toBe("GBCylFrst28MtlRollBlk");
    expect(svg.getAttribute("data-bb-master-version")).toBe(`${APPROVED_KIT_VERSION}-${CYLINDER28_KIT_VERSION}`);
    expect(requested).toEqual([`/api/bottle-masters/approved?sku=GBCylFrst28MtlRollBlk&v=${APPROVED_KIT_VERSION}-${CYLINDER28_KIT_VERSION}`]);
    expect(container.innerHTML).toMatch(/cylinder28-glass-frosted/);
    expect(container.textContent).not.toContain("Product image coming soon");
});
