/* eslint-disable @next/next/no-img-element -- Inspect unoptimized local review pixels. */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import source from '@/lib/register/local-round78-tubes.json';

export const dynamic='force-dynamic';
export default function Round78ReviewPage() {
    if(process.env.NODE_ENV!=='development'||process.env.VERCEL)notFound();
    return <main style={{maxWidth:1100,margin:'40px auto',padding:24}}>
        <h1>Round 78 ml spray tube review</h1>
        <p><Link href="/team/media-review/round78/lotion">14 lotion combinations: local tube candidates ready for review</Link></p>
        <p>Twelve local candidates: six clear and six frosted finishes. The intact Photoshop tube replaces the damaged hero extraction. Glass and seated hardware remain unchanged. All bottles are empty.</p>
        <p>Offline review used the production capture from {source.capturedAt.slice(0,10)}. These product links use local development data. Browser, mobile and owner visual acceptance remain pending. Nothing published.</p>
        <p>Latest revision: seated views preserve the native white highlights. The previous brightness filter darkened the whole pump into a gray silhouette. Original tube pixels, registration and exposed views are unchanged.</p>
        <img src="/local-media/round78-review/native-highlights-comparison.png" alt="Round 78 clear and frosted glass, previous gray cast compared with preserved native highlights" style={{display:'block',width:'100%',height:'auto'}}/>
        <p>Check Cap On, Sidecar, Exploded and zoom. The tube should join the sprayer, remain continuous, end above the inner floor, and move with its sprayer. Frosted glass should soften its visibility. Check the same selected finish in Builder.</p>
        <ul>{source.rows.map(row=><li key={row.websiteSku} style={{padding:'10px 0'}}>
            {row.color} · {row.capColor} · {row.websiteSku}{' · '}
            <Link href={`/products/${row.productGroupSlug}?sku=${encodeURIComponent(row.websiteSku)}`}>Product page</Link>{' · '}
            <Link href="/matrix?family=Round">Builder</Link>
        </li>)}</ul>
        <Link href="/team/media-review">Empire review</Link>
    </main>;
}
