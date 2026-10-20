import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
D=Path('/Users/jordanrichter/.codex/visualizations/2026/10/19/01a15606-c4e4-7692-9d6e-773c45309fd7/empire-pilot/empire-complete')
async def main():
 records=[]
 async with async_playwright() as p:
  b=await p.chromium.launch();page=await b.new_page(viewport={'width':1440,'height':1050});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto('http://127.0.0.1:3008/empire-complete/',wait_until='networkidle')
  for finish in ['MtSl','ShnSl','ShnGl','ShnBlk','Cu','MtGl','White']:
   await page.locator(f'[data-finish="{finish}"]').click()
   for surface in ['exploded','capon','catalog-card','builder']:
    await page.locator(f'[data-surface="{surface}"]').click();await page.locator('img').evaluate_all('async xs=>Promise.all(xs.map(i=>i.decode()))')
   for size in [50,100]:
    await page.locator(f'[data-size="{size}"]').click();await page.locator('#comparison img').evaluate_all('async xs=>Promise.all(xs.map(i=>i.decode()))')
   records.append({'finish':finish,'surfaces':4,'beforeAfterSizes':2,'decoded':True})
  await page.locator('[data-finish="MtSl"]').click();await page.locator('[data-surface="exploded"]').click();await page.locator('img').evaluate_all('async xs=>Promise.all(xs.map(i=>i.decode()))');await page.screenshot(path=str(D/'review-desktop.png'),full_page=True)
  await page.set_viewport_size({'width':390,'height':844});assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth');await page.screenshot(path=str(D/'review-phone.png'))
  geometry=[]
  for finish in ['MtSl','ShnSl','ShnGl','ShnBlk','Cu','MtGl','White']:
   await page.goto(f'http://127.0.0.1:3008/empire-complete/scale-{finish}.svg',wait_until='networkidle')
   positions=await page.evaluate('''()=>[50,100].map(size=>{const body=document.querySelector(`#assembly-${size} [data-builder-layer="body"]`);const m=body.getCTM();const top=size===50?124:128,bottom=size===50?1728:1675;const p1=new DOMPoint(0,top).matrixTransform(m),p2=new DOMPoint(0,bottom).matrixTransform(m);return {size,height:p2.y-p1.y,baseline:p2.y};})''')
   for row,h in zip(positions,[352,428]):assert abs(row['height']-h)<.01 and abs(row['baseline']-650)<.01,positions
   geometry.append({'finish':finish,'positions':positions})
  await page.goto('http://127.0.0.1:3008/empire-complete/');await page.set_viewport_size({'width':1400,'height':1000})
  for start,fs in enumerate([['MtSl','ShnSl','ShnGl'],['ShnBlk','Cu','MtGl'],['White']]):
   cells=[]
   for f in fs:
    for size in [50,100]:
     sku=f'LBEmp{size}WhtClOvrCp' if f=='White' else f'GBEmp{size}Spry{f}'
     cells.append(f'<div><p>{sku}</p><img src="http://127.0.0.1:3008/empire-complete/after/{sku}-exploded.png"></div>')
   await page.set_content('<style>body{margin:0;background:#f5f3ef;font:14px Arial}main{display:grid;grid-template-columns:repeat(6,1fr)}img{width:100%}p{padding:5px}</style><main>'+''.join(cells)+'</main>');await page.locator('img').evaluate_all('async xs=>Promise.all(xs.map(i=>i.decode()))');await page.screenshot(path=str(D/f'exploded-contact-{start}.png'))
  assert not errors,errors
  (D/'review-check.json').write_text(json.dumps({'controls':records,'physicalScale':geometry,'phoneOverflow':False,'pageErrors':errors},indent=2));print('Review passed: 7 finishes, 4 surfaces, both before/after sizes, common-scale geometry, phone layout.');await b.close()
asyncio.run(main())
