import asyncio,json
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch();page=await b.new_page()
  await page.goto('http://localhost:3007/products/empire-50ml-clear-18-415-perfumespray?sku=GBEmp50SpryMtGl',wait_until='networkidle')
  print(json.dumps(await page.locator('[data-testid="pdp-stage"] img').evaluate_all('(xs)=>xs.map(i=>({url:i.currentSrc,w:i.naturalWidth,html:i.outerHTML.slice(0,400)}))'),indent=2))
  await b.close()
asyncio.run(main())
