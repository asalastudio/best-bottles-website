import fs from 'node:fs';
import { stageLayout, type KitLike } from '../../../src/lib/products/pdp-redesign/stage';
const dir = 'docs/reviews/sleek8-hero-depth-2026-11-01';
const before = JSON.parse(fs.readFileSync(dir + '/before-kits.json', 'utf8')).rows.GBSleek8SpryGlMatt as KitLike;
const after = JSON.parse(fs.readFileSync('src/lib/paper-doll/approved-kits.generated.json', 'utf8')).rows.GBSleek8SpryGlMatt as KitLike;
function figure(kit: KitLike) {
    const l = stageLayout(kit, 'sidecar', { websiteSku: kit.sku })!, c = l.canvas, f = l.frame;
    const viewport = [-f.x / 100 * c.width / f.scale, -f.y / 100 * c.height / f.scale, c.width / f.scale, c.height / f.scale].join(' ');
    return '<svg viewBox="' + viewport + '" role="img" aria-label="Sleek 8 ml gold sprayer at product size">' + l.parts.map(p => {
        const x = ((p.box?.leftPct ?? 0) + p.dxPct) / 100 * c.width, y = ((p.box?.topPct ?? 0) + p.dyPct) / 100 * c.height;
        return '<image data-slot="' + p.slot + '" href="' + p.url + '" x="' + x + '" y="' + y + '" width="' + ((p.box?.widthPct ?? 100) / 100 * c.width) + '" height="' + ((p.box?.heightPct ?? 100) / 100 * c.height) + '" opacity="' + (p.opacity ?? 1) + '" style="mix-blend-mode:' + (p.blendMode ?? 'normal') + '" />';
    }).join('') + '</svg>';
}
const html = '<!doctype html><html lang="en"><meta charset="utf-8"><title>Sleek 8 ml hero tube correction</title><style>body{margin:0;background:#f5f3ef;color:#202020;font:16px system-ui}main{max-width:1100px;margin:auto;padding:28px}h1{font-size:22px;font-weight:500}p{line-height:1.5;color:#565656;max-width:850px}section{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0}h2{font-size:16px;font-weight:500}svg{display:block;width:100%;aspect-ratio:10/11;background:#f6f4f3}a{color:#34615b}@media(max-width:600px){section{grid-template-columns:1fr}}</style><main><h1>Sleek 8 ml: hero tube depth</h1><p>The same approved glass and component pixels in both images. The revised mechanism and tube sit behind the glass reflections at lower opacity. Bottle size, cap seating, bend and tube endpoint are unchanged. All eight sprayer finishes use this treatment; the exposed tube stays natural in exploded view. Prepared in the pull request, not deployed.</p><section><figure id="before"><h2>Previous shared hero</h2>' + figure(before) + '</figure><figure id="after"><h2>Corrected shared hero</h2>' + figure(after) + '</figure></section><p><a href="/catalog?category=Glass+Bottle&families=Sleek&sort=capacity-asc">Open catalog</a> · <a href="/products/sleek-8ml-clear-13-415-finemist?cap=matte-gold">Open product page and separate glass-material review</a></p></main></html>';
fs.mkdirSync('public/reviews/sleek8-hero-depth-2026-11-01', { recursive: true });
fs.writeFileSync('public/reviews/sleek8-hero-depth-2026-11-01/index.html', html);
fs.writeFileSync(dir + '/comparison.html', html);
