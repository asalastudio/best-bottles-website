import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
const base='http://localhost:3056',dir='output/four-family-component-cleanup';
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const checks=[],errors=[];
const raw=JSON.parse(fs.readFileSync('../four-family-pdp-components-2026-09-22/data/audits/four-family-pdp-components-2026-09-22/production/served-kits.json','utf8'));
const local=JSON.parse(fs.readFileSync('data/repairs/four-family-components-2026-09-22/local-kits.json','utf8')).rows;
const bounds={};for(const kit of Object.values({...raw,...local})) for(const p of kit?.parts??[]) if(p.slot==='body')bounds[p.image.url]=p.bounds;
async function label(page,t) {
 await page.waitForFunction(t=>[...document.querySelectorAll('button[aria-label]')].some(e=>e.offsetWidth&&!e.disabled&&e.getAttribute('aria-label')===t),{timeout:45000},t);
 const h=await page.evaluateHandle(t=>[...document.querySelectorAll('button[aria-label]')].find(e=>e.offsetWidth&&!e.disabled&&e.getAttribute('aria-label')===t),t);await h.asElement().click();
}
async function button(page,t) {
 await page.waitForFunction(t=>[...document.querySelectorAll('button')].some(e=>e.offsetWidth&&!e.disabled&&e.innerText.trim()===t),{timeout:45000},t);
 const h=await page.evaluateHandle(t=>[...document.querySelectorAll('button')].find(e=>e.offsetWidth&&!e.disabled&&e.innerText.trim()===t),t);await h.asElement().click();
}
try {
 for(const [width,height] of [[1440,900],[1280,650],[390,844]]) {
  for(const slug of ['circle-15ml-clear-13-415','circle-100ml-clear-18-415-perfumespray','round-78ml-frosted-18-415-antiquespray','empire-50ml-clear-18-415-perfumespray']) {
   const p=await browser.newPage();p.on('pageerror',e=>errors.push(e.stack));await p.setViewport({width,height});
   const response=await p.goto(base+'/products/'+slug,{waitUntil:'networkidle2',timeout:120000});
   await p.waitForFunction(()=>[...document.querySelectorAll('[data-pdp-photo-canvas]')].some(e=>e.offsetWidth),{timeout:30000});
   const state=await p.evaluate(()=>{const c=[...document.querySelectorAll('[data-pdp-photo-canvas]')].find(e=>e.offsetWidth),f=c.querySelector('[data-pdp-stage-frame]');return {width:c.clientWidth,height:c.clientHeight,transform:getComputedStyle(f).transform,broken:[...c.querySelectorAll('img')].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src)}});
   if(response.status()!==200||Math.abs(state.width/state.height-10/11)>.008||state.broken.length)throw Error('Canvas or image failure '+slug);
   const cap=await p.$('button[aria-label="Cap on or off"]');
   if(width>1099&&cap) {await cap.click();await p.waitForNetworkIdle({idleTime:600});const after=await p.evaluate(()=>{const e=[...document.querySelectorAll('[data-pdp-stage-frame]')].find(e=>e.offsetWidth);return getComputedStyle(e).transform});if(after!==state.transform)throw Error('Paired photo changed zoom '+slug);}
   await p.screenshot({path:`${dir}/framing-${slug}-${width}.png`});checks.push({surface:'pdp',slug,viewport:{width,height},http:response.status(),...state,pass:true});await p.close();
  }
 }
 const bodyWidths=[];
 for(const color of ['Clear','Frosted']) {
  const p=await browser.newPage();await p.setViewport({width:1440,height:1000});p.on('pageerror',e=>errors.push(e.stack));
  const ready=p.waitForResponse(r=>r.url().includes('/api/bottle-builder/families')&&r.status()===200,{timeout:60000});
  await p.goto(base+'/matrix?family=Circle',{waitUntil:'domcontentloaded',timeout:120000});await ready;
  await label(p,'100 ml, 18-415 neck');await p.waitForNetworkIdle({idleTime:800});await label(p,color);await button(p,'Choose Fitment');await label(p,'Vintage Style Bulb Sprayer with Tassel');
  let prior=null;
  for(const finish of ['Gold','Matte Silver']) {
   await label(p,finish);await p.waitForNetworkIdle({idleTime:800});
   const state=await p.evaluate(bounds=>{const section=[...document.querySelectorAll('[aria-label="Live bottle preview"]')].find(e=>e.offsetWidth),svg=section.querySelector('svg[role="img"]'),body=section.querySelector('[data-builder-layer="body"]');
    if(!svg||!body)throw Error('Missing builder frame');const url=body.getAttribute('href'),b=bounds[url];if(!b)throw Error('Unknown source bounds '+url);
    const m=body.getScreenCTM(),left=new DOMPoint(b.left,b.top).matrixTransform(m),right=new DOMPoint(b.right,b.bottom).matrixTransform(m);return {viewBox:svg.getAttribute('viewBox'),bodyWidth:right.x-left.x,bodyUrl:url};},bounds);
   if(prior&&state.viewBox!==prior.viewBox)throw Error('Finish moved camera');prior=state;
   bodyWidths.push(state.bodyWidth);checks.push({surface:'builder',color,finish,...state,pass:true});
   await p.screenshot({path:`${dir}/framing-builder-circle100-${color}-${finish.replaceAll(' ','-')}.png`});
  }await p.close();
 }
 if(Math.max(...bodyWidths)-Math.min(...bodyWidths)>.5)throw Error('Glass changed width across materials');
 if(errors.length)throw Error(errors.join('\n'));
 console.log(`Passed ${checks.length} framing checks; Circle body widths ${bodyWidths.map(n=>n.toFixed(2)).join(', ')} px.`);
} catch(e) {console.error(e.stack);errors.push(e.stack);process.exitCode=1;for(const p of await browser.pages())if(p.url().startsWith(base))await p.screenshot({path:dir+'/framing-browser-failure.png'});}
finally{fs.writeFileSync(dir+'/framing-browser-checks.json',JSON.stringify({checkedAt:new Date().toISOString(),base,checks,errors},null,2)+'\n');await browser.close();}
