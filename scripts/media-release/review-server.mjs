/** Local contact sheet and technical plan. Serves only the release's 57 images. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
const root = path.resolve(import.meta.dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/media-release/manifest.json'), 'utf8'));
const assets = new Set(Object.values(manifest.assetMap));
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Empire + Round release preparation</title><style>
body{margin:0;background:#f5f3ef;color:#272821;font:16px/1.55 system-ui,sans-serif}main{max-width:1250px;margin:auto;padding:40px 24px}h1{font-size:36px;line-height:1.15;max-width:700px}h2{font-size:22px}code{font-size:13px;overflow-wrap:anywhere}a{color:#355b47}.status{background:#e7eddf;padding:18px 24px;border-left:4px solid #47704c}.setup{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin:32px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(205px,1fr));gap:16px}.card{background:white;border:1px solid #d9d5ca;padding:14px;border-radius:5px}.card img{width:100%;aspect-ratio:10/11;object-fit:contain}.card p{font-size:14px;margin:6px 0}small{color:#666}button{font:inherit} @media(max-width:650px){.setup{grid-template-columns:1fr}h1{font-size:28px}}</style>
<main><small>BEST BOTTLES / LOCAL RELEASE REVIEW</small><h1>Empire and Round 78 ml<br>Ready for preview preparation</h1><div class="status"><strong>26 exact variants. Release disabled.</strong><br>14 Empire sprays and white pumps, plus 12 Round sprays. Diva and Round lotion are held. No push, deployment or production change.</div><p><code>${escape(manifest.revision)}</code> · ${assets.size} immutable image files · <a href="/plan">Full preview setup and rollback plan</a></p>
<div class="setup"><section><h2>Preview setup</h2><p>Use a separate Vercel project and isolated Convex backend. Serve these exact assets with the application. Include no production write credentials.</p><p>The existing preview inherits write credentials. Its project cannot pass the new isolation gate. The proposed target is still unprovisioned.</p><p>This contact sheet serves the prepared catalog images locally. It is not a hosted storefront acceptance test.</p></section><section><h2>Rollback</h2><ol><li>Build and retain the release-disabled version first.</li><li>Review the two Empire canaries, then 14 Empire and all 26 variants.</li><li>If a check fails, stop expansion and return to the disabled build.</li><li>Builder rejects mixed revisions and asks open clients to refresh. Keep previous assets and the additive schema.</li></ol><p>No product records need restoring.</p></section></div>
<h2>Exact catalog images in this bundle</h2><div class="grid">${manifest.entries.map(row => `<article class="card"><img src="${escape(row.hero.url)}" alt="${escape(row.hero.alt)}"><p><strong>${escape(row.hero.family)} ${row.hero.capacityMl} ml · ${escape(row.hero.bottleColor)}</strong></p><code>${escape(row.websiteSku)}</code><p><small>${escape(row.stage === 'canary' ? 'First canary' : row.stage === 'empire' ? 'Remaining Empire' : 'Round sprays')}</small></p></article>`).join('')}</div></main></html>`;
const server = http.createServer((req, res) => {
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    const url = new URL(req.url, 'http://127.0.0.1');
    let bytes, type;
    if (url.pathname === '/') { bytes = Buffer.from(html); type = 'text/html; charset=utf-8'; }
    else if (url.pathname === '/plan') { bytes = fs.readFileSync(path.join(root, 'docs/reviews/empire-round-release-prep-2026-10-20/README.md')); type = 'text/plain; charset=utf-8'; }
    else if (assets.has(url.pathname)) { bytes = fs.readFileSync(path.join(root, 'public', url.pathname)); type = url.pathname.endsWith('.webp') ? 'image/webp' : 'image/png'; }
    else { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': bytes.length, 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : bytes);
});
server.listen(Number(process.env.BB_MEDIA_REVIEW_PORT ?? 3010), '127.0.0.1', () => console.log(`Local media release review: http://127.0.0.1:${server.address().port}`));
