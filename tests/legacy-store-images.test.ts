import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** The catalogue still links https://www.bestbottles.com/images/store/... After the
 * DNS cutover those URLs are answered by this app, so every one must exist in
 * public/ with the legacy host's exact bytes. */
type Entry = { path: string; url: string; bytes: number; sha256: string; format: string };
const manifest = JSON.parse(readFileSync("docs/legacy-store-images/manifest.json", "utf8")) as { files: Entry[] };

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        return statSync(full).isDirectory() ? walk(full) : [full];
    });
}

describe("legacy /images/store mirror", () => {
    it("serves every manifest entry from public/ with the recorded bytes", () => {
        expect(manifest.files.length).toBeGreaterThan(0);
        for (const entry of manifest.files) {
            expect(entry.path.startsWith("/images/store/")).toBe(true);
            expect(entry.url).toBe(`https://www.bestbottles.com${entry.path}`);
            const bytes = readFileSync(path.join("public", entry.path));
            expect(bytes.length, entry.path).toBe(entry.bytes);
            expect(createHash("sha256").update(bytes).digest("hex"), entry.path).toBe(entry.sha256);
        }
    });

    it("has no unrecorded files under public/images/store", () => {
        const recorded = new Set(manifest.files.map((f) => f.path));
        const onDisk = walk("public/images/store").map((f) => `/${path.relative("public", f).split(path.sep).join("/")}`);
        expect(onDisk.filter((p) => !recorded.has(p))).toEqual([]);
    });

    it("keeps paths unique when compared without case", () => {
        const lower = manifest.files.map((f) => f.path.toLowerCase());
        expect(new Set(lower).size).toBe(lower.length);
    });

    it("covers every legacy image URL written in runtime source", () => {
        const recorded = new Set(manifest.files.map((f) => f.url));
        const pattern = /https?:\/\/(?:www\.)?bestbottles\.com\/images\/store\/[^"'\s\\)]*\.(?:gif|png|jpe?g|webp)/gi;
        const sources = [...walk("src"), ...walk("convex")].filter(
            (f) => /\.(ts|tsx)$/.test(f) && !f.includes(`${path.sep}_generated${path.sep}`),
        );
        const missing = sources.flatMap((f) =>
            [...readFileSync(f, "utf8").matchAll(pattern)]
                .map((m) => m[0].replace(/^http:/, "https:").replace("https://bestbottles.com", "https://www.bestbottles.com"))
                .filter((url) => !recorded.has(url))
                .map((url) => `${f}: ${url}`),
        );
        expect(missing).toEqual([]);
    });
});
