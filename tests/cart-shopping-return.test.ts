import { describe, expect, it } from "vitest";
import { isBuilderShoppingPath, validateShoppingReturn } from "@/lib/cartShoppingReturn";

describe("safe cart shopping destinations", () => {
    it.each([
        "/catalog?category=Component&threads=13-415",
        "/products/elegant-15ml-clear-13-415?cap=silver",
        "/matrix?family=Elegant",
        "/es/catalog?category=Component",
        "/catalog/cylinder?colors=Cobalt",
        "/es/catalog/application/essential-oils?capacities=15+ml",
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

    it("preserves actual SKU/cap/roller picks, builder family/shop and catalog filters", () => {
        expect(validateShoppingReturn("/products/elegant?sku=GB-ELG-CLR-15ML-SLV-T-01&cap=silver&roller=metal&qty=100&applicator=Metal+Roller+Ball"))
            .toBe("/products/elegant?sku=GB-ELG-CLR-15ML-SLV-T-01&cap=silver&roller=metal&qty=100&applicator=Metal+Roller+Ball");
        expect(validateShoppingReturn("/es/matrix?family=Boston+Round&shop=roll-on-bottles&from=grace"))
            .toBe("/es/matrix?family=Boston+Round&shop=roll-on-bottles");
        const result = new URL(validateShoppingReturn("/catalog?category=Glass+Bottle&families=Cylinder,Elegant&colors=Clear&colors=Cobalt&capacities=15+ml&threads=13-415&priceMin=1.25&priceMax=10&sort=capacity-asc&view=line&scope=all")!, "https://example.test");
        expect(result.searchParams.get("families")).toBe("Cylinder,Elegant");
        expect(result.searchParams.getAll("colors")).toEqual(["Clear", "Cobalt"]);
        expect(result.searchParams.get("capacities")).toBe("15 ml");
        expect(result.searchParams.get("threads")).toBe("13-415");
        expect(result.searchParams.get("priceMin")).toBe("1.25");
        expect(result.searchParams.get("sort")).toBe("capacity-asc");
        expect(result.searchParams.get("view")).toBe("line");
    });

    it("drops auth, personal, unknown and nested URL fields plus all fragments", () => {
        expect(validateShoppingReturn("/products/elegant?cap=silver&token=secret&access_token=secret&code=secret&auth=secret&email=buyer%40example.test&customer_id=123&note=private&from=%2Fcatalog%3Ftoken%3Dsecret#access_token=secret"))
            .toBe("/products/elegant?cap=silver");
        expect(validateShoppingReturn("/catalog?category=Component&search=buyer%40example.test&utm_source=private#results"))
            .toBe("/catalog?category=Component");
        expect(validateShoppingReturn("/catalog?search=13-415#filters")).toBe("/catalog");
        expect(validateShoppingReturn("/collections?sku=PRIVATE#private")).toBe("/collections");
    });

    it.each(["category", "family", "families"])("preserves the known Cap/Closure catalog %s", key => {
        const path = `/catalog?${key}=Cap%2FClosure`;
        expect(validateShoppingReturn(path)).toBe(path);
    });

    it("preserves Cap/Closure alongside comma-separated and repeated component families", () => {
        const path = "/es/catalog?families=Cap%2FClosure%2CSprayer&families=Dropper";
        expect(validateShoppingReturn(path)).toBe(path);
    });

    it.each(["https%3A%2F%2Fevil.test", "%2F%2Fevil.test", "Cap%2FClosure%2Fevil", "Cap%2FClosure%2C%2F%2Fevil.test"])("rejects arbitrary slash-bearing catalog values: %s", value => {
        expect(validateShoppingReturn(`/catalog?category=${value}&family=${value}&families=${value}`)).toBe("/catalog");
    });

    it("limits the slash-label exception to relevant catalog filters", () => {
        expect(validateShoppingReturn("/catalog?shop=Cap%2FClosure&colors=Cap%2FClosure")).toBe("/catalog");
        expect(validateShoppingReturn("/products/elegant?cap=Cap%2FClosure")).toBe("/products/elegant");
        expect(validateShoppingReturn("/matrix?family=Cap%2FClosure")).toBe("/matrix");
    });

    it.each([1, 9999, 10000, 99999])("preserves valid PDP quantity %s", quantity => {
        const path = `/products/elegant?qty=${quantity}`;
        expect(validateShoppingReturn(path)).toBe(path);
    });

    it.each(["0", "-1", "1.5", "100000", "01", "1e4"])("drops invalid PDP quantity %s", quantity => {
        expect(validateShoppingReturn(`/products/elegant?qty=${quantity}`)).toBe("/products/elegant");
    });

    it.each(["buyer%40example.test", "https%3A%2F%2Fprivate.test", "%2540private", "%0Asecret", "%3Cscript%3E"])("drops unsafe content inside allowlisted values: %s", value => {
        expect(validateShoppingReturn(`/products/elegant?sku=${value}&cap=silver`)).toBe("/products/elegant?cap=silver");
        expect(validateShoppingReturn(`/matrix?family=${value}`)).toBe("/matrix");
    });

    it("validates bounded numeric values and does not propagate unrelated route parameters", () => {
        expect(validateShoppingReturn("/products/elegant?qty=-1&priceMin=2&family=Elegant&sku=VALID&sku=OTHER")).toBe("/products/elegant?sku=VALID");
        expect(validateShoppingReturn("/catalog?priceMin=NaN&priceMax=-2&view=private&scope=private")).toBe("/catalog");
        expect(validateShoppingReturn(`/products/elegant?sku=${"a".repeat(81)}`)).toBe("/products/elegant");
    });

    it("only names the actual matrix route as a builder", () => {
        expect(isBuilderShoppingPath("/es/matrix?family=Elegant")).toBe(true);
        expect(isBuilderShoppingPath("/catalog?returnTo=/matrix")).toBe(false);
        expect(isBuilderShoppingPath("/products/matrix")).toBe(false);
    });
});
