const fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'outputs/catalog-model-repair-2026-10-31/reports/production-alignment');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
 const result={checkedAt:new Date().toISOString(),builder:[],gallery:{},errors:[]};
 try{
 const p=await browser.newPage();await p.setViewport({width:1440,height:1000});p.on('pageerror',e=>result.errors.push(e.message));
 await p.goto('http://localhost:3010/matrix?family=Cylinder',{waitUntil:'domcontentloaded',timeout:60000});
 await p.waitForSelector('button[aria-label="9 ml, 17-415 neck"]');await p.click('button[aria-label="9 ml, 17-415 neck"]');
 const snap=async(name)=>{await p.waitForSelector('[aria-label="Live bottle preview"] [data-builder-layer="body"]');await delay(700);result.builder.push(await p.evaluate(name=>{
 const section=document.querySelector('[aria-label="Live bottle preview"]'),el=section.querySelector('[data-builder-layer="body"]'),box=el.getBoundingClientRect(),frame=section.querySelector('[data-chooser-frame],svg[role="img"]'),fr=frame.getBoundingClientRect();
 const stageWidth=Math.min(fr.width,fr.height/1.1),stageHeight=stageWidth*1.1,left=fr.left+(fr.width-stageWidth)/2,top=fr.top+(fr.height-stageHeight)/2;
 return {name,stage:section.getAttribute('data-preview-stage'),source:el.getAttribute('src')||el.getAttribute('href'),normalized:{left:(box.left-left)/stageWidth,top:(box.top-top)/stageHeight,width:box.width/stageWidth,height:box.height/stageHeight},viewBox:frame.getAttribute('viewBox')};},name));};
 const clickText=async text=>{await p.waitForFunction(t=>[...document.querySelectorAll('[data-builder-page] button')].some(b=>!b.disabled&&b.textContent.trim()===t),{timeout:30000},text);await p.$$eval('[data-builder-page] button',(bs,t)=>bs.find(b=>!b.disabled&&b.textContent.trim()===t).click(),text);};
 await snap('bottle selected');await clickText('Choose Your Glass');await p.waitForSelector('button[aria-label="Clear"]');await p.click('button[aria-label="Clear"]');await snap('clear glass');await clickText('Choose Your Fitment');
 await p.waitForSelector('button[aria-label="Fine Mist Sprayer"]',{timeout:30000});await p.click('button[aria-label="Fine Mist Sprayer"]');await snap('sprayer selected');
 await p.$$eval('nav[aria-label="Bottle building progress"] button',bs=>bs.find(b=>b.querySelector('b')?.textContent==='Finish').click());await p.waitForSelector('section[aria-label="Bottle options"] button[aria-label="Black"]');await p.click('section[aria-label="Bottle options"] button[aria-label="Black"]');await snap('black finish');
 await clickText('Show cap');await snap('cap on');await clickText('Hide cap');await snap('cap sidecar');await p.screenshot({path:path.join(out,'builder-9ml.png')});
 const initial=result.builder[0].normalized;result.builderStable=result.builder.every(r=>Object.keys(initial).every(k=>Math.abs(r.normalized[k]-initial[k])<0.002));
 result.overcapSources=await p.$$eval('[aria-label="Live bottle preview"] [data-builder-layer="overcap"]',xs=>xs.map(x=>x.getAttribute('href')||x.getAttribute('src')));
 await p.goto('http://localhost:3010/reviews/glass-body-overview-2026-10-31/scale.html',{waitUntil:'domcontentloaded'});await p.waitForSelector('#grid .card');
 result.gallery.defaultCards=await p.$$eval('#grid .card',xs=>xs.length);await p.click('#colors');result.gallery.allColorCards=await p.$$eval('#grid .card',xs=>xs.length);
 result.gallery.failedImages=await p.$$eval('#grid img',async imgs=>{await Promise.all(imgs.map(i=>{i.loading='eager';return i.decode().catch(()=>{});}));return imgs.filter(i=>!i.naturalWidth).map(i=>i.src)});
 await p.click('#colors');await p.screenshot({path:path.join(out,'scale-review-desktop.png')});
 await p.setViewport({width:390,height:844});result.gallery.mobileOverflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);await p.screenshot({path:path.join(out,'scale-review-mobile.png')});
 await p.close();
 }finally{fs.writeFileSync(path.join(out,'builder-and-scale-browser.json'),JSON.stringify(result,null,2));await browser.close();console.log(JSON.stringify(result,null,2));}
 if(!result.builderStable||result.errors.length||result.gallery.failedImages?.length||result.gallery.mobileOverflow)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1});
