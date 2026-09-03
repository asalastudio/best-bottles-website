import { describe, expect, it } from "vitest";
import { getCanonicalProductSlug, getLegacyProductRouteOverride } from "../src/lib/products/legacy-product-route-overrides";
import { resolveProductPageRedirectTarget } from "../src/lib/products/pdp-redirect";
import { safePdpReturnPath } from "../src/app/products/[slug]/ProductDetailClient";

describe("legacy product route overrides", () => {
    it("routes the old Diva catch-all PDP to the canonical perfume spray PDP", () => {
        expect(getLegacyProductRouteOverride("diva-46ml-clear-18-415")).toBe("diva-46ml-clear-18-415-perfumespray");
        expect(getCanonicalProductSlug("diva-46ml-clear-18-415")).toBe("diva-46ml-clear-18-415-perfumespray");
    });

    it("routes duplicate 5 ml Cylinder cap records to the canonical cap PDP", () => {
        expect(getLegacyProductRouteOverride("cylinder-5ml-clear-13-415-capclosure")).toBe("cylinder-5ml-clear-13-415");
        expect(getLegacyProductRouteOverride("cylinder-5ml-white-13-415")).toBe("cylinder-5ml-clear-13-415");
        expect(getCanonicalProductSlug("cylinder-5ml-white-13-415")).toBe("cylinder-5ml-clear-13-415");
    });

    it("routes duplicate 9 ml Cylinder drift records to canonical clear Cylinder PDPs", () => {
        expect(getLegacyProductRouteOverride("cylinder-9ml-17-415")).toBe("cylinder-9ml-clear-17-415-rollon");
        expect(getLegacyProductRouteOverride("cylinder-9ml-clear")).toBe("cylinder-9ml-clear-17-415-rollon");
        expect(getLegacyProductRouteOverride("cylinder-9ml-white-13-415")).toBe("cylinder-9ml-clear-13-415");
        expect(getLegacyProductRouteOverride("cylinder-9ml-white-17-415-rollon")).toBe("cylinder-9ml-clear-17-415-rollon");
        expect(getCanonicalProductSlug("cylinder-9ml-white-17-415-rollon")).toBe("cylinder-9ml-clear-17-415-rollon");
    });

    it("preserves a direct PDP SKU query through the operative server redirect without looping", () => {
        expect(resolveProductPageRedirectTarget("cylinder-9ml-17-415", { sku: "WEB-9ML", from: "grace" }))
            .toBe("/products/cylinder-9ml-clear-17-415-rollon?sku=WEB-9ML&from=grace");
        expect(resolveProductPageRedirectTarget("cylinder-9ml-clear-17-415-rollon", { sku: "WEB-9ML" })).toBeNull();
        expect(getLegacyProductRouteOverride("cylinder-9ml-clear-17-415-rollon")).toBeNull();
    });

    it("routes duplicate 9 ml Cylinder vial records to canonical Vial PDPs", () => {
        expect(getLegacyProductRouteOverride("cylinder-9ml-clear-18-400")).toBe("vial-9ml-clear-18-400");
        expect(getLegacyProductRouteOverride("cylinder-9ml-clear-18-400-glasswand")).toBe("vial-9ml-clear-18-400-glasswand");
        expect(getCanonicalProductSlug("cylinder-9ml-clear-18-400-glasswand")).toBe("vial-9ml-clear-18-400-glasswand");
    });

    it("leaves canonical slugs unchanged", () => {
        expect(getLegacyProductRouteOverride("diva-46ml-clear-18-415-perfumespray")).toBeNull();
        expect(getCanonicalProductSlug("diva-46ml-clear-18-415-perfumespray")).toBe("diva-46ml-clear-18-415-perfumespray");
    });

    it("accepts only same-origin PDP return paths", () => {
        expect(safePdpReturnPath("/catalog/cylinder?application=rollon")).toBe("/catalog/cylinder?application=rollon");
        expect(safePdpReturnPath("//malicious.example/pdp")).toBeNull();
        expect(safePdpReturnPath("/\\malicious.example/pdp")).toBeNull();
        expect(safePdpReturnPath("https://malicious.example/pdp")).toBeNull();
    });
});
