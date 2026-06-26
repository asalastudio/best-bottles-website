import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
    isGraceCapacityOnlySearch,
    normalizeGraceCatalogNavigationPath,
} from "../src/lib/graceShapeIntent";

describe("Grace catalog navigation", () => {
    it("detects direct size-only catalog searches", () => {
        expect(isGraceCapacityOnlySearch("1ml")).toBe(true);
        expect(isGraceCapacityOnlySearch("1 mL bottle")).toBe(true);
        expect(isGraceCapacityOnlySearch("take me to the 1 ml bottle")).toBe(true);
        expect(isGraceCapacityOnlySearch('"1ml"')).toBe(true);

        expect(isGraceCapacityOnlySearch("1ml roll-on")).toBe(false);
        expect(isGraceCapacityOnlySearch("1ml decorative bottle")).toBe(false);
        expect(isGraceCapacityOnlySearch("octagonal 1ml")).toBe(false);
    });

    it("removes stale filters from Grace size navigation", () => {
        const path = "/catalog?families=Apothecary%2CBell%2CDecorative%2CDiamond%2CTeardrop&search=1ml&sort=best-match&grace=1";
        const normalized = normalizeGraceCatalogNavigationPath(path);
        const params = new URLSearchParams(normalized.split("?")[1]);

        expect(normalized.startsWith("/catalog?")).toBe(true);
        expect(params.get("search")).toBe("1ml");
        expect(params.get("sort")).toBe("best-match");
        expect(params.get("grace")).toBe("1");
        expect(params.has("families")).toBe(false);
        expect(params.has("family")).toBe(false);
        expect(params.has("applicators")).toBe(false);
        expect(params.has("category")).toBe(false);
        expect(params.has("threads")).toBe(false);
    });

    it("normalizes spoken size navigation to a compact catalog search", () => {
        const path = "/catalog?families=Decorative&search=1%20ml%20bottle&grace=1";
        const normalized = normalizeGraceCatalogNavigationPath(path);
        const params = new URLSearchParams(normalized.split("?")[1]);

        expect(params.get("search")).toBe("1ml");
        expect(params.get("sort")).toBe("best-match");
        expect(params.has("families")).toBe(false);
    });

    it("preserves intentional non-size catalog filters", () => {
        const path = "/catalog?families=Decorative&search=octagonal%209ml&grace=1";

        expect(normalizeGraceCatalogNavigationPath(path)).toBe(path);
    });

    it("uses the normalization from Grace's navigation tools", () => {
        const provider = readFileSync("src/components/grace/GraceProvider.tsx", "utf8");

        expect(provider).toContain("isGraceCapacityOnlySearch");
        expect(provider).toContain("normalizeGraceCatalogNavigationPath");
    });
});
