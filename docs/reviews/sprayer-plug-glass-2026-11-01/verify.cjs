const fs = require('fs'), assert = require('assert/strict'), P = require(process.cwd() + '/node_modules/puppeteer-core');
const sharp = require(process.cwd() + '/node_modules/sharp');
const paintOnly = process.env.QA_PAINT_ONLY === '1';
const dir = 'docs/reviews/sprayer-plug-glass-2026-11-01', origin = 'http://localhost:3010';
const manifest = JSON.parse(fs.readFileSync('src/lib/paper-doll/approved-kits.generated.json'));
const groups = [
 { body: 'tulip-6ml-13-415', family: 'Cylinder', slug: 'tulip-6ml-clear-13-415-finemist', prefix: 'GBTulip6Spry', sku: 'GBTulip6SpryGlMatt' },
 { body: 'sleek-8ml-13-415', family: 'Sleek', slug: 'sleek-8ml-clear-13-415-finemist', prefix: 'GBSleek8Spry', sku: 'GBSleek8SpryGlMatt' },
];
const scoped = Object.values(manifest.rows).filter(k => groups.some(g => g.body === k.register?.bodyId) && k.register?.glass === 'Clear' && k.parts.some(p => p.slot === 'sprayer'));
const report = { status: 'running', manifestVersion: manifest.version, pdp: [], catalog: [], builder: [], comparisons: [], paintedMasks: [], errors: [] };
fs.mkdirSync(dir + '/screenshots', { recursive: true });
const save = () => fs.writeFileSync(dir + (paintOnly ? '/paint-verification.json' : '/verification.json'), JSON.stringify(report, null, 2) + '\n');
const pause = ms => new Promise(r => setTimeout(r, ms));
const inspect = e => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); return { mask: s.maskImage, origin: s.maskOrigin, clip: s.maskClip, opacity: s.opacity, box: [r.x,r.y,r.width,r.height] }; };
async function checkPaint(page, selector, tag, sourceHeight) {
 const element=await page.$(selector);
 const after=await element.screenshot();
 const box=await element.boundingBox();
 await element.evaluate(e=>{e.dataset.savedMask=e.style.maskImage;e.style.maskImage='none';});
 await pause(100);
 const before=await element.screenshot();
 assert.deepEqual(await element.boundingBox(),box);
 await element.evaluate(e=>{e.style.maskImage=e.dataset.savedMask;delete e.dataset.savedMask;});
 const a=await sharp(after).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const beforePixels=await sharp(before).ensureAlpha().raw().toBuffer();
 let changed=0,shaftChanged=0,tipRasterEdgePixels=0;
 const shaftRow=Math.ceil((376/sourceHeight+.07)*a.info.height);
 for(let y=0;y<a.info.height;y++)for(let x=0;x<a.info.width;x++) {
  const i=(y*a.info.width+x)*4;
  const delta=Math.max(...[0,1,2].map(c=>Math.abs(a.data[i+c]-beforePixels[i+c])));
  if(delta>1){
   changed++;
   if(y>=shaftRow){
    // A masked SVG gets its own raster surface. Chrome can round the final
    // fractional scanline by <=3 RGB levels even where mask alpha is one.
    if(y===a.info.height-1 && delta<=3)tipRasterEdgePixels++;
    else shaftChanged++;
   }
  }
 }
 assert(changed>2,tag+' mask has no painted effect');
 assert.equal(shaftChanged,0,tag+' changed the narrow shaft');
 report.paintedMasks.push({tag,changedPixels:changed,shaftChangedPixels:shaftChanged,tipRasterEdgePixels,geometryUnchanged:true});save();
}

(async () => {
 const b = await P.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args:['--no-sandbox'] });
 try {
  const p = await b.newPage(); p.on('pageerror', e => report.errors.push(e.message));
  for (const viewport of ['desktop','mobile']) {
   await p.setViewport(viewport === 'desktop' ? {width:1440,height:1100} : {width:390,height:844});
   for (const g of groups) {
    const cases = paintOnly ? [] : viewport === 'desktop' ? scoped.filter(k=>k.register.bodyId===g.body) : [manifest.rows[g.sku]];
    for (const k of cases) {
     await p.goto(origin+'/products/'+g.slug+'?'+new URLSearchParams({sku:k.sku}), {waitUntil:'domcontentloaded', timeout:120000});
     await p.waitForFunction(sku=>document.querySelector('[data-testid="pdp-product-info"]')?.innerText.includes(sku)&&document.querySelector('[data-slot="diptube"] img'), {timeout:60000}, k.sku);
     for (const view of k.sku===g.sku ? ['sidecar','capon','exploded'] : ['sidecar']) {
      await p.$eval('[data-testid="pdp-view-'+view+'"]',e=>e.click());
      await p.waitForFunction(v=>document.querySelector('[data-testid="pdp-stage"]')?.dataset.view===v,{},view);
      await p.evaluate(async()=>Promise.all([...document.querySelectorAll('[data-testid="pdp-stage"] img')].map(i=>i.decode())));
      const state=await p.$eval('[data-slot="diptube"] img',inspect);
      assert.equal(state.mask==='none',view==='exploded');
      if(view!=='exploded'){assert(state.mask.includes('linear-gradient'));assert.equal(state.opacity,'0.4');assert.equal(state.origin,'fill-box');}
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      report.pdp.push({sku:k.sku,view,viewport,...state});
      if(k.sku===g.sku) {
       await pause(1000);
       const stage=await p.$('[data-testid="pdp-stage"]');
       await stage.screenshot({path:dir+'/screenshots/'+viewport+'-'+g.sku+'-'+view+'-after.png'});
       if(view==='sidecar') {
        const sources=await p.$$eval('[data-testid="pdp-stage"] img',els=>els.map(e=>e.src));
        await p.$eval('[data-slot="diptube"] img',e=>{e.dataset.savedMask=e.style.maskImage;e.style.maskImage='none';});
        await pause(100);
        const before=await p.$eval('[data-slot="diptube"] img',inspect);
        assert.deepEqual(before.box,state.box);
        await stage.screenshot({path:dir+'/screenshots/'+viewport+'-'+g.sku+'-sidecar-before.png'});
        await p.$eval('[data-slot="diptube"] img',e=>{e.style.maskImage=e.dataset.savedMask;delete e.dataset.savedMask;});
        assert.deepEqual(await p.$$eval('[data-testid="pdp-stage"] img',els=>els.map(e=>e.src)),sources);
        report.comparisons.push({sku:k.sku,viewport,geometryAndSourcesUnchanged:true});
       }
      }
      save();
     }
    }
    console.log('PDP',viewport,g.body,'passed');
    await p.goto(origin+'/catalog?'+new URLSearchParams({category:'Glass Bottle',families:g.family,sort:'capacity-asc'}),{waitUntil:'domcontentloaded',timeout:120000});
    await p.waitForSelector('[data-bb-master-sku^="'+g.prefix+'"]',{timeout:90000});
    for(const k of scoped.filter(k=>k.register.bodyId===g.body && (!paintOnly || k.sku===g.sku))) {
     await p.evaluate(({prefix,sku})=>{
      const a=document.querySelector('[data-bb-master-sku^="'+prefix+'"]').closest('article');
      const more=a.querySelector('[data-testid="catalog-card-cap-more"]');if(more&&more.getAttribute('aria-expanded')!=='true')more.click();
     },{prefix:g.prefix,sku:k.sku});
     await p.waitForFunction(({prefix,sku})=>document.querySelector('[data-bb-master-sku^="'+prefix+'"]')?.closest('article')?.querySelector('[data-sku="'+sku+'"]'),{timeout:15000},{prefix:g.prefix,sku:k.sku});
     await p.evaluate(({prefix,sku})=>document.querySelector('[data-bb-master-sku^="'+prefix+'"]').closest('article').querySelector('[data-sku="'+sku+'"]').click(),{prefix:g.prefix,sku:k.sku});
     const sel='[data-bb-master-sku="'+k.sku+'"]';await p.waitForSelector(sel);
     const state=await p.$eval(sel+' [data-bb-master-part="diptube"]',inspect);
     assert(state.mask.includes('linear-gradient'));assert.equal(state.origin,'fill-box');assert.equal(state.opacity,'0.4');
     report.catalog.push({sku:k.sku,viewport,...state});
     if(k.sku===g.sku){await p.$eval(sel,e=>e.scrollIntoView({block:'center'}));await pause(1200);await(await p.$(sel)).screenshot({path:dir+'/screenshots/'+viewport+'-'+g.sku+'-catalog-after.png'});await checkPaint(p,sel+' [data-bb-master-part="diptube"]',viewport+'-'+g.sku+'-catalog',k.parts.find(p=>p.slot==='diptube').image.height);}
     save();
    }
    await p.goto(origin+'/matrix?'+new URLSearchParams({family:g.family,sku:g.sku,from:'pdp'}),{waitUntil:'domcontentloaded',timeout:120000});
    await p.waitForFunction(()=>document.querySelector('[data-builder-layer="diptube"]'),{timeout:90000});
    const sel='[data-builder-layer="diptube"]',state=await p.$eval(sel,inspect);
    assert(state.mask.includes('linear-gradient'));assert.equal(state.opacity,'0.4');assert.equal(state.origin,'fill-box');
    await pause(1200);await(await p.$(sel)).evaluate(e=>e.closest('svg').scrollIntoView({block:'center'}));
    await(await p.$(sel)).evaluate(e=>e.closest('svg').setAttribute('data-plug-qa',''));
    await(await p.$('[data-plug-qa]')).screenshot({path:dir+'/screenshots/'+viewport+'-'+g.sku+'-builder-after.png'});
    await checkPaint(p,sel,viewport+'-'+g.sku+'-builder',manifest.rows[g.sku].parts.find(p=>p.slot==='diptube').image.height);
    report.builder.push({sku:g.sku,viewport,...state});save();
    console.log('CATALOG and BUILDER',viewport,g.body,'passed');
   }
  }
  assert.equal(scoped.length,15);assert.equal(report.catalog.length,paintOnly?4:30);assert.equal(report.builder.length,4);assert.deepEqual(report.errors,[]);
  report.status='passed';save();console.log('PASS',JSON.stringify({pdp:report.pdp.length,catalog:report.catalog.length,builder:report.builder.length}));
 } finally {await b.close();}
})().catch(e=>{report.status='failed';report.error=e.stack;save();console.error(e);process.exit(1);});
