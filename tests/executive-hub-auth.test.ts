import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Executive Hub auth", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/executive/page.tsx"), "utf8");

    it("does not silently bounce signed-in users back to the storefront", () => {
        expect(source).not.toContain('redirect("/")');
        expect(source).toContain("Executive Hub access pending");
    });

    it("uses the shared Executive Hub access rules", () => {
        expect(source).toContain("hasExecutiveHubAccess");
    });
});
