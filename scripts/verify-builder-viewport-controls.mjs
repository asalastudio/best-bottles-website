/** Read-only regression for zoom and keyboard-dismissal tap retargeting.
 * BB_PLAYWRIGHT_MODULE, BB_CHROME_PATH and BB_BASE_URL select local tooling.
 * Keyboard geometry is simulated; this is not physical iOS keyboard verification.
 * The final click is intercepted before React: no cart request is submitted.
 */
import assert from 'node:assert/strict';
const {chromium,webkit,devices}=await import(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
for (const engine of [webkit,chromium]) {
 const browser=await engine.launch({headless:true,...(engine===chromium && process.env.BB_CHROME_PATH ? {executablePath:process.env.BB_CHROME_PATH}:{})});
 try {
  const page=await browser.newPage({...devices['iPhone 13']});
  await page.goto(`${process.env.BB_BASE_URL || 'http://localhost:3001'}/matrix?family=Cylinder`);
  const root=page.locator('[data-mobile-builder]');await root.waitFor();
  await root.getByRole('radio',{name:'5 ml, 13-415 neck',exact:true}).check();
  await root.getByRole('button',{name:'Continue to glass',exact:true}).tap();
  await root.getByRole('radio',{name:'Clear',exact:true}).check();
  if(engine===chromium){
   const session=await page.context().newCDPSession(page);
   for(const scale of [1.5,2,1]){
    await session.send('Emulation.setPageScaleFactor',{pageScaleFactor:scale});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await root.getAttribute('data-keyboard'),'false','Zoom must not activate keyboard layout');
   }
  }
  await root.getByRole('button',{name:'Continue to fitment',exact:true}).tap();
  await root.getByRole('radio',{name:'Metal Roller',exact:true}).check();
  await root.getByRole('button',{name:'Continue to finish',exact:true}).tap();
  await root.getByRole('radio').first().check();
  await root.getByRole('button',{name:'Review bottle',exact:true}).tap();
  await root.getByRole('spinbutton',{name:'Quantity'}).focus();
  await page.evaluate(()=>{
   window.__actionClicks=[];
   let keyboardHeight=innerHeight*.5;
   Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>keyboardHeight});
   visualViewport.dispatchEvent(new Event('resize'));
   // Simulate keyboard dismissal while the finger is pressing the action.
   document.addEventListener('pointerdown',()=>{keyboardHeight=innerHeight;visualViewport.dispatchEvent(new Event('resize'));},{capture:true,once:true});
   document.addEventListener('click',event=>{
    window.__actionClicks.push(event.target.closest('button')?.textContent?.trim() || event.target.tagName);
    event.stopImmediatePropagation();event.preventDefault();
   },true);
  });
  await page.waitForFunction(()=>document.querySelector('[data-mobile-builder]').dataset.keyboard==='true');
  const action=root.getByRole('button',{name:/Add to cart/});await action.scrollIntoViewIfNeeded();
  const box=await action.boundingBox();await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
  const clicks=await page.evaluate(()=>window.__actionClicks);
  assert.equal(clicks.length,1);assert.match(clicks[0],/^Add to cart/,'Tap was retargeted away from the action');
  assert.equal(await root.getAttribute('data-keyboard'),'false');
  console.log(`${engine.name()}: keyboard dismissal preserves action target; click intercepted without cart submission`);
 } finally {await browser.close();}
}
