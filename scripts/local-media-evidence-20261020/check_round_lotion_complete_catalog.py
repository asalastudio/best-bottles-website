import asyncio,json
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.async_api import async_playwright
R=Path('/private/tmp/best-bottles-empire-alpha-20261019');O=R/'output/round78-lotion-completion';heroes=json.loads((R/'src/lib/products/local-round78-lotion-pilot-catalog-heroes.json').read_text())+json.loads((R/'src/lib/products/local-round78-lotion-additional-catalog-heroes.json').read_text())
async def transport(route):
 src=parse_qs(urlparse(route.request.url).query).get('url',[''])[0]
 if src.startswith('https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/'):await route.fulfill(response=await route.fetch(url=src))
 else:await route.continue_()
async def main():
 results=[]
 async with async_playwright() as p:
  b=await p.chromium.launch();page=await b.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce');await page.route('**/_next/image?**',transport);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto('http://localhost:3007/catalog/round',wait_until='domcontentloaded',timeout=120000)
  await page.get_by_test_id('catalog-card-cap-dot').first.wait_for(timeout=45000)
  for hero in heroes:
   sku=hero['websiteSku'];record={'sku':sku}
   try:
    image=page.locator(f'[data-bb-image-audit="catalog-card"][data-bb-product-group-slug="{hero["groupSlug"]}"]').first
    article=image.locator('xpath=ancestor::article[1]');more=article.get_by_test_id('catalog-card-cap-more')
    if await more.count() and (await more.get_attribute('aria-label')).startswith('Show '):
     if 'fewer' not in (await more.get_attribute('aria-label')):await more.click()
    button=article.locator(f'[data-testid="catalog-card-cap-dot"][data-sku="{sku}"]');await button.click();await page.wait_for_timeout(400)
    await image.locator('img').evaluate_all('async xs=>Promise.all(xs.map(i=>i.decode()))')
    src=await image.locator('img').first.get_attribute('src');src=parse_qs(urlparse(src).query).get('url',[src])[0]
    link=image if await image.get_attribute('href') else image.locator('a').first
    record.update(image=src,shownSku=await image.get_attribute('data-bb-website-sku'),href=await link.get_attribute('href'))
    assert src==hero['url'],record
    assert record['shownSku']==sku,record
    assert parse_qs(urlparse(record['href']).query).get('sku')==[sku],record
    await article.screenshot(path=str(O/(sku+'-catalog-card.png')))
   except Exception as e:record['error']=str(e);print('ERROR',sku,str(e),flush=True)
   results.append(record);(O/'catalog-results.json').write_text(json.dumps({'rows':results,'pageErrors':errors},indent=2))
  await page.set_viewport_size({'width':390,'height':844});await page.wait_for_timeout(500);overflow=await page.evaluate('document.documentElement.scrollWidth>innerWidth');await page.screenshot(path=str(O/'catalog-phone.png'));assert not overflow
  (O/'catalog-results.json').write_text(json.dumps({'rows':results,'pageErrors':errors,'phoneOverflow':overflow},indent=2));print('Catalog',len(results),'errors',sum('error' in r for r in results),errors,flush=True);await b.close()
asyncio.run(main())
