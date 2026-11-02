const fs=require('node:fs'),assert=require('node:assert/strict');
const puppeteer=require(process.cwd()+'/node_modules/puppeteer-core');
const dir='docs/reviews/vial3-swatches-builder-2026-11-02';
const rows=JSON.parse(fs.readFileSync(dir+'/catalog-snapshot.json')).rows;
const kits=JSON.parse(fs.readFileSync('public/local-kits/vial3-swatches-builder-2026-11-02/kits.json')).rows;
const previous=process.argv.includes('--retry-failed')?JSON.parse(fs.readFileSync(dir+'/browser-verification.json')):null;
const targets=previous?new Set(previous.errors.filter(e=>e.sku).map(e=>e.viewport+'|'+e.sku)):null;
const report=previous?{...previous,pdp:previous.pdp.filter(s=>!targets.has(s.viewport+'|'+s.sku)),builder:previous.builder.filter(s=>!targets.has(s.viewport+'|'+s.sku)),retriedErrors:previous.errors,errors:[]}: {scope:'Three existing 5/8 dram vial SKUs, two glass masters, no new purchase variants',pdp:[],builder:[],errors:[]};
const save=()=>fs.writeFileSync(dir+'/browser-verification.json',JSON.stringify(report,null,2)+'\n');
const srcOf=e=>e.currentSrc||e.src||e.getAttribute('href');
(async()=>{
 const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();page.on('pageerror',e=>{report.errors.push({type:'page',message:e.message,stack:e.stack,url:page.url()});save()});
  for(const viewport of ['desktop','mobile']){
   await page.setViewport(viewport==='desktop'?{width:1440,height:1100,deviceScaleFactor:1}:{width:390,height:844,deviceScaleFactor:2});
   for(const row of rows){
    const sku=row.websiteSku,finish=sku.includes('Wht')?'white':'black';
    if(targets&&!targets.has(viewport+'|'+sku))continue;
    const url='http://localhost:3010/products/'+row.productGroupSlug+'?cap='+finish;
    try{
     assert.equal((await page.goto(url,{waitUntil:'networkidle2',timeout:60000})).status(),200);
     await page.waitForFunction(s=>document.querySelector('[data-testid="pdp-item-name"]')?.textContent.trim()===s,{timeout:25000},sku);
     let baseline;
     for(const view of ['sidecar','capon','exploded']){
      await page.$eval('[data-testid="pdp-view-'+view+'"]',e=>e.click());
      await page.waitForFunction(v=>document.querySelector('[data-testid="pdp-stage"]')?.dataset.view===v,{timeout:15000},view);
      await page.evaluate(async()=>{
       const stage=document.querySelector('[data-testid="pdp-stage"]');
       await Promise.all([...document.querySelectorAll('[data-testid="pdp-stage"] img,[data-testid="pdp-glass-lineup"] img,[data-testid="pdp-build-strip"] img')].map(i=>i.decode()));
       await Promise.all(stage.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));
       await document.fonts.ready;
      });
      // The mobile stage's layout transition can continue after layer transitions.
      // Measure only after consecutive frames stop moving; keep the strict tolerance.
      let last,stable=0;for(let sample=0;sample<30&&stable<4;sample++){
       const rect=await page.$eval('[data-testid="pdp-stage"] [data-slot="body"] img',e=>{const r=e.getBoundingClientRect(),s=e.closest('[data-testid="pdp-stage"]').getBoundingClientRect();return[r.x-s.x,r.y-s.y,r.width,r.height]});
       stable=last&&rect.every((n,i)=>Math.abs(n-last[i])<.03)?stable+1:0;last=rect;
       await new Promise(resolve=>setTimeout(resolve,60));
      }
      const state=await page.evaluate(()=>{
       const stage=document.querySelector('[data-testid="pdp-stage"]'),r=stage.getBoundingClientRect(),img=stage.querySelector('[data-slot="body"] img'),b=img.getBoundingClientRect();
       const strip=document.querySelector('[data-testid="pdp-build-strip"]');
       return{sku:document.querySelector('[data-testid="pdp-item-name"]')?.textContent.trim(),layered:stage.dataset.layered,body:img.currentSrc,bodyRect:[b.x-r.x,b.y-r.y,b.width,b.height],
        glass:[...document.querySelectorAll('[data-testid="pdp-glass-lineup"] [data-glass-slug]')].map(e=>({slug:e.dataset.glassSlug,images:e.querySelectorAll('img').length})),
        capOptions:[...document.querySelectorAll('[data-testid="pdp-cap-rail"] [data-cap-id]')].map(e=>e.dataset.capId),
        strip:{text:strip.innerText,images:strip.querySelectorAll('img').length,components:strip.querySelector('[data-components]')?.dataset.components,hasFitment:Boolean(strip.querySelector('[data-testid="pdp-build-fitment"]'))},overflow:document.documentElement.scrollWidth>innerWidth+1};
      });
      assert.equal(state.sku,sku);assert.equal(state.layered,'true');assert(state.body.includes('vial3-swatches-builder'));
      assert(state.glass.length===2&&state.glass.every(g=>g.images>0));assert.equal(state.strip.hasFitment,false);assert(!state.strip.text.includes('0 finishes'));assert(state.strip.images>=2);assert.equal(state.overflow,false);
      if(row.color==='Green')assert.deepEqual(state.capOptions,['black','white']);
      if(baseline)state.bodyRect.forEach((n,i)=>assert(Math.abs(n-baseline[i])<.35,'Body moved across views'));baseline=state.bodyRect;
      await(await page.$('[data-testid="pdp-stage"]')).screenshot({path:dir+'/evidence/'+viewport+'-'+sku+'-'+view+'.png'});
      report.pdp.push({viewport,view,...state});save();
     }
     await(await page.$('[data-testid="pdp-build-strip"]')).screenshot({path:dir+'/evidence/'+viewport+'-'+sku+'-build-strip.png'});
     const builder='http://localhost:3010/matrix?family=Vial&shop=sample-vials&sku='+encodeURIComponent(sku)+'&from=pdp';
     assert.equal((await page.goto(builder,{waitUntil:'domcontentloaded',timeout:60000})).status(),200);
     await page.waitForFunction(()=>[...document.querySelectorAll('[data-builder-layer="body"]')].some(e=>(e.src||e.getAttribute('href')||'').includes('vial3-swatches-builder')),{timeout:30000});
     await page.evaluate(async()=>{const els=[...document.querySelectorAll('[data-builder-layer]')];await Promise.all(els.map(e=>new Promise((resolve,reject)=>{const i=new Image();i.onload=resolve;i.onerror=()=>reject(new Error('Failed layer '+i.src));i.src=e.currentSrc||e.src||e.getAttribute('href')})));});
     const state=await page.evaluate(()=>({url:location.href,body:document.body.innerText,layers:[...document.querySelectorAll('[data-builder-layer]')].map(e=>({slot:e.dataset.builderLayer,src:e.currentSrc||e.src||e.getAttribute('href')})),overflow:document.documentElement.scrollWidth>innerWidth+1}));
     const bodyPart=kits[sku].parts.find(p=>p.slot==='body'),capPart=kits[sku].parts.find(p=>p.slot==='cap');
     assert(state.layers.some(p=>p.slot==='body'&&p.src.includes(bodyPart.image.sha256.slice(0,12))));
     assert(state.layers.some(p=>p.slot==='cap'&&p.src.includes(capPart.image.sha256.slice(0,12))));
     assert(!state.body.includes('Cap photo coming soon'));assert(!state.body.includes('entry is unavailable'));assert.equal(state.overflow,false);
     delete state.body;
     await page.screenshot({path:dir+'/evidence/'+viewport+'-'+sku+'-builder.png',fullPage:true});
     report.builder.push({sku,viewport,...state});save();
    }catch(e){report.errors.push({sku,viewport,message:e.message});save()}
   }
  }
  assert.equal(report.errors.length,0,JSON.stringify(report.errors));assert.equal(report.pdp.length,18);assert.equal(report.builder.length,6);report.passed=true;save();
  console.log(JSON.stringify({passed:true,pdp:report.pdp.length,builder:report.builder.length}));
 }finally{await browser.close()}
})().catch(e=>{report.errors.push({type:'run',message:e.message});save();console.error(e.message);process.exitCode=1});
