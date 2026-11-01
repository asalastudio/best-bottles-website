const fs=require('fs'),p=require('puppeteer-core');
const dir='docs/reviews/cylinder9-color-set-2026-11-01',index=JSON.parse(fs.readFileSync(dir+'/canonical-library.json')),model=JSON.parse(fs.readFileSync(dir+'/model.json')),base='http://127.0.0.1:3010';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await p.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']}),checks=[],errors=[];try{
 for(const width of [1440,390]){const page=await b.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.setViewport({width,height:1100});
 for(const glass of model.glasses){const configs=model.configurations.filter(c=>c.glassKey===glass.key);let reference;
 await page.goto(base+'/products/'+configs[0].productGroupSlug+'?sku='+configs[0].websiteSku,{waitUntil:'networkidle2',timeout:90000});await page.waitForSelector('[data-slot="body"] img');
 for(const c of configs){const collar=index.assets['collar-'+c.finishKey].url;
 await page.click('button[aria-label="'+c.finishLabel+' cap"]');
 await page.waitForFunction(u=>[...document.querySelectorAll('[data-testid="pdp-stage"] [data-slot="collar"] img')].some(i=>decodeURIComponent(i.src).includes(u)),{timeout:20000},collar);
 for(const [view,label] of [['sidecar','SIDECAR'],['capon','CAP ON'],['exploded','EXPLODED']]){
 await page.evaluate(label=>[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===label)?.click(),label);
 await page.waitForFunction(v=>document.querySelector('[data-testid="pdp-stage"]')?.dataset.view===v,{},view);
 await page.evaluate(()=>Promise.all([...document.querySelectorAll('[data-testid="pdp-stage"] img')].map(i=>i.decode())));await pause(280);
 const check=await page.evaluate(()=>{const s=document.querySelector('[data-testid="pdp-stage"]'),r=s.getBoundingClientRect(),body=s.querySelector('[data-slot="body"] img'),b=body.getBoundingClientRect();return{url:decodeURIComponent(body.src),body:{x:b.x,y:b.y,width:b.width,height:b.height},parts:[...s.querySelectorAll('[data-slot] img')].map(i=>{const a=i.getBoundingClientRect();return{slot:i.parentElement.dataset.slot,url:decodeURIComponent(i.src),loaded:i.complete&&i.naturalWidth>0,inside:a.left>=r.left-.5&&a.right<=r.right+.5&&a.top>=r.top-.5&&a.bottom<=r.bottom+.5}}),overflow:document.documentElement.scrollWidth>innerWidth}});
 if(!reference)reference=check.body;check.stable=Object.keys(reference).every(k=>Math.abs(reference[k]-check.body[k])<.15);
 const expected=index.assets['body-'+glass.key].url;check.correctMaster=check.url.includes(expected);check.correctInternals=check.parts.some(p=>p.slot==='diptube')===(view==='exploded'||glass.key==='clear');
 checks.push({sku:c.websiteSku,width,view,...check});
 if(c.finishKey==='gold'&&view==='sidecar')await(await page.$('[data-testid="pdp-stage"]')).screenshot({path:dir+'/actual-'+glass.key+'-'+width+'.png'});
 if(c.finishKey==='red'&&glass.key==='clear'&&view==='exploded')await(await page.$('[data-testid="pdp-stage"]')).screenshot({path:dir+'/actual-clear-exploded-'+width+'.png'});
 }
 }console.log(JSON.stringify({width,glass:glass.key,states:checks.length}));}
 await page.close();}
 const failed=checks.filter(c=>!c.stable||!c.correctMaster||!c.correctInternals||c.overflow||c.parts.some(p=>!p.loaded||!p.inside));const report={passed:!failed.length&&!errors.length,scope:'Actual PDP: 30 fine-mist SKUs x 3 states x 2 viewport sizes, without image overrides',checks,errors,failureCount:failed.length};
 fs.writeFileSync(dir+'/actual-pdp-checks.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,states:checks.length,errors,failures:failed.slice(0,3)}));if(!report.passed)process.exitCode=1;
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
