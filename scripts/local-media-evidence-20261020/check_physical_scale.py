import asyncio,json,hashlib,xml.etree.ElementTree as E
from pathlib import Path
from playwright.async_api import async_playwright
D=Path('/Users/jordanrichter/.codex/visualizations/2026/10/19/01a15606-c4e4-7692-9d6e-773c45309fd7/empire-pilot')
N={'s':'http://www.w3.org/2000/svg'}
root=E.parse(D/'physical-scale.svg').getroot()
for size,file in [(50,'catalog-50-assembly.svg'),(100,'catalog-assembly.svg')]:
 source=E.parse(D/file).getroot();dest=root.find(f's:g[@id="assembly-{size}"]',N)
 assert [e.get('href') for e in source.iter() if e.tag.endswith('image')]==[e.get('href') for e in dest.iter() if e.tag.endswith('image')]
 for a,b in zip([e for e in source.iter() if e.tag.endswith('image')],[e for e in dest.iter() if e.tag.endswith('image')]):
  assert a.get('transform')==b.get('transform')
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch();page=await b.new_page(viewport={'width':1280,'height':1150});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto('http://127.0.0.1:3008/physical-scale.svg',wait_until='networkidle')
  await page.locator('image').evaluate_all('async xs=>Promise.all(xs.map(async i=>{const im=new Image();im.src=i.getAttribute("href");await im.decode()}))')
  positions=await page.evaluate('''()=>[50,100].map(size=>{const body=document.querySelector(`#assembly-${size} [data-builder-layer="body"]`);const m=body.getCTM();const top=size===50?124:128, bottom=size===50?1728:1675;const p1=new DOMPoint(0,top).matrixTransform(m),p2=new DOMPoint(0,bottom).matrixTransform(m);return {size,height:p2.y-p1.y,baseline:p2.y};})''')
  for r,h in zip(positions,[352,428]):assert abs(r['height']-h)<.01 and abs(r['baseline']-660)<.01,positions
  await page.locator('svg').screenshot(path=str(D/'physical-scale.png'))
  await page.goto('http://127.0.0.1:3008/?revision=4',wait_until='networkidle');await page.locator('img').evaluate_all('async xs=>Promise.all(xs.map(i=>i.decode()))')
  await page.screenshot(path=str(D/'physical-scale-review.png'))
  for view in ['cap-on','sidecar','phone','exploded']:
   await page.locator(f'[data-view="{view}"]').click();await page.locator('[data-surface="pdp"] img').evaluate_all('async xs=>Promise.all(xs.map(i=>i.decode()))')
  await page.set_viewport_size({'width':390,'height':844});assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
  (D/'physical-scale-check.json').write_text(json.dumps({'originalImageBytes':'unchanged for both assemblies','childImageTransforms':'unchanged','renderedGeometry':positions,'desktop':'passed','mobileOverflow':False,'pageErrors':errors},indent=2))
  print(json.dumps(positions));await b.close()
asyncio.run(main())
