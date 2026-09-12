import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import heroes from '../src/lib/products/catalog-heroes.json';
import release from '../docs/reviews/catalog-complete-hero-release-2026-09-07.json';
import { getCatalogHero, getProductHero, getCatalogHeroProductHref } from '../src/lib/products/catalog-heroes';
import elegant from '../docs/reviews/elegant-family-final-manifest-2026-09-06.json';
import circle from '../docs/reviews/circle-family-final-manifest-2026-09-06.json';
import empire from '../docs/reviews/empire-100ml-final-manifest-2026-09-06.json';
import diva from '../docs/reviews/diva-family-final-manifest-2026-09-06.json';
import shoulderApproval from '../docs/reviews/elegant-shoulder-alignment-2026-09-07.json';
import circleRevision from '../docs/reviews/circle-recovery/alignment-and-matte-report.json';
import { readdirSync, existsSync } from 'node:fs';
const approved=[...elegant.rows,...circle.rows,...empire.rows,...diva.rows];

/**
 * Heroes Jordan has since re-approved in a Sunburst release, by sha256.
 *
 * The earlier per-family records describe how to FRAME an original photograph so
 * the glass lands where he wanted it. A Sunburst hero carries that geometry in its
 * own pixels — his size target, the foot on the 1562 baseline, the group centred at
 * x=780 — and is published with identity framing, because the shared nudge must not
 * be applied twice. So for a row he has re-approved, the release lock is the record
 * that applies, and the older framing rule no longer describes the image on disk.
 * Every registry row is still checked against one approval or the other; none is
 * simply exempted.
 */
const releaseLock=new Map<string,string>();
for(const dir of readdirSync('docs/reviews').filter(d=>/^sunburst-heroes-release-\d+$/.test(d)).sort()) {
 const p=`docs/reviews/${dir}/approved-lock.json`;
 if(!existsSync(p)) continue;
 for(const [sku,e] of Object.entries(JSON.parse(readFileSync(p,'utf8')) as Record<string,{sha256:string}>)) releaseLock.set(sku,e.sha256);
}
const IDENTITY_FRAMING={scale:1,translateXPercent:0,translateYPercent:0};
/** A registry row is "re-approved" only when the bytes on disk are the exact ones locked in a release. */
const reapproved=(sku:string)=>{
 const sha=releaseLock.get(sku); if(!sha) return false;
 const h=heroes.find(x=>x.websiteSku===sku); if(!h) return false;
 return createHash('sha256').update(readFileSync(`public${h.url}`)).digest('hex')===sha;
};
/** The plate must be bone, within 2/255. A wrong background — white, transparent, another plate — is off by tens. */
const expectBone=(px:number[])=>{ const bone=[245,243,239]; for(let i=0;i<3;i++) expect(Math.abs(px[i]-bone[i])).toBeLessThanOrEqual(2); };
describe('approved catalog hero release',()=>{
 it('includes the expanded release and preserves every prior approved registration',()=>{
  expect(heroes).toHaveLength(391);
  expect(new Set(heroes.map(h=>h.websiteSku)).size).toBe(391);
  for(const a of approved) {
   const h=getProductHero(a.sku)!;
   if(reapproved(a.sku)) {
    // re-approved in a Sunburst release: the lock is the record, and the image is placed in its own pixels
    expect(h.framing).toEqual(IDENTITY_FRAMING);
    expect(createHash('sha256').update(readFileSync(`public${h.url}`)).digest('hex')).toBe(releaseLock.get(a.sku));
    continue;
   }
   expect(h.framing).toEqual(circleRevision.rows.find(row=>row.sku===a.sku)?.framing ?? shoulderApproval.rows.find(row=>row.sku===a.sku)?.framing ?? a.framing);
   expect(createHash('sha256').update(readFileSync(`public${h.url}`)).digest('hex')).toBe(circleRevision.rows.find(row=>row.sku===a.sku)?.assetSha256 ?? a.assetSha256);
  }
  expect(heroes.filter(h=>h.family==='Cylinder')).toHaveLength(52);
 });
 it('applies the saved Circle shoulder targets with the shared contact baseline',()=>{
  expect(circleRevision.rows).toHaveLength(27);
  for(const row of circleRevision.rows) {
   const h=getProductHero(row.sku)!;
   if(reapproved(row.sku)) { expect(h.framing).toEqual(IDENTITY_FRAMING); continue; }
   const target=({15:37,30:43,50:47,100:54} as Record<number,number>)[h.capacityMl!];
   const f=h.framing;
   expect((row.originalBaseY-row.landmark.shoulderY)*f.scale/1716*100).toBeCloseTo(target,8);
   expect(row.originalBaseY*f.scale/1716*100+f.translateYPercent).toBeCloseTo(91,8);
   const [left,top,right,bottom]=row.renderedSignificantArtworkBounds;
   expect(left).toBeGreaterThan(0);expect(top).toBeGreaterThan(0);
   expect(right).toBeLessThan(1560);expect(bottom).toBeLessThan(1716);
  }
 });
 it('locks all Elegant shoulders while preserving the approved vintage exceptions',()=>{
  expect(shoulderApproval.rows).toHaveLength(33);
  expect(shoulderApproval.rows.filter(row=>row.vintageException)).toHaveLength(8);
  for(const row of shoulderApproval.rows) {
   expect(getProductHero(row.sku)?.framing).toEqual(row.framing);
   if(row.vintageException) { expect(row.framing).toEqual(row.beforeFraming); continue; }
   const shoulder=row.landmarks!.shoulder*row.framing.scale/3.3+row.framing.translateYPercent;
   const baseline=row.bodyBase!*row.framing.scale/3.3+row.framing.translateYPercent;
   expect(shoulder).toBeCloseTo(row.shoulderYPercent!,8);
   expect(baseline).toBeCloseTo(91,8);
   for(const value of Object.values(row.sceneBounds!)) { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(100); }
  }
 });
 for(const h of heroes) it(`${h.websiteSku} preserves approved bytes, framing, bone and exact SKU filtering`,async()=>{
  const a=release.rows.find(a=>a.websiteSku===h.websiteSku)!;
  const b=readFileSync(`public${h.url}`);
  expect(createHash('sha256').update(b).digest('hex')).toBe(a.sha256);
  expect(h.framing).toEqual(a.framing);
  const {data,info}=await sharp(b).removeAlpha().raw().toBuffer({resolveWithObject:true});
  expect([info.width,info.height]).toEqual([1560,1716]);
  for(const [x,y] of [[0,0],[1559,0],[0,1715],[1559,1715]]) expectBone([...data.subarray((y*info.width+x)*3,(y*info.width+x)*3+3)]);
  expect(getCatalogHero(h.groupSlug,[{websiteSku:h.websiteSku}])?.url).toBe(h.url);
  expect(getCatalogHero(h.groupSlug,[{websiteSku:'unapproved-other-finish'}])).toBeNull();
  expect(getCatalogHeroProductHref(h,'/products/example?applicator=spray')).toContain(`sku=${h.websiteSku}`);
 });

 it('resolves the verified production slug for the 30 ml Cylinder spray hero',()=>{
  const hero=getCatalogHero('cylinder-30ml-clear-18-415',[{websiteSku:'GBSpry1ozGl'}]);
  expect(hero?.websiteSku).toBe('GBSpry1ozGl');
  expect(hero?.groupSlug).toBe('cylinder-30ml-clear-18-415');
  expect(hero?.url).toBe('/images/catalog/bone-review/GBSpry1ozGl.fb9ac058faf2.png');
  expect(getCatalogHero('cylinder-30ml-clear-18-415',[{websiteSku:'GBSpry1ozSl'}])).toBeNull();
 });
 it('keeps catalog media out of product detail implementations',()=>{
  for(const p of ['ConfiguratorPdp.tsx','mobile/MobileProductHero.tsx','mobile/MobileProductPdp.tsx']) expect(readFileSync(`src/components/products/${p}`,'utf8')).not.toContain('catalog-heroes');
 });
});
