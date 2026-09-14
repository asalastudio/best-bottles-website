/**
 * globals.css must be parseable.
 *
 * A stylesheet with a broken comment fails at BUILD time, not at test time, so
 * typecheck, lint and the whole suite can be green while production cannot
 * ship. That is exactly what happened: an edit inserted a rule at the first
 * match for `@layer base`, which was inside a comment describing @layer base —
 * splitting the comment in half and leaving its tail as stray CSS:
 *
 *     Lives in /* The wordmark inside the portal rail ...
 *     @layer base so component utilities and CSS modules can still refine
 *
 * Turbopack had cached the previous parse, so the running dev server looked
 * fine and the fault only surfaced on a cold build. These assertions are cheap
 * and run in CI, where a cold build's failure would otherwise be the first
 * anyone heard of it.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

/** Walk the file tracking comment state, the way a CSS parser does. */
function scanComments(source: string) {
    const nestedAt: number[] = [];
    let index = 0;
    let line = 1;
    let inComment = false;

    while (index < source.length) {
        if (source[index] === "\n") line += 1;

        if (!inComment && source[index] === "/" && source[index + 1] === "*") {
            inComment = true;
            index += 2;
            continue;
        }
        // CSS comments do not nest, so a second opener inside one means an
        // earlier comment lost its terminator — the exact defect.
        if (inComment && source[index] === "/" && source[index + 1] === "*") {
            nestedAt.push(line);
            index += 2;
            continue;
        }
        if (inComment && source[index] === "*" && source[index + 1] === "/") {
            inComment = false;
            index += 2;
            continue;
        }
        index += 1;
    }

    return { nestedAt, unterminated: inComment };
}

describe("globals.css", () => {
    it("has no comment opened inside another comment", () => {
        const { nestedAt } = scanComments(css);
        expect(nestedAt, `nested /* at line(s) ${nestedAt.join(", ")}`).toEqual([]);
    });

    it("leaves no comment unterminated", () => {
        expect(scanComments(css).unterminated).toBe(false);
    });

    it("balances braces", () => {
        // Counted outside comments and strings, so a `{` in prose does not
        // register as a block.
        let depth = 0;
        let minDepth = 0;
        let index = 0;
        let inComment = false;
        let quote: string | null = null;

        while (index < css.length) {
            const char = css[index];
            if (inComment) {
                if (char === "*" && css[index + 1] === "/") { inComment = false; index += 2; continue; }
                index += 1;
                continue;
            }
            if (quote) {
                if (char === "\\") { index += 2; continue; }
                if (char === quote) quote = null;
                index += 1;
                continue;
            }
            if (char === "/" && css[index + 1] === "*") { inComment = true; index += 2; continue; }
            if (char === '"' || char === "'") { quote = char; index += 1; continue; }
            if (char === "{") depth += 1;
            if (char === "}") { depth -= 1; minDepth = Math.min(minDepth, depth); }
            index += 1;
        }

        expect(minDepth, "a closing brace appeared before its opener").toBe(0);
        expect(depth, "unclosed block").toBe(0);
    });

    it("still carries the interface tokens the portal and team hub read", () => {
        // These live in `@theme static` on purpose: Tailwind v4 tree-shakes
        // theme variables no utility class references, and an inline var() does
        // not count as a reference — without `static` the icon tokens vanish
        // from the built stylesheet and every rail icon collapses.
        expect(css).toContain("@theme static");
        for (const token of [
            "--color-surface-rail",
            "--color-rule",
            "--color-text-primary",
            "--icon-size-desktop",
        ]) {
            expect(css, `${token} missing`).toContain(token);
        }
    });
});
