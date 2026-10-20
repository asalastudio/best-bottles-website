import { mkdtempSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { PRODUCTION_TARGET } from '../src/lib/media-release/build-config';
import manifest from '../src/lib/media-release/manifest.json';

function build(env: Record<string, string>) {
    const dir = mkdtempSync(join(tmpdir(), 'bb-preview-build-'));
    const log = join(dir, 'commands');
    symlinkSync(process.execPath, join(dir, 'node'));
    for (const folder of ['scripts', 'src', 'node_modules']) symlinkSync(resolve(folder), join(dir, folder));
    writeFileSync(join(dir, 'npx'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$BUILD_TEST_LOG"\n', { mode: 0o755 });
    try {
        const result = spawnSync('/bin/sh', [resolve('scripts/vercel-build.sh')], {
            cwd: dir, env: { NODE_ENV: 'test', PATH: `${dir}:/usr/bin:/bin`, BUILD_TEST_LOG: log, ...env }, encoding: 'utf8',
        });
        let commands = '';
        try { commands = readFileSync(log, 'utf8'); } catch { /* Rejection must run no build. */ }
        return { status: result.status, commands, stderr: result.stderr };
    } finally { rmSync(dir, { recursive: true, force: true }); }
}

it.each(['preview:example|test', 'prod:example|test', 'dev:example|test'])('blocks inherited deployment keys before invoking any build (%s)', key => {
    const result = build({ VERCEL_ENV: 'preview', CONVEX_DEPLOY_KEY: key });
    expect(result.status).not.toBe(0);
    expect(result.commands).toBe('');
    expect(result.stderr).toContain('frontend-only');
});
it('builds an unselected preview frontend without backend credentials', () => {
    expect(build({ VERCEL_ENV: 'preview' }).commands).toBe('next build --webpack\n');
});
it('blocks unapproved production even when the media release is off', () => {
    const result = build({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main',
        VERCEL_PROJECT_ID: PRODUCTION_TARGET.projectId, VERCEL_ORG_ID: PRODUCTION_TARGET.teamId,
        NEXT_PUBLIC_CONVEX_URL: PRODUCTION_TARGET.convexUrl, NEXT_PUBLIC_CLERK_ENABLED: 'true' });
    expect(result.status).not.toBe(0);
    expect(result.commands).toBe('');
    expect(result.stderr).toContain('approval');
});
it('an exactly approved production baseline invokes only Next', () => {
    const commit = 'c'.repeat(40);
    const result = build({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main',
        VERCEL_GIT_COMMIT_SHA: commit, VERCEL_PROJECT_ID: PRODUCTION_TARGET.projectId,
        VERCEL_ORG_ID: PRODUCTION_TARGET.teamId, NEXT_PUBLIC_CONVEX_URL: PRODUCTION_TARGET.convexUrl,
        NEXT_PUBLIC_CLERK_ENABLED: 'true', NEXT_PUBLIC_BB_MEDIA_RELEASE: 'off',
        BB_MEDIA_PRODUCTION_APPROVAL: JSON.stringify({ release: manifest.revision, commit,
            projectId: PRODUCTION_TARGET.projectId, convexUrl: PRODUCTION_TARGET.convexUrl, mode: 'off',
            reference: 'TEST ONLY', approvedBy: 'Test operator', rollbackDeploymentId: 'dpl_testRollback',
            expiresAt: new Date(Date.now() + 60_000).toISOString(), intent: 'stage-without-traffic' }),
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.commands).toBe('next build --webpack\n');
});
