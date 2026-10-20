import asyncio,json,re,sys
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path(sys.argv[1]);OUT.mkdir(parents=True,exist_ok=True)
BASE='http://localhost:3007'
async def ready(page,selector):
 await page.locator(selector).first.wait_for(timeout=45000)
 await page.evaluate('document.fonts.ready')
 await page.wait_for_function('s => [...document.querySelectorAll(s+" img")].every(i=>i.complete)',arg=selector,timeout=45000)
 await page.wait_for_timeout(1800)
async def main():
 results=json.loads((OUT/"results.json").read_text()) if (OUT/"results.json").exists() else []
 results=[r for r in results if r["surface"]!="builder"]
 async with async_playwright() as p:
  b=await p.chromium.launch()
  ctx=await b.new_context(viewport={'width':1024,'height':900},device_scale_factor=2)
  for size in [50,100]:
   page=await ctx.new_page();row={'surface':'builder','size':size,'steps':[]}
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
    await page.get_by_role('dialog').first.screenshot(path=str(OUT/f'builder-{size}.png'))
    row['images']=await page.get_by_role('dialog').locator('image,img').evaluate_all('(xs)=>xs.map(i=>({url:i.currentSrc||i.getAttribute("href"),w:i.naturalWidth}))')
    row['summary']=(await page.locator('main').inner_text())[:600]
   except Exception as e:
    row['error']=str(e);await page.screenshot(path=str(OUT/f'builder-{size}-error.png'))
   print('builder',size,row.get('error','OK'),flush=True);results.append(row);(OUT/'results.json').write_text(json.dumps(results,indent=2));await page.close()
  await b.close()
 (OUT/'results.json').write_text(json.dumps(results,indent=2))
asyncio.run(main())
