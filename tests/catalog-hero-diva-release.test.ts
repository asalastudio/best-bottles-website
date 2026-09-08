import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import lock from '../docs/reviews/diva-family-final-manifest-2026-09-06.json';
import heroes from '../src/lib/products/catalog-heroes.json';
it('ships exactly the 21 approved Diva assets and absolute framing',()=>{
 expect(lock.visualApproved).toBe(true);expect(lock.rows).toHaveLength(21);
 expect(new Set(lock.rows.map(r=>r.sku)).size).toBe(21);
 for(const r of lock.rows){
  const hero=heroes.find(h=>h.websiteSku===r.sku)!;
  expect(hero.family).toBe('Diva');expect(hero.url).toBe(r.url);expect(hero.framing).toEqual(r.framing);
  const hash=createHash('sha256').update(readFileSync('public'+hero.url)).digest('hex');
  expect(hash).toBe(r.assetSha256);
  expect(r.body.outputBase/1716*100+r.framing.translateYPercent).toBeCloseTo(91,8);
  expect(r.liveIdentityVerified).toBe(true);expect(r.sourcePsdVerified).toBe(true);
 }
});
