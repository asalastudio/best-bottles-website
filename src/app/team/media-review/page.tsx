/* eslint-disable @next/next/no-img-element -- Review original source pixels without image optimization. */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { localMediaBaseline } from '@/lib/register/local-media-baseline';
import { drawableRegisterKits } from '@/lib/register/load';
import masters from '@/lib/register/local-empire-bare-glass.json';

export const dynamic = 'force-dynamic';
export default function MediaReviewPage() {
    const baseline = localMediaBaseline();
    if (!baseline) notFound();
    const snapshot = baseline.snapshot;
    const candidates = Object.values(snapshot.lookups).flatMap(entry => entry?.product ? [entry.product] : []).filter(p => p.family === snapshot.family);
    const rows = [...new Map(candidates.map(p => [p.websiteSku, { ...p,
        productGroupSlug: snapshot.catalog?.groups.find(g => String(g._id) === String(p.productGroupId))?.slug,
    }])).values()];
    const kits = drawableRegisterKits(baseline.snapshot.register);
    return <main style={{ maxWidth: 1000, margin: '40px auto', padding: 24 }}>
        <h1>Empire · empty bottle masters</h1>
        <p><Link href="/team/media-review/round78">Next batch: Round 78 ml spray tubes, clear and frosted</Link></p>
        <p>The new 50 ml and 100 ml masters are applied locally to 90 registered assemblies. One 100 ml white-pump combination still uses its older fallback and is held for source recovery. Nothing has been published.</p>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>{masters.map(m => <figure key={m.plateKey} style={{ margin: 0 }}><img src={m.url} alt={`Empty Empire ${m.physicalGuide.heightMm === 88 ? 50 : 100} ml glass master`} style={{ height: 300, width: 'auto' }} /><figcaption>{m.physicalGuide.heightMm} × {m.physicalGuide.widthMm} mm dimension guide</figcaption></figure>)}</div>
        <p><Link href="/catalog/empire">Open the production-matched Empire catalogue</Link>. Cards retain their captured published imagery; proposed assemblies appear on PDP and Builder.</p>
        <p>Captured production catalogue and geometry. Proposed artwork is local and unapproved. This checklist records work still to verify; it does not mark the family complete.</p>
        <p>For each finish: inspect Sidecar, Cap On, Exploded and zoom. Check the tube joins its pump, stays inside the glass when seated, has no breaks or scraps, and moves with its pump when exploded. Check the same SKU in Builder on desktop and a physical iPhone.</p>
        <p>For reducer combinations, the insert is now a separate source layer. Its proposed seating needs visual review. The bare Builder stage contains only the empty glass master.</p>
        <p>The three 50 ml droppers use their exact-SKU photographic pipettes, now visible inside the glass. Check their seating and length before acceptance.</p>
        <p>Seated tubes and pipettes now preserve the glass reflections and stop at the inner cavity. Old rim and base fragments are masked out. Exposed tubes retain their separate appearance. Check these changes closely in zoom before acceptance.</p>
        <p>The 50 ml vintage bulb and tassel assemblies now use the intact Photoshop tube layer. The old extraction had lost most of the tube width. Check the continuous tube from collar to inner floor in both the product view and Builder.</p>
        <ul>{rows.map(p => <li key={p.websiteSku} style={{ padding: '12px 0' }}><strong>{p.capacityMl} ml · {p.applicator} · {p.capColor} · {p.websiteSku}</strong>{' · '}<Link href={`/products/${p.productGroupSlug}?sku=${encodeURIComponent(p.websiteSku)}`}>Product page</Link>{' · '}<Link href="/matrix?family=Empire">Builder</Link>{' · '}{kits[p.websiteSku] ? 'new master applied; visual and browser checks pending' : 'HELD: exact white-pump source unresolved; older fallback remains'}</li>)}</ul>
        <p>The white rectangular pump is newly recovered from source; its detached clear cover is an earlier drawing candidate and still needs approval. All bottles must appear empty.</p>
        <p>This is an artwork review. Cart and checkout remain connected to development; they have not been accepted as part of this pilot. Production price/stock in the snapshot must be refreshed before release.</p>
    </main>;
}
