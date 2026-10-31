const fs = require('fs');
const root = '/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/.claude/worktrees/branch-setup-localhost-c1fea9';
const pp = require(root + '/node_modules/puppeteer-core');
const rows=JSON.parse(fs.readFileSync(root+'/public/local-kits/vial-4ml-measured-2026-10-31/kits.json')).rows;
const out=root+'/outputs/catalog-model-repair-2026-10-31/vial-4ml-measured/screenshots';fs.mkdirSync(out,{recursive:true});
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
   const cap=kit.parts.find(p=>p.slot==='cap'),capImg=stage.querySelector('[data-slot="cap"] img');
   function visibleBounds(image,part){const r=image.getBoundingClientRect(),b=part.bounds,x=part.box;return {left:r.left+(b.left-x.x)/x.width*r.width,right:r.left+(b.right-x.x)/x.width*r.width,top:r.top+(b.top-x.y)/x.height*r.height,bottom:r.top+(b.bottom-x.y)/x.height*r.height}}
   const bodyBounds=visibleBounds(img,part),capBounds=capImg?visibleBounds(capImg,cap):null;
   const clipping=capBounds?[bodyBounds,capBounds].some(b=>b.left<canvas.left-1||b.right>canvas.right+1||b.top<canvas.top-1||b.bottom>canvas.bottom+1):true;
   const centerError=capBounds?Math.abs((capBounds.left+capBounds.right-bodyBounds.left-bodyBounds.right)/2):999;
   const seatError=capBounds?Math.abs(capBounds.bottom-(bodyBounds.top+(bodyBounds.bottom-bodyBounds.top)*7/44.98)):999;
   const sidecarBaselineError=capBounds?Math.abs(capBounds.bottom-bodyBounds.bottom):999;
   const capMatches=!!capImg&&capImg.currentSrc.includes(cap.image.sha256);
   const baseline=stage.querySelector('[data-testid="pdp-glass-baseline"]');
   return {url:location.href,view:stage.dataset.view,bodyBounds,capBounds,clipping,centerError,seatError,sidecarBaselineError,capMatches,bodyAspect:(bodyBounds.right-bodyBounds.left)/(bodyBounds.bottom-bodyBounds.top),glassHeightPct:(foot-top)/canvas.height*100,glassFootPct:(foot-canvas.top)/canvas.height*100,baselinePct:baseline?(baseline.getBoundingClientRect().top-canvas.top)/canvas.height*100:null,canvas:{x:canvas.x,y:canvas.y,width:canvas.width,height:canvas.height},imageLoaded:img.complete&&img.naturalWidth>0,allImagesLoaded:[...stage.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0),overflow:document.documentElement.scrollWidth>innerWidth,generated:img.currentSrc.includes(part.image.sha256),frame:wrapper.parentElement.style.transform,previewFlag:new URL(location.href).searchParams.has('assetPreview')};
  },rows[sku]);
  if(Math.abs(result.glassHeightPct-51.74)>.04||Math.abs(result.glassFootPct-91)>.04||Math.abs(result.baselinePct-91)>.04||result.overflow||!result.generated||!result.allImagesLoaded||result.previewFlag||result.clipping||!result.capMatches||Math.abs(result.bodyAspect-14.6/44.98)>.001||(result.view==='capon'&&(result.centerError>1||result.seatError>1))||(result.view==='sidecar'&&result.sidecarBaselineError>1)||(result.view==='exploded'&&result.centerError>1))throw Error(name+': '+JSON.stringify(result));
  checks.push({name,...result});await page.screenshot({path:out+'/'+name+'.png'});
 };
 try{
 const skus={clear:['GBV1DrmBlackCapSht','GBV1DrmWhtCapSht'],amber:['GBVAmb1DrmBlackCapSht','GBVAmb1DrmWhtCapSht'],blue:['GBVBlu1DrmBlackCapSht','GBVBlu1DrmWhtCapSht'],green:['GBVGr1DrmBlackCapSht','GBVGr1DrmWhtCapSht']};
 const colors=Object.keys(skus).filter(c=>rows[skus[c][0]]),skuOf=(color,cap)=>skus[color][cap==='black'?0:1];
 for(const size of ['desktop','mobile']) {
  await page.setViewport(size==='desktop'?{width:1440,height:1050}:{width:390,height:844});
  for(const color of colors) {
   await page.goto('http://localhost:3010/products/vial-4ml-'+color+'-13-425?cap=black',{waitUntil:'networkidle2',timeout:60000});
   await page.waitForSelector('[data-cap-id="white"]');
   for(const cap of ['black','white']) {
    await page.click('[data-cap-id="'+cap+'"]');
    for(const view of ['sidecar','capon','exploded']) {await page.click('[data-testid="pdp-view-'+view+'"]');await check(size+'-'+color+'-'+cap+'-'+view,skuOf(color,cap));}
   }
   const images=await page.evaluate(()=>({lineup:[...document.querySelectorAll('[data-testid="pdp-glass-lineup"] button')].map(b=>({name:b.textContent.trim(),images:[...b.querySelectorAll('img')].map(i=>i.currentSrc||i.src)})),build:[...document.querySelectorAll('[data-testid="pdp-build-strip"] img')].map(i=>i.currentSrc||i.src)}));
   for(const c of colors) {const hash=rows[skuOf(c,'black')].parts.find(p=>p.slot==='body').image.sha256;if(!images.lineup.some(i=>i.images.some(u=>u.includes(hash))))throw Error('Old '+c+' lineup on '+color);}
   const bodyHash=rows[skuOf(color,'black')].parts.find(p=>p.slot==='body').image.sha256;if(images.build.filter(u=>u.includes(bodyHash)).length!==2)throw Error('Old build strip '+color);
   checks.push({name:size+'-'+color+'-thumbnails',passed:true,...images});
  }
 }
 for(const color of colors){await page.goto('http://localhost:3010/products/vial-4ml-'+color+'-13-425?cap=clear',{waitUntil:'networkidle2'});const selected=await page.evaluate(()=>document.querySelector('[data-cap-id][aria-pressed="true"]')?.dataset.capId);await check('legacy-query-'+color,skuOf(color,selected||'black'));await page.reload({waitUntil:'networkidle2'});await check('reload-'+color,skuOf(color,selected||'black'));}
 fs.writeFileSync(out+'/browser-checks.json',JSON.stringify(checks,null,2));console.log(JSON.stringify({passed:checks.length,names:checks.map(c=>c.name)}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
