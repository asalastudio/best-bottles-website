const fs=require('fs'),p=require('puppeteer-core');
const dir='docs/reviews/cylinder9-pumps-rollers-2026-11-01',model=require('../../../public/reviews/cylinder9-pumps-rollers-2026-11-01/model.json');
const rows=model.configurations.filter(c=>c.applicatorKey==='lotion-pump'||c.finishLabel==='Black Dotted');
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),report={version:model.version,started:new Date().toISOString(),pdp:[],builder:[],errors:[]};
(async()=>{const browser=await p.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});try{
 for(const width of [1440,390]){
  const page=await browser.newPage();await page.setViewport({width,height:1100});
  for(const c of rows){
   await page.goto('http://127.0.0.1:3010/products/'+c.productGroupSlug+'?sku='+c.websiteSku,{waitUntil:'domcontentloaded',timeout:90000});
   await page.waitForSelector('[data-testid="pdp-stage"] [data-slot="body"] img');
   const slot=c.applicatorKey==='lotion-pump'?'pump':'roller',expected=model.assets[c.applicatorKey==='lotion-pump'?'lotion-head':c.applicatorKey==='metal-roller'?'roller-metal':'roller-plastic'].url;
   await page.waitForFunction((slot,expected)=>document.querySelector(`[data-testid="pdp-stage"] [data-slot="${slot}"] img`)?.src.endsWith(expected),{timeout:15000},slot,expected);
   let firstBody=null;
   await page.evaluate(()=>{window.auditBody=document.querySelector('[data-testid="pdp-stage"] [data-slot="body"]');});
   for(const view of ['SIDECAR','CAP ON','EXPLODED']){
    await page.evaluate(view=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===view).click(),view);await sleep(650);
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-testid="pdp-stage"] [data-slot] img')].every(i=>i.complete&&i.naturalWidth>0),{timeout:20000});
    const result=await page.evaluate(()=>{const stage=document.querySelector('[data-testid="pdp-stage"]'),body=stage.querySelector('[data-slot="body"]'),r=body.getBoundingClientRect();return{view:stage.dataset.view,body:[r.x,r.y,r.width,r.height],sameElement:body===window.auditBody,parts:[...stage.querySelectorAll('[data-slot] img')].map(i=>({slot:i.closest('[data-slot]').dataset.slot,url:i.currentSrc,width:i.naturalWidth}))}});
    if(!firstBody)firstBody=result.body;
    if(result.body.some((v,i)=>Math.abs(v-firstBody[i])>.1)||!result.sameElement)throw Error('Body moved/remounted: '+c.websiteSku);
    report.pdp.push({sku:c.websiteSku,width,...result});
    if(c.glassLabel==='Clear'&&['Black','Black Dotted'].includes(c.finishLabel)&&view==='EXPLODED')await(await page.$('[data-testid="pdp-stage"]')).screenshot({path:`${dir}/verified-${c.applicatorKey}-${width}.png`});
   }
  }
  await page.close();console.log('PDP width '+width+': '+rows.length+' SKUs, all three views passed');fs.writeFileSync(dir+'/browser-verification.json',JSON.stringify(report,null,2));
 }
 const page=await browser.newPage();await page.setViewport({width:1440,height:1100});
 const builderRows=rows.filter(c=>(c.glassLabel==='Clear')||(c.glassLabel==='Amber'&&c.finishLabel==='Gold')||(c.glassLabel==='Cobalt Blue'&&c.applicatorKey==='metal-roller'));
 for(const c of builderRows){
  await page.goto('http://127.0.0.1:3010/matrix?family=Cylinder&sku='+c.websiteSku,{waitUntil:'domcontentloaded',timeout:90000});
  const asset=model.assets[c.applicatorKey==='lotion-pump'?'lotion-head':c.applicatorKey==='metal-roller'?'roller-metal':'roller-plastic'].url;
  await page.waitForFunction(asset=>[...document.querySelectorAll('[data-builder-layer]')].some(e=>(e.getAttribute('href')||e.getAttribute('src')||'').endsWith(asset)),{timeout:45000},asset);
  const layers=await page.evaluate(()=>[...document.querySelectorAll('[data-builder-layer]')].map(e=>({slot:e.dataset.builderLayer,url:e.getAttribute('href')||e.getAttribute('src')})));
  report.builder.push({sku:c.websiteSku,layers});
  if(c.websiteSku==='GBCyl9MtlRollBlkDot'){await sleep(750);await page.screenshot({path:dir+'/builder-metal.png'});}
 }
 await page.goto('http://127.0.0.1:3010/reviews/cylinder9-pumps-rollers-2026-11-01/index.html',{waitUntil:'networkidle2',timeout:90000});
 await page.waitForSelector('#live');await page.screenshot({path:dir+'/review-page.png'});
 report.reviewPage={status:'loaded',title:await page.title()};console.log('Builder: '+report.builder.length+' exact-SKU selections passed');
}catch(e){report.errors.push(String(e));console.error(e);process.exitCode=1}finally{report.finished=new Date().toISOString();fs.writeFileSync(dir+'/browser-verification.json',JSON.stringify(report,null,2));await browser.close();}})();
