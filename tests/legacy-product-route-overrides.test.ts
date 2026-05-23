import { describe, expect, it } from "vitest";
import { getCanonicalProductSlug, getLegacyProductRouteOverride } from "../src/lib/products/legacy-product-route-overrides";

describe("legacy product route overrides", () => {
    it("routes the old Diva catch-all PDP to the canonical perfume spray PDP", () => {
        expect(getLegacyProductRouteOverride("diva-46ml-clear-18-415")).toBe("diva-46ml-clear-18-415-perfumespray");
        expect(getCanonicalProductSlug("diva-46ml-clear-18-415")).toBe("diva-46ml-clear-18-415-perfumespray");
    });

    it("leaves canonical slugs unchanged", () => {
        expect(getLegacyProductRouteOverride("diva-46ml-clear-18-415-perfumespray")).toBeNull();
        expect(getCanonicalProductSlug("diva-46ml-clear-18-415-perfumespray")).toBe("diva-46ml-clear-18-415-perfumespray");
    });
});
