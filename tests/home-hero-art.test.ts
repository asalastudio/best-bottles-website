import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HOME_HERO_ART } from "@/lib/homepageMerchandising";

describe("homepage hero art", () => {
    it("ships the 21:9 composite as a committed asset with alt text and a 21:9 desktop frame", () => {
        expect(existsSync(join(process.cwd(), "public", HOME_HERO_ART.src))).toBe(true);
        expect(HOME_HERO_ART.alt.length).toBeGreaterThan(30);
        const home = readFileSync(join(process.cwd(), "src/components/HomePage.tsx"), "utf8");
        expect(home).toContain("lg:aspect-[21/9]");
        expect(home).toContain("HOME_HERO_ART.src");
        expect(home).not.toContain("lg:h-[100dvh]");
    });
});
