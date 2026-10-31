const fs = require('fs');
const root = '/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/.claude/worktrees/branch-setup-localhost-c1fea9';
const pp = require(root + '/node_modules/puppeteer-core');
const rows=JSON.parse(fs.readFileSync(root+'/public/local-kits/vial-2ml-source-2026-10-31/kits.json')).rows;
const out=root+'/docs/reviews/vial-2ml-source-correction-2026-10-31/sizing';
(async()=>{
 const browser=await pp.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage();const checks=[];
 const check=async(name,sku)=>{
  await page.waitForFunction(()=>{const i=document.querySelector('[data-testid="pdp-stage"] [data-slot="body"] img');return i&&i.complete&&i.naturalWidth>0;});
  await new Promise(r=>setTimeout(r,800));
  const result=await page.evaluate(kit=>{
   const stage=document.querySelector('[data-testid="pdp-stage"]');
   const wrapper=stage.querySelector('[data-slot="body"]');
   const img=wrapper.querySelector('img');
   const canvas=wrapper.parentElement.parentElement.getBoundingClientRect();
   const rect=img.getBoundingClientRect();const part=kit.parts.find(p=>p.slot==='body');const b=part.bounds;const box=part.box;
   const top=rect.top+(b.top-box.y)/box.height*rect.height;
   const foot=rect.top+(b.bottom-box.y)/box.height*rect.height;
   const baseline=stage.querySelector('[data-testid="pdp-glass-baseline"]');
   return {url:location.href,view:stage.dataset.view,glassHeightPct:(foot-top)/canvas.height*100,glassFootPct:(foot-canvas.top)/canvas.height*100,baselinePct:baseline?(baseline.getBoundingClientRect().top-canvas.top)/canvas.height*100:null,canvas:{x:canvas.x,y:canvas.y,width:canvas.width,height:canvas.height},imageLoaded:img.complete&&img.naturalWidth>0,allImagesLoaded:[...stage.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0),overflow:document.documentElement.scrollWidth>innerWidth,generated:img.currentSrc.includes('f769786d251fa57fa592825f790db1c62d9f3c75d8031647313bd15a9ee591d8'),frame:wrapper.parentElement.style.transform,previewFlag:new URL(location.href).searchParams.has('assetPreview')};
  },rows[sku]);
  if(Math.abs(result.glassHeightPct-40.24)>.04||Math.abs(result.glassFootPct-91)>.04||Math.abs(result.baselinePct-91)>.04||result.overflow||!result.generated||!result.allImagesLoaded||result.previewFlag)throw Error(name+': '+JSON.stringify(result));
  checks.push({name,...result});await page.screenshot({path:out+'/'+name+'.png'});
 };
 try{
  await page.setViewport({width:1440,height:1050});
  await page.goto('http://localhost:3010/products/vial-2ml-clear-8-425?cap=white',{waitUntil:'networkidle2',timeout:60000});
  for(const cap of ['white','black']){
   await page.click('[data-cap-id="'+cap+'"]');
   const sku=cap==='white'?'GBVialClr2mlWhtCap':'GBVialClr2mlBlackCap';
   for(const view of ['sidecar','capon','exploded']){await page.click('[data-testid="pdp-view-'+view+'"]');await check('desktop-'+cap+'-'+view,sku);}
  }
  await page.goto('http://localhost:3010/products/vial-2ml-clear-8-425?cap=white',{waitUntil:'networkidle2'});
  await page.reload({waitUntil:'networkidle2'});await check('desktop-white-reload','GBVialClr2mlWhtCap');
  await page.setViewport({width:390,height:844});await page.reload({waitUntil:'networkidle2'});
  for(const view of ['sidecar','capon','exploded']){await page.click('[data-testid="pdp-view-'+view+'"]');await check('mobile-white-'+view,'GBVialClr2mlWhtCap');}
  await page.goto('http://localhost:3010/products/vial-2ml-amber-8-425',{waitUntil:'networkidle2'});
  const amber=await page.evaluate(()=>({override:!!document.querySelector('[data-testid="pdp-glass-baseline"]'),generated:[...document.querySelectorAll('[data-testid="pdp-stage"] img')].some(i=>i.src.includes('f769786d'))}));
  if(amber.override||amber.generated)throw Error('Clear sizing leaked to amber '+JSON.stringify(amber));
  checks.push({name:'amber-unchanged',...amber});
  fs.writeFileSync(out+'/browser-checks.json',JSON.stringify(checks,null,2));
  console.log(JSON.stringify({passed:checks.length,checks:checks.map(c=>({name:c.name,height:c.glassHeightPct,foot:c.glassFootPct}))}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
