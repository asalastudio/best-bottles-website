const fs=require('fs');
const root='/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/.claude/worktrees/branch-setup-localhost-c1fea9';
const pp=require(root+'/node_modules/puppeteer-core');
(async()=>{
 const b=await pp.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const p=await b.newPage();const results=[]; await p.setViewport({width:1440,height:1050});
 const dir=root+'/docs/reviews/vial-2ml-source-correction-2026-10-31/image-generation/body';
 for(const cap of ['white','black']){
  await p.goto('http://localhost:3010/products/vial-2ml-clear-8-425?cap='+cap+'&assetPreview=kits',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForFunction(()=>[...document.images].some(i=>decodeURIComponent(i.src).includes('f769786d251fa57fa592825f790db1c62d9f3c75d8031647313bd15a9ee591d8.body.png')&&i.complete&&i.naturalWidth>0));
  for(const view of ['SIDECAR','CAP ON','EXPLODED']){
   await p.evaluate(text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text)?.click(),view);
   await new Promise(r=>setTimeout(r,700));
   const data=await p.evaluate(()=>({url:location.href,images:[...document.images].filter(i=>i.getBoundingClientRect().width>200).map(i=>({src:i.currentSrc,alt:i.alt,loaded:i.complete&&i.naturalWidth>0})),overflow:document.documentElement.scrollWidth>innerWidth}));
   results.push({cap,view,...data}); await p.screenshot({path:dir+'/'+cap+'-'+view.toLowerCase().replace(' ','-')+'.png'});
  }
 }
 await p.setViewport({width:390,height:844});
 await p.goto('http://localhost:3010/products/vial-2ml-clear-8-425?cap=white&assetPreview=kits',{waitUntil:'domcontentloaded'});
 await new Promise(r=>setTimeout(r,1500));
 results.push({mobile:true,overflow:await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
 await p.screenshot({path:dir+'/white-mobile.png'});
 await p.goto('http://localhost:3010/products/vial-2ml-clear-8-425?cap=white',{waitUntil:'domcontentloaded'});
 const defaultHasPreview=await p.evaluate(()=>[...document.images].some(i=>decodeURIComponent(i.src).includes('/local-kits/vial-2ml-source-2026-10-31/parts/')));
 results.push({defaultHasPreview});if(defaultHasPreview)throw Error('Local candidate escaped opt-in');
 fs.writeFileSync(dir+'/browser-checks.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results));await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
