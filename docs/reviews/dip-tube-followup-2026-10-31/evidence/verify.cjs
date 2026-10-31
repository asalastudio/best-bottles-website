const fs=require('fs'),assert=require('assert/strict'),p=require('puppeteer-core');
const out=__dirname,kits=require('./kits-after.json'),before=require('./kits-before.json'),records=process.env.BUILDER_ONLY?require('./browser-verification.json').records:[];
function slug(k){const id=k.register.bodyId,glass=k.register.glass.toLowerCase();return id.startsWith('round')?`round-78ml-${glass}-18-415-perfumespray`:id.startsWith('sleek')?'sleek-8ml-clear-13-415-finemist':'tulip-5ml-amber-13-415-finemist'}
(async()=>{const browser=await p.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});try{const page=await browser.newPage();const browserErrors=[];page.on('pageerror',e=>browserErrors.push(e.message));
for(const [viewport,size]of Object.entries(process.env.BUILDER_ONLY?{}:{desktop:{width:1440,height:1100},mobile:{width:390,height:844}})){
 await page.setViewport(size);
 for(const [sku,kit]of Object.entries(kits)){
  const res=await page.goto(`http://localhost:3010/products/${slug(kit)}?sku=${encodeURIComponent(sku)}`,{waitUntil:'networkidle2',timeout:60000});assert.equal(res.status(),200);
  await page.waitForSelector('[data-testid="pdp-stage"] [data-slot="diptube"]',{timeout:60000});let seatedBody;
  for(const view of ['sidecar','capon','exploded']){
   await page.$eval(`[data-testid="pdp-view-${view}"]`,b=>b.click());
   await page.waitForFunction(v=>document.querySelector('[data-testid="pdp-stage"]').dataset.view===v,{},view);
   await page.waitForFunction(()=>[...document.querySelectorAll('[data-testid="pdp-stage"] img')].every(i=>i.complete&&i.naturalWidth>0));
   await new Promise(r=>setTimeout(r,600));
   const data=await page.evaluate(()=>{const stage=document.querySelector('[data-testid="pdp-stage"]'),r=stage.getBoundingClientRect();return {text:document.querySelector('main').textContent,stage:r.toJSON(),overflow:document.documentElement.scrollWidth>innerWidth+1,builder:[...document.querySelectorAll('a')].find(a=>a.dataset.testid==='pdp-build-cta')?.getAttribute('href'),parts:[...stage.querySelectorAll('[data-slot]')].map(e=>{const i=e.querySelector('img');return {slot:e.dataset.slot,url:i?.getAttribute('src'),opacity:i?getComputedStyle(i).opacity:null,zIndex:getComputedStyle(e).zIndex,transform:e.style.transform,rect:i?.getBoundingClientRect().toJSON()}})}});
   assert.ok(data.text.includes(sku),'Selected SKU '+sku);assert.equal(data.overflow,false,'page overflow');
   const tubes=data.parts.filter(p=>p.slot==='diptube');assert.equal(tubes.length,1);const tube=tubes[0],body=data.parts.find(p=>p.slot==='body'),head=data.parts.find(p=>p.slot==='sprayer'),expected=kit.parts.find(p=>p.slot==='diptube'&&p.views.includes(view));
   assert.equal(new URL(tube.url,'http://localhost').searchParams.get('url')??tube.url,expected.image.url);assert.equal(Number(tube.opacity),expected.opacity??1);
   for(const part of data.parts){assert.ok(/^\d+$/.test(part.zIndex),'integer stacking');const r=part.rect,s=data.stage;assert.ok(r.left>=s.left-1&&r.right<=s.right+1&&r.top>=s.top-1&&r.bottom<=s.bottom+1,'uncropped '+sku+' '+view+' '+part.slot)}
   assert.ok(Number(tube.zIndex)>Number(body.zIndex)&&Number(tube.zIndex)<Number(head.zIndex));
   assert.equal(tube.transform,head.transform,'head and tube stay together');
   if(view!=='exploded'){
    assert.ok(tube.rect.left>body.rect.left&&tube.rect.right<body.rect.right,'tube inside glass width');
    assert.ok(tube.rect.bottom<body.rect.bottom,'tube above base');
    const box=[body.rect.x-data.stage.x,body.rect.y-data.stage.y,body.rect.width,body.rect.height];
    if(seatedBody)box.forEach((v,i)=>assert.ok(Math.abs(v-seatedBody[i])<.2,'stable glass cap on/off'));else seatedBody=box;
   }
   const filename=`${viewport}-${sku}-${view}.png`;await(await page.$('[data-testid="pdp-stage"]')).screenshot({path:out+'/screenshots/'+filename});
   records.push({viewport,sku,bodyId:kit.register.bodyId,glass:kit.register.glass,view,passed:true,screenshot:filename,parts:data.parts,builder:data.builder});
   fs.writeFileSync(out+'/browser-verification.json',JSON.stringify({records,browserErrors},null,2));
  }
  console.log(viewport,sku,'3 views passed');
 }
}
 const builder=[];
 for(const [family,bodyId]of [['Tulip','tulip-5ml-13-415'],['Sleek','sleek-8ml-13-415'],['Round','round-78ml-18-415']]){
  const response=await page.goto(`http://localhost:3010/api/bottle-builder/kits?family=${family}&bodyId=${encodeURIComponent(bodyId.replace(/-(13-415|18-415)$/, '|$1|Glass Bottle'))}`,{waitUntil:'domcontentloaded',timeout:60000});assert.equal(response.status(),200);const payload=JSON.parse(await page.$eval('body',e=>e.textContent));
  for(const [sku,kit]of Object.entries(kits).filter(([,k])=>k.register.bodyId===bodyId)){
   const bk=Object.values(payload.kits).find(k=>k?.sku===sku);assert.ok(bk,'builder kit '+sku);const tube=bk.parts.filter(p=>p.slot==='diptube');assert.equal(tube.length,1);const expected=kit.parts.find(p=>p.slot==='diptube'&&p.views.includes('capon'));assert.deepEqual(tube[0].box,expected.box);assert.equal(tube[0].image.url,expected.image.url);assert.equal(tube[0].opacity,expected.opacity);assert.deepEqual(kit.parts.filter(p=>p.slot!=='diptube'),before[sku].parts.filter(p=>p.slot!=='diptube'));
   builder.push({sku,bodyId,passed:true,tubeUrl:tube[0].image.url});
  }
 }
 fs.writeFileSync(out+'/builder-verification.json',JSON.stringify(builder,null,2));console.log('PASS',records.length,'PDP states;',builder.length,'builder kits; page errors',browserErrors.length);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
