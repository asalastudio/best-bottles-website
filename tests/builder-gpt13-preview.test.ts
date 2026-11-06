import { beforeEach, describe, expect, it, vi } from "vitest";
const { loadKits, pilot } = vi.hoisted(() => ({ loadKits: vi.fn(), pilot: vi.fn() }));
// The route imports the server-only display manifest; vitest is neither a Server nor a Client Component runtime.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/bottle-builder/server", () => ({ loadBuilderBodyKits: loadKits, BUILDER_CDN_CACHE: "public, max-age=60" }));
vi.mock("@/lib/paper-doll/local-component-kits", () => ({ localGpt13ComponentKits: pilot }));
import { GET } from "@/app/api/bottle-builder/kits/route";
const request = () => new Request("http://localhost:3010/api/bottle-builder/kits?family=Cylinder&bodyId=cylinder5&assetPreview=gpt13");
beforeEach(() => { vi.clearAllMocks(); });
describe("builder review kit overlay", () => {
    it("uses the exact SKU and seated layers without mutating the cached baseline", async () => {
        const baseline = { id: { sku: "A", parts: [{ slot: "body", image: "old" }] }, other: { sku: "B", parts: [] } };
        loadKits.mockResolvedValue(baseline);
        pilot.mockReturnValue({ A: { sku: "A", parts: [{ slot: "body" }, { slot: "roller", views: ["capon", "sidecar"] }, { slot: "roller", views: ["exploded"] }] } });
        const response = await GET(request()); const { kits } = await response.json();
        expect(pilot).toHaveBeenCalledWith("localhost:3010", "gpt13");
        expect(kits.id.parts.map((p: { slot: string }) => p.slot)).toEqual(["body", "roller"]);
        expect(kits.other).toEqual(baseline.other);
        expect(baseline.id.parts).toEqual([{ slot: "body", image: "old" }]);
        expect(response.headers.get("Cache-Control")).toBe("no-store");
    });
    it("rejects a mismatched SKU and retains baseline caching without an active pilot", async () => {
        const baseline = { id: { sku: "A", parts: [] } }; loadKits.mockResolvedValue(baseline);
        pilot.mockReturnValue({ A: { sku: "wrong", parts: [{ slot: "body" }] } });
        expect((await (await GET(request())).json()).kits).toEqual(baseline);
        pilot.mockReturnValue({});
        const response = await GET(request());
        expect((await response.json()).kits).toEqual(baseline);
        expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    });
    it("can review a recovered exact configuration when its previous kit was missing", async () => {
        const baseline = { GBMtlRoll28Wht: null, unrelated: null };
        loadKits.mockResolvedValue(baseline);
        pilot.mockReturnValue({ GBMtlRoll28Wht: { sku: "GBMtlRoll28Wht", parts: [
            { slot: "body" }, { slot: "roller", views: ["sidecar", "capon"] }, { slot: "roller", views: ["exploded"] },
        ] }, extraSku: { sku: "extraSku", parts: [] } });
        const response = await GET(request());
        const { kits } = await response.json();
        expect(kits.GBMtlRoll28Wht.parts.map((p: { slot: string }) => p.slot)).toEqual(["body", "roller"]);
        expect(kits.unrelated).toBeNull();
        expect(kits.extraSku).toBeUndefined();
        expect(baseline.GBMtlRoll28Wht).toBeNull();
        expect(response.headers.get("Cache-Control")).toBe("no-store");
    });
});
