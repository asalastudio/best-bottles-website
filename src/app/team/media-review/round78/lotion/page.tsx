/* eslint-disable @next/next/no-img-element -- Preserve unoptimized review pixels. */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import scope from '@/lib/register/local-round78-lotion-review.json';

export const dynamic = 'force-dynamic';
export default function Round78LotionReviewPage() {
    if (process.env.NODE_ENV !== 'development' || process.env.VERCEL) notFound();
    return <main style={{ maxWidth: 1100, margin: '40px auto', padding: 24 }}>
        <h1>Round 78 ml lotion: local tube review</h1>
        <p>Fourteen exact combinations, seven clear and seven frosted. The production baseline from {scope.snapshotCapturedAt.slice(0, 10)} has 42 offline PDP and 84 Builder layouts. All fourteen legacy SKU pages and their 56 gallery images were recovered.</p>
        <p>The original archive is available again. All fourteen local candidates now use the complete hollow tube from a verified Photoshop master. Its original pixels and proportions are preserved, and its visible head joins the pump’s solid edge. The bottles remain empty.</p>
        <img src="/local-media/round78-lotion-review/native-lotion-solid-seat-comparison.png" alt="Round 78 lotion: previous thin tube edge beside the complete native tube, in clear and frosted glass" style={{ display: 'block', width: '100%', height: 'auto' }} />
        <p>The comparison shows offline layouts before and after the tube correction. All 42 PDP and 84 Builder layouts were regenerated. Product links below use current development data. Browser, mobile and owner acceptance remain pending. Nothing published.</p>
        <p>Copper cap follow-up: the white retouch scraps are removed from both local copper variants. Original metal pixels, alpha and registration are preserved. Owner and browser acceptance remain pending.</p>
        <p><a href="/local-media/round78-lotion-review/source-comparison.png">Earlier source comparison with exact legacy photographs</a></p>
        <img src="/local-media/round78-lotion-review/copper-cleanup.png" alt="Copper overcap before and after removal of the exterior white retouch scraps" style={{ display: 'block', width: '100%', height: 'auto' }} />
        <p><Link href="/team/media-review/diva46">Next batch: twelve Diva 46 ml spray tube candidates</Link></p>
        <ul>{scope.rows.map(row => <li key={row.websiteSku} style={{ padding: '10px 0' }}>
            {row.glass} · {row.websiteSku}{' · '}
            <Link href={`/products/${row.productGroupSlug}?sku=${encodeURIComponent(row.websiteSku)}`}>Product page</Link>{' · '}
            <Link href="/matrix?family=Round">Builder</Link>
        </li>)}</ul>
        <Link href="/team/media-review/round78">Round spray review</Link>
    </main>;
}
