import { afterEach, describe, expect, it, vi } from "vitest";
const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("node:fs", () => ({ readFileSync: read }));
import { localGpt13ComponentKits, localPdpComponentKits } from "@/lib/paper-doll/local-component-kits";
afterEach(() => { vi.unstubAllEnvs(); read.mockReset(); });
function setup() {
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL", "");
    vi.stubEnv("BUILDER_LOCAL_KITS", "");
    read.mockImplementation((path: string) => {
        if (path.includes("gpt-13-415")) return JSON.stringify({ rows: { A: { sku: "A", familyId: "pilot" }, stale: { sku: "wrong" } } });
        return JSON.stringify({ rows: { A: { sku: "A", familyId: "baseline" } }, defaultPdpSkus: ["A"] });
    });
}
describe("GPT 13-415 local review boundary", () => {
    it("requires the explicit flag and a loopback host", () => {
        setup();
        for (const host of [null, "bestbottles.com", "localhost.attacker.com", "example.vercel.app"])
            expect(localGpt13ComponentKits(host, "gpt13")).toEqual({});
        for (const flag of [undefined, "kits", "other"])
            expect(localGpt13ComponentKits("localhost:3010", flag)).toEqual({});
        expect(read).not.toHaveBeenCalled();
        expect(localGpt13ComponentKits("localhost:3010", "gpt13").A.familyId).toBe("pilot");
    });
    it("never reads the pilot file in production or on Vercel", () => {
        setup(); vi.stubEnv("NODE_ENV", "production");
        expect(localGpt13ComponentKits("localhost:3010", "gpt13")).toEqual({});
        vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL", "1");
        expect(localGpt13ComponentKits("localhost:3010", "gpt13")).toEqual({});
        expect(read).not.toHaveBeenCalled();
    });
    it("keeps ordinary product pages on their original kit and resolves pilot SKUs exactly", () => {
        setup(); const variants = [{ websiteSku: "A" }, { websiteSku: "stale" }];
        expect(localPdpComponentKits("localhost:3010", undefined, variants).A.familyId).toBe("baseline");
        expect(localPdpComponentKits("localhost:3010", "gpt13", variants)).toEqual({ A: { sku: "A", familyId: "pilot" } });
        expect(localPdpComponentKits("localhost:3010", undefined, variants).A.familyId).toBe("baseline");
    });
    it("fails closed when review assets have not been restored", () => {
        setup(); read.mockImplementation(() => { throw Error("missing"); });
        expect(localGpt13ComponentKits("localhost:3010", "gpt13")).toEqual({});
    });
});
