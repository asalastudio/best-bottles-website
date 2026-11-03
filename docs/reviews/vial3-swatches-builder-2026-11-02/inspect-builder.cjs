const fs=require('node:fs');
const puppeteer=require(process.cwd()+'/node_modules/puppeteer-core');
(async()=>{
 const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage(),errors=[];
  await page.setViewport({width:1440,height:1100});
  page.on('pageerror',e=>errors.push(e.message));
  let status;try{status=(await page.goto('http://localhost:3010/matrix?family=Vial&shop=sample-vials&sku=GBVGreen2o4BlackCapSht&from=pdp',{waitUntil:'domcontentloaded',timeout:45000})).status()}catch(e){errors.push(e.message)}
  await page.waitForSelector('[data-builder-page]',{timeout:15000}).catch(e=>errors.push(e.message));
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-builder-layer="body"]')].some(e=>(e.src||e.getAttribute('href')||'').includes('vial3-swatches-builder')),{timeout:30000}).catch(e=>errors.push(e.message));
  const state=await page.evaluate(()=>({url:location.href,text:document.body.innerText.slice(-13000),layers:[...document.querySelectorAll('[data-builder-layer]')].map(e=>({layer:e.dataset.builderLayer,tag:e.tagName,src:e.src||e.getAttribute('href')})),images:[...document.images].filter(i=>i.src.includes('vial3')).map(i=>({src:i.currentSrc,complete:i.complete,width:i.naturalWidth}))}));
  await page.screenshot({path:'docs/reviews/vial3-swatches-builder-2026-11-02/evidence/builder-first.png',fullPage:true});
  fs.writeFileSync('docs/reviews/vial3-swatches-builder-2026-11-02/builder-inspection.json',JSON.stringify({status,errors,...state},null,2)+'\n');
  console.log(JSON.stringify({status,errors,text:state.text.slice(-7000),layers:state.layers,images:state.images}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
