const fs = require('fs');
const root = '/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/.claude/worktrees/branch-setup-localhost-c1fea9';
const pp = require(root + '/node_modules/puppeteer-core');
const rows=JSON.parse(fs.readFileSync(root+'/public/local-kits/vial-2ml-source-2026-10-31/kits.json')).rows;
const out=root+'/outputs/catalog-model-repair-2026-10-31/vial-four-colors/amber-sunburst';
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
   return {url:location.href,view:stage.dataset.view,glassHeightPct:(foot-top)/canvas.height*100,glassFootPct:(foot-canvas.top)/canvas.height*100,baselinePct:baseline?(baseline.getBoundingClientRect().top-canvas.top)/canvas.height*100:null,canvas:{x:canvas.x,y:canvas.y,width:canvas.width,height:canvas.height},imageLoaded:img.complete&&img.naturalWidth>0,allImagesLoaded:[...stage.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0),overflow:document.documentElement.scrollWidth>innerWidth,generated:img.currentSrc.includes(part.image.sha256),frame:wrapper.parentElement.style.transform,previewFlag:new URL(location.href).searchParams.has('assetPreview')};
  },rows[sku]);
  if(Math.abs(result.glassHeightPct-40.24)>.04||Math.abs(result.glassFootPct-91)>.04||Math.abs(result.baselinePct-91)>.04||result.overflow||!result.generated||!result.allImagesLoaded||result.previewFlag)throw Error(name+': '+JSON.stringify(result));
  checks.push({name,...result});await page.screenshot({path:out+'/'+name+'.png'});
 };
 try{
 const skuOf=(color,cap)=>color==='amber'?(cap==='black'?'GBVAmb2BlackCap':'GBVAmb2WhtCap'):(cap==='black'?'GBVialClr2mlBlackCap':'GBVialClr2mlWhtCap');
 for(const size of ['desktop','mobile']) {
  await page.setViewport(size==='desktop'?{width:1440,height:1050}:{width:390,height:844});
  for(const color of ['clear','amber']) {
   await page.goto('http://localhost:3010/products/vial-2ml-'+color+'-8-425?cap=black',{waitUntil:'networkidle2',timeout:60000});
   await page.waitForSelector('[data-cap-id="white"]');
   for(const cap of ['black','white']) {
    await page.click('[data-cap-id="'+cap+'"]');
    for(const view of ['sidecar','capon','exploded']) {await page.click('[data-testid="pdp-view-'+view+'"]');await check(size+'-'+color+'-'+cap+'-'+view,skuOf(color,cap));}
   }
   const images=await page.evaluate(()=>({lineup:[...document.querySelectorAll('[data-testid="pdp-glass-lineup"] button')].map(b=>({name:b.textContent.trim(),images:[...b.querySelectorAll('img')].map(i=>i.currentSrc||i.src)})),build:[...document.querySelectorAll('[data-testid="pdp-build-strip"] img')].map(i=>i.currentSrc||i.src)}));
   for(const c of ['clear','amber']) {const hash=rows[skuOf(c,'black')].parts.find(p=>p.slot==='body').image.sha256;if(!images.lineup.find(i=>i.name.toLowerCase()===c)?.images.some(u=>u.includes(hash)))throw Error('Old '+c+' lineup on '+color);}
   const bodyHash=rows[skuOf(color,'black')].parts.find(p=>p.slot==='body').image.sha256;if(images.build.filter(u=>u.includes(bodyHash)).length!==2)throw Error('Old build strip '+color);
   checks.push({name:size+'-'+color+'-thumbnails',passed:true,...images});
  }
 }
 await page.goto('http://localhost:3010/products/vial-2ml-amber-8-425?cap=clear',{waitUntil:'networkidle2'});await check('legacy-clear-query','GBVAmb2BlackCap');
 await page.reload({waitUntil:'networkidle2'});await check('amber-reload','GBVAmb2BlackCap');
 await page.evaluate(()=>[...document.querySelectorAll('[data-testid="pdp-glass-lineup"] button')].find(b=>b.textContent.trim()==='Clear').click());
 await page.waitForFunction(()=>location.pathname.includes('vial-2ml-clear'));
 await page.waitForFunction(()=>document.querySelector('[data-testid="pdp-stage"] [data-slot="body"] img')?.src.includes('32f2956f'));
 await check('switch-to-clear','GBVialClr2mlBlackCap');
 await page.evaluate(()=>[...document.querySelectorAll('[data-testid="pdp-glass-lineup"] button')].find(b=>b.textContent.trim()==='Amber').click());
 await page.waitForFunction(()=>location.pathname.includes('vial-2ml-amber'));
 await page.waitForFunction(()=>document.querySelector('[data-testid="pdp-stage"] [data-slot="body"] img')?.src.includes('32e5dfca'));
 await check('switch-to-amber','GBVAmb2BlackCap');
 fs.writeFileSync(out+'/browser-checks.json',JSON.stringify(checks,null,2));console.log(JSON.stringify({passed:checks.length,names:checks.map(c=>c.name)}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
