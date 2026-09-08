import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import postcss from "postcss";
import { expect, it } from "vitest";

// Use Next's bundled plugin, matching the CSS-module purity check in its
// Webpack build. Turbopack accepts global-only selectors that Webpack rejects.
const localByDefault = createRequire(import.meta.url)(
    "next/dist/compiled/postcss-modules-local-by-default",
);

it("compiles mobile family styles under Vercel's Webpack CSS-module rules", async () => {
    const path = new URL("../src/components/catalog/MobileFamilyCatalog.module.css", import.meta.url);
    const css = readFileSync(path, "utf8");
    await expect(postcss([localByDefault({ mode: "pure" })]).process(css, {
        from: path.pathname,
    })).resolves.toBeDefined();
});
