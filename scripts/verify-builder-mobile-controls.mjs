/** Read-only production-build regression: 48 mobile paths, no cart submission.
 * BB_PLAYWRIGHT_MODULE, BB_CHROME_PATH, BB_BASE_URL and BB_PROOF_DIR are optional.
 * Exercises raw touchscreen taps, preview layers, dialog dismissal, review and edit.
 */
import assert from 'node:assert/strict';import fs from 'node:fs';
const {webkit,chromium,devices}=await import(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.BB_BASE_URL || 'http://localhost:3001';
const output=process.env.BB_PROOF_DIR || '/tmp/bb-mobile-preview-proof';fs.mkdirSync(output,{recursive:true});
for(const engine of [webkit,chromium]){const b=await engine.launch({headless:true,...(engine===chromium && process.env.BB_CHROME_PATH?{executablePath:process.env.BB_CHROME_PATH}:{})});
try{const p=await b.newPage({...devices['iPhone 13']});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.addInitScript(() => {
 window.__builderTapTrace=[];
 for (const type of ['pointerdown','pointerup','pointercancel','click']) document.addEventListener(type,event => {
  const button=event.target instanceof Element ? event.target.closest('button') : null;
  if (!button?.closest('[data-mobile-builder]')) return;
  window.__builderTapTrace.push({type,button:button.getAttribute('aria-label') || button.textContent?.trim(),disabled:button.disabled,stage:document.querySelector('[data-mobile-builder]')?.dataset.stage});
 },true);
});
await p.goto(`${base}/matrix?family=Cylinder`,{waitUntil:'domcontentloaded',timeout:120000});const r=p.locator('[data-mobile-builder]');await r.waitFor({timeout:120000});
async function tapAction(name,stage,target='label'){const btn=r.getByRole('button',{name,exact:true});assert(await btn.isEnabled());const box=await btn.boundingBox();let point={x:box.x+box.width*.4,y:box.y+box.height/2};
if(target==='arrow'){const icon=await btn.locator('svg').boundingBox();point={x:icon.x+icon.width/2,y:icon.y+icon.height/2}}
if(target==='edge')point={x:box.x+box.width-3,y:box.y+box.height-3};
assert(await btn.evaluate((el,pt)=>el.contains(document.elementFromPoint(pt.x,pt.y)),point),'button covered');
await p.touchscreen.tap(point.x,point.y);await p.waitForFunction(expected=>document.querySelector('[data-mobile-builder]')?.dataset.stage===String(expected),stage,{timeout:4000});}
for(const [width,height] of [[390,844],[320,740],[844,390]])for(const glass of ['Clear','Cobalt Blue']){
 await p.setViewportSize({width,height});if(await r.getByRole('button',{name:'Start over',exact:true}).count())await r.getByRole('button',{name:'Start over',exact:true}).tap();
 await r.getByRole('radio',{name:'5 ml, 13-415 neck',exact:true}).check();await tapAction('Continue to glass',1,'arrow');
 await r.getByRole('radio',{name:glass,exact:true}).check();await p.evaluate(()=>window.scrollTo(0,400));await tapAction('Continue to fitment',2,'edge');
 const preview=r.locator('section[aria-label="Live bottle preview"]');assert.deepEqual(await preview.locator('[data-builder-layer]').evaluateAll(es=>es.map(e=>e.dataset.builderLayer)),['body']);
 for(const fitment of ['Metal Roller','Plastic Roller','Screw Cap','Fine Mist Sprayer']){
 await r.getByRole('radio',{name:fitment,exact:true}).check();
 const layers=await preview.locator('[data-builder-layer]').evaluateAll(es=>es.map(e=>e.dataset.builderLayer));assert(layers.includes(fitment==='Screw Cap'?'cap':fitment.includes('Roller')?'roller':'sprayer'),`${glass} ${fitment} missing ${layers}`);
 await r.getByRole('button',{name:'Expand bottle preview',exact:true}).tap();const dialog=p.getByRole('dialog',{name:'Expanded bottle preview'});const svg=dialog.locator('svg[role=img]');const vb=await svg.getAttribute('viewBox');assert(vb);
 await p.screenshot({path:`${output}/${engine.name()}-${width}-${glass.replaceAll(' ','')}-${fitment.replaceAll(' ','')}.png`});
 await dialog.getByRole('button',{name:'Close preview',exact:true}).tap();
 await tapAction('Continue to finish',3,'arrow');await r.getByRole('radio').first().check();await tapAction('Review bottle',4,'label');
 const q=r.getByRole('spinbutton',{name:'Quantity'});await q.fill('24');await q.blur();await r.getByRole('button',{name:'Edit fitment',exact:true}).tap();
 console.log(engine.name(),width,glass,fitment,'preview, raw tap actions, review, edit OK');
 }
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');
}
fs.writeFileSync(`${output}/${engine.name()}-touch-trace.json`,JSON.stringify(await p.evaluate(()=>window.__builderTapTrace),null,2));
assert.deepEqual(errors,[]);fs.writeFileSync(`${output}/${engine.name()}-errors.json`,JSON.stringify(errors));
}finally{await b.close()}}
