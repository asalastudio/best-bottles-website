import asyncio,json,re,sys
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.async_api import async_playwright
OUT=Path(sys.argv[1]);OUT.mkdir(parents=True,exist_ok=True)
BASE='http://localhost:3007'
async def ready(page,selector):
 await page.locator(selector).first.wait_for(timeout=45000)
 await page.evaluate('document.fonts.ready')
 await page.wait_for_function('s => [...document.querySelectorAll(s+" img")].every(i=>i.complete && i.naturalWidth>0)',arg=selector,timeout=45000)
 await page.wait_for_timeout(1800)
async def image_transport(route):
 url=route.request.url
 source=parse_qs(urlparse(url).query).get('url',[''])[0]
 if source.startswith('https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/'):
  response=await route.fetch(url=source)
  await route.fulfill(response=response)
 else: await route.continue_()
async def main():
 results=[]
 async with async_playwright() as p:
  b=await p.chromium.launch()
  # Capture-only transport workaround for local Next optimizer DNS64 rejection.
  # Serve exact source bytes for remote hardware, leaving app code untouched.
  ctx=await b.new_context(viewport={'width':1440,'height':1000},device_scale_factor=2)
  for size in [50,100]:
   page=await ctx.new_page();await page.route('**/_next/image?**',image_transport); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   url=f'{BASE}/products/empire-{size}ml-clear-18-415-perfumespray?sku=GBEmp{size}SpryMtGl'
   row={'surface':'pdp','size':size,'url':url,'views':{},'errors':errors}
   try:
    res=await page.goto(url,wait_until='domcontentloaded',timeout=180000);row['status']=res.status;row['captureTransport']='remote hardware optimizer requests served from their exact original source URLs'
    await ready(page,'[data-testid="pdp-stage"]')
    for view in ['Sidecar','Cap on','Exploded']:
     btn=page.get_by_role('button',name=re.compile('^'+view+'$',re.I)).first
     await btn.wait_for(timeout=45000)
     await btn.click(timeout=45000);await ready(page,'[data-testid="pdp-stage"]')
     file=f'pdp-{size}-{view.lower().replace(" ","-")}.png'
     await page.locator('[data-testid="pdp-stage"]').first.screenshot(path=str(OUT/file))
     row['views'][view]={'file':file,'images':await page.locator('[data-testid="pdp-stage"] img').evaluate_all('(xs)=>xs.map(i=>({url:i.currentSrc,w:i.naturalWidth,h:i.naturalHeight}))')}
    await page.set_viewport_size({'width':390,'height':844})
    await page.get_by_role('button',name=re.compile('^Cap on$',re.I)).first.click();await ready(page,'[data-testid="pdp-stage"]')
    await page.locator('[data-testid="pdp-stage"]').first.screenshot(path=str(OUT/f'pdp-{size}-phone.png'))
   except Exception as e:
    row['error']=str(e);await page.screenshot(path=str(OUT/f'pdp-{size}-error.png'))
   print('PDP',size,row.get('error','OK'),flush=True);results.append(row);(OUT/'results.json').write_text(json.dumps(results,indent=2));await page.close()
  page=await ctx.new_page();await page.route('**/_next/image?**',image_transport);row={'surface':'catalog','url':BASE+'/catalog/empire'}
  try:
   res=await page.goto(row['url'],wait_until='domcontentloaded',timeout=180000);row['status']=res.status;row['captureTransport']='remote hardware optimizer requests served from their exact original source URLs'
   selector='[data-bb-image-audit="catalog-card"][data-bb-family="Empire"]'
   await ready(page,selector)
   row['cards']=[]
   for size in [50,100]:
    card=page.locator(selector+f'[data-bb-product-group-slug="empire-{size}ml-clear-18-415-perfumespray"]').first
    if not await card.count():raise Exception('Expected perfume spray catalog card missing')
    await card.scroll_into_view_if_needed();await page.wait_for_timeout(300)
    await card.screenshot(path=str(OUT/f'catalog-{size}.png'))
    row['cards'].append({'size':size,'sku':await card.get_attribute('data-bb-website-sku'),'images':await card.locator('img').evaluate_all('(xs)=>xs.map(i=>({url:i.currentSrc,w:i.naturalWidth,h:i.naturalHeight}))')})
  except Exception as e:
   row['error']=str(e);await page.screenshot(path=str(OUT/'catalog-error.png'));print((await page.locator('body').inner_text())[:500],flush=True)
  print('catalog',row.get('error','OK'),flush=True);results.append(row);(OUT/'results.json').write_text(json.dumps(results,indent=2));await page.close();await ctx.close()
  ctx=await b.new_context(viewport={'width':1024,'height':900},device_scale_factor=2)
  for size in [50,100]:
   page=await ctx.new_page();await page.route('**/_next/image?**',image_transport);row={'surface':'builder','size':size,'steps':[]}
   try:
    await page.goto(BASE+'/matrix?family=Empire',wait_until='domcontentloaded',timeout=180000)
    for step in range(8):
     h=page.get_by_role('heading',name=re.compile('^(Choose your|Review your)',re.I)).first
     await h.wait_for(timeout=45000);title=(await h.inner_text()).lower();row['steps'].append(title);print('step',size,title,flush=True)
     if title.startswith('review your'):break
     choice=str(size)+' ml' if 'bottle' in title else 'Clear' if 'glass' in title else 'Perfume Sprayer' if 'fitment' in title else 'Matte Gold'
     radio=page.get_by_role('radio',name=re.compile('^'+re.escape(choice)+r'\b',re.I)).first
     await radio.click(timeout=30000)
     await page.wait_for_timeout(1200)
     if 'glass' in title:
      await page.screenshot(path=str(OUT/f'builder-{size}-glass-step.png'))
     await page.get_by_role('button',name=re.compile('^(Continue|Review bottle)',re.I)).first.click()
     await page.wait_for_timeout(1800)
    await page.get_by_role('button',name='Expand bottle preview').click(timeout=30000)
    await ready(page,'dialog[open]')
    await page.get_by_role('dialog').locator('image').evaluate_all('async xs => Promise.all(xs.map(async i => {const p=new Image();p.src=i.getAttribute("href");await p.decode();}))')
    await page.get_by_role('dialog').first.screenshot(path=str(OUT/f'builder-{size}.png'))
    row['captureTransport']='remote hardware optimizer requests served from their exact original source URLs';row['images']=await page.get_by_role('dialog').locator('image,img').evaluate_all('(xs)=>xs.map(i=>({url:i.currentSrc||i.getAttribute("href"),w:i.naturalWidth}))')
    row['summary']=(await page.locator('main').inner_text())[:600]
   except Exception as e:
    row['error']=str(e);await page.screenshot(path=str(OUT/f'builder-{size}-error.png'))
   print('builder',size,row.get('error','OK'),flush=True);results.append(row);(OUT/'results.json').write_text(json.dumps(results,indent=2));await page.close()
  await b.close()
 (OUT/'results.json').write_text(json.dumps(results,indent=2))
asyncio.run(main())
