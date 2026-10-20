import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
D=Path('/Users/jordanrichter/.codex/visualizations/2026/10/19/01a15606-c4e4-7692-9d6e-773c45309fd7/empire-pilot')
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch();page=await b.new_page(viewport={'width':1280,'height':1000},device_scale_factor=1);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  r=await page.goto('http://127.0.0.1:3008/?revision=3',wait_until='networkidle');assert r.status==200
  await page.locator('img').evaluate_all('async xs=>Promise.all(xs.map(i=>i.decode()))')
  assert await page.locator('[data-surface] img').count()==6
  await page.screenshot(path=str(D/'both-sizes-overview.png'))
  for view in ['cap-on','sidecar','phone','exploded']:
   await page.locator(f'[data-view="{view}"]').click()
   await page.locator('[data-surface="pdp"] img').evaluate_all('async xs=>Promise.all(xs.map(i=>i.decode()))')
   assert await page.locator(f'[data-view="{view}"]').get_attribute('aria-pressed')=='true'
  tube=page.locator('section').filter(has=page.get_by_role('heading',name='50 ml tube, before and after'))
  await tube.screenshot(path=str(D/'tube-50-before-after.png'))
  await page.locator('#before-after summary').click()
  await page.locator('#before-after img').evaluate_all('async xs=>Promise.all(xs.map(i=>i.decode()))')
  await page.set_viewport_size({'width':390,'height':844})
  assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  await page.screenshot(path=str(D/'review-mobile.png'))
  assert not errors,errors
  (D/'review-check.json').write_text(json.dumps({'httpStatus':r.status,'desktop':'passed','mobileOverflow':False,'pdpViewTabs':4,'pageErrors':errors},indent=2))
  print('Review: both sizes, four product views, before/after, images, and mobile layout passed.')
  await b.close()
asyncio.run(main())
