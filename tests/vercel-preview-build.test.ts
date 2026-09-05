import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

function build(env: Record<string, string>) {
    const dir = mkdtempSync(join(tmpdir(), "bb-preview-build-"));
    const log = join(dir, "commands");
    writeFileSync(join(dir, "npx"), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$BUILD_TEST_LOG"\n', { mode: 0o755 });
    try {
        const result = spawnSync("sh", [resolve("scripts/vercel-build.sh")], {
            env: { NODE_ENV: "test", PATH: `${dir}:/usr/bin:/bin`, BUILD_TEST_LOG: log, ...env }, encoding: "utf8",
        });
        let commands = "";
        try { commands = readFileSync(log, "utf8"); } catch { /* No command should run on rejection. */ }
        return { status: result.status, commands };
    } finally { rmSync(dir, { recursive: true, force: true }); }
}

it("deploys opted-in previews with their backend before releasing the frontend", () => {
    const result = build({ VERCEL_ENV: "preview", BB_CONVEX_PREVIEW_DEPLOY: "true", CONVEX_DEPLOY_KEY: "preview:example|test" });
    expect(result.status).toBe(0);
    expect(result.commands).toContain("convex deploy --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL --cmd npx next build --webpack");
});

it.each(["", "prod:example|test", "dev:example|test"])("refuses an opted-in preview without a preview-scoped key (%s)", (key) => {
    const result = build({ VERCEL_ENV: "preview", BB_CONVEX_PREVIEW_DEPLOY: "true", CONVEX_DEPLOY_KEY: key });
    expect(result.status).not.toBe(0);
    expect(result.commands).toBe("");
});

it("preserves existing preview and production build behavior outside the opt-in", () => {
    expect(build({ VERCEL_ENV: "preview" }).commands).toBe("next build --webpack\n");
    expect(build({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" }).commands).toBe("convex deploy --cmd npx next build --webpack\n");
});
