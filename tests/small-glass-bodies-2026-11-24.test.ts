import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { approvedComponentKit, originalApprovedComponentKit } from "@/lib/paper-doll/approved-component-kits";
import { APPROVED_KIT_VERSION, SMALL_GLASS_KIT_VERSION, updatedCylinderKitVersion } from "@/lib/paper-doll/approved-kit-index";
import { GET } from "@/app/api/bottle-masters/approved/route";
import smallGlass from "@/lib/paper-doll/small-glass-bodies.generated.json";
import display from "@/lib/products/display-images.generated.json";

type Body = { source: string; hubAssetId: string; image: { url: string; sha256: string; width: number; height: number } | null };
const bodies = smallGlass.bodies as Record<string, Body>;
const kits = smallGlass.kits as Record<string, { body: string; box: { x: number; y: number; width: number; height: number } | null }>;
const sources = display.sources as Record<string, Record<string, string>>;
const listed = ["GB1mlAmbVBlk", "GB1mlAmbVialWht", "GB1mlVBlk", "GB1mlVWht", "GB3TPlGl", "GBVAmb2BlackCap", "GBVAmb2WhtCap",
    "GBVBlu1o9BlackCapSht", "GBVGreen2o4BlackCapSht", "GBVGreen2o4WhtCapSht", "GBVialClr2mlBlackCap", "GBVialClr2mlWhtCap", "LB3mlClear"];

describe("small-glass bodies (2026-11-24)", () => {
    it("covers the vial, tola and spray cards Jordan listed, every body labelled as generated", () => {
        expect(Object.keys(kits).sort()).toEqual(listed.sort());
        for (const body of Object.values(bodies)) {
            expect(body.source).toBe("generated");
            expect(body.hubAssetId).toMatch(/^[0-9a-f-]{36}$/);
        }
    });

    it("serves each body from an immutable repository master with display copies", () => {
        for (const body of Object.values(bodies)) {
            if (!body.image) continue;            // the 2 ml amber 13-425 glass ships inside its heroes
            const bytes = readFileSync(`public${body.image.url}`);
            expect(createHash("sha256").update(bytes).digest("hex")).toBe(body.image.sha256);
            expect(body.image.url).toContain(body.image.sha256.slice(0, 12));
            for (const copy of Object.values(sources[body.image.url])) expect(readFileSync(`public${copy}`).length).toBeGreaterThan(0);
        }
    });

    it("changes only the body: every other part, the anchors and the visible glass box stay as approved", () => {
        for (const [sku, { body, box }] of Object.entries(kits)) {
            const before = originalApprovedComponentKit(sku)!, after = approvedComponentKit(sku)!;
            expect(after.anchors).toEqual(before.anchors);
            expect(after.parts.filter(p => p.slot !== "body")).toEqual(before.parts.filter(p => p.slot !== "body"));
            const old = before.parts.find(p => p.slot === "body")!, now = after.parts.find(p => p.slot === "body")!;
            expect(now.image.url).toBe(bodies[body].image!.url);
            expect(now.bounds).toEqual(old.bounds);
            if (box) {
                // The new box is the old box tightened to the visible glass: it never leaves it.
                expect(now.box!.x).toBeGreaterThanOrEqual(old.box!.x - 0.01);
                expect(now.box!.y).toBeGreaterThanOrEqual(old.box!.y - 0.01);
                expect(now.box!.x + now.box!.width).toBeLessThanOrEqual(old.box!.x + old.box!.width + 0.01);
                expect(now.box!.y + now.box!.height).toBeLessThanOrEqual(old.box!.y + old.box!.height + 0.01);
            } else expect(now.box ?? null).toBeNull();
        }
    });

    it("gives the changed kits their own version, and still answers the old one with the old kit", async () => {
        for (const sku of listed) expect(updatedCylinderKitVersion(sku)).toBe(`${APPROVED_KIT_VERSION}-${SMALL_GLASS_KIT_VERSION}`);
        const sku = "GBVGreen2o4BlackCapSht";
        const now = await (await GET(new Request(`https://example.com/api/bottle-masters/approved?sku=${sku}&v=${updatedCylinderKitVersion(sku)}`))).json();
        expect(now.kit.parts.find((p: { slot: string }) => p.slot === "body").image.url).toBe(bodies["vial3-green"].image!.url);
        const old = await (await GET(new Request(`https://example.com/api/bottle-masters/approved?sku=${sku}&v=${APPROVED_KIT_VERSION}`))).json();
        expect(old.kit.parts.find((p: { slot: string }) => p.slot === "body").image.url).not.toBe(bodies["vial3-green"].image!.url);
    });
});
