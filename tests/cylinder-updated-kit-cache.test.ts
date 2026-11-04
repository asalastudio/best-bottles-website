import { describe, expect, it, vi } from "vitest";
import { cylinderMasterSource } from "@/lib/products/cylinder-master";
import { APPROVED_KIT_VERSION } from "@/lib/paper-doll/approved-kit-index";
vi.mock("server-only", () => ({}));
import { GET } from "@/app/api/bottle-masters/approved/route";

describe("updated Cylinder image kit cache versions", () => {
    it.each(["GBCyl50MtlRollBlk", "LBcyl25LtnClOvrCap", "GBcyl25SpryMtGl"])("serves the updated kit under a new version for %s", async sku => {
        const source = cylinderMasterSource(sku)!;
        expect(source.family).toBe("approved");
        expect(source.version).not.toBe(APPROVED_KIT_VERSION);
        const updated = await GET(new Request(`https://example.com/api/bottle-masters/approved?sku=${sku}&v=${source.version}`));
        expect(updated.status).toBe(200);
        expect((await updated.json()).version).toBe(source.version);
        const old = await GET(new Request(`https://example.com/api/bottle-masters/approved?sku=${sku}&v=${APPROVED_KIT_VERSION}`));
        // These SKUs had no recipe under the prior immutable version.
        expect(old.status).toBe(404);
        const invalid = await GET(new Request(`https://example.com/api/bottle-masters/approved?sku=${sku}&v=wrong`));
        expect(invalid.status).toBe(404);
    });

    it.each(["GBcyl25SpryCu", "GBCyl50SpryCu", "GBCyl100SpryCu"])("uses the copper overcap master for %s", async sku => {
        const source = cylinderMasterSource(sku)!;
        const response = await GET(new Request(`https://example.com/api/bottle-masters/approved?sku=${sku}&v=${source.version}`));
        const { kit } = await response.json();
        const cap = kit.parts.find((part: { slot: string }) => part.slot === "overcap");
        expect(cap.image.sha256).toBe("e8eb5bb9035ca88d0583c89bca01b3636f4a7ebb1aa3957f01ee2c4a0f277bdd");
    });
});
