const fs=require('node:fs'),puppeteer=require(process.cwd()+'/node_modules/puppeteer-core');
(async()=>{
 const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage(),events=[];
  await page.setViewport({width:390,height:844,deviceScaleFactor:2});
  page.on('framenavigated',f=>{if(f===page.mainFrame())events.push({type:'navigate',url:f.url()})});
  page.on('pageerror',e=>events.push({type:'error',message:e.message,stack:e.stack}));
  await page.goto('http://localhost:3010/products/vial-3ml-blue-13-425?cap=black',{waitUntil:'networkidle2',timeout:60000});
  await page.evaluate(()=>document.fonts.ready);
  for(const view of ['sidecar','capon','exploded']){
   const buttons=await page.$$eval('[data-testid^="pdp-view"]',es=>es.map(e=>({id:e.dataset.testid,disabled:e.disabled})));
   events.push({type:'before',view,buttons});
   await page.$eval('[data-testid="pdp-view-'+view+'"]',e=>e.click()).catch(e=>events.push({message:e.message}));
   await new Promise(r=>setTimeout(r,1200));
   events.push(await page.evaluate(()=>{const stage=document.querySelector('[data-testid="pdp-stage"]'),s=stage.getBoundingClientRect(),img=stage.querySelector('[data-slot="body"] img'),b=img.getBoundingClientRect();let el=img;const ancestors=[];while(el&&el!==stage){const r=el.getBoundingClientRect();ancestors.push({tag:el.tagName,classes:el.className,style:el.getAttribute('style'),transform:getComputedStyle(el).transform,rect:[r.x-s.x,r.y-s.y,r.width,r.height]});el=el.parentElement}return{type:'after',url:location.href,rect:[b.x-s.x,b.y-s.y,b.width,b.height],ancestors,stage:stage.outerHTML.slice(0,300),buttons:[...document.querySelectorAll('[data-testid^="pdp-view"]')].map(e=>e.dataset.testid)}}));
  }
  await page.screenshot({path:'docs/reviews/vial3-swatches-builder-2026-11-02/evidence/blue-mobile-debug.png',fullPage:true});
  fs.writeFileSync('docs/reviews/vial3-swatches-builder-2026-11-02/blue-inspection.json',JSON.stringify(events,null,2)+'\n');console.log(JSON.stringify(events));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
