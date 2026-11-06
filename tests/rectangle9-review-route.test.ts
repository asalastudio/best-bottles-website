import { afterEach, describe, expect, it, vi } from "vitest";
// The route imports the server-only display manifest; vitest is neither a Server nor a Client Component runtime.
vi.mock("server-only", () => ({}));
import { GET } from "@/app/api/bottle-masters/rectangle9/route";

afterEach(() => vi.unstubAllEnvs());
describe("Rectangle image candidate boundary", () => {
    it.each(["localhost:3010", "127.0.0.1:3010", "[::1]:3010"])("allows loopback review on %s", async host => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("VERCEL", "");
        const response = await GET(new Request("http://" + host + "/api/bottle-masters/rectangle9?sku=GBSQSTClear"));
        expect(response.status).toBe(200);
        expect((await response.json()).kit.sku).toBe("GBSQSTClear");
    });
    it.each([
        ["production", "", "localhost:3010"],
        ["development", "1", "localhost:3010"],
        ["development", "", "example.com"],
        ["development", "", "localhost.example.com"],
    ])("rejects non-local candidate access (%s, %s, %s)", async (mode, vercel, host) => {
        vi.stubEnv("NODE_ENV", mode); vi.stubEnv("VERCEL", vercel);
        expect((await GET(new Request("http://" + host + "/api/bottle-masters/rectangle9?sku=GBSQSTClear"))).status).toBe(404);
    });
    it("does not substitute an unrelated SKU", async () => {
        vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL", "");
        expect((await GET(new Request("http://localhost:3010/api/bottle-masters/rectangle9?sku=GBSleek5RollGlMatt"))).status).toBe(404);
    });
});
