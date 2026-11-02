const fs=require('node:fs'),assert=require('node:assert/strict'),P=require(process.cwd()+'/node_modules/puppeteer-core');
const dir=process.env.TUBE_QA_OUT||'docs/reviews/cylinder-lotion-pumps-2026-11-02/local';
const origin=process.env.TUBE_QA_ORIGIN||'http://localhost:3010';
const before=require('./before-kits.json').rows,after=require('./after-kits.json').rows;
const source=require('./tube-source.json').image;
const colors={'Clear':'clear','Amber':'amber','Cobalt Blue':'cobalt-blue','Frosted':'frosted','Swirl':'swirl'};
let cases=Object.entries(after).map(([sku,k])=>({sku,slug:'cylinder-9ml-'+colors[k.register.glass]+'-17-415-lotionpump',kind:'9ml',glass:k.register.glass}));
for(const sku of ['LBcyl25LtnClOvrCap','LBCyl25LtnCu','LBCyl25LtnMtGl','LBCyl25LtnMtSl','LBCyl25LtnShnBlk','LBCyl25LtnShnGl','LBCyl25LtnShnSl']) cases.push({sku,slug:'cylinder-25ml-clear-18-415-lotionpump',kind:'25ml',glass:'Clear'});
if(process.env.TUBE_QUICK)cases=cases.filter(c=>['LBCyl9LtnGl','LBCyl25LtnMtGl'].includes(c.sku));
if(process.env.TUBE_SKUS){const selected=new Set(process.env.TUBE_SKUS.split(','));cases=cases.filter(c=>selected.has(c.sku));}
const report={origin,version:require(process.cwd()+'/src/lib/paper-doll/approved-kit-index.json').version,states:[],apis:[],builders:[],errors:[]};
fs.mkdirSync(dir,{recursive:true});const save=()=>fs.writeFileSync(dir+'/verification.json',JSON.stringify(report,null,2));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const css=s=>s.replace(/\s+/g,'').replace(/-?\d+\.\d+(?=%)/g,n=>Number(n).toFixed(3)).replace(/;$/,'');
const rounded=value=>Array.isArray(value)?value.map(rounded):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rounded(v)])):typeof value==='number'?Number(value.toFixed(8)):value;
(async()=>{const b=await P.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});try{
 const p=await b.newPage();p.on('pageerror',e=>report.errors.push({area:'browser',message:e.message}));
 if(process.env.TUBE_ACCESS_FILE)await p.goto(fs.readFileSync(process.env.TUBE_ACCESS_FILE,'utf8').trim(),{waitUntil:'domcontentloaded',timeout:60000});
 for(const viewport of ['desktop','mobile']){
  await p.setViewport(viewport==='desktop'?{width:1440,height:1100,deviceScaleFactor:1}:{width:390,height:844,deviceScaleFactor:2});
  for(const c of cases){try{
   await p.goto(origin+'/products/'+c.slug+'?sku='+c.sku,{waitUntil:'domcontentloaded',timeout:45000});
   await p.waitForSelector('[data-testid="pdp-stage"] [data-slot="body"] img',{timeout:45000});
   for(const view of ['sidecar','capon','exploded']){
    await p.waitForSelector('[data-testid="pdp-view-'+view+'"]',{timeout:15000});
    await p.click('[data-testid="pdp-view-'+view+'"]');
    await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('[data-testid="pdp-stage"] img')].map(i=>i.decode()));});await pause(160);
    const parts=await p.$$eval('[data-testid="pdp-stage"] [data-slot]',es=>es.map(e=>({slot:e.dataset.slot,url:e.querySelector('img')?.src,currentSrc:e.querySelector('img')?.currentSrc,style:e.getAttribute('style'),imgStyle:e.querySelector('img')?.getAttribute('style')})));
    const tubes=parts.filter(x=>x.slot==='diptube');
    assert.equal(tubes.length,c.kind==='9ml'&&c.glass!=='Clear'&&view!=='exploded'?0:1,c.sku+' duplicate/missing tube '+view);
    if(tubes.length)assert.ok(tubes[0].url.includes(source.sha256)||tubes[0].currentSrc.includes(source.sha256),c.sku+' old tube '+view);
    if(viewport==='desktop'&&view==='sidecar'&&['LBCyl9LtnGl','LBCyl25LtnMtGl'].includes(c.sku)){
     const old=JSON.parse(fs.readFileSync('docs/reviews/cylinder-lotion-pumps-2026-11-02/'+c.kind+'-before-dom.json'));
     const exterior=rows=>rows.filter(x=>x.slot!=='diptube').map(({slot,url,style,imgStyle})=>({slot,url,style:css(style),imgStyle:css(imgStyle)}));
     assert.deepEqual(exterior(parts),exterior(old),c.sku+' exterior changed');
    }
    const screenshot=['LBCyl9LtnGl','LBCyl25LtnMtGl'].includes(c.sku)||viewport==='desktop'&&view==='sidecar';
    if(screenshot)await(await p.$('[data-testid="pdp-stage"]')).screenshot({path:dir+'/'+viewport+'-'+c.sku+'-'+view+'.png'});
    report.states.push({sku:c.sku,viewport,view,tubes:tubes.length,parts});save();
   }
   console.log('Passed',viewport,c.sku);
  }catch(e){const state=await p.evaluate(()=>({title:document.title,path:location.pathname,stage:document.querySelector('[data-testid="pdp-stage"]')?.getAttribute('data-source'),heading:document.querySelector('h1')?.textContent})).catch(()=>null);report.errors.push({area:'pdp',sku:c.sku,viewport,message:e.message,state});save();console.error('FAIL',c.sku,e.message.slice(0,180));}}
 }
 // Test the same exact source at the Builder API, separate from PDP rendering.
 for(const [bodyId,skus]of [['cylinder-9ml|17-415|Glass Bottle',Object.keys(after)],['cylinder-25ml|18-415|Glass Bottle',cases.filter(c=>c.kind==='25ml').map(c=>c.sku)]]){
  const data=await p.evaluate(async url=>{const r=await fetch(url);if(!r.ok)throw Error('Builder '+r.status);return r.json();},'/api/bottle-builder/kits?'+new URLSearchParams({family:'Cylinder',bodyId}));
  for(const sku of skus){const k=data.kits[sku];assert(k,'Builder missing '+sku);const tubes=k.parts.filter(x=>x.slot==='diptube');if(tubes.length)assert(tubes.every(t=>t.image.url===source.url),'Builder old tube '+sku);if(after[sku])assert.deepEqual(rounded(k.parts),rounded(after[sku].parts.filter(part=>!part.views||part.views.includes('capon'))));report.apis.push({sku,builder:true,tubes:tubes.length});}save();
 }
 for(const sku of ['LBCyl9LtnGl','LBCyl25LtnMtGl']){
  await p.goto(origin+'/matrix?'+new URLSearchParams({family:'Cylinder',sku,from:'pdp'}),{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForFunction(hash=>[...document.querySelectorAll('[data-builder-layer="diptube"]')].some(e=>(e.getAttribute('href')||e.getAttribute('src')||'').includes(hash)),{timeout:60000},source.sha256);
  report.builders.push({sku,renderedNewTube:true});save();
 }
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));report.passed=true;save();
 console.log(JSON.stringify({states:report.states.length,builderApis:report.apis.length,builders:report.builders.length,errors:report.errors.length}));
}finally{await Promise.race([b.close(),pause(5000)]);b.process()?.kill('SIGTERM');}})().catch(e=>{report.errors.push({area:'run',message:e.message});save();console.error(e.message.slice(0,800));process.exitCode=1;});
