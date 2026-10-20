import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
O=Path('/private/tmp/best-bottles-empire-alpha-20261019/output/empire-completion-pilot')
async def main():
 results=[]
 async with async_playwright() as p:
  b=await p.chromium.launch();page=await b.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce')
  for size,sku,fit in [(50,'GBEmp50SpryCu','perfumespray'),(100,'GBEmp100SpryMtSl','perfumespray'),(100,'LBEmp100WhtClOvrCp','lotionpump')]:
   errors=[];handler=lambda e:errors.append(str(e));page.on('pageerror',handler)
   await page.goto(f'http://localhost:3007/products/empire-{size}ml-clear-18-415-{fit}?sku={sku}',wait_until='domcontentloaded',timeout=90000)
   await page.wait_for_function('()=>!new URLSearchParams(location.search).has("sku")',timeout=45000)
   await page.get_by_test_id('pdp-view-exploded').click();await page.wait_for_function('()=>{const xs=[...document.querySelectorAll("[data-testid=pdp-stage] img")];return xs.length>2&&xs.every(i=>i.complete&&i.naturalWidth>0)}',timeout=45000)
   assert await page.get_by_test_id('pdp-item-name').inner_text()==sku
   assert not errors,errors
   results.append({'sku':sku,'transportOverrides':False,'view':'exploded','allImagesDecoded':True,'pageErrors':errors});page.remove_listener('pageerror',handler)
  (O/'native-delivery.json').write_text(json.dumps(results,indent=2));print('3 native-delivery spot checks passed');await b.close()
asyncio.run(main())
