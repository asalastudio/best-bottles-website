const fs=require('node:fs'),assert=require('node:assert/strict');
const puppeteer=require(process.cwd()+'/node_modules/puppeteer-core');
const dir='docs/reviews/vial3-swatches-builder-2026-11-02';
const rows=JSON.parse(fs.readFileSync(dir+'/catalog-snapshot.json')).rows;
const report={checkedAt:new Date().toISOString(),scope:'5/8 dram 13-425 vials, exact existing black/white cap variants, normal localhost URLs',states:[],errors:[]};
const save=()=>fs.writeFileSync(dir+'/sidecar-verification.json',JSON.stringify(report,null,2)+'\n');
async function settle(page,view){
 await page.waitForFunction(v=>document.querySelector('[data-testid="pdp-stage"]')?.dataset.view===v,{timeout:15000},view);
 await page.evaluate(async()=>{const stage=document.querySelector('[data-testid="pdp-stage"]');await Promise.all([...stage.querySelectorAll('img')].map(i=>i.decode()));await document.fonts.ready;await Promise.all(stage.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
 return page.evaluate(()=>{
  const stage=document.querySelector('[data-testid="pdp-stage"]'),s=stage.getBoundingClientRect();
  const rect=slot=>{const el=stage.querySelector('[data-slot="'+slot+'"] img'),r=el.getBoundingClientRect();return{source:el.currentSrc,left:r.left-s.left,top:r.top-s.top,width:r.width,height:r.height,right:r.right-s.left,bottom:r.bottom-s.top}};
  return {sku:document.querySelector('[data-testid="pdp-item-name"]').textContent.trim(),view:stage.dataset.view,body:rect('body'),cap:rect('cap'),selectedView:document.querySelector('[data-testid^="pdp-view-"][aria-pressed="true"]')?.dataset.testid,selectedCap:document.querySelector('[data-testid="pdp-cap-rail"] [aria-pressed="true"]')?.dataset.capId,overflow:document.documentElement.scrollWidth>innerWidth+1};
 });
}
(async()=>{
 const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
 try{
  for(const viewport of ['desktop','mobile']){
   const page=await browser.newPage();
   await page.setViewport(viewport==='desktop'?{width:1440,height:1100,deviceScaleFactor:1}:{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
   page.on('pageerror',e=>{report.errors.push({viewport,message:e.message});save()});
   const press=selector=>viewport==='mobile'?page.tap(selector):page.click(selector);
   for(const row of rows){
    const sku=row.websiteSku,cap=sku.includes('Wht')?'white':'black';
    try{
     await page.goto('http://localhost:3010/products/'+row.productGroupSlug+'?cap='+cap,{waitUntil:'networkidle2',timeout:60000});
     await page.waitForFunction(s=>document.querySelector('[data-testid="pdp-item-name"]')?.textContent.trim()===s,{timeout:20000},sku);
     await press('[data-testid="pdp-view-capon"]');const on=await settle(page,'capon');
     await press('[data-testid="pdp-view-sidecar"]');const off=await settle(page,'sidecar');
     assert.equal(off.sku,sku);assert.equal(off.selectedView,'pdp-view-sidecar');assert.equal(off.selectedCap,cap);assert.equal(off.overflow,false);
     assert(off.cap.left>off.body.right+1,'Detached cap must stand beside the vial');
     assert(Math.abs(off.cap.bottom-off.body.bottom)<1.5,'Cap and vial must share the floor');
     for(const key of ['left','top','width','height'])assert(Math.abs(off.body[key]-on.body[key])<.35,'Bottle changed '+key+' between CAP ON and SIDECAR');
     await(await page.$('[data-testid="pdp-stage"]')).screenshot({path:dir+'/evidence/sidecar-check-'+viewport+'-'+sku+'.png'});
     await press('[data-testid="pdp-view-capon"]');const returned=await settle(page,'capon');
     assert(returned.cap.left<returned.body.right&&returned.cap.right>returned.body.left,'Cap did not return to the neck');
     assert(Math.abs((returned.cap.left+returned.cap.right)/2-(returned.body.left+returned.body.right)/2)<1,'Cap is not centered on the vial');
     report.states.push({sku,viewport,input:viewport==='mobile'?'touch':'mouse',capOn:on,sidecar:off,returnedCapOn:returned});save();
     if(row.color==='Green'){
      await press('[data-testid="pdp-view-sidecar"]');await settle(page,'sidecar');
      const other=cap==='black'?'white':'black';await press('[data-cap-id="'+other+'"]');
      const otherSku=other==='black'?'GBVGreen2o4BlackCapSht':'GBVGreen2o4WhtCapSht';
      await page.waitForFunction(s=>document.querySelector('[data-testid="pdp-item-name"]')?.textContent.trim()===s,{timeout:15000},otherSku);
      const swapped=await settle(page,'sidecar');assert.equal(swapped.selectedCap,other);assert(swapped.cap.left>swapped.body.right+1);assert(Math.abs(swapped.cap.bottom-swapped.body.bottom)<1.5);
      for(const key of ['left','top','width','height'])assert(Math.abs(swapped.body[key]-off.body[key])<.35,'Cap swap changed bottle '+key);
      report.states.push({sku:otherSku,viewport,input:viewport==='mobile'?'touch':'mouse',action:'cap-swap-while-in-sidecar',sidecar:swapped});save();
     }
    }catch(e){report.errors.push({sku,viewport,message:e.message});save()}
   }
   await page.close();
  }
  assert.equal(report.errors.length,0,JSON.stringify(report.errors));assert.equal(report.states.length,10);report.passed=true;save();console.log(JSON.stringify({passed:true,interactiveCases:report.states.length}));
 }finally{await browser.close()}
})().catch(e=>{report.errors.push({kind:'run',message:e.message});save();console.error(e.message);process.exitCode=1});
