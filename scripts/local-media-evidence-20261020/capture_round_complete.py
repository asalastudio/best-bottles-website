import asyncio,json,re
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.async_api import async_playwright
R=Path('/private/tmp/best-bottles-empire-alpha-20261019')
O=R/'output/round78-spray-completion/after';O.mkdir(parents=True,exist_ok=True)
P=Path('/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/Best-Bottles-Website-02-20-2026-preservation/claude-browser-checks-2026-10-18')
links=[x for x in json.loads((R/'output/pdp-readiness-20261019/all-variant-links.json').read_text()) if any(s in x[0] for s in ['/round-78ml-clear-18-415-perfumespray','/round-78ml-frosted-18-415-perfumespray'])]
async def transport(route):
 source=parse_qs(urlparse(route.request.url).query).get('url',[''])[0]
 if source.startswith('https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/'):
  try:await route.fulfill(response=await route.fetch(url=source,timeout=30000))
  except:await route.continue_()
 else:await route.continue_()
async def main():
 results=json.loads((O/'results.json').read_text()) if (O/'results.json').exists() else []
 results=[r for r in results if not ('diva-46ml-clear' in r['path'] and 'antiquespray' in r['path']) and not r.get('error') and not r.get('pageErrors') and r.get('itemName') and all(v['state']!='not-offered' for v in r['views'].values())]
 completed={r['sku'] for r in results}
 async with async_playwright() as p:
  b=await p.chromium.launch();ctx=await b.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce');await ctx.route('**/_next/image?**',transport);sem=asyncio.Semaphore(3)
  async def one(link):
   async with sem:
    sku=parse_qs(urlparse(link).query)['sku'][0];page=await ctx.new_page();row={'sku':sku,'path':link,'family':link.split('/products/')[1].split('-')[0],'views':{},'pageErrors':[]}
    page.on('pageerror',lambda e:row['pageErrors'].append(str(e)))
    try:
     res=await page.goto('http://localhost:3007'+link,wait_until='domcontentloaded',timeout=90000);row['status']=res.status
     stage=page.get_by_test_id('pdp-stage');await stage.wait_for(timeout=45000)
     # Hydration is complete once an available view can be clicked, rather than mistaking SSR disabled controls for restrictions.
     await page.wait_for_function('()=>[...document.querySelectorAll("[data-testid^=pdp-view-]")].some(b=>!b.disabled)',timeout=30000)
     await page.wait_for_function('()=>!new URLSearchParams(location.search).has("sku")',timeout=45000)
     await page.get_by_test_id('pdp-cap-rail').wait_for(timeout=15000)
     await page.wait_for_timeout(500)
     row['layered']=await stage.get_attribute('data-layered');row['source']=await stage.get_attribute('data-source')
     row['selection']=await page.get_by_test_id('pdp-selection-name').inner_text() if await page.get_by_test_id('pdp-selection-name').count() else None
     row['itemName']=await page.get_by_test_id('pdp-item-name').inner_text() if await page.get_by_test_id('pdp-item-name').count() else None
     for view in ['sidecar','capon','exploded']:
      button=page.get_by_test_id('pdp-view-'+view)
      if not await button.count():row['views'][view]={'state':'not-offered'};continue
      if await button.is_disabled():row['views'][view]={'state':'disabled'};continue
      await button.click();await page.wait_for_timeout(200)
      await page.wait_for_function('()=>[...document.querySelectorAll("[data-testid=pdp-stage] img")].every(i=>i.complete)',timeout=20000)
      imgs=await stage.locator('img').evaluate_all('(xs)=>xs.map(i=>({url:i.currentSrc,w:i.naturalWidth,h:i.naturalHeight,alt:i.alt}))')
      row['views'][view]={'state':'rendered','images':imgs,'broken':[i['url'] for i in imgs if not i['w']]}
      assert await stage.get_attribute('data-view')==view,'View did not switch'
      await stage.screenshot(path=str(O/f'{sku}-{view}.png'))
     assert row['itemName']==sku,f'Exact SKU mismatch: {sku} selected {row["itemName"]}'
     row['finalUrl']=page.url
     row['capButtons']=await page.get_by_test_id('pdp-cap-rail').locator('button').count()
    except Exception as e:row['error']=str(e)[:450]
    await page.close();results.append(row);(O/'results.json').write_text(json.dumps(results,indent=2))
    if len(results)%10==0 or row.get('error'):print(f'{len(results)}/{len(links)} {sku}: '+row.get('error','captured'),flush=True)
  await asyncio.gather(*(one(link) for link,_ in links if parse_qs(urlparse(link).query)['sku'][0] not in completed));await b.close()
 print('Complete',len(results),'page failures',sum(bool(r.get('error')) for r in results),flush=True)
asyncio.run(main())
