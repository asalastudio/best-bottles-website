const fs=require('node:fs'),assert=require('node:assert/strict'),P=require(process.cwd()+'/node_modules/puppeteer-core');
const dir='docs/reviews/cylinder25-material-cleanup-2026-11-02';
const kits=JSON.parse(fs.readFileSync('public/local-kits/cylinder25-material-cleanup-2026-11-02/kits.json')).rows;
const data=JSON.parse(fs.readFileSync(dir+'/review-data.json'));
const selected=new Set(['LBCyl25LtnCu','LBCyl25LtnMtGl','LBCyl25LtnShnSl','LBcyl25LtnClOvrCap','LBCyl25LtnMtSl','LBCyl25LtnShnBlk','LBCyl25LtnShnGl','GBcyl25SpryCu','GBcyl25SpryMtGl','GBCyl25DrpGl']);
const cases=data.filter(e=>selected.has(e.sku));
const report={states:[],builderApis:[],errors:[]};fs.mkdirSync(dir+'/evidence',{recursive:true});const save=()=>fs.writeFileSync(dir+'/browser-verification.json',JSON.stringify(report,null,2));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await P.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});try{
 const p=await b.newPage();p.on('pageerror',e=>report.errors.push({kind:'browser',message:e.message}));
 for(const viewport of ['desktop','mobile']){
  await p.setViewport(viewport==='desktop'?{width:1440,height:1100,deviceScaleFactor:1}:{width:390,height:844,deviceScaleFactor:2});
  for(const entry of cases){try{
   const res=await p.goto('http://localhost:3010'+entry.product,{waitUntil:'domcontentloaded',timeout:45000});assert.equal(res.status(),200);
   const expected=kits[entry.sku].parts.find(p=>p.slot==='body').image.url;
   await p.waitForFunction(src=>{const img=document.querySelector('[data-testid="pdp-stage"] [data-slot="body"] img');if(!img)return false;const u=new URL(img.src);return(u.searchParams.get('url')||u.pathname)===src;},{timeout:15000},expected);
   let first;
   for(const view of entry.views){
    const button=await p.$('[data-testid="pdp-view-'+view+'"]');if(button)await button.evaluate(e=>e.click());
    await p.waitForFunction(v=>document.querySelector('[data-testid="pdp-stage"]').dataset.view===v,{timeout:15000},view);
    await p.evaluate(async()=>{const stage=document.querySelector('[data-testid="pdp-stage"]');await Promise.all([...stage.querySelectorAll('img')].map(i=>i.decode()));await Promise.all(stage.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});await sleep(60);
    const state=await p.evaluate(()=>{const stage=document.querySelector('[data-testid="pdp-stage"]'),s=stage.getBoundingClientRect();return{overflow:document.documentElement.scrollWidth>innerWidth+1,parts:[...stage.querySelectorAll('[data-slot]')].map(e=>{const img=e.querySelector('img'),r=img.getBoundingClientRect();return{slot:e.dataset.slot,source:img.getAttribute('src'),rect:[r.x-s.x,r.y-s.y,r.width,r.height]}})}});
    assert.equal(state.overflow,false);const body=state.parts.find(p=>p.slot==='body');if(first)body.rect.forEach((v,i)=>assert(Math.abs(v-first[i])<0.3,'body moved between views'));first=body.rect;
    if(entry.sku.endsWith('Cu'))assert(state.parts.some(p=>p.slot==='overcap'&&(p.source.includes('e8eb5bb9035ca88d')||p.source.includes(encodeURIComponent('e8eb5bb9035ca88d')))),'old copper cap');
    if(view==='sidecar'||['LBCyl25LtnCu','LBCyl25LtnMtGl'].includes(entry.sku))await(await p.$('[data-testid="pdp-stage"]')).screenshot({path:dir+'/evidence/'+viewport+'-'+entry.sku+'-'+view+'.png'});
    report.states.push({sku:entry.sku,viewport,view,...state});save();
   }
  }catch(e){report.errors.push({sku:entry.sku,viewport,message:e.message});save();}}
 }
 const api=await p.evaluate(async()=>{const r=await fetch('/api/bottle-builder/kits?'+new URLSearchParams({family:'Cylinder',bodyId:'cylinder-25ml|18-415|Glass Bottle',assetPreview:'gpt13'}));return r.json()});
 for(const entry of cases){const k=api.kits[entry.sku];assert(k,'Builder missing '+entry.sku);assert.equal(k.parts.find(p=>p.slot==='body').image.url,kits[entry.sku].parts.find(p=>p.slot==='body').image.url);report.builderApis.push({sku:entry.sku,sameCandidateBody:true});}save();
 await p.setViewport({width:1440,height:1100});await p.goto('http://localhost:3010/reviews/cylinder25-material-cleanup-2026-11-02/index.html',{waitUntil:'networkidle2',timeout:45000});await p.screenshot({path:dir+'/evidence/desktop-comparison.png',fullPage:true});
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));report.passed=true;save();console.log(JSON.stringify({states:report.states.length,builderApis:report.builderApis.length,errors:report.errors.length}));
 }finally{await b.close();}})().catch(e=>{report.errors.push({kind:'run',message:e.message});save();console.error(e.message.slice(0,1500));process.exitCode=1});
