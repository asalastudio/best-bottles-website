import asyncio,json,re,hashlib,base64
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.async_api import async_playwright
ROOT=Path('/private/tmp/best-bottles-empire-alpha-20261019');OUT=ROOT/'output/empire-both-sizes-pilot'
async def transport(route):
 source=parse_qs(urlparse(route.request.url).query).get('url',[''])[0]
 if source.startswith('https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/'):
  await route.fulfill(response=await route.fetch(url=source))
 else:await route.continue_()
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch();ctx=await b.new_context(viewport={'width':1024,'height':900});page=await ctx.new_page();await page.route('**/_next/image?**',transport)
  await page.goto('http://localhost:3007/matrix?family=Empire',wait_until='domcontentloaded',timeout=120000)
  for _ in range(8):
   h=page.get_by_role('heading',name=re.compile('^(Choose your|Review your)',re.I)).first;await h.wait_for(timeout=45000);title=(await h.inner_text()).lower()
   if title.startswith('review your'):break
   choice='50 ml' if 'bottle' in title else 'Clear' if 'glass' in title else 'Perfume Sprayer' if 'fitment' in title else 'Matte Gold'
   await page.get_by_role('radio',name=re.compile('^'+re.escape(choice)+r'\b',re.I)).first.click();await page.wait_for_timeout(1200)
   await page.get_by_role('button',name=re.compile('^(Continue|Review bottle)',re.I)).first.click();await page.wait_for_timeout(1800)
  await page.get_by_role('button',name='Expand bottle preview').click();svg=page.get_by_role('dialog').locator('svg[role="img"]');await svg.wait_for()
  refs=await svg.locator('image').evaluate_all('(xs)=>xs.map(i=>i.getAttribute("href"))')
  assert any('empire-50ml-empty-alpha' in r for r in refs), refs
  assert any('native-spray-tube' in r for r in refs), refs
  images={};lineage=[]
  for ref in refs:
   src=parse_qs(urlparse(ref).query).get('url',[ref])[0] if '/_next/image?' in ref else ref
   if src.startswith('/'):
    content=(ROOT/'public'/src.lstrip('/')).read_bytes()
   else:
    response=await ctx.request.get(src);assert response.status==200;content=await response.body()
   images[ref]='data:image/png;base64,'+base64.b64encode(content).decode()
   lineage.append({'url':src,'sha256':hashlib.sha256(content).hexdigest(),'bytes':len(content)})
  data=await svg.evaluate('''(el,images)=>{const box=el.getBBox();const clone=el.cloneNode(true);clone.querySelectorAll('image').forEach(i=>i.setAttribute('href',images[i.getAttribute('href')]));const h=box.height*1.28,w=h*10/11;clone.setAttribute('viewBox',`${box.x+box.width/2-w/2} ${box.y+box.height/2-h/2} ${w} ${h}`);clone.setAttribute('width','1200');clone.setAttribute('height','1320');clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('style','display:block;background:#f5f3ef');return {svg:clone.outerHTML,frame:{x:box.x+box.width/2-w/2,y:box.y+box.height/2-h/2,width:w,height:h},originalViewBox:el.getAttribute('viewBox')};}''',images)
  (OUT/'catalog-50-assembly.svg').write_text(data['svg'])
  render=await ctx.new_page();await render.set_viewport_size({'width':1200,'height':1320});await render.set_content('<html><body style="margin:0">'+data['svg']+'</body></html>')
  await render.locator('image').evaluate_all('async xs=>Promise.all(xs.map(async i=>{const im=new Image();im.src=i.getAttribute("href");await im.decode();}))')
  content=await render.locator('svg').screenshot();sha=hashlib.sha256(content).hexdigest();url=f'/local-media/empire-bare-glass/GBEmp50SpryMtGl-shared-catalog.{sha[:12]}.png';(ROOT/'public'/url.lstrip('/')).write_bytes(content)
  source=json.loads((ROOT/'src/lib/products/catalog-heroes.json').read_text());hero=next(r for r in source if r['websiteSku']=='GBEmp50SpryMtGl');hero.update(url=url,width=1200,height=1320,alt='50 ml Clear Empire perfume spray bottle with Matte Gold sprayer and overcap beside',framing={'scale':1,'translateXPercent':0,'translateYPercent':0})
  (ROOT/'src/lib/products/local-empire-additional-catalog-heroes.json').write_text(json.dumps([hero],indent=2)+'\n')
  (OUT/'catalog-50-export.json').write_text(json.dumps({'websiteSku':hero['websiteSku'],'url':url,'sha256':sha,'width':1200,'height':1320,'source':'actual Builder sidecar SVG, exact original layer bytes embedded','layers':lineage,'frame':data['frame'],'originalViewBox':data['originalViewBox']},indent=2)+'\n')
  (ROOT/'src/lib/products/local-empire-50ml-catalog-provenance.json').write_text((OUT/'catalog-50-export.json').read_text())
  print(url,flush=True);await b.close()
asyncio.run(main())
