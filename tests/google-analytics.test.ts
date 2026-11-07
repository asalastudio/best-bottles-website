import { describe, expect, it } from "vitest";
import { gaMeasurementId, gaPageLocation } from "../src/lib/analytics/googleAnalytics";

describe("gaMeasurementId", () => {
    it("accepts a GA4 measurement ID", () => {
        expect(gaMeasurementId(" G-ABC123XYZ ")).toBe("G-ABC123XYZ");
    });

    it("keeps GA off when the ID is unset or is not a GA4 ID", () => {
        for (const raw of [undefined, "", "UA-12345-1", "G-", "G-abc123", "<script>"]) {
            expect(gaMeasurementId(raw), String(raw)).toBeNull();
        }
    });
});

describe("gaPageLocation", () => {
    it("counts reviewed public pages, in both languages", () => {
        expect(gaPageLocation("https://www.bestbottles.com/catalog")).toBe("https://www.bestbottles.com/catalog");
        expect(gaPageLocation("https://www.bestbottles.com/es/products/cylinder-9ml-clear-13-415"))
            .toBe("https://www.bestbottles.com/es/products/cylinder-9ml-clear-13-415");
    });

    it("sends nothing from private pages", () => {
        for (const path of ["/portal/orders", "/team", "/cart", "/contact", "/request-quote", "/sign-in", "/grace-workspace"]) {
            expect(gaPageLocation(`https://www.bestbottles.com${path}`), path).toBeNull();
        }
    });

    it("keeps campaign parameters and drops everything else", () => {
        expect(gaPageLocation("https://www.bestbottles.com/catalog?q=jordan%40example.com&utm_source=newsletter&gclid=abc&shop=cream-jars#top"))
            .toBe("https://www.bestbottles.com/catalog?utm_source=newsletter&gclid=abc");
    });

    it("rejects what is not a URL", () => {
        expect(gaPageLocation("not a url")).toBeNull();
    });
});
