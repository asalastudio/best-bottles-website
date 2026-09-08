/** Read-only homepage navigation verification. Requires Playwright browsers.
 * BB_BASE_URL, BB_PLAYWRIGHT_MODULE, BB_CHROME_PATH, BB_PROOF_DIR are configurable.
 * Does not submit cart, account, or Grace requests.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium,webkit}=await import(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.BB_BASE_URL || 'http://localhost:3001';
const output=process.env.BB_PROOF_DIR || '/tmp/bb-homepage-proof';fs.mkdirSync(output,{recursive:true});
for(const engine of (process.env.BB_ENGINE==='webkit' ? [webkit] : process.env.BB_QUICK ? [chromium] : [chromium,webkit])) {
 const browser=await engine.launch({headless:true,...(engine===chromium&&process.env.BB_CHROME_PATH?{executablePath:process.env.BB_CHROME_PATH}:{})});
 try {
  for(const width of (process.env.BB_QUICK ? [390] : [320,390,430,768,1440])) {
   const context=await browser.newContext({viewport:{width,height:width===1440?1000:844},hasTouch:width<1024,reducedMotion:'reduce'});
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base,{waitUntil:'domcontentloaded',timeout:120000});
   const root=page.locator('[data-home-browse]:visible');await root.waitFor();
   const popular=root.locator('[data-popular-track]');await popular.locator('a').first().waitFor();
   if(width<1024){
    assert.equal(await page.locator('main > section').first().isVisible(),false,'Mobile hero must be hidden');
    const search=await page.getByRole('searchbox',{name:'Search products',exact:true}).boundingBox();assert(search.y>=0&&search.y+search.height<844);
    const first=await popular.locator('a').first().boundingBox();assert(first.y+first.height<844,'First card must be complete above fold');
    const next=await popular.locator('a').nth(1).boundingBox();assert(next.x<width&&next.x+next.width>width,'Next card should peek');
   }
   await page.screenshot({path:`${output}/${engine.name()}-${width}-default.png`});
   const popularNext=root.getByRole('button',{name:'Next popular families',exact:true});
   if(await popular.evaluate(e=>e.scrollWidth>e.clientWidth+2)){
    await popularNext.click();await page.waitForTimeout(100);assert((await popular.evaluate(e=>e.scrollLeft))>4);
    await root.getByRole('button',{name:'Previous popular families',exact:true}).click();
   }
   const track=root.locator('[data-catalog-track]');
   const familyLinks=await track.locator('a').evaluateAll(es=>es.map(e=>({label:e.textContent.trim(),href:e.getAttribute('href')})));
   assert(familyLinks.length>20);assert.equal(new Set(familyLinks.map(e=>e.href)).size,familyLinks.length,'Every family has its own scope');
   for(const label of ['Families','Applicators','Collections']){
    await root.getByRole('tab',{name:new RegExp(`^${label}`)}).click();
    const count=await track.locator('a').count();assert(count>0);
    const next=root.getByRole('button',{name:`Next ${label.toLowerCase()}`,exact:true});
    for(let moves=0;await track.evaluate(e=>e.scrollLeft+e.clientWidth<e.scrollWidth-2);moves++){
     assert(moves<count,'Arrow navigation must reach the end');await next.click();await page.waitForTimeout(100);
    }
    await root.getByRole('button',{name:'View all',exact:true}).click();assert.equal(await track.locator('a').count(),count);
    assert(await track.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Expanded grid must reflow');
    if(width===390)await page.screenshot({path:`${output}/${engine.name()}-${label}-expanded.png`,fullPage:false});
    await root.getByRole('button',{name:'Show less',exact:true}).click();
   }
   // Native tab-key navigation and returning to the same scrollable tab.
   await root.getByRole('tab',{name:/^Families/}).focus();await page.keyboard.press('ArrowRight');
   assert.equal(await root.getByRole('tab',{name:/^Applicators/}).getAttribute('aria-selected'),'true');
   if(width===390){
    const appNext=root.getByRole('button',{name:'Next applicators',exact:true});if(await track.evaluate(e=>e.scrollLeft+e.clientWidth<e.scrollWidth-2))await appNext.click();
    const before=await track.evaluate(e=>e.scrollLeft);
    await track.locator('a').last().click();await page.waitForURL(/catalog/);
    await page.goBack({waitUntil:'domcontentloaded'});await root.waitFor();
    await page.waitForFunction(()=>document.querySelector('[role=tab][aria-selected=true]')?.textContent?.startsWith('Applicators'));
    assert((await track.evaluate(e=>e.scrollLeft))>=before-2,'Restore carousel position after Back');
    await root.scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/${engine.name()}-alternate-tab.png`});
    const search=page.getByRole('searchbox',{name:'Search products',exact:true});await search.fill('5 ml');await search.press('Enter');await page.waitForURL(url=>url.pathname==='/catalog'&&url.searchParams.get('search')==='5 ml');await page.goBack({waitUntil:'domcontentloaded'});await root.waitFor();
   }
   if(!(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))){console.log(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,wide:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+2&&getComputedStyle(e).position!=='fixed').slice(-15).map(e=>[e.tagName,e.className,e.getBoundingClientRect().toJSON()])})));await page.screenshot({path:`${output}/overflow-${width}.png`});throw Error('Page must not overflow');}
   assert.deepEqual(errors,[],'Browser runtime errors');
   console.log(`${engine.name()} ${width}: initial viewport, all tabs, arrows, View all, keyboard and overflow passed`);
   await context.close();
  }
 }finally{await browser.close();}
}
