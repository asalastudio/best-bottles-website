import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
D=Path('/Users/jordanrichter/.codex/visualizations/2026/10/19/01a15606-c4e4-7692-9d6e-773c45309fd7/empire-pilot/readiness')
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch();page=await b.new_page(viewport={'width':1280,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto('http://127.0.0.1:3008/readiness/',wait_until='networkidle');await page.locator('img').evaluate_all('async xs=>Promise.all(xs.map(i=>i.decode()))')
  assert await page.locator('#rows tr').count()==157
  await page.screenshot(path=str(D/'overview.png'))
  await page.locator('#scope').select_option('fixed');assert await page.locator('#rows tr').count()==6
  await page.locator('#scope').select_option('spray');assert await page.locator('#rows tr').count()==10
  await page.locator('#scope').select_option('all');await page.locator('#family').select_option('Empire');assert await page.locator('#rows tr').count()==91
  await page.locator('#family').select_option('All families');await page.locator('#search').fill('GBDiva46AnSpIvySl');assert await page.locator('#rows tr').count()==2
  await page.set_viewport_size({'width':390,'height':844});assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not errors,errors
  await page.close()
  native=[]
  for path in ['/products/empire-100ml-clear-18-415-reducer?sku=GBEmp100RdcrMtSlTall','/products/diva-46ml-clear-18-415-antiquespray?sku=GBDiva46AnSpIvySl','/products/round-78ml-frosted-18-415-perfumespray?sku=GBRndFrst78SpryMtGl']:
   page=await b.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce');row={'path':path,'transportOverride':False}
   try:
    await page.goto('http://localhost:3007'+path,wait_until='domcontentloaded',timeout=90000)
    await page.wait_for_function('()=>!new URLSearchParams(location.search).has("sku")',timeout=45000)
    await page.get_by_test_id('pdp-view-capon').click()
    await page.wait_for_function('()=>[...document.querySelectorAll("[data-testid=pdp-stage] img")].length>0 && [...document.querySelectorAll("[data-testid=pdp-stage] img")].every(i=>i.complete&&i.naturalWidth>0)',timeout=60000)
    row['sku']=await page.get_by_test_id('pdp-item-name').inner_text();row['imageCount']=await page.get_by_test_id('pdp-stage').locator('img').count();row['pass']=True
   except Exception as e:row['error']=str(e)[:400]
   native.append(row);await page.close()
  (D/'review-check.json').write_text(json.dumps({'dashboardRows':157,'filters':'passed','mobileOverflow':False,'pageErrors':errors,'nativeTransportSpotChecks':native},indent=2))
  print(json.dumps(native,indent=2));await b.close()
asyncio.run(main())
