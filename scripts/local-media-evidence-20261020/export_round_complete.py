import asyncio,json,re,hashlib,base64,sys
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.async_api import async_playwright
R=Path('/private/tmp/best-bottles-empire-alpha-20261019');O=R/'output/round78-spray-completion';rows=json.loads((O/'kits.json').read_text());results=[];heroes=[];memo={url:(O/'image-cache'/r['file']).read_bytes() for url,r in json.loads((O/'image-cache-index.json').read_text()).items()}
async def transport(route):
 source=parse_qs(urlparse(route.request.url).query).get('url',[''])[0]
 if source.startswith('https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/'):
  await route.fulfill(response=await route.fetch(url=source))
 else:await route.continue_()
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch();ctx=await b.new_context(viewport={'width':1024,'height':900},reduced_motion='reduce');await ctx.route('**/_next/image?**',transport)
  sem=asyncio.Semaphore(2)
  async def one(entry):
   async with sem:
    row=entry['row'];sku=row['websiteSku'];size=row['capacityMl'];white='WhtClOvr' in sku;page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    try:
     await page.goto('http://localhost:3007/matrix?family=Round',wait_until='domcontentloaded',timeout=120000)
     for _ in range(8):
      h=page.get_by_role('heading',name=re.compile('^(Choose your|Review your)',re.I)).first;await h.wait_for(timeout=45000);title=(await h.inner_text()).lower()
      if title.startswith('review your'):break
      choice=f'{size} ml' if 'bottle' in title else row['color'] if 'glass' in title else ('Lotion Pump' if white else 'Perfume Sprayer') if 'fitment' in title else ('White' if white else row['capColor'])
      radio=page.get_by_role('radio',name=re.compile('^'+re.escape(choice)+r'\b',re.I)).first
      if not await radio.count():raise Exception(f'Choice {choice} missing: '+str(await page.get_by_role('radio').all_text_contents()))
      await radio.click();await page.wait_for_timeout(350);await page.get_by_role('button',name=re.compile('^(Continue|Review bottle)',re.I)).first.click();await page.wait_for_timeout(600)
     summary=await page.locator('main').inner_text();assert f'{size} ml Round' in summary and ('White rectangular pump' if white else row['capColor']) in summary,(sku,summary[-1500:])
     await page.get_by_role('button',name='Expand bottle preview').click();svg=page.get_by_role('dialog').locator('svg[role="img"]');await svg.wait_for()
     await svg.locator('image').evaluate_all('async xs=>Promise.all(xs.map(async i=>{const im=new Image();im.src=i.getAttribute("href");await im.decode()}))')
     refs=await svg.locator('image').evaluate_all('(xs)=>xs.map(i=>i.getAttribute("href"))')
     body=next(x for x in entry['kit']['parts'] if x['slot']=='body')['image']['url'];assert any(body==parse_qs(urlparse(r).query).get('url',[r])[0] for r in refs),refs
     expected=next(x for x in entry['kit']['parts'] if x['slot']=='diptube')['image']['url'];assert any(expected==parse_qs(urlparse(r).query).get('url',[r])[0] for r in refs),(sku,expected,refs)
     hardware=next(x for x in entry['kit']['parts'] if x['slot']==('pump' if white else 'sprayer'))['image']['url'];assert any(hardware==parse_qs(urlparse(r).query).get('url',[r])[0] for r in refs),(sku,hardware,refs)
     await page.get_by_role('dialog').screenshot(path=str(O/(sku+'-builder.png')))
     images={};lineage=[]
     for ref in refs:
      src=parse_qs(urlparse(ref).query).get('url',[ref])[0] if '/_next/image?' in ref else ref
      if src not in memo:
       if src.startswith('/'):content=(R/'public'/src.lstrip('/')).read_bytes()
       else:
        response=await ctx.request.get(src);assert response.status==200,(src,response.status);content=await response.body()
       memo[src]=content
      content=memo[src];images[ref]='data:image/png;base64,'+base64.b64encode(content).decode();lineage.append({'url':src,'sha256':hashlib.sha256(content).hexdigest(),'bytes':len(content)})
     data=await svg.evaluate('''(el,images)=>{const box=el.getBBox();const clone=el.cloneNode(true);clone.querySelectorAll('image').forEach(i=>i.setAttribute('href',images[i.getAttribute('href')]));const h=box.height*1.28,w=h*10/11;clone.setAttribute('viewBox',`${box.x+box.width/2-w/2} ${box.y+box.height/2-h/2} ${w} ${h}`);clone.setAttribute('width','1200');clone.setAttribute('height','1320');clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('style','display:block;background:#f5f3ef');return {svg:clone.outerHTML,frame:{x:box.x+box.width/2-w/2,y:box.y+box.height/2-h/2,width:w,height:h},originalViewBox:el.getAttribute('viewBox')};}''',images)
     (O/(sku+'-assembly.svg')).write_text(data['svg']);render=await ctx.new_page();await render.set_viewport_size({'width':1200,'height':1320});await render.set_content('<html><body style="margin:0">'+data['svg']+'</body></html>');await render.locator('image').evaluate_all('async xs=>Promise.all(xs.map(async i=>{const im=new Image();im.src=i.getAttribute("href");await im.decode()}))')
     content=await render.locator('svg').screenshot();await render.close();sha=hashlib.sha256(content).hexdigest();url=f'/local-media/round78-pilot/{sku}-shared-catalog.{sha[:12]}.png';(R/'public'/url.lstrip('/')).write_bytes(content);(O/(sku+'-catalog.png')).write_bytes(content)
     finish='White pump with clear overcap' if white else row['capColor']+' sprayer'
     hero={'groupSlug':row['productGroupSlug'],'websiteSku':sku,'graceSku':row['graceSku'],'shopifyVariantId':row['shopifyVariantId'],'family':'Round','capacityMl':size,'bottleColor':row['color'],'url':url,'alt':f'{size} ml {row["color"]} Round bottle with {finish} and overcap beside','width':1200,'height':1320,'presentation':'Empty · cap beside','framing':{'scale':1,'translateXPercent':0,'translateYPercent':0}}
     record={'websiteSku':sku,'url':url,'sha256':sha,'width':1200,'height':1320,'source':'actual Builder sidecar SVG, exact original layer bytes embedded','layers':lineage,'frame':data['frame'],'originalViewBox':data['originalViewBox'],'pageErrors':errors,'exactSku':True,'finish':finish,'size':size,'glass':row['color']};assert not errors,errors
     heroes.append(hero);results.append(record);print(sku,'exported',flush=True)
    except Exception as e:
     import traceback;traceback.print_exc();results.append({'websiteSku':sku,'error':repr(e)});await page.screenshot(path=str(O/(sku+'-builder-error.png')));print(sku,'ERROR',str(e),flush=True)
    (O/'builder-export-results.json').write_text(json.dumps(results,indent=2));await page.close()
  selected=rows if len(sys.argv)==1 else [r for r in rows if r['row']['websiteSku'] in sys.argv[1:]]
  await asyncio.gather(*(one(r) for r in selected));await b.close()
  if len(selected)==12 and not any('error' in r for r in results):
   (R/'src/lib/products/local-round78-additional-catalog-heroes.json').write_text(json.dumps([h for h in heroes if h['websiteSku'] not in ['GBRnd78SpryShnSl','GBRndFrst78SpryShnSl']],indent=2)+'\n')
   (R/'src/lib/products/local-round78-completion-provenance.json').write_text(json.dumps(results,indent=2)+'\n')
asyncio.run(main())
