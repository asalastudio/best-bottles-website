import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Executive Hub links", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/executive/page.tsx"), "utf8");

    it("links to Best Bottles Packaging Studio", () => {
        expect(source).toContain("Best Bottles Packaging Studio");
        expect(source).toContain("https://best-bottles-packaging-studio.vercel.app/");
    });
});
