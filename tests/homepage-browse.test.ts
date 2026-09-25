import { describe, expect, it } from 'vitest';
import { buildHomeBrowseData, type HomeBrowseGroup } from '@/lib/homepageBrowse';
import { HOME_ACCESSORY_STORY, HOME_SAMPLE_FEATURE } from '@/lib/homepageMerchandising';
const group=(family:string,category='Glass Bottle',variantCount=1):HomeBrowseGroup=>({_id:family,slug:family.toLowerCase().replaceAll(' ','-'),family,category,variantCount});
describe('homepage catalog navigation',()=>{
 it('retains distinct raw family labels and scopes unrecognized landing names through catalog filters',()=>{
  const data=buildHomeBrowseData([group('Bell'),group('Bell Collection'),group('Bell'),group('Cylinder'),group('Empty','Glass Bottle',0),group('Sprayer','Component')],[]);
  expect(data.families.map(c=>c.label).sort()).toEqual(['Bell','Bell Collection','Cylinder']);
  const legacy=data.families.find(c=>c.id==='Bell Collection')!;
  expect(new URL(legacy.href,'https://example.com').searchParams.get('families')).toBe('Bell Collection');
  expect(data.families.find(c=>c.id==='Cylinder')?.href).toBe('/catalog?category=Glass+Bottle&families=Cylinder&sort=capacity-asc');
  expect(data.glassFamilyCount).toBe(3);
 });
 it('counts listed glass-bottle groups per family, skipping components, empty, hidden and redirected groups',()=>{
  const data=buildHomeBrowseData([group('Cylinder'),group('Cylinder','Component'),{...group('Cylinder'),_id:'c2',slug:'cylinder-5ml-clear-13-415'},group('Cylinder','Glass Bottle',0),{...group('Cylinder'),_id:'c3',slug:'cylinder-5.5ml-clear-13-415'},{...group('Cylinder'),_id:'c4',slug:'cylinder-9ml-17-415'},group('Round')],[]);
  expect(data.familyCounts).toEqual({Cylinder:2,Round:1});
 });
 it('includes non-glass bottle and jar lines without mixing component categories into families',()=>{
  const data=buildHomeBrowseData([group('Atomizer','Metal Atomizer'),group('Cream Jar','Glass Jar'),group('Plastic Bottle','Plastic Bottle'),group('Tool','Accessory')],[]);
  expect(data.families).toHaveLength(3);expect(data.glassFamilyCount).toBe(0);
 });
 it('keeps exact curated URL parameters and existing application destinations',()=>{
  const data=buildHomeBrowseData([],[]);
  expect(data.collections.find(c=>c.id==='samples')?.href).toBe(HOME_SAMPLE_FEATURE.href);
  expect(data.collections.find(c=>c.id==='bags')?.href).toBe(HOME_ACCESSORY_STORY.links.find(c=>c.label==='Bags & Pouches')?.href);
  expect(data.applicators.map(c=>c.label)).toContain('Reducer');
  expect(data.applicators.every(c=>c.href.startsWith('/catalog?applicators='))).toBe(true);
 });
 it('never borrows a different family photograph or hides a navigable family for missing media',()=>{
  const data=buildHomeBrowseData([group('Bell')],[{groupSlug:'bell',family:'Circle',url:'/wrong.png'}]);
  expect(data.families[0].image).toBeNull();expect(data.families[0].href).toContain('families=Bell');
 });
});
