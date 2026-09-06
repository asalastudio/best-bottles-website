import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NextRequest} from 'next/server';
const mocks=vi.hoisted(()=>({ids:vi.fn(),skus:vi.fn(),checkout:vi.fn()}));
vi.mock('@/lib/graceRateLimitServer',()=>({enforceGraceRateLimit:vi.fn().mockResolvedValue(null)}));
vi.mock('@/lib/portal/wholesaleCheckout',()=>({resolveWholesaleCheckoutUrl:vi.fn().mockResolvedValue(null)}));
vi.mock('@/lib/shopify',()=>({normalizeShopifyVariantId:(id:string|null)=>id?.split('/').pop()??null,resolveCheckoutVariantsByIds:mocks.ids,resolveVariantsBySkus:mocks.skus,buildCheckoutUrl:mocks.checkout}));
import {POST} from '../src/app/api/shopify/resolve-variants/route';
const clear='GB-DVA-CLR-46ML-DRP-SLV',frosted='GB-DVA-FRS-46ML-DRP-SLV';
async function request(items:unknown[]){return POST(new NextRequest('http://localhost/api/shopify/resolve-variants',{method:'POST',body:JSON.stringify({items}),headers:{'content-type':'application/json'}}));}
describe('checkout SKU identity',()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('SHOPIFY_ADMIN_TOKEN','test-only');mocks.skus.mockResolvedValue([]);mocks.checkout.mockImplementation(items=>'/cart/'+items.map((i:any)=>`${i.variantId}:${i.quantity}`).join(','));});
 it('re-resolves a saved clear-silver ID that now identifies frosted silver',async()=>{
  mocks.ids.mockResolvedValue([{variantId:'old',sku:frosted,available:true}]);
  mocks.skus.mockResolvedValue([{sku:clear,variantId:'new-clear',available:true}]);
  const response=await request([{sku:clear,shopifyVariantId:'old',quantity:12},{sku:frosted,shopifyVariantId:'old',quantity:1}]);
  expect(response.status).toBe(200);expect(mocks.skus).toHaveBeenCalledWith([clear]);
  expect(mocks.checkout).toHaveBeenCalledWith([{variantId:'old',quantity:1},{variantId:'new-clear',quantity:12}]);
 });
 it('does not send an unrelated available variant to checkout when the requested SKU cannot resolve',async()=>{
  mocks.ids.mockResolvedValue([{variantId:'old',sku:frosted,available:true}]);
  const response=await request([{sku:clear,shopifyVariantId:'old',quantity:1}]);
  expect(response.status).toBe(409);expect(mocks.checkout).not.toHaveBeenCalled();expect((await response.json()).unmatchedSkus).toEqual([clear]);
 });
 it('retains a correct direct mapping without a SKU lookup',async()=>{
  mocks.ids.mockResolvedValue([{variantId:'right',sku:clear,available:true}]);
  const response=await request([{sku:clear,shopifyVariantId:'right',quantity:2}]);
  expect(response.status).toBe(200);expect(mocks.skus).not.toHaveBeenCalled();expect(mocks.checkout).toHaveBeenCalledWith([{variantId:'right',quantity:2}]);
 });
 it('keeps a correctly identified unavailable bottle blocked',async()=>{
  mocks.ids.mockResolvedValue([{variantId:'right',sku:clear,available:false}]);
  const response=await request([{sku:clear,shopifyVariantId:'right',quantity:1}]);
  expect(response.status).toBe(409);expect(mocks.skus).not.toHaveBeenCalled();expect((await response.json()).unavailableSkus).toEqual([clear]);
 });
});
