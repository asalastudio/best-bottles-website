import { readFileSync, readdirSync, statSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const DIR = "public/images/bottle-builder/";
const masters = readdirSync(DIR).filter((file) => /^fitment-pencil-.*\.png$/.test(file));

describe("Choose Your Fitment drawings", () => {
    it("have a light WebP display copy of every PNG master, at the same pixel size", async () => {
        expect(masters.sort()).toEqual(["fitment-pencil-approved.png", "fitment-pencil-perfume-sprayer-18-415.png", "fitment-pencil-reducer.png"]);
        let total = 0;
        for (const master of masters) {
            const copy = DIR + master.replace(/\.png$/, ".webp");
            const [png, webp] = await Promise.all([sharp(DIR + master).metadata(), sharp(copy).metadata()]);
            expect(webp.format, copy).toBe("webp");
            expect([webp.width, webp.height], copy).toEqual([png.width, png.height]);
            // the masters are 0.6-1.75 MB each; a copy much over 100 KB means the conversion was skipped
            expect(statSync(copy).size, copy).toBeLessThan(120_000);
            total += statSync(copy).size;
        }
        expect(total).toBeLessThan(300_000);
    });

    it("are loaded as the display copies, never the masters", () => {
        const source = readFileSync("src/components/bottle-builder/FitmentIllustration.tsx", "utf8");
        const loaded = [...source.matchAll(/(?:src|href)="(\/images\/bottle-builder\/[^"]+)"/g)].map((match) => match[1]);
        expect(loaded.sort()).toEqual(masters.map((master) => "/images/bottle-builder/" + master.replace(/\.png$/, ".webp")).sort());
    });
});
