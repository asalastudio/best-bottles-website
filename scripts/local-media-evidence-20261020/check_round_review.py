import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
D=Path('/Users/jordanrichter/.codex/visualizations/2026/10/19/01a15606-c4e4-7692-9d6e-773c45309fd7/empire-pilot/round78-pilot')
O=Path('/private/tmp/best-bottles-empire-alpha-20261019/output/round78-two-bottle-pilot')
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch();page=await b.new_page(viewport={'width':1440,'height':1050});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto('http://127.0.0.1:3008/round78-pilot/',wait_until='networkidle')
  for s in ['sidecar','capon','exploded','catalog-card','builder','source']:
   await page.locator(f'[data-surface="{s}"]').click();await page.locator('img').evaluate_all('async xs=>Promise.all(xs.map(i=>i.decode()))')
  for g in ['Clear','Frosted']:
   await page.locator(f'[data-glass="{g}"]').click();await page.locator('img').evaluate_all('async xs=>Promise.all(xs.map(i=>i.decode()))')
  await page.locator('[data-surface="exploded"]').click();await page.locator('img').evaluate_all('async xs=>Promise.all(xs.map(i=>i.decode()))');await page.screenshot(path=str(D/'review-desktop.png'),full_page=True)
  await page.locator('#pair').screenshot(path=str(D/'exploded-pair.png'))
  await page.set_viewport_size({'width':390,'height':844});assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth');await page.screenshot(path=str(D/'review-phone.png'))
  await page.goto('http://127.0.0.1:3008/round78-pilot/matched-scale.svg',wait_until='networkidle')
  positions=await page.evaluate('''()=>['clear','frosted'].map(glass=>{const body=document.querySelector(`#${glass} [data-builder-layer="body"]`);const m=body.getCTM();const p1=new DOMPoint(0,133).matrixTransform(m),p2=new DOMPoint(0,2096).matrixTransform(m);return {glass,height:p2.y-p1.y,baseline:p2.y};})''')
  for r in positions: assert abs(r['height']-400)<.01 and abs(r['baseline']-620)<.01,positions
  await page.set_viewport_size({'width':1100,'height':730});await page.screenshot(path=str(D/'matched-scale.png'))
  assert not errors,errors
  (D/'review-check.json').write_text(json.dumps({'surfaces':6,'beforeAfterGlasses':2,'scale':positions,'phoneOverflow':False,'pageErrors':errors},indent=2))
  native=[]
  for glass,sku in [('clear','GBRnd78SpryShnSl'),('frosted','GBRndFrst78SpryShnSl')]:
   await page.goto(f'http://localhost:3007/products/round-78ml-{glass}-18-415-perfumespray?sku={sku}',wait_until='domcontentloaded',timeout=90000)
   await page.wait_for_function('()=>!new URLSearchParams(location.search).has("sku")',timeout=45000)
   await page.get_by_test_id('pdp-view-exploded').click();await page.wait_for_function('()=>{const xs=[...document.querySelectorAll("[data-testid=pdp-stage] img")];return xs.length>2&&xs.every(i=>i.complete&&i.naturalWidth>0)}',timeout=45000)
   assert await page.get_by_test_id('pdp-item-name').inner_text()==sku
   native.append({'sku':sku,'transportOverrides':False,'explodedImagesDecoded':True})
  assert not errors,errors
  (O/'native-delivery.json').write_text(json.dumps(native,indent=2));print('Review, equal scale, phone layout, and two native delivery checks passed');await b.close()
asyncio.run(main())
