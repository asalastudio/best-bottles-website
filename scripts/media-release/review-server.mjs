/** Local contact sheet and technical plan. Serves only the release's 57 images. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
const root = path.resolve(import.meta.dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/media-release/manifest.json'), 'utf8'));
const assets = new Set(Object.values(manifest.assetMap));
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const deploymentDir = path.join(root, 'docs/reviews/isolated-preview-deployment-2026-10-20');
function render() {
const read = name => { try { return JSON.parse(fs.readFileSync(path.join(deploymentDir, name), 'utf8')); } catch { return null; } };
const rollback = read('rollback.json'), browser = read('hosted-browser.json');
const complete = rollback?.oldTabRequestedRefresh && rollback?.refreshRecovered && rollback?.activeRestored
    && browser?.catalog?.length === 26 && browser?.pdp?.length === 26 && browser?.builder?.length === 26 && !browser?.errors?.length;
const preview = 'https://best-bottles-media-review-asala.vercel.app';
return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Empire + Round isolated preview</title><style>
body{margin:0;background:#f5f3ef;color:#272821;font:16px/1.55 system-ui,sans-serif}main{max-width:1250px;margin:auto;padding:40px 24px}h1{font-size:36px;line-height:1.15;max-width:700px}h2{font-size:22px}code{font-size:13px;overflow-wrap:anywhere}a{color:#355b47}.status{background:#e7eddf;padding:18px 24px;border-left:4px solid #47704c}.setup{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin:32px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(205px,1fr));gap:16px}.card{background:white;border:1px solid #d9d5ca;padding:14px;border-radius:5px}.card img{width:100%;aspect-ratio:10/11;object-fit:contain}.card p{font-size:14px;margin:6px 0}small{color:#666}button{font:inherit} @media(max-width:650px){.setup{grid-template-columns:1fr}h1{font-size:28px}}</style>
<main><small>BEST BOTTLES / LOCAL RELEASE REVIEW</small><h1>Empire and Round 78 ml<br>Isolated preview release</h1><div class="status"><strong>${complete ? '26 variants verified in the hosted preview.' : 'Branch pushed. Test backend deployed. Hosted checks in progress.'}</strong><br>14 Empire sprays and white pumps, plus 12 Round sprays. Diva and Round lotion are held. Existing production is unchanged.</div><p><code>${escape(manifest.revision)}</code> · ${assets.size} immutable release images · <a href="/deployment">Deployment and verification report</a> · <a href="/plan">Rollback plan</a></p>
<div class="setup"><section><h2>Preview</h2><p>The application uses a separate Vercel project and an isolated Convex backend with 39 read-only queries. The test catalog contains 26 bottle variants plus six required sprayer products.</p><p>${complete ? `<a href="${preview}/catalog?category=Glass+Bottle">Open the working catalog</a> · <a href="${preview}/matrix?family=Empire">Empire Builder</a> · <a href="${preview}/matrix?family=Round">Round Builder</a><br><small>Protected by your Vercel sign-in.</small>` : 'The baseline and scoped builds are undergoing HTTP, image and browser checks.'}</p><p>This is a catalog and media review environment. Checkout, customer accounts and AI services are not configured.</p></section><section><h2>Rollback</h2><p>${complete ? 'Verified on the isolated preview alias: active → off → active. An open Builder tab requested a refresh after rollback, and refreshing recovered the previous version. All 26 variants are active again for review.' : 'The rehearsal will switch only the isolated alias to the retained off build, check an open Builder tab and then restore all 26 variants.'}</p><p>Both the previous and approved images are retained. No product records need restoring.</p></section></div>
<h2>Exact catalog images in this bundle</h2><div class="grid">${manifest.entries.map(row => `<article class="card"><img src="${escape(row.hero.url)}" alt="${escape(row.hero.alt)}"><p><strong>${escape(row.hero.family)} ${row.hero.capacityMl} ml · ${escape(row.hero.bottleColor)}</strong></p><code>${escape(row.websiteSku)}</code><p><small>${escape(row.stage === 'canary' ? 'First canary' : row.stage === 'empire' ? 'Remaining Empire' : 'Round sprays')}</small></p>${complete ? `<a href="${preview}/products/${escape(row.hero.groupSlug)}?sku=${encodeURIComponent(row.websiteSku)}">Review product page</a>` : ''}</article>`).join('')}</div></main></html>`;
}
const server = http.createServer((req, res) => {
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    const url = new URL(req.url, 'http://127.0.0.1');
    let bytes, type;
    if (url.pathname === '/') { bytes = Buffer.from(render()); type = 'text/html; charset=utf-8'; }
    else if (url.pathname === '/deployment') { bytes = fs.readFileSync(path.join(deploymentDir, 'README.md')); type = 'text/plain; charset=utf-8'; }
    else if (url.pathname === '/setup') { bytes = fs.readFileSync(path.join(root, 'docs/reviews/isolated-preview-setup-2026-10-20/README.md')); type = 'text/plain; charset=utf-8'; }
    else if (url.pathname === '/plan') { bytes = fs.readFileSync(path.join(root, 'docs/reviews/empire-round-release-prep-2026-10-20/README.md')); type = 'text/plain; charset=utf-8'; }
    else if (assets.has(url.pathname)) { bytes = fs.readFileSync(path.join(root, 'public', url.pathname)); type = url.pathname.endsWith('.webp') ? 'image/webp' : 'image/png'; }
    else { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': bytes.length, 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : bytes);
});
server.listen(Number(process.env.BB_MEDIA_REVIEW_PORT ?? 3010), '127.0.0.1', () => console.log(`Local media release review: http://127.0.0.1:${server.address().port}`));
