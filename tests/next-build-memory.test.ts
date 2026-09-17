import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import config from "../next.config";

describe("production build memory isolation", () => {
    it("keeps the Webpack worker enabled after Sentry adds its custom hook", () => {
        expect(config.webpack).toBeTypeOf("function");
        expect(config.experimental?.webpackBuildWorker).toBe(true);
    });

    it("still rejects TypeScript errors during builds", () => {
        expect(config.typescript?.ignoreBuildErrors).not.toBe(true);
    });

    it("does not upload Sentry source maps on Vercel Preview", () => {
        const source = readFileSync("next.config.ts", "utf8");
        expect(source).toContain("sentrySourceMapsEnabled");
        expect(source).toContain('process.env.VERCEL_ENV !== "preview"');
        expect(source).toContain("disable: !sentrySourceMapsEnabled");
        expect(source).toContain("widenClientFileUpload: sentrySourceMapsEnabled");
        expect(readFileSync("scripts/vercel-build.sh", "utf8")).toContain("--max-old-space-size=6144");
    });
});
