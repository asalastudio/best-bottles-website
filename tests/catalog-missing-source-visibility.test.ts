import { describe, expect, it } from 'vitest';
import { isMissingHeroSource, isVisibleCatalogGroup } from '../src/lib/products/catalog-listing-visibility';
import { filterVariantsForProductGroup } from '../src/lib/productVariantIntegrity';
import { getCatalogCardVariantPreviews } from '../src/lib/products/product-card-variant-previews';
import { sanitizeCatalogResult, applyVisibleCatalogSummary } from '../src/lib/catalogServer';
import { buildCatalogSearchResult, type CatalogSearchResultShape } from '../src/lib/catalogSearchFallback';
import { EMPTY_FILTERS } from '../src/lib/catalogFilters';
import missing from '../src/lib/products/missing-hero-sources.json';

const good = { websiteSku: 'GOOD', graceSku: 'GOOD', capColor: 'Gold', applicator: 'Fine Mist Sprayer', imageUrl: '/good.png' };
const bad = { websiteSku: '13-415CAP4SpryCuMt', graceSku: 'CMP-SPR-MTCP-13-415-01', capColor: 'Copper', applicator: 'Fine Mist Sprayer' };
function fixture(): CatalogSearchResultShape {
 const group = { _id:'covered', slug:'fine-mist-sprayer-13-415', displayName:'Sprayer', family:'Sprayer', category:'Component', capacity:null, capacityMl:null, color:null, bottleCollection:null, neckThreadSize:'13-415', variantCount:2, priceRangeMin:1, priceRangeMax:2 };
 return { items:[group,{...group,_id:'held',slug:'cap-closure-13-425'},{...group,_id:'empty',slug:'lotion-bottle-30ml-clear',variantCount:0},{...group,_id:'real-lotion',slug:'lotion-bottle-30ml-clear'}],primarySkus:[{groupId:'covered',...bad}],variantPreviewRows:[{groupId:'covered',variants:[bad,good]}], totalCount:4,nextCursor:null,facets:{categories:{Component:4},collections:{},applicators:{},rollerMaterials:{metal:0,plastic:0},families:{Sprayer:4},colors:{},capacities:{},neckThreadSizes:{},componentTypes:{},priceRange:{min:1,max:2}} } as unknown as CatalogSearchResultShape;
}

describe('missing source publication hold',()=>{
 it('holds all 25 exact records without matching blank or unrelated identities',()=>{
  expect(missing).toHaveLength(25);
  for(const row of missing) expect(isMissingHeroSource(row)).toBe(true);
  expect(isMissingHeroSource({websiteSku:null,graceSku:null})).toBe(false);
  expect(isMissingHeroSource(good)).toBe(false);
 });
 it('removes only unpictured options from PDP and card choices',()=>{
  expect(filterVariantsForProductGroup(null,[bad,good])).toEqual([good]);
  expect(getCatalogCardVariantPreviews([bad,good],{productTitle:'Sprayer'}).map(r=>r.websiteSku)).toEqual(['GOOD']);
 });
 it('retains a real lotion group while suppressing its empty duplicate',()=>{
  expect(isVisibleCatalogGroup({slug:'lotion-bottle-30ml-clear',variantCount:0})).toBe(false);
  expect(isVisibleCatalogGroup({slug:'lotion-bottle-30ml-clear',variantCount:1},[])).toBe(false);
  expect(isVisibleCatalogGroup({slug:'lotion-bottle-30ml-clear',variantCount:1})).toBe(true);
 });
 it('filters server cards and variants and selects a pictured primary',()=>{
  const result=sanitizeCatalogResult(fixture());
  expect(result.items.map(r=>r._id)).toEqual(['covered','real-lotion']);
  expect(result.variantPreviewRows[0].variants).toEqual([good]);
  expect(result.primarySkus[0].websiteSku).toBe('GOOD');
  expect(result.facets.categories.Component).toBe(4);
 });
 it('counts source holds outside the current page and retains the backend cursor',()=>{
  const f=fixture();
  const page={...f,items:[f.items[0]],nextCursor:'1'};
  const result=applyVisibleCatalogSummary(sanitizeCatalogResult(page),{groups:f.items,primarySkus:f.primarySkus,variantPreviewRows:f.variantPreviewRows},{filters:EMPTY_FILTERS,sort:'featured',view:'visual',limit:1,cursor:null});
  expect(result.items).toHaveLength(1);
  expect(result.totalCount).toBe(2);
  expect(result.facets.categories.Component).toBe(2);
  expect(result.nextCursor).toBe('1');
 });
 it('applies the same hold before fallback facets and pagination',()=>{
  const f=fixture(),result=buildCatalogSearchResult({groups:f.items,primarySkus:f.primarySkus,variantPreviewRows:f.variantPreviewRows,filters:EMPTY_FILTERS,sort:'featured',view:'visual',limit:24});
  expect(result.totalCount).toBe(2);
  expect(result.facets.categories.Component).toBe(2);
  expect(result.primarySkus[0].websiteSku).toBe('GOOD');
  expect(result.variantPreviewRows[0].variants).toEqual([good]);
 });
});
