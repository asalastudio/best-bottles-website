import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Hub sign-in", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/sign-in/[[...sign-in]]/page.tsx"), "utf8");

    it("forces Clerk to return hub sign-ins to the requested hub", () => {
        expect(source).toContain("forceRedirectUrl={redirectUrl}");
        expect(source).toContain("signUpForceRedirectUrl={redirectUrl}");
    });

    it("labels Team and Executive Hub sign-in contexts", () => {
        expect(source).toContain("Team Hub");
        expect(source).toContain("Executive Hub");
    });
});
