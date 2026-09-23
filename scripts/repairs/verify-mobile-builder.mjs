import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
const root='output/four-family-component-cleanup';
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage();
await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
const result={errors:[]}; page.on('pageerror',e=>result.errors.push(e.stack));
async function radio(label) {
  const selector=`input[type="radio"][aria-label="${label}"]`;
  await page.waitForSelector(selector);
  await page.$eval(selector,n=>n.parentElement.click());
  await page.waitForFunction(s=>document.querySelector(s)?.checked,{timeout:10000},selector);
}
async function button(label) {
  await page.waitForFunction(t=>[...document.querySelectorAll('button')].some(n=>n.innerText.trim()===t&&!n.disabled),{},label);
  const handle=await page.evaluateHandle(t=>[...document.querySelectorAll('button')].find(n=>n.innerText.trim()===t&&!n.disabled),label);
  await handle.asElement().click();
}
try {
  const ready=page.waitForResponse(r=>r.url().includes('/api/bottle-builder/families')&&r.status()===200,{timeout:60000});
  await page.goto('http://localhost:3056/matrix?family=Circle',{waitUntil:'domcontentloaded',timeout:90000}); await ready;
  await radio('100 ml, 18-415 neck'); await button('Continue to glass');
  await radio('Frosted'); await button('Continue to fitment');
  await radio('Vintage Style Bulb Sprayer with Tassel'); await button('Continue to finish');
  await radio('Gold'); await button('Review bottle');
  await page.waitForSelector('[data-mobile-builder][data-stage="4"]');
  const recipes=JSON.parse(fs.readFileSync('convex/repairs/fourFamilyComponents.json','utf8'));
  const sku='GBCrclFrst100AnSpTslGl';
  const hash=recipes.kitRoles.find(r=>r.sku===sku).after.parts.find(p=>p.slot==='sprayer').sha256;
  await page.waitForFunction(hash=>[...document.querySelectorAll('[data-builder-layer="sprayer"]')].some(n=>(n.getAttribute('href')||n.getAttribute('src')||'').includes(hash)),{timeout:30000},hash);
  await page.waitForNetworkIdle({idleTime:1000,timeout:30000});
  await page.evaluate(async()=>{
    const urls=[...document.querySelectorAll('[aria-label="Live bottle preview"] [data-builder-layer]')].map(n=>n.getAttribute('href')||n.getAttribute('src')).filter(Boolean);
    await Promise.all(urls.map(url=>{const img=new Image();img.src=url;return img.decode();}));
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
  result.frame=await page.$eval('[aria-label="Live bottle preview"]',n=>({html:n.innerHTML,rect:{width:n.clientWidth,height:n.clientHeight}}));
  result.summary=await page.$eval('[aria-label="Review and quantity"]',n=>n.innerText);
  result.sku=sku;result.stage=4;
  result.pass=result.errors.length===0;
  await page.screenshot({path:`${root}/mobile-builder-review.png`,fullPage:true});
  if(!result.pass)throw Error(result.errors.join('\n'));
  console.log('Mobile builder passed:',sku,'at review; no order submitted.');
} catch(e) {result.error=e.stack;process.exitCode=1;console.error(e.stack);}
finally {fs.writeFileSync(`${root}/mobile-builder-check.json`,JSON.stringify(result,null,2)+'\n');await browser.close();}
