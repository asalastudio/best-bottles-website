import { NextResponse } from 'next/server';
import { acceptsMediaRevision, mediaRevision } from './release';
export function mediaRevisionConflict(request: Request): NextResponse | null {
    return acceptsMediaRevision(request.url) ? null : NextResponse.json({ error: 'Bottle images have changed. Refresh this page.', mediaRevision: mediaRevision() },
        { status: 409, headers: { 'Cache-Control': 'no-store', 'X-BB-Media-Revision': mediaRevision() } });
}
export function mediaResponseHeaders(cacheControl: string) {
    return { 'Cache-Control': cacheControl, 'X-BB-Media-Revision': mediaRevision() };
}
