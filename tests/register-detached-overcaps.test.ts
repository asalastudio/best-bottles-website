import { describe, expect, it } from "vitest";
import { DETACHED_OVERCAPS, detachedOvercap } from "@/lib/register/detached-overcaps";

describe("detached overcaps: the 9 mL Cylinder 17-415 clear cover (Jordan 2026-09-30)", () => {
    const lotion = DETACHED_OVERCAPS["CMP-LPM-BLK-17-415"];
    const mist = DETACHED_OVERCAPS["CMP-SPR-RED-17-415"];

    it("parks the empty cover beside the glass for every fine-mist and lotion finish", () => {
        for (const id of ["CMP-SPR-BLK-17-415-01", "CMP-SPR-CLR-17-415", "CMP-SPR-RED-17-415", "CMP-SPR-SGLD-17-415", "CMP-SPR-SLV-17-415",
            "CMP-SPR-SSLV-17-415", "CMP-LPM-BLK-17-415", "CMP-LPM-MSLV-17-415", "CMP-LPM-SGLD-17-415"]) {
            expect(DETACHED_OVERCAPS[id]?.url).toBe("/assets/register/overcaps/ovr-17-415-clear-overcap.webp");
        }
        expect(lotion.seatedLayerSha256).not.toBe(mist.seatedLayerSha256);   // each seated layer carries its own head
    });

    it("stands the empty cover where the seated one stands, at its width", () => {
        const part = { slot: "overcap", componentId: "CMP-LPM-BLK-17-415", image: { url: `https://blob/overcap-${lotion.seatedLayerSha256}.png`, width: 427 }, box: { x: 100, y: 50, width: 213.5, height: 284.5 } };
        const look = detachedOvercap(part)!;
        expect(look.image.url).toBe(lotion.url);
        expect(look.box.width).toBeCloseTo(213.5 * (lotion.seatedCoverWidth / lotion.coverWidth) * (lotion.width / 427), 1);
        expect(look.box.y + look.box.height).toBeCloseTo(50 + 284.5, 1);
        // a seated layer re-cut since (another image) drops the override instead of mis-sizing it
        expect(detachedOvercap({ ...part, image: { ...part.image, url: "https://blob/overcap-0000.png" } })).toBeNull();
    });
});

describe("detached overcaps: the white rectangular pump's clear cover (checklist 6a, 2026-10-01)", () => {
    const entry = DETACHED_OVERCAPS["LIB-18-415-WhtPumpClOvrCp"];

    it("parks an empty cover of its own, served at the size the entry records", async () => {
        const sharp = (await import("sharp")).default;
        const meta = await sharp(`public${entry.url}`).metadata();
        expect([meta.width, meta.height]).toEqual([entry.width, entry.height]);
    });

    it("stands it where the seated cover stands, at the seated cover's width", () => {
        const part = { slot: "overcap", componentId: "LIB-18-415-WhtPumpClOvrCp", image: { url: `https://blob/overcap-${entry.seatedLayerSha256}.png`, width: 379 }, box: { x: 376.5, y: -56.9, width: 251, height: 306 } };
        const look = detachedOvercap(part)!;
        expect(look.image.url).toBe(entry.url);
        const coverWidthOnStage = look.box.width * (entry.coverWidth / entry.width);
        expect(coverWidthOnStage).toBeCloseTo(251 * (entry.seatedCoverWidth / 379), 1);
        expect(look.box.y + look.box.height).toBeCloseTo(-56.9 + 306, 1);
    });
});
