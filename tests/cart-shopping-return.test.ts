import { describe, expect, it } from "vitest";
import { isBuilderShoppingPath, validateShoppingReturn } from "@/lib/cartShoppingReturn";

describe("safe cart shopping destinations", () => {
    it.each([
        "/catalog?category=Component&search=13-415#results",
        "/products/elegant-15ml-clear-13-415?cap=silver",
        "/matrix?family=Elegant",
        "/es/catalog?search=botella",
        "/es/matrix?family=Elegant",
        "/bottle-families",
        "/collections/boston-round-30ml",
    ])("preserves browsing state in %s", path => expect(validateShoppingReturn(path)).toBe(path));

    it.each([
        undefined, null, "", "https://evil.example/catalog", "//evil.example/catalog", "/\\evil.example/catalog",
        "/%2f%2fevil.example", "/catalog/../sign-in", "/catalog/%2e%2e/sign-in", "/catalog\n",
        "/cart", "/es/cart", "/api/redirect?url=https://evil.example", "/sign-in?redirect_url=https://evil.example",
        "/portal", "/matrix-evil", "/products", "/products/%ZZ", "/products/%5c", "/catalog/%252e%252e/sign-in",
    ])("rejects non-browsing or unsafe path %s", path => expect(validateShoppingReturn(path)).toBeNull());

    it("only names the actual matrix route as a builder", () => {
        expect(isBuilderShoppingPath("/es/matrix?family=Elegant")).toBe(true);
        expect(isBuilderShoppingPath("/catalog?returnTo=/matrix")).toBe(false);
        expect(isBuilderShoppingPath("/products/matrix")).toBe(false);
    });
});
