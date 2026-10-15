/* eslint-disable @next/next/no-img-element -- Preserve unoptimized review pixels. */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import scope from '@/lib/register/local-diva46-review.json';

export const dynamic = 'force-dynamic';
export default function Diva46ReviewPage() {
    if (process.env.NODE_ENV !== 'development' || process.env.VERCEL) notFound();
    return <main style={{ maxWidth: 1100, margin: '40px auto', padding: 24 }}>
        <h1>Diva 46 ml spray: local tube candidates</h1>
        <p>Twelve exact combinations, six clear and six frosted, from the production capture on {scope.snapshotCapturedAt.slice(0, 10)}. The bottles remain empty and their glass and hardware are unchanged.</p>
        <p>The Diva masters have no isolated complete tube. These candidates reuse the intact photographed tube from the same six registered sprayer components. Uniform scale preserves its proportions; the head joins the solid sprayer edge, and the tip retains the captured exposed endpoint above the inner floor. This source reuse still needs visual and physical fit approval.</p>
        <img src="/local-media/diva46-review/comparison.png" alt="Previous Diva tubes on the left, complete native tube candidates on the right, in clear and frosted glass" style={{ display: 'block', width: '100%', height: 'auto' }} />
        <p>Offline evidence covers 36 PDP and 72 Builder layouts. Browser, zoom, mobile and owner acceptance remain pending. The offline rasterizer does not reproduce every browser blend or Builder camera detail. Nothing published.</p>
        <p><a href="/local-media/diva46-review/all-pdp-views.jpg">All 36 PDP views</a></p>
        <ul>{scope.rows.map(row => <li key={row.websiteSku} style={{ padding: '10px 0' }}>
            {row.color} · {row.websiteSku}{' · '}
            <Link href={`/products/${row.productGroupSlug}?sku=${encodeURIComponent(row.websiteSku)}`}>Product page</Link>{' · '}
            <Link href="/matrix?family=Diva">Builder</Link>
        </li>)}</ul>
        <Link href="/team/media-review/round78/lotion">Round lotion and copper cap review</Link>
    </main>;
}
