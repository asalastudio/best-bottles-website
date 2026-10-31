const fs=require('fs'),path=require('path'),assert=require('assert/strict'),p=require('puppeteer-core');
const out=path.resolve(__dirname,'..'), base='http://localhost:3010';
(async()=>{
 const {rows}=JSON.parse(fs.readFileSync('public/local-kits/cylinder5-profiles-2026-10-31/kits.json'));
 const query='?family=Cylinder&bodyId='+encodeURIComponent('cylinder-5ml|13-415|Glass Bottle');
 const {configurations}=await(await fetch(base+'/api/bottle-builder/bodies'+query)).json();
 const {kits}=await(await fetch(base+'/api/bottle-builder/kits'+query)).json();
 const report={configurations:[],browser:[],errors:[]};
 for(const [sku,kit] of Object.entries(rows)){
  const config=configurations.find(c=>c.id===sku);assert(config,sku+' missing from builder');
  const expected=kit.parts.find(p=>p.slot==='body').image;
  const actual=kits[sku]?.parts.find(p=>p.slot==='body').image;
  assert.equal(actual?.url,expected.url,sku+' wrong body');assert.equal(actual?.sha256,expected.sha256,sku+' wrong hash');
  report.configurations.push({sku,color:config.color,fitment:config.fitment,closure:config.closure,body:actual.url,match:true});
 }
 const browser=await p.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();await page.setViewport({width:1440,height:1100});page.on('pageerror',e=>report.errors.push(e.message));
  for(const glass of ['clear','cobalt-blue'])for(const type of ['cap','finemist','rollon']){
   const url=base+`/products/cylinder-5ml-${glass}-13-415${type==='cap'?'':'-'+type}?cap=black`;
   await page.goto(url,{waitUntil:'networkidle2',timeout:60000});await page.waitForSelector('[data-testid="pdp-build-cta"]');
   const href=await page.$eval('[data-testid="pdp-build-cta"]',e=>e.getAttribute('href'));
   const sku=new URL(href,base).searchParams.get('sku'),config=configurations.find(c=>c.id===sku);assert(config,'No exact handoff config');
   const body=await page.$eval('[data-testid="pdp-stage"] [data-slot="body"] img',e=>e.getAttribute('src'));assert(body.includes('measured-v19'));
   await page.$eval('[data-testid="pdp-build-cta"]',e=>e.click());
   await page.waitForSelector('[aria-label="Live bottle preview"]',{timeout:60000});
   await page.waitForFunction(()=>[...document.querySelectorAll('[aria-label="Live bottle preview"] img, [aria-label="Live bottle preview"] svg image')].some(e=>(e.getAttribute('src')||e.getAttribute('href'))?.includes('measured-v19')),{timeout:60000});
   await new Promise(r=>setTimeout(r,900));
   const result=await page.evaluate(async()=>({url:location.href,summary:document.querySelector('[aria-label="Your Build"]')?.innerText,stage:document.querySelector('[aria-label="Live bottle preview"]')?.getAttribute('data-preview-stage'),images:await Promise.all([...document.querySelectorAll('[aria-label="Live bottle preview"] img, [aria-label="Live bottle preview"] svg image')].map(async e=>{const src=e.getAttribute('src')||e.getAttribute('href'),img=new Image();img.src=src;await img.decode().catch(()=>{});return {src,loaded:!!img.naturalWidth};})),selected:[...document.querySelectorAll('button[aria-pressed="true"]')].map(e=>e.getAttribute('aria-label')||e.innerText)}));
   assert.equal(new URL(result.url).searchParams.get('sku'),sku);assert(result.summary.includes(config.color));assert(result.summary.includes(config.closure));assert.equal(result.stage,'complete');assert(result.images.every(i=>i.loaded));assert(result.images.some(i=>decodeURIComponent(i.src).includes(kits[sku].parts.find(p=>p.slot==='body').image.url)));
   await page.screenshot({path:out+`/approved-handoff-${glass}-${type}.png`});report.browser.push({glass,type,sku,href,...result,passed:true});console.log('PASS',glass,type,sku);
  }
  assert.equal(report.configurations.length,71);assert.equal(report.errors.length,0);report.passed=true;
 }finally{fs.writeFileSync(out+'/five-approved-handoff-checks.json',JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
