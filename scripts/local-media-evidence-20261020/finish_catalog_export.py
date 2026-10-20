import asyncio,json,re,hashlib,base64
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.async_api import async_playwright
ROOT=Path('/private/tmp/best-bottles-empire-alpha-20261019');OUT=ROOT/'output/empire-proportion-pilot'
async def transport(route):
 source=parse_qs(urlparse(route.request.url).query).get('url',[''])[0]
 if source.startswith('https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/'):
  await route.fulfill(response=await route.fetch(url=source))
 else:await route.continue_()
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch();ctx=await b.new_context()
  import xml.etree.ElementTree as ET
  svg=(OUT/'catalog-assembly.svg').read_text();tree=ET.fromstring(svg)
  kit=json.loads(Path('/private/tmp/bb-empire-alpha-evidence/current-kit.json').read_text())
  sources=[part['image']['url'] for part in kit['parts'] if 'exploded' not in part.get('views',[])]
  embedded=[el.get('href') for el in tree.iter() if el.tag.endswith('image')]
  assert len(sources)==len(embedded)
  lineage=[{'url':url,'sha256':hashlib.sha256(base64.b64decode(image.split(',')[1])).hexdigest()} for url,image in zip(sources,embedded)]
  data={'svg':svg,'frame':tree.get('viewBox'),'originalViewBox':'see captured Builder SVG'}
  render=await ctx.new_page();await render.set_viewport_size({'width':1200,'height':1320});await render.set_content('<html><body style="margin:0">'+data['svg']+'</body></html>')
  await render.locator('image').evaluate_all('async xs=>Promise.all(xs.map(async i=>{const im=new Image();im.src=i.getAttribute("href");await im.decode();}))')
  content=await render.locator('svg').screenshot();sha=hashlib.sha256(content).hexdigest();url=f'/local-media/empire-bare-glass/GBEmp100SpryMtGl-107x46-catalog.{sha[:12]}.png';(ROOT/'public'/url.lstrip('/')).write_bytes(content)
  source=json.loads((ROOT/'src/lib/products/catalog-heroes.json').read_text());hero=next(r for r in source if r['websiteSku']=='GBEmp100SpryMtGl');hero.update(url=url,width=1200,height=1320,alt='100 ml Clear Empire perfume spray bottle with Matte Gold sprayer and overcap beside',framing={'scale':1,'translateXPercent':0,'translateYPercent':0})
  (ROOT/'src/lib/products/local-empire-catalog-hero.json').write_text(json.dumps(hero,indent=2)+'\n')
  (OUT/'catalog-export.json').write_text(json.dumps({'websiteSku':hero['websiteSku'],'url':url,'sha256':sha,'width':1200,'height':1320,'source':'actual Builder sidecar SVG, exact original layer bytes embedded','layers':lineage,'frame':data['frame'],'originalViewBox':data['originalViewBox']},indent=2)+'\n')
  print(url,flush=True);await b.close()
asyncio.run(main())
