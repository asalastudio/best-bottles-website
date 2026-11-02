const fs=require('node:fs'),assert=require('node:assert/strict');
const puppeteer=require(process.cwd()+'/node_modules/puppeteer-core');
const dir='docs/reviews/jumbo28-archive-geometry-2026-11-02';
const rows=JSON.parse(fs.readFileSync('public/local-kits/jumbo28-archive-geometry-2026-11-02/kits.json')).rows;
const report={states:[],passed:false};
(async()=>{
 const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();
  for(const viewport of ['desktop','mobile']){
   await page.setViewport(viewport==='desktop'?{width:1440,height:1100}:{width:390,height:844,deviceScaleFactor:2});
   await page.goto('http://localhost:3010/products/cylinder-28ml-clear-16mm-rollon?roller=metal&cap=black',{waitUntil:'networkidle2',timeout:60000});
   for(const cap of ['black','white'])for(const roller of ['metal','plastic']){
    const sku=cap==='black'?(roller==='metal'?'GBMtlRoll28Blk':'GBRoll28Blk'):(roller==='metal'?'GBMtlRoll28Wht':'GBCyl1ozRollWht');
    await page.$eval('[data-cap-id="'+cap+'"]',e=>e.click());
    await page.$eval('[data-roller="'+roller+'"]',e=>e.click());
    await page.waitForFunction(s=>document.querySelector('[data-testid="pdp-item-name"]')?.textContent.trim()===s,{timeout:15000},sku);
    await page.evaluate(async()=>{const stage=document.querySelector('[data-testid="pdp-stage"]');await Promise.all([...stage.querySelectorAll('img')].map(i=>i.decode()));await Promise.all(stage.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))});
    const state=await page.evaluate(()=>({sku:document.querySelector('[data-testid="pdp-item-name"]').textContent.trim(),body:document.querySelector('[data-testid="pdp-stage"] [data-slot="body"] img').currentSrc,
     selectedRoller:document.querySelector('[data-testid="pdp-roller-toggle"] [aria-pressed="true"]').dataset.roller,
     selectedCap:document.querySelector('[data-testid="pdp-cap-rail"] [aria-pressed="true"]').dataset.capId,
     thumbnails:[...document.querySelectorAll('[data-testid="pdp-roller-toggle"] img')].map(i=>({src:i.currentSrc||i.src,width:i.naturalWidth})),overflow:document.documentElement.scrollWidth>innerWidth+1}));
    assert.equal(state.sku,sku);assert.equal(state.selectedRoller,roller);assert.equal(state.selectedCap,cap);assert.equal(state.overflow,false);
    assert(state.body.includes(rows[sku].parts.find(p=>p.slot==='body').image.sha256.slice(0,12)));assert.equal(state.thumbnails.length,2);
    assert(state.thumbnails.every(t=>t.src.includes('/display/')&&t.src.includes('/128.')));
    report.states.push({viewport,cap,roller,...state});
   }
  }
  report.passed=true;fs.writeFileSync(dir+'/control-verification.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,selections:report.states.length}));
 }finally{await browser.close()}
})().catch(e=>{report.error=e.message;fs.writeFileSync(dir+'/control-verification.json',JSON.stringify(report,null,2)+'\n');console.error(e.message);process.exitCode=1});
