const fs=require('fs'),P=require(process.cwd()+'/node_modules/puppeteer-core'),assert=require('assert/strict');
const dir='docs/reviews/rectangle9-applicator-2026-11-01',slug='rectangle-9ml-clear-Ground-glassapplicator';
const sources=JSON.parse(fs.readFileSync(dir+'/sources-and-registration.json')).sources;
(async()=>{const b=await P.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});let ok=false;const pdp=[],catalog=[];
try{const p=await b.newPage();for(const [viewport,size]of [['desktop',{width:1440,height:1050}],['mobile',{width:390,height:844}]]){
 await p.setViewport(size);await p.goto('http://localhost:3010/products/'+slug,{waitUntil:'domcontentloaded',timeout:120000});
 await p.waitForFunction(()=>document.querySelector('[data-testid="pdp-product-info"]')?.innerText.includes('GBSQSTClear'),{timeout:60000});
 let initialStageWidth,initialHeight;
 for(const [id,sku]of [['clear','GBSQSTClear'],['cobalt-blue','GBSQSTBlue'],['green','GBSQSTGREEN']]){
  await p.$eval('[data-cap-id="'+id+'"]',e=>e.click());await p.waitForFunction(s=>document.querySelector('[data-testid="pdp-product-info"]')?.innerText.includes(s),{timeout:30000},sku);
  await p.evaluate(async()=>Promise.all([...document.querySelectorAll('[data-testid="pdp-stage"] img')].map(i=>i.decode())));
  const row=await p.evaluate(()=>({url:location.href,title:document.querySelector('[data-testid="pdp-title"]')?.innerText,stage:document.querySelector('[data-testid="pdp-stage"]').getBoundingClientRect().toJSON(),image:document.querySelector('[data-testid="pdp-stage"] img').getBoundingClientRect().toJSON(),src:document.querySelector('[data-testid="pdp-stage"] img').src,rail:[...document.querySelectorAll('[data-cap-id]')].map(e=>({id:e.dataset.capId,active:e.getAttribute('aria-pressed')})),overflow:document.documentElement.scrollWidth>innerWidth}));
  const source=sources.find(s=>s.sku===sku),native=source.native,ink=source.alphaBounds;
  row.visible={x:row.image.x+ink.x/native.width*row.image.width,y:row.image.y+ink.y/native.height*row.image.height,width:ink.width/native.width*row.image.width,height:ink.height/native.height*row.image.height};
  assert(decodeURIComponent(row.src).includes('/'+sku+'.'));assert(!row.overflow);
  if(initialStageWidth!==undefined){assert(Math.abs(row.stage.width-initialStageWidth)<0.05,'canvas changed width');assert(Math.abs(row.visible.height-initialHeight)<0.05,'bottle changed height');}
  initialStageWidth=row.stage.width;initialHeight=row.visible.height;
  const shot=viewport+'-'+sku+'.png';await p.screenshot({path:dir+'/'+shot,fullPage:true});
  pdp.push({viewport,sku,shot,...row});console.log('PDP',viewport,sku,'height',row.visible.height);
 }
 await p.goto('http://localhost:3010/catalog?category=Glass+Bottle&families=Rectangle&sort=capacity-asc',{waitUntil:'domcontentloaded',timeout:120000});
 await p.waitForFunction(()=>document.querySelector('[data-bb-master-sku^="GBSQST"]'),{timeout:60000});
 let active=await p.$eval('[data-bb-master-sku^="GBSQST"]',e=>e.dataset.bbMasterSku);
 for(const sku of ['GBSQSTClear','GBSQSTBlue','GBSQSTGREEN']){
  const selected='[data-bb-master-sku="'+active+'"]';
  await p.$eval(selected,(e,sku)=>{const a=e.closest('article');const more=a.querySelector('[data-testid="catalog-card-cap-more"]');if(more&&more.getAttribute('aria-expanded')!=='true')more.click();const target=a.querySelector('[data-sku="'+sku+'"]');if(!target)throw Error('Missing catalog color '+sku);target.click();},sku);
  await p.waitForSelector('[data-bb-master-sku="'+sku+'"]',{timeout:30000});active=sku;
  const selector='[data-bb-master-sku="'+sku+'"]';await p.$eval(selector,e=>e.scrollIntoView({block:'center'}));
  await p.evaluate(async s=>Promise.all([...document.querySelector(s).querySelectorAll('image')].map(e=>{const i=new Image();i.src=e.getAttribute('href');return i.decode();})),selector);
  const row=await p.$eval(selector,e=>({version:e.dataset.bbMasterVersion,viewBox:e.getAttribute('viewBox'),source:e.querySelector('image')?.dataset.bbMasterSource,href:e.closest('article').querySelector('a[href*="/products/"]')?.href,title:e.closest('article').innerText}));
  assert(row.source.includes('/'+sku+'.'));assert(row.title.includes('9 ml Rectangle Applicator Bottle'));assert(row.title.includes('Ground · '+sources.find(s=>s.sku===sku).color+' · Glass stopper'));assert.equal(new URL(row.href).searchParams.get('sku'),sku);
  const shot='catalog-'+viewport+'-'+sku+'.png';await(await p.$(selector)).screenshot({path:dir+'/'+shot});
  catalog.push({viewport,sku,shot,...row});console.log('CATALOG',viewport,sku,'passed');
 }
}
assert.equal(pdp.length,6);assert.equal(catalog.length,6);
fs.writeFileSync(dir+'/interactions-verification.json',JSON.stringify({status:'passed',capturedAt:new Date().toISOString(),pdp,catalog},null,2)+'\n');ok=true;
}finally{await Promise.race([b.close(),new Promise(r=>setTimeout(r,5000))]);b.process()?.kill('SIGTERM');}if(ok)process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
