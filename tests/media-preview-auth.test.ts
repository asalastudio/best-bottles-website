import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
const state = vi.hoisted(() => ({ enabled: false, middleware: vi.fn() }));
vi.mock('../src/lib/clerk', () => ({ get CLERK_ENABLED() { return state.enabled; } }));
vi.mock('@clerk/nextjs/server', () => ({ clerkMiddleware: () => state.middleware, createRouteMatcher: () => () => false }));
vi.mock('../src/lib/crawl/catalog-product-slugs', () => ({ productSlugExists: vi.fn() }));
import proxy from '../src/proxy';
afterEach(() => { state.enabled = false; state.middleware.mockReset(); });
it('serves the API without invoking Clerk when authentication is explicitly disabled', async () => {
    state.middleware.mockImplementation(() => { throw new Error('Missing publishableKey'); });
    const response = await proxy(new NextRequest('http://localhost/api/bottle-builder/kits'), {} as Parameters<typeof proxy>[1]);
    expect(response.status).toBe(200);
    expect(state.middleware).not.toHaveBeenCalled();
});
it('still invokes the existing Clerk middleware when authentication is enabled', async () => {
    state.enabled = true; state.middleware.mockResolvedValue(NextResponse.next());
    await proxy(new NextRequest('http://localhost/api/bottle-builder/kits'), {} as Parameters<typeof proxy>[1]);
    expect(state.middleware).toHaveBeenCalledTimes(1);
});
