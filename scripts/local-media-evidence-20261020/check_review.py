import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
D=Path('/Users/jordanrichter/.codex/visualizations/2026/10/19/01a15606-c4e4-7692-9d6e-773c45309fd7/empire-pilot')
async def loaded(page):
 await page.wait_for_function('Array.from(document.images).every(i=>i.complete && i.naturalWidth>0)')
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch();page=await b.new_page(viewport={'width':1200,'height':1000},device_scale_factor=1)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto((D/'index.html').as_uri());await loaded(page)
  await page.screenshot(path=str(D/'comparison-100ml.png'),full_page=True)
  for size in ['50','100']:
   await page.locator(f'[data-size="{size}"]').click()
   for v in ['cap-on','sidecar','phone','exploded']:
    await page.locator(f'[data-view="{v}"]').click();await loaded(page)
  await page.set_viewport_size({'width':390,'height':844});await loaded(page)
  assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not errors
  await b.close()
  print('Review: 2 sizes × 4 views, all images loaded, no browser errors, no mobile horizontal overflow')
asyncio.run(main())
