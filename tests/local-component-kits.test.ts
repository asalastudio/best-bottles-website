import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
vi.mock("server-only", () => ({}));
import { localPdpComponentKits, readLocalComponentKits } from "@/lib/paper-doll/local-component-kits";

const dirs: string[] = [];
afterEach(() => { vi.unstubAllEnvs(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function stage() {
    const dir = mkdtempSync(join(tmpdir(), "bottle-kit-review-")); dirs.push(dir);
    const path = join(dir, "kits.json");
    writeFileSync(path, JSON.stringify({ rows: { A: { sku: "A" }, B: { sku: "B" }, stale: { sku: "different" } } }));
    vi.stubEnv("BUILDER_LOCAL_KITS", path); vi.stubEnv("VERCEL", "");
}
describe("shared local component review", () => {
    it("uses the same staged source in Builder and only exact current-group kits in PDP", () => {
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
