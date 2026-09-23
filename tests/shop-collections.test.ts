import {describe,it,expect} from 'vitest';
import {SHOP_COLLECTIONS,matchesShopCollection,featuredCollectionCards} from '../src/lib/shopCollections';
import {EMPTY_FILTERS,filtersToParams,paramsToFilters,activeFilterCount} from '../src/lib/catalogFilters';
import {buildAppliedFilterChips,removeCatalogFilterChip} from '../src/lib/catalogRefineModel';
import {buildCatalogSearchResult,type CatalogSearchGroup} from '../src/lib/catalogSearchFallback';
import {parseBrowseContext,browseContextToFilters} from '../src/lib/products/focused-shopping';
const group=(id:string,applicatorTypes:string[],extra:Partial<CatalogSearchGroup>={}):CatalogSearchGroup=>({_id:id,slug:id,displayName:id,family:'Elegant',capacity:'15 ml',capacityMl:15,color:'Clear',category:'Glass Bottle',bottleCollection:'Elegant',neckThreadSize:'13-415',variantCount:2,priceRangeMin:1,priceRangeMax:2,heroImageUrl:'/test.webp',applicatorTypes,...extra});
const rows=[group('roller',['Metal Roller Ball']),group('spray',['Fine Mist Sprayer']),group('bulb',['Vintage Bulb Sprayer with Tassel']),group('travel',['Atomizer'],{family:'Atomizer',category:'Metal Atomizer'}),group('loose',['Vintage Bulb Sprayer'],{family:'Sprayer',category:'Component'}),group('wand',['Glass Rod'],{family:'Vial'}),group('dropper',['Dropper'],{family:'Boston Round'})];
const run=(filters:Partial<typeof EMPTY_FILTERS>,limit=50,cursor:string|null=null)=>buildCatalogSearchResult({groups:rows,primarySkus:[],variantPreviewRows:[],filters:{...EMPTY_FILTERS,...filters},sort:'featured',view:'visual',limit,cursor});
describe('collection membership',()=>{
 it('has eleven distinct commercial groups and six featured defaults',()=>{expect(SHOP_COLLECTIONS).toHaveLength(11);expect(featuredCollectionCards()).toHaveLength(6);expect(new Set(SHOP_COLLECTIONS.map(c=>c.key)).size).toBe(11);});
 it('keeps glass sprays, vintage assemblies and travel formats separate',()=>{expect(run({shopCollection:'glass-spray-bottles'}).items.map(g=>g._id).sort()).toEqual(['bulb','spray']);expect(run({shopCollection:'perfume-atomizers'}).items.map(g=>g._id)).toEqual(['travel']);expect(run({shopCollection:'accessories-packaging'}).items.map(g=>g._id)).toEqual(['loose']);});
 it('does not turn a glass wand vial or loose roller cap into a roll-on bottle',()=>{expect(run({shopCollection:'sample-vials'}).items.map(g=>g._id)).toEqual(['wand']);expect(matchesShopCollection(group('cap',['Metal Roller Ball'],{category:'Component'}),'roll-on-bottles')).toBe(false);});
 it('includes Eternal Flame in apothecary, and excludes a jar lid from jars',()=>{const eternal=group('eternal-flame-35ml-clear-Ground',[],{family:'Decorative'});expect(matchesShopCollection(eternal,'apothecary-bottles')).toBe(true);expect(matchesShopCollection(eternal,'decorative-bottles')).toBe(false);expect(matchesShopCollection(group('lid',[],{family:'Cream Jar',category:'Component'}),'cream-jars')).toBe(false);});
 it('applies family and collection as an intersection before pagination and facets',()=>{const fromFamily=run({families:['Elegant'],shopCollection:'roll-on-bottles'});const fromCollection=run({shopCollection:'roll-on-bottles',families:['Elegant']});expect(fromFamily.items).toEqual(fromCollection.items);expect(fromFamily.items.map(g=>g._id)).toEqual(['roller']);expect(run({shopCollection:'glass-spray-bottles'},1).totalCount).toBe(2);expect(run({shopCollection:'glass-spray-bottles'}).facets.families).toEqual({Elegant:2});expect(run({shopCollection:'roll-on-bottles',families:['Boston Round']}).items).toEqual([]);});
});
describe('collection state and editorial configuration',()=>{
 it('round trips a shared URL and removes only its own chip',()=>{const filters={...EMPTY_FILTERS,shopCollection:'roll-on-bottles',families:['Elegant'],colors:['Frosted']};const parsed=paramsToFilters(filtersToParams(filters,'price-asc')).filters;expect(parsed).toMatchObject(filters);expect(activeFilterCount(parsed)).toBe(3);const chip=buildAppliedFilterChips(parsed).find(c=>c.facet==='shopCollection')!;expect(removeCatalogFilterChip(parsed,chip)).toMatchObject({shopCollection:null,families:['Elegant'],colors:['Frosted']});});
 it('preserves collection context through family links',()=>{const context=parseBrowseContext('/catalog',new URLSearchParams('shop=roll-on-bottles&families=Elegant'));expect(browseContextToFilters(context)).toMatchObject({shopCollection:'roll-on-bottles',families:['Elegant']});});
 it('ignores unknown keys and honors explicit empty or disabled CMS cards',()=>{expect(paramsToFilters(new URLSearchParams('shop=bogus')).filters.shopCollection).toBeNull();expect(featuredCollectionCards([])).toEqual([]);expect(featuredCollectionCards([{collectionKey:'roll-on-bottles',enabled:false},{collectionKey:'invalid'}])).toEqual([]);expect(featuredCollectionCards([{collectionKey:'cream-jars',order:2},{collectionKey:'sample-vials',order:1},{collectionKey:'cream-jars',order:3}]).map(c=>c.key)).toEqual(['sample-vials','cream-jars']);});
});

describe('builder collection entry',()=>{
 it('restricts only existing compatible assemblies without changing identities',async()=>{
  const {builderCollectionBodies}=await import('../src/lib/bottle-builder/collection-context');
  const roller={id:'exact-roll-sku',fitment:'Metal Roller'},spray={id:'exact-spray-sku',fitment:'Fine Mist Sprayer'};
  const bodies=[{id:'body',configurations:[roller,spray]}] as import('../src/lib/bottle-builder/model').BuilderBody[];
  const filtered=builderCollectionBodies(bodies,'roll-on-bottles');
  expect(filtered[0].configurations).toEqual([roller]);expect(filtered[0].configurations[0]).toBe(roller);expect(bodies[0].configurations).toHaveLength(2);
  expect(builderCollectionBodies(bodies,'dropper-bottles')).toEqual([]);
 });
});
