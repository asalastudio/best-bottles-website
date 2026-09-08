/** Local read-only browser regression. Expected cap count reflects the six currently held short-cap kits. */
import assert from 'node:assert/strict';
const {webkit,chromium,devices}=await import(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const output = new URL('.', import.meta.url).pathname;
const base = process.env.BB_BASE_URL || 'http://localhost:3001';
for(const engine of [webkit,chromium]){
 const browser=await engine.launch({headless:true,...(engine===chromium?{...(process.env.BB_CHROME_PATH ? {executablePath:process.env.BB_CHROME_PATH} : {})}:{})});
 try {
 const page=await browser.newPage({...devices['iPhone 13']}); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/matrix?family=Cylinder`,{waitUntil:'domcontentloaded',timeout:120000});
 const root=page.locator('[data-mobile-builder]');await root.waitFor({timeout:120000});
 await root.getByRole('radio',{name:'5 ml, 13-415 neck',exact:true}).check();await root.getByRole('button',{name:'Continue to glass',exact:true}).tap();
 await root.getByRole('radio',{name:'Cobalt Blue',exact:true}).check();await root.getByRole('button',{name:'Continue to fitment',exact:true}).tap();
 assert.equal(await root.getByRole('radio').count(),4);
 await page.screenshot({path:`${output}/${engine.name()}-cobalt-fitments.png`,fullPage:false});
 for(const [fitment,count,text] of [['Screw Cap',4,'No roller is included.'],['Metal Roller',9,'metal roller, and selected roller cap.'],['Plastic Roller',9,'plastic roller, and selected roller cap.'],['Fine Mist Sprayer',7,'Matching protective overcap included.']]){
  await root.getByRole('radio',{name:fitment,exact:true}).check();await root.getByRole('button',{name:'Continue to finish',exact:true}).tap();
  assert.equal(await root.getByRole('radio').count(),count,fitment+' finish count');
  await root.getByRole('radio').first().check();await root.getByRole('button',{name:'Review bottle',exact:true}).tap();
  assert((await root.innerText()).includes(text));
  assert.equal(await root.getByRole('button',{name:/Add to cart/}).isEnabled(),true);
  const quantity=root.getByRole('spinbutton',{name:'Quantity'});await quantity.fill('24');await quantity.blur();
  await page.screenshot({path:`${output}/${engine.name()}-${fitment.replaceAll(' ','-')}-review.png`,fullPage:false});
  await root.getByRole('button',{name:'Edit fitment',exact:true}).tap();
  console.log(engine.name(),fitment,count,'review and edit OK');
 }
 await page.setViewportSize({width:320,height:740});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await page.screenshot({path:`${output}/${engine.name()}-320-fitments.png`,fullPage:false});
 assert.deepEqual(errors,[]);await page.close();
 if(engine===chromium){const desktop=await browser.newPage({viewport:{width:1440,height:1000}});await desktop.goto(`${base}/matrix?family=Cylinder`,{waitUntil:'domcontentloaded',timeout:120000});await desktop.locator('[data-bottle-builder]').waitFor({timeout:120000});await desktop.screenshot({path:`${output}/desktop-builder.png`,fullPage:false});console.log('Desktop builder rendered');}
 }finally{await browser.close();}
}
