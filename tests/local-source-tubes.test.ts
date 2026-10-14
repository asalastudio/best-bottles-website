import {afterEach,describe,expect,it,vi} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {heroTube} from '../src/lib/register/dip-tubes';
import source from '../src/lib/register/local-source-tubes.json';
import heroes from '../src/lib/register/hero-tubes.json';
import {sourceTubeMaterialFilter} from '../src/lib/register/source-tube-material';
const pilot=source[0],plate=pilot.expectedPlate;
const assembly={plateKey:plate.plateKey,parts:[{role:'sprayer',componentId:'exact-spray'}]};
const components={'exact-spray':{type:'fine-mist-sprayer'}};
const frame={width:1000,height:1100,axisX:500,seatY:489,pxPerMm:10.508365};
const draw=(p=plate)=>heroTube(assembly,components,p,frame)!;
afterEach(()=>vi.unstubAllEnvs());
describe('source tube local pilot',()=>{
 it('preserves the source lighting through glass and boosts only the exposed exploded tube',()=>{
  expect(sourceTubeMaterialFilter(pilot.url, 'sidecar')).toBeUndefined();
  expect(sourceTubeMaterialFilter(pilot.url, 'capon')).toBeUndefined();
  expect(sourceTubeMaterialFilter(pilot.url, 'exploded')).toBe('brightness(0.625) contrast(4)');
  expect(sourceTubeMaterialFilter('/unrelated.png', 'exploded')).toBeUndefined();
 });
 it('uses one intact source for both seated and expanded views only in development',()=>{
  vi.stubEnv('NODE_ENV','development');const local=draw();
  expect(local.seated?.url).toBe(pilot.url);expect(local.exploded).toEqual(local.seated);
  // Source seat/foot registration, one scale in both dimensions; never stretch.
  expect(local.seated!.box.width/local.seated!.box.height).toBeCloseTo(62/454,3);
  expect(local.seated!.box.y).toBeGreaterThan(frame.seatY);
  expect(local.seated!.box.y+local.seated!.box.height).toBeLessThan(1061);
  vi.stubEnv('NODE_ENV','production');expect(draw().exploded?.url).toBe(heroes.tubes[pilot.key as keyof typeof heroes.tubes].exploded!.url);
 });
 it('rejects stale plate URL, geometry and a different fitment',()=>{
  vi.stubEnv('NODE_ENV','development');
  expect(draw({...plate,url:plate.url+'changed'}).exploded?.url).not.toBe(pilot.url);
  expect(draw({...plate,anchors:{...plate.anchors,seatY:plate.anchors.seatY+1}}).exploded?.url).not.toBe(pilot.url);
  expect(heroTube(assembly,{'exact-spray':{type:'lotion-pump'}},plate,frame)).toBeNull();
 });
 it('keeps the hashed PSD layer intact and removes the old interior alpha break',async()=>{
  async function longestGap(url:string) {
   const {data,info}=await sharp(path.join(process.cwd(),'public',url)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   const occupied=Array.from({length:info.height},(_,y)=>{for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>15)return true;return false;});
   const first=occupied.indexOf(true),last=occupied.lastIndexOf(true);let run=0,max=0;
   for(const on of occupied.slice(first,last+1)){run=on?0:run+1;max=Math.max(max,run);}return max;
  }
  const bytes=fs.readFileSync(path.join(process.cwd(),'public',pilot.url));expect(createHash('sha256').update(bytes).digest('hex')).toBe(pilot.sha256);
  expect(await longestGap(heroes.tubes[pilot.key as keyof typeof heroes.tubes].exploded!.url)).toBeGreaterThan(3);
  expect(await longestGap(pilot.url)).toBe(0);
 });
});
