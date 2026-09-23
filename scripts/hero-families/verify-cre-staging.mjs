/** Read-only exact-SKU audit of the reviewed Circle/Round/Empire catalog release. */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.REVIEW_URL;if(!base)throw new Error('Set REVIEW_URL');
const rows=JSON.parse(fs.readFileSync('src/lib/products/catalog-hero-cre-pilot.json'));
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const report={url:base,checkedAt:new Date().toISOString(),views:[],errors:[],screenshots:[]};
try{
for(const mobile of [false,true]){
 const page=await browser.newPage();await page.setViewport(mobile?{width:390,height:844}:{width:1440,height:1100});page.on('pageerror',e=>report.errors.push(e.message));
 for(const route of ['/catalog','family']){
  const seen=new Set();
  for(const family of ['Circle','Round','Empire']){
   const capacities=[...new Set(rows.filter(r=>r.family===family).map(r=>r.capacityMl))];
   const queries=capacities.map(c=>`family=${family}&capacities=${encodeURIComponent(`${c} ml`)}`);
   if(family==='Circle')queries.push('family=Circle&capacities=15%20ml&roller=plastic');
   for(const query of queries){
    const url=`${base}${route==='family'?`/catalog/${family.toLowerCase()}`:route}?${query}`;
    const response=await page.goto(url,{waitUntil:'networkidle2',timeout:90000});assert.equal(response.status(),200,url);
    await page.waitForSelector('img[data-bb-image-audit="catalog-card"]',{timeout:60000});
    for(const img of await page.$$('img[data-bb-image-audit="catalog-card"]')){if(!await img.evaluate(e=>e.getBoundingClientRect().width>0))continue;await img.evaluate(e=>e.scrollIntoView({block:'center'}));await img.evaluate(e=>e.decode());}
    const cards=await page.$$eval('img[data-bb-image-audit="catalog-card"]',imgs=>imgs.filter(i=>i.getBoundingClientRect().width>0).map(i=>({sku:i.dataset.bbWebsiteSku,group:i.dataset.bbProductGroupSlug,src:i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0,frame:{width:i.parentElement.clientWidth,height:i.parentElement.clientHeight},href:i.parentElement.querySelector('a')?.getAttribute('href')})));
    for(const card of cards.filter(c=>c.src.includes('cre-pilot-2026-09-22'))){const row=rows.find(r=>r.websiteSku===card.sku);assert.ok(row,`Unknown ${card.sku}`);assert.equal(row.groupSlug,card.group);assert.ok(decodeURIComponent(card.src).includes(row.url));assert.ok(card.loaded);assert.ok(card.href.includes(`sku=${row.websiteSku}`));assert.ok(Math.abs(card.frame.width/card.frame.height-10/11)<.01);seen.add(card.sku);}
    assert.ok(cards.some(c=>c.src.includes('cre-pilot-2026-09-22')),`No new heroes ${url}`);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow');
    report.views.push({mobile,route,family,query,cards});
    console.log(`${mobile?'mobile':'desktop'} ${route} ${query}: ${cards.length} cards`);
   }
   if(route==='family'){
    await page.evaluate(()=>scrollTo(0,0));const out=`${process.env.REVIEW_SCREENSHOT_DIR||'/tmp'}/${family}-${mobile?'mobile':'desktop'}.png`;await page.screenshot({path:out,fullPage:false});report.screenshots.push(out);
   }
  }
  const missing=rows.filter(r=>!seen.has(r.websiteSku)).map(r=>r.websiteSku);assert.deepEqual(missing,[],`Missing heroes ${mobile} ${route}`);
 }
 await page.close();
}
assert.deepEqual(report.errors,[]);report.result='pass-all-60-exact-heroes-both-catalog-routes-desktop-and-mobile';
}finally{fs.writeFileSync(process.env.REVIEW_REPORT||'/tmp/cre-staging-browser.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
