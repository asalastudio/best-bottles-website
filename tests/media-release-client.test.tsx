// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { loadBodyConfigurations } from '../src/components/bottle-builder/builder-requests';
import { useMediaRevisionMismatch } from '../src/components/bottle-builder/media-revision-notice';
import { MEDIA_RELEASE_ID } from '../src/lib/media-release/release';
function Notice() { return <p>{useMediaRevisionMismatch() ? 'Refresh required' : 'Current images'}</p>; }
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('rejects a response from another revision and tells an already-open Builder to refresh', async () => {
    vi.stubEnv('NEXT_PUBLIC_BB_MEDIA_RELEASE', `${MEDIA_RELEASE_ID}:all`);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ configurations: [] }), { headers: { 'X-BB-Media-Revision': 'media-off-v1' } })));
    const element = document.createElement('div'); const root = createRoot(element);
    try {
        await act(async () => root.render(<Notice />)); expect(element.textContent).toBe('Current images');
        await act(async () => { await expect(loadBodyConfigurations('Empire', 'e100', null)).rejects.toThrow('Refresh this page'); });
        expect(element.textContent).toBe('Refresh required');
    } finally { act(() => root.unmount()); }
});
