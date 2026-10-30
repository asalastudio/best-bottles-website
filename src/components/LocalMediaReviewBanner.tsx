import { localMediaBaseline } from '@/lib/register/local-media-baseline';

export default function LocalMediaReviewBanner() {
    const baseline = localMediaBaseline();
    if (!baseline) return null;
    return <aside style={{ padding: '12px 20px', background: '#eadbc2', color: '#332b22', fontSize: 14, position: 'relative', zIndex: 100 }}>
        <strong>{baseline.snapshot.family} · local artwork review</strong>{' · '}
        Production snapshot from {baseline.snapshot.capturedAt.slice(0, 10)} for this family&apos;s PDP, Builder and family-filtered catalogue. Other browsing uses development data. Local artwork candidates; nothing published.
        {' '}<a href="/team/media-review" style={{ textDecoration: 'underline' }}>Open the review checklist</a>
    </aside>;
}
