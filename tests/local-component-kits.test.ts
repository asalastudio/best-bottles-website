import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
vi.mock("server-only", () => ({}));
import { localPdpComponentKits, readLocalComponentKits } from "@/lib/paper-doll/local-component-kits";

const dirs: string[] = [];
afterEach(() => { vi.unstubAllEnvs(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function stage(defaultPdpSkus?: string[]) {
    const dir = mkdtempSync(join(tmpdir(), "bottle-kit-review-")); dirs.push(dir);
    const path = join(dir, "kits.json");
    writeFileSync(path, JSON.stringify({ defaultPdpSkus, rows: { A: { sku: "A" }, B: { sku: "B" }, stale: { sku: "different" } } }));
    vi.stubEnv("BUILDER_LOCAL_KITS", path); vi.stubEnv("VERCEL", "");
}
describe("shared local component review", () => {
    it("keeps explicitly enabled exact SKUs on normal localhost URLs without enabling other candidates", () => {
        stage(["A", "stale", "missing"]);
        const rows = readLocalComponentKits()!;
        const variants = [{ websiteSku: "A" }, { websiteSku: "B" }, { websiteSku: "stale" }, { websiteSku: "missing" }];
        for (const host of ["localhost:3010", "127.0.0.1:3010", "[::1]:3010"])
            expect(localPdpComponentKits(host, undefined, variants)).toEqual({ A: rows.A });
        expect(localPdpComponentKits("localhost:3010", undefined, [{ websiteSku: "B" }])).toEqual({});
    });
    it("includes allowlisted sibling glass candidates while excluding unapproved siblings", () => {
        stage(["A", "B"]);
        const rows = readLocalComponentKits()!;
        const currentAndSiblingCandidates = [{ websiteSku: "A" }, { websiteSku: "B" }, { websiteSku: "stale" }];
        expect(localPdpComponentKits("localhost:3010", undefined, currentAndSiblingCandidates)).toEqual({ A: rows.A, B: rows.B });
        expect(localPdpComponentKits("example.com", undefined, currentAndSiblingCandidates)).toEqual({});
    });
    it("keeps default local candidates off public hosts and Vercel", () => {
        stage(["A"]); const variants = [{ websiteSku: "A" }];
        for (const host of [null, "example.com", "localhost.example.com:3010"])
            expect(localPdpComponentKits(host, undefined, variants)).toEqual({});
        vi.stubEnv("VERCEL", "1");
        expect(localPdpComponentKits("localhost:3010", undefined, variants)).toEqual({});
    });
    it("uses the same staged source in Builder and only requested exact kits in PDP", () => {
        stage(); const rows = readLocalComponentKits()!;
        expect(localPdpComponentKits("localhost:3059", "kits", [{ websiteSku: "A" }, { websiteSku: "stale" }, { websiteSku: "missing" }])).toEqual({ A: rows.A });
    });
    it("does not expose candidate artwork on a deployed site or without explicit local review", () => {
        stage(); const variants = [{ websiteSku: "A" }];
        for (const host of [null, "example.com", "localhost.example.com:3059"])
            expect(localPdpComponentKits(host, "kits", variants)).toEqual({});
        expect(localPdpComponentKits("localhost:3059", undefined, variants)).toEqual({});
        vi.stubEnv("VERCEL", "1");
        expect(readLocalComponentKits()).toBeNull();
        expect(localPdpComponentKits("localhost:3059", "kits", variants)).toEqual({});
    });
});
