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
});
