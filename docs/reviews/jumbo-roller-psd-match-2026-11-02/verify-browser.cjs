const fs=require('node:fs'),assert=require('node:assert/strict');
const puppeteer=require(process.cwd()+'/node_modules/puppeteer-core');
const dir='docs/reviews/jumbo-roller-psd-match-2026-11-02';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const entries=read('docs/reviews/cylinder-family-completion-2026-11-02/review-data.json').filter(e=>e.neck==='16mm');
const kits=read('public/local-kits/cylinder-family-completion-2026-11-02/kits.json').rows;
const sources=read('src/lib/products/review-display-images.generated.json').sources;
const report={scope:'Original PSD balls on local 28/50 ml 16 mm PDPs',states:[],errors:[]};
const save=()=>fs.writeFileSync(dir+'/browser-verification.json',JSON.stringify(report,null,2)+'\n');
fs.mkdirSync(dir+'/evidence',{recursive:true});
(async()=>{
 const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();page.on('pageerror',e=>report.errors.push({kind:'page',message:e.message}));
  for(const viewport of ['desktop','mobile']){
   await page.setViewport(viewport==='desktop'?{width:1440,height:1100,deviceScaleFactor:1}:{width:390,height:844,deviceScaleFactor:2});
   for(const e of entries){
    try{
     const response=await page.goto('http://localhost:3010'+e.product,{waitUntil:'domcontentloaded',timeout:60000});assert.equal(response.status(),200);
     const expected=kits[e.sku].parts.find(p=>p.slot==='roller').image.url;assert(expected.includes('native-psd'));
     const allowed=[expected,...Object.values(sources[expected]||{})];
     await page.waitForFunction(urls=>{const img=document.querySelector('[data-testid="pdp-stage"] [data-slot="roller"] img');if(!img)return false;const u=new URL(img.src);return urls.includes(u.searchParams.get('url')||u.pathname)},{timeout:30000},allowed);
     let baseline;
     for(const view of e.views){
      const b=await page.$('[data-testid="pdp-view-'+view+'"]');assert(b);await b.evaluate(n=>n.click());
      await page.waitForFunction(v=>document.querySelector('[data-testid="pdp-stage"]').dataset.view===v,{timeout:15000},view);
      await page.evaluate(async()=>{const s=document.querySelector('[data-testid="pdp-stage"]');await Promise.all([...s.querySelectorAll('img')].map(i=>i.decode()));await Promise.all(s.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))});
      await new Promise(r=>setTimeout(r,80));
      const state=await page.evaluate(()=>{const s=document.querySelector('[data-testid="pdp-stage"]'),b=s.getBoundingClientRect();return{overflow:document.documentElement.scrollWidth>innerWidth+1,parts:[...s.querySelectorAll('[data-slot]')].map(p=>{const i=p.querySelector('img'),r=i.getBoundingClientRect();return{slot:p.dataset.slot,source:i.currentSrc,rect:[r.x-b.x,r.y-b.y,r.width,r.height]}})}});
      assert.equal(state.overflow,false);const body=state.parts.find(p=>p.slot==='body');assert(body);
      if(baseline)body.rect.forEach((n,i)=>assert(Math.abs(n-baseline[i])<.3,'Bottle moved across views'));baseline=body.rect;
      await(await page.$('[data-testid="pdp-stage"]')).screenshot({path:dir+'/evidence/'+viewport+'-'+e.sku+'-'+view+'.png'});
      report.states.push({sku:e.sku,viewport,view,...state});save();
     }
    }catch(error){report.errors.push({sku:e.sku,viewport,message:error.message});save();}
   }
  }
  await page.setViewport({width:1440,height:1100,deviceScaleFactor:1});
  await page.goto('http://localhost:3010/reviews/jumbo-roller-psd-match-2026-11-02/index.html',{waitUntil:'networkidle2',timeout:60000});
  await page.screenshot({path:dir+'/evidence/psd-comparison.png',fullPage:true});
  assert.equal(report.errors.length,0,JSON.stringify(report.errors));assert.equal(report.states.length,48);report.passed=true;save();
  console.log(JSON.stringify({passed:true,states:report.states.length,errors:report.errors.length}));
 }finally{await browser.close();}
})().catch(error=>{report.errors.push({kind:'run',message:error.message});save();console.error(error.message.slice(0,1800));process.exitCode=1;});
