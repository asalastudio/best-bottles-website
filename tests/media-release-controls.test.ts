import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import manifest from '../src/lib/media-release/manifest.json';
import { assertMediaBuildConfig, PRODUCTION_TARGET, PREVIEW_TARGET, type ProductionApproval } from '../src/lib/media-release/build-config';

const now = Date.parse('2026-10-20T18:00:00Z');
const commit = 'a'.repeat(40);
const approval: ProductionApproval = {
    release: manifest.revision, commit, projectId: PRODUCTION_TARGET.projectId,
    convexUrl: PRODUCTION_TARGET.convexUrl, mode: 'all', rollbackDeploymentId: 'dpl_testRollback',
    reference: 'TEST ONLY', approvedBy: 'Test operator', expiresAt: '2026-10-20T19:00:00Z', intent: 'stage-without-traffic',
};
const production = {
    VERCEL: '1', VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main', VERCEL_GIT_COMMIT_SHA: commit,
    VERCEL_PROJECT_ID: PRODUCTION_TARGET.projectId, VERCEL_ORG_ID: PRODUCTION_TARGET.teamId,
    NEXT_PUBLIC_CONVEX_URL: PRODUCTION_TARGET.convexUrl, NEXT_PUBLIC_CLERK_ENABLED: 'true',
    NEXT_PUBLIC_BB_MEDIA_RELEASE: `${manifest.revision}:all`, BB_MEDIA_PRODUCTION_APPROVAL: JSON.stringify(approval),
};
const local = { NEXT_PUBLIC_BB_MEDIA_RELEASE: `${manifest.revision}:all`, BB_MEDIA_LOCAL_REVIEW: 'true', NEXT_PUBLIC_CONVEX_URL: 'https://ci-placeholder.convex.cloud' };
describe('frontend-only release controls', () => {
    it('requires a separate exact approval for every production stage, including off', () => {
        for (const mode of ['off', 'canary', 'empire', 'all']) {
            const env = { ...production, NEXT_PUBLIC_BB_MEDIA_RELEASE: mode === 'off' ? 'off' : `${manifest.revision}:${mode}` };
            expect(() => assertMediaBuildConfig({ ...env, BB_MEDIA_PRODUCTION_APPROVAL: '' }, now)).toThrow('approval');
            expect(() => assertMediaBuildConfig({ ...env, BB_MEDIA_PRODUCTION_APPROVAL: JSON.stringify({ ...approval, mode }) }, now)).not.toThrow();
        }
    });
    it('rejects wrong commit, project, backend, mode, expiration, rollback or approval intent', () => {
        for (const patch of [
            { commit: 'b'.repeat(40) }, { commit: '' }, { projectId: PREVIEW_TARGET.projectId },
            { convexUrl: PREVIEW_TARGET.convexUrl }, { release: 'another-release' }, { mode: 'canary' },
            { rollbackDeploymentId: '' }, { reference: '' }, { approvedBy: '' }, { intent: 'promote' },
            { expiresAt: 'invalid' }, { expiresAt: '2026-10-20T17:00:00Z' }, { expiresAt: '2026-10-22T18:00:00Z' },
        ]) expect(() => assertMediaBuildConfig({ ...production, BB_MEDIA_PRODUCTION_APPROVAL: JSON.stringify({ ...approval, ...patch }) }, now)).toThrow();
        for (const patch of [
            { VERCEL_PROJECT_ID: PREVIEW_TARGET.projectId }, { VERCEL_ORG_ID: 'other-team' },
            { NEXT_PUBLIC_CONVEX_URL: PREVIEW_TARGET.convexUrl }, { VERCEL_GIT_COMMIT_SHA: undefined },
            { NEXT_PUBLIC_CLERK_ENABLED: 'false' }, { NEXT_PUBLIC_CLERK_ENABLED: undefined },
            { BB_MEDIA_LOCAL_REVIEW: 'true' }, { NEXT_PUBLIC_REGISTER_STAGE: 'off' },
        ]) expect(() => assertMediaBuildConfig({ ...production, ...patch }, now)).toThrow();
    });
    it('rejects backend deployment credentials even with release off', () => {
        for (const mode of ['off', `${manifest.revision}:all`]) {
            for (const patch of [{ CONVEX_DEPLOY_KEY: 'test-only' }, { BB_CONVEX_PREVIEW_DEPLOY: 'true' }]) {
                expect(() => assertMediaBuildConfig({ ...production, NEXT_PUBLIC_BB_MEDIA_RELEASE: mode, ...patch }, now)).toThrow('frontend-only');
            }
        }
    });
    it('allows isolated local and preview checks but refuses shared backend or inherited write credentials', () => {
        expect(() => assertMediaBuildConfig(local)).not.toThrow();
        expect(() => assertMediaBuildConfig({ NEXT_PUBLIC_BB_MEDIA_RELEASE: 'off' })).not.toThrow();
        for (const patch of [{ VERCEL_ENV: 'production' }, { NODE_ENV: 'development' }, { VERCEL: '1', VERCEL_ENV: 'preview' }, { BEST_BOTTLES_CONVEX_WRITE_TOKEN: 'test-only' }, { SHOPIFY_ADMIN_TOKEN: 'test-only' }, { CONVEX_DEPLOY_KEY: 'test-only' }, { NEXT_PUBLIC_CONVEX_URL: PRODUCTION_TARGET.convexUrl }, { NEXT_PUBLIC_REGISTER_STAGE: 'off' }]) {
            expect(() => assertMediaBuildConfig({ ...local, ...patch })).toThrow();
        }
        const preview = { ...local, VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_PROJECT_ID: PREVIEW_TARGET.projectId, VERCEL_GIT_COMMIT_REF: PREVIEW_TARGET.branch, NEXT_PUBLIC_CONVEX_URL: PREVIEW_TARGET.convexUrl };
        expect(() => assertMediaBuildConfig(preview)).not.toThrow();
        for (const mode of ['off', `${manifest.revision}:all`]) {
            expect(() => assertMediaBuildConfig({ ...preview, NEXT_PUBLIC_BB_MEDIA_RELEASE: mode })).not.toThrow();
            expect(() => assertMediaBuildConfig({ ...preview, NEXT_PUBLIC_BB_MEDIA_RELEASE: mode, NEXT_PUBLIC_CONVEX_URL: PRODUCTION_TARGET.convexUrl })).toThrow();
        }
        expect(() => assertMediaBuildConfig({ NEXT_PUBLIC_BB_MEDIA_RELEASE: 'unknown' })).toThrow();
    });
    it('blocks automatic Git deployments for main and both review branches without a wildcard override', () => {
        const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
        expect(config.git.deploymentEnabled).toEqual({ main: false, 'release/empire-round26-production': false, 'integration/local-media-main-2026-10-20': false });
    });
    it('executes the real wrapper as frontend-only and stops before next when preflight fails', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-build-wrapper-'));
        try {
            const log = path.join(dir, 'commands');
            fs.writeFileSync(path.join(dir, 'node'), '#!/bin/sh\nprintf "preflight %s\\n" "$*" >> "$BB_TEST_LOG"\nexit "${BB_TEST_PREFLIGHT_EXIT:-0}"\n', { mode: 0o755 });
            fs.writeFileSync(path.join(dir, 'npx'), '#!/bin/sh\nprintf "frontend %s\\n" "$*" >> "$BB_TEST_LOG"\n', { mode: 0o755 });
            const wrapper = path.resolve('scripts/vercel-build.sh');
            const env: NodeJS.ProcessEnv = { NODE_ENV: "production", PATH: `${dir}:/usr/bin:/bin`, BB_TEST_LOG: log, VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main' };
            const result = spawnSync('/bin/sh', [wrapper], { cwd: dir, env });
            expect(result.status).toBe(0);
            expect(fs.readFileSync(log, 'utf8').trim().split('\n')).toEqual(['preflight --import tsx scripts/media-release/preflight.ts', 'frontend next build --webpack']);
            fs.writeFileSync(log, '');
            const blocked = spawnSync('/bin/sh', [wrapper], { cwd: dir, env: { ...env, BB_TEST_PREFLIGHT_EXIT: '1' } });
            expect(blocked.status).toBe(1);
            expect(fs.readFileSync(log, 'utf8')).not.toContain('frontend');
        } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    });
});
