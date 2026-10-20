import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
D=Path('/Users/jordanrichter/.codex/visualizations/2026/10/19/01a15606-c4e4-7692-9d6e-773c45309fd7/empire-pilot/diva46-complete');O=Path('/private/tmp/best-bottles-empire-alpha-20261019/output/diva46-spray-completion');url='http://127.0.0.1:3008/diva46-complete/'
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch();page=await b.new_page(viewport={'width':1440,'height':1050},reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto(url,wait_until='networkidle');records=[];geometry=[]
  for f in ['ShnSl','MtSl','ShnGl','MtGl','ShnBlk','Cu']:
   await page.locator(f'[data-finish="{f}"]').click()
   for s in ['sidecar','capon','exploded','catalog-card','builder','catalog']:
    await page.locator(f'[data-surface="{s}"]').click();await page.locator('img').evaluate_all('async xs=>Promise.all(xs.map(i=>i.decode()))')
   for g in ['Clear','Frosted']:
    await page.locator(f'[data-glass="{g}"]').click();await page.locator('img').evaluate_all('async xs=>Promise.all(xs.map(i=>i.decode()))')
   records.append({'finish':f,'surfaces':6,'sourceComparisonGlasses':2,'decoded':True})
  await page.locator('[data-finish="MtGl"]').click();await page.locator('[data-surface="exploded"]').click();await page.locator('img').evaluate_all('async xs=>Promise.all(xs.map(i=>i.decode()))');await page.screenshot(path=str(D/'review-desktop.png'),full_page=True)
  await page.set_viewport_size({'width':390,'height':844});assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth');await page.screenshot(path=str(D/'review-phone.png'))
  for f in ['ShnSl','MtSl','ShnGl','MtGl','ShnBlk','Cu']:
   await page.goto(url+f'scale-{f}.svg',wait_until='networkidle')
   positions=await page.evaluate('''()=>['clear','frosted'].map(glass=>{const body=document.querySelector(`#${glass} [data-builder-layer="body"]`);const m=body.getCTM();const p1=new DOMPoint(0,146).matrixTransform(m),p2=new DOMPoint(0,glass==='clear'?2097:2098).matrixTransform(m);return {glass,height:p2.y-p1.y,baseline:p2.y};})''')
   for r in positions:assert abs(r['height']-400)<.01 and abs(r['baseline']-620)<.01,positions
   geometry.append({'finish':f,'positions':positions})
   await page.set_viewport_size({'width':1100,'height':730});await page.screenshot(path=str(D/f'scale-{f}.png'))
  await page.goto(url);await page.set_viewport_size({'width':1500,'height':900})
  for n,fs in enumerate([['ShnSl','MtSl','ShnGl'],['MtGl','ShnBlk','Cu']]):
   cells=[]
   for f in fs:
    for g in ['','Frst']:
     sku=f'GBDiva{g}46Spry{f}';cells.append(f'<div><p>{sku}</p><img src="{url}after/{sku}-exploded.png"></div>')
   await page.set_content('<style>body{margin:0;background:#f5f3ef;font:12px Arial}main{display:grid;grid-template-columns:repeat(6,1fr)}img{width:100%}p{padding:5px}</style><main>'+''.join(cells)+'</main>');await page.locator('img').evaluate_all('async xs=>Promise.all(xs.map(i=>i.decode()))');await page.screenshot(path=str(D/f'exploded-contact-{n}.png'))
  assert not errors,errors
  (D/'review-check.json').write_text(json.dumps({'controls':records,'relativeScale':geometry,'phoneOverflow':False,'pageErrors':errors},indent=2))
  native=[]
  for glass,sku in [('clear','GBDiva46SpryCu'),('frosted','GBDivaFrst46SpryMtGl'),('clear','GBDiva46SpryShnBlk')]:
   await page.goto(f'http://localhost:3007/products/diva-46ml-{glass}-18-415-perfumespray?sku={sku}',wait_until='domcontentloaded',timeout=90000)
   await page.wait_for_function('()=>!new URLSearchParams(location.search).has("sku")',timeout=45000)
   await page.get_by_test_id('pdp-view-exploded').click();await page.wait_for_function('()=>{const xs=[...document.querySelectorAll("[data-testid=pdp-stage] img")];return xs.length>2&&xs.every(i=>i.complete&&i.naturalWidth>0)}',timeout=45000)
   assert await page.get_by_test_id('pdp-item-name').inner_text()==sku
   native.append({'sku':sku,'transportOverrides':False,'explodedImagesDecoded':True})
  assert not errors,errors
  (O/'native-delivery.json').write_text(json.dumps(native,indent=2));print('Six-finish review, same-scale geometry, phone layout, and three native delivery checks passed');await b.close()
asyncio.run(main())
