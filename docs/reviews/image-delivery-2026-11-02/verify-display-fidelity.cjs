const fs=require('fs'), path=require('path'), P=require(process.cwd()+'/node_modules/puppeteer-core'), sharp=require(process.cwd()+'/node_modules/sharp');
const dir=process.env.QA_OUT || 'docs/reviews/image-delivery-2026-11-02';
const manifest=require(process.cwd()+'/src/lib/products/display-images.generated.json');
const originals=new Map(Object.entries(manifest.sources).flatMap(([source,sizes])=>Object.values(sizes).map(url=>[url,source])));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const origin=process.env.QA_ORIGIN || 'http://localhost:3010';
const routes=[
 ...(process.env.QA_ORIGIN ? ['sleek-8ml-clear-13-415-finemist?cap=matte-gold'] : []),
 'tulip-6ml-clear-13-415-finemist?cap=shiny-silver',
 'cylinder-9ml-frosted-13-415-finemist?cap=matte-black',
 'vial-2ml-amber-8-425?cap=white',
 'cylinder-5ml-cobalt-blue-13-415-rollon?roller=metal&cap=shiny-silver',
 'tola-6ml-clear-14.3mm',
];
const report={states:[],comparisons:[],errors:[]};fs.mkdirSync(dir+'/visual',{recursive:true});
(async()=>{
const b=await P.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
try{
 const p=await b.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 await p.setCacheEnabled(false);
 if(process.env.QA_ACCESS_FILE) await p.goto(fs.readFileSync(process.env.QA_ACCESS_FILE,'utf8').trim(),{waitUntil:'domcontentloaded',timeout:120000});
 let originalsMode=false;
 await p.setRequestInterception(true);
 p.on('request',r=>{const source=originalsMode?originals.get(r.url()):null;r.continue(source?{url:source}:undefined).catch(()=>{});});
 for(const viewport of ['desktop','mobile']){
  await p.setViewport(viewport==='desktop'?{width:1440,height:1100,deviceScaleFactor:1}:{width:390,height:844,deviceScaleFactor:2});
  for(const [i,route]of routes.entries()){
   originalsMode=false;
   await p.goto(origin+'/products/'+route,{waitUntil:'domcontentloaded',timeout:120000});
   await p.waitForSelector('[data-testid="pdp-stage"] img',{timeout:60000});
   const inspect=async()=>{await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('[data-testid="pdp-stage"] img')].map(i=>i.decode()));});await pause(650);return p.$$eval('[data-testid="pdp-stage"] [data-slot] img',es=>es.map(e=>{const r=e.getBoundingClientRect();return {src:e.src,box:[r.x,r.y,r.width,r.height],loading:e.loading,priority:e.fetchPriority};}));};
   const after=await inspect();
   if(after.some(e=>!e.src.includes('/product-display/v1/')))throw Error('Unoptimized selected master '+route+' '+JSON.stringify(after.map(e=>e.src)));
   if(after.some(e=>e.loading!=='eager'||e.priority!=='high'))throw Error('Main image not prioritized');
   const stage=await p.waitForSelector('[data-testid="pdp-stage"]',{timeout:60000});
   const beforeBytes=await stage.screenshot({path:dir+'/visual/'+viewport+'-'+i+'-optimized.png'});
   report.states.push({route,viewport,view:'sidecar',layers:after});
   if(viewport==='desktop'){
    originalsMode=true;
    await p.goto(origin+'/products/'+route,{waitUntil:'domcontentloaded',timeout:120000});
    const original=await inspect();
    if(JSON.stringify(original.map(e=>e.box))!==JSON.stringify(after.map(e=>e.box)))throw Error('Registration changed '+route);
    const bytes=await(await p.$('[data-testid="pdp-stage"]')).screenshot({path:dir+'/visual/'+viewport+'-'+i+'-original.png'});
    const a=await sharp(beforeBytes).removeAlpha().raw().toBuffer({resolveWithObject:true}),c=await sharp(bytes).removeAlpha().raw().toBuffer();
    let sum=0,large=0;for(let j=0;j<c.length;j++){const delta=Math.abs(a.data[j]-c[j]);sum+=delta;if(delta>16)large++;}
    report.comparisons.push({route,geometryUnchanged:true,meanAbsoluteChannelDifference:sum/c.length,channelFractionDifferenceAbove16:large/c.length});
    originalsMode=false;
   }
   for(const view of ['capon','exploded']){
    const button=await p.$('[data-testid="pdp-view-'+view+'"]');if(!button)continue;
    await button.click();await inspect();
    report.states.push({route,viewport,view});
   }
   fs.writeFileSync(dir+'/visual-verification.json',JSON.stringify(report,null,2));console.log('Passed',viewport,route);
  }
 }
}finally{await Promise.race([b.close(),pause(5000)]);b.process()?.kill('SIGTERM');}
if(report.errors.length)throw Error(report.errors.join('; '));
report.status='passed';fs.writeFileSync(dir+'/visual-verification.json',JSON.stringify(report,null,2));
})().catch(e=>{console.error(e.stack);process.exit(1)});
