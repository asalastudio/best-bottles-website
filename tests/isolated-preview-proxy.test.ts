import { describe, expect, it, vi } from "vitest";
import { NextRequest, type NextFetchEvent } from "next/server";

vi.mock("@/lib/clerk", () => ({ CLERK_ENABLED: false }));
vi.mock("@clerk/nextjs/server", () => ({
    clerkMiddleware: () => vi.fn(() => { throw new Error("Disabled preview must not enter Clerk"); }),
    createRouteMatcher: () => () => false,
}));
vi.mock("@/lib/crawl/catalog-product-slugs", () => ({ productSlugExists: vi.fn() }));
vi.mock("@/lib/crawl/route-status", () => ({
    NOT_FOUND_REWRITE_PATH: "/not-found",
    crawlRouteStatus: async () => ({ kind: "pass" }),
}));

import proxy from "../src/proxy";

describe("isolated preview without Clerk", () => {
    it("preserves POST transport headers while adding locale headers", async () => {
        const body = JSON.stringify({ family: "Empire", sku: "GBEmp100SpryMtGl" });
        const request = new NextRequest("https://preview.example/api/bottle-builder/validate", {
            method: "POST",
            headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(body)), "x-test-client": "preview" },
            body,
        });
        const response = await proxy(request, {} as NextFetchEvent);
        const forwarded = response.headers.get("x-middleware-override-headers")!.split(",");
        for (const name of ["content-type", "content-length", "x-test-client"]) {
            expect(forwarded).toContain(name);
            expect(response.headers.get(`x-middleware-request-${name}`)).toBe(request.headers.get(name));
        }
        expect(await request.json()).toEqual({ family: "Empire", sku: "GBEmp100SpryMtGl" });
    });
});
