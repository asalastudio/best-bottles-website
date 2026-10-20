import asyncio,json,re
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.async_api import async_playwright
O=Path('/private/tmp/best-bottles-empire-alpha-20261019/output/pdp-readiness-20261019')
P=Path('/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/Best-Bottles-Website-02-20-2026-preservation/claude-browser-checks-2026-10-18/pr369-review-links.json')
groups={}
for link,_ in json.loads(P.read_text()):groups.setdefault(link.split('?')[0],link)
async def transport(route):
 source=parse_qs(urlparse(route.request.url).query).get('url',[''])[0]
 if source.startswith('https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/'):
  try:await route.fulfill(response=await route.fetch(url=source,timeout=30000))
  except:await route.continue_()
 else:await route.continue_()
async def main():
 results=json.loads((O/'selector-results.json').read_text());results=[r for r in results if not ('diva-46ml-clear' in r['group'] and 'antiquespray' in r['group']) and not r.get('error')]
 completed={r['group'] for r in results}
 async with async_playwright() as p:
  b=await p.chromium.launch();ctx=await b.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce');await ctx.route('**/_next/image?**',transport)
  await ctx.add_init_script('window.__auditPdpContext=null;window.addEventListener("bestbottles:pdp-context-change",e=>window.__auditPdpContext=e.detail)')
  sem=asyncio.Semaphore(2)
  async def one(group,link):
   async with sem:
    page=await ctx.new_page();row={'group':group,'picks':[],'pageErrors':[]};page.on('pageerror',lambda e:row['pageErrors'].append(str(e)))
    try:
     await page.goto('http://localhost:3007'+link,wait_until='domcontentloaded',timeout=90000)
     await page.wait_for_function('()=>window.__auditPdpContext && !new URLSearchParams(location.search).has("sku")',timeout=45000)
     await page.get_by_test_id('pdp-view-capon').click()
     rail=page.get_by_test_id('pdp-cap-rail');ids=await rail.locator('button').evaluate_all('(xs)=>xs.map(b=>({id:b.dataset.capId,label:b.getAttribute("aria-label")}))')
     for choice in ids:
      btn=rail.locator('button').nth(next(i for i,x in enumerate(ids) if x['id']==choice['id']))
      await btn.click();await page.wait_for_function('(id)=>document.querySelector(`[data-cap-id="${CSS.escape(id)}"]`)?.getAttribute("aria-pressed")==="true"',arg=choice['id'])
      await page.wait_for_timeout(300)
      stage=page.get_by_test_id('pdp-stage');await page.wait_for_function('()=>[...document.querySelectorAll("[data-testid=pdp-stage] img")].every(i=>i.complete)',timeout=20000)
      item=await page.get_by_test_id('pdp-item-name').inner_text();context=await page.evaluate('window.__auditPdpContext')
      imgs=await stage.locator('img').evaluate_all('(xs)=>xs.map(i=>({url:i.currentSrc,w:i.naturalWidth,slot:i.closest("[data-slot]")?.dataset.slot}))')
      body=stage.locator('[data-slot="body"] img');box=await body.bounding_box() if await body.count() else None
      row['picks'].append({'capId':choice['id'],'label':choice['label'],'sku':item,'contextSku':context.get('websiteSku'),'source':await stage.get_attribute('data-source'),'images':imgs,'bodyBox':box,'url':page.url})
      assert item==context.get('websiteSku'),f'Context mismatch {item} {context}'
      assert parse_qs(urlparse(page.url).query).get('cap',[''])[0]==choice['id'],f'URL mismatch {page.url} {choice}'
      assert all(i['w'] for i in imgs),'Undecoded stage image'
     await page.set_viewport_size({'width':390,'height':844});await page.wait_for_timeout(500)
     await page.get_by_test_id('pdp-stage').screenshot(path=str(O/(group.rsplit('/',1)[-1]+'-phone.png')))
     row['phoneCaptured']=True;row['phoneOverflow']=await page.evaluate('document.documentElement.scrollWidth>innerWidth')
    except Exception as e:row['error']=str(e)[:400]
    await page.close();results.append(row);(O/'selector-results.json').write_text(json.dumps(results,indent=2));print(len(results),group,len(row['picks']),row.get('error','OK'),flush=True)
  await asyncio.gather(*(one(g,l) for g,l in groups.items() if g not in completed));await b.close()
asyncio.run(main())
