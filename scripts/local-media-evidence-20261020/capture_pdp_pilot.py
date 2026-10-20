import asyncio,json,re,sys
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path(sys.argv[1]);OUT.mkdir(parents=True,exist_ok=True)
BASE='http://localhost:3007'
async def ready(page,selector):
 await page.locator(selector).first.wait_for(timeout=45000)
 await page.evaluate('document.fonts.ready')
 await page.wait_for_function('s => [...document.querySelectorAll(s+" img")].every(i=>i.complete && i.naturalWidth>0)',arg=selector,timeout=45000)
 await page.wait_for_timeout(1800)
async def main():
 results=json.loads((OUT/"results.json").read_text()) if (OUT/"results.json").exists() else []
 results=[r for r in results if r["surface"]!="pdp"]
 async with async_playwright() as p:
  b=await p.chromium.launch()
  ctx=await b.new_context(viewport={'width':1440,'height':1000},device_scale_factor=2)
  for size in [50,100]:
   page=await ctx.new_page(); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   url=f'{BASE}/products/empire-{size}ml-clear-18-415-perfumespray?sku=GBEmp{size}SpryMtGl'
   row={'surface':'pdp','size':size,'url':url,'views':{},'errors':errors}
   try:
    res=await page.goto(url,wait_until='domcontentloaded',timeout=180000);row['status']=res.status
    await page.wait_for_load_state('networkidle',timeout=45000)
    await ready(page,'[data-testid="pdp-stage"]')
    for view in ['Sidecar','Cap on','Exploded']:
     btn=page.get_by_role('button',name=re.compile('^'+view+'$',re.I)).first
     if not await btn.count() or await btn.is_disabled():row['views'][view]='unavailable';continue
     await btn.click();await ready(page,'[data-testid="pdp-stage"]')
     file=f'pdp-{size}-{view.lower().replace(" ","-")}.png'
     await page.locator('[data-testid="pdp-stage"]').first.screenshot(path=str(OUT/file))
     row['views'][view]={'file':file,'images':await page.locator('[data-testid="pdp-stage"] img').evaluate_all('(xs)=>xs.map(i=>({url:i.currentSrc,w:i.naturalWidth,h:i.naturalHeight}))')}
    await page.set_viewport_size({'width':390,'height':844})
    await page.get_by_role('button',name=re.compile('^Cap on$',re.I)).first.click();await ready(page,'[data-testid="pdp-stage"]')
    await page.locator('[data-testid="pdp-stage"]').first.screenshot(path=str(OUT/f'pdp-{size}-phone.png'))
   except Exception as e:
    row['error']=str(e);await page.screenshot(path=str(OUT/f'pdp-{size}-error.png'))
   print('PDP',size,row.get('error','OK'),flush=True);results.append(row);(OUT/'results.json').write_text(json.dumps(results,indent=2));await page.close()
  await b.close()
 (OUT/'results.json').write_text(json.dumps(results,indent=2))
asyncio.run(main())
