// @vitest-environment jsdom

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import GraceProductCard from "@/components/grace/cards/GraceProductCard";

vi.mock("next/image", () => ({
    default: (props: { alt: string; src: string }) => createElement("img", props),
}));
vi.mock("@/components/grace/cards/GraceCtaRow", () => ({
    default: () => null,
}));

const product = {
    graceSku: "GRACE-9ML",
    websiteSku: "WEB-9ML",
    itemName: "9 mL Clear Cylinder",
    slug: "cylinder-9ml-clear-17-415-rollon",
};

describe("Grace product-card navigation", () => {
    it("uses the preverified canonical product href including the exact SKU", () => {
        const markup = renderToStaticMarkup(createElement(GraceProductCard, {
            product: {
                ...product,
                verifiedPdpHref: "/products/cylinder-9ml-clear-17-415-rollon?sku=WEB-9ML",
            },
        }));

        expect(markup).toContain('href="/products/cylinder-9ml-clear-17-415-rollon?sku=WEB-9ML"');
    });

    it.each([undefined, "/products/cylinder-9ml-clear-17-415-rollon"])("sends an unverified card destination (%s) to the focused finder", (verifiedPdpHref) => {
        const markup = renderToStaticMarkup(createElement(GraceProductCard, {
            product: { ...product, verifiedPdpHref },
        }));

        expect(markup).toContain('href="/catalog?grace=1"');
        expect(markup).not.toContain('href="/products/cylinder-9ml-clear-17-415-rollon"');
    });
});
