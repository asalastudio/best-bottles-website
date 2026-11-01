const fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'outputs/catalog-model-repair-2026-10-31/reports/production-alignment');
const route='/products/cylinder-9ml-clear-17-415-finemist?sku=GBCyl9SpryBlk';
let browser;
(async()=>{browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});const result={checkedAt:new Date().toISOString(),pages:[],localViews:[],errors:[]};
for(const [name,origin]of [['local','http://localhost:3010'],['production','https://best-bottles-website.vercel.app']]){
 const page=await browser.newPage();await page.setViewport({width:1440,height:1000});page.on('pageerror',e=>result.errors.push({name,error:e.message}));const res=await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForSelector('[data-testid="pdp-stage"] [data-slot="body"] img',{timeout:90000});await page.waitForFunction(()=>[...document.querySelectorAll('[data-testid="pdp-stage"] img')].every(i=>i.complete),{timeout:45000});
 const state=await page.evaluate(()=>({title:document.title,h1:document.querySelector('h1')?.textContent,stageSource:document.querySelector('[data-testid="pdp-stage"]')?.getAttribute('data-source'),images:[...document.querySelectorAll('[data-testid="pdp-stage"] [data-slot] img')].map(i=>{const u=new URL(i.src);return {slot:i.closest('[data-slot]').getAttribute('data-slot'),url:u.searchParams.get('url')||i.getAttribute('src'),loaded:!!i.naturalWidth}}),caps:[...document.querySelectorAll('[data-testid="pdp-cap-rail"] button')].map(b=>b.getAttribute('aria-label'))}));result.pages.push({name,status:res.status(),url:page.url(),...state});await page.screenshot({path:path.join(out,name+'-9ml.png')});
 if(name==='local'){
  const measure=()=>page.evaluate(()=>{const stage=document.querySelector('[data-testid="pdp-stage"]'),img=stage.querySelector('[data-slot="body"] img'),r=img.getBoundingClientRect();return {view:stage.getAttribute('data-view'),body:{left:r.left,top:r.top,width:r.width,height:r.height},source:img.getAttribute('src')};});
  for(const view of ['CAP ON','EXPLODED','SIDECAR']){await page.$$eval('[aria-label="View"] button',(bs,label)=>bs.find(b=>b.textContent.trim()===label)?.click(),view);await new Promise(r=>setTimeout(r,850));result.localViews.push(await measure());}
  const capCount=await page.$$eval('[data-testid="pdp-cap-rail"] button',xs=>xs.length);if(capCount>1){await page.$$eval('[data-testid="pdp-cap-rail"] button',xs=>xs[1].click());await new Promise(r=>setTimeout(r,1000));result.localViews.push({...await measure(),action:'second cap'});}
  await page.setViewport({width:390,height:844});await page.screenshot({path:path.join(out,'local-9ml-mobile.png')});result.mobileOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 }
 await page.close();
}
const [a,b]=result.pages;result.sameProduct=a.h1===b.h1;result.sameStageAssetUrls=JSON.stringify(a.images.map(x=>[x.slot,x.url]))===JSON.stringify(b.images.map(x=>[x.slot,x.url]));result.bodyStable=result.localViews.every(v=>Object.keys(v.body).every(k=>Math.abs(v.body[k]-result.localViews[0].body[k])<.5));
fs.writeFileSync(path.join(out,'browser-parity.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();if(!result.sameProduct||!result.bodyStable||result.pages.some(p=>p.status!==200||p.images.some(i=>!i.loaded)))process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(async()=>{if(browser)await browser.close()});
