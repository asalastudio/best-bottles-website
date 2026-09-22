/** Read-only browser audit. Run with REVIEW_URL and optionally BROWSER_PATH. */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.REVIEW_URL;
if(!base) throw new Error('Set REVIEW_URL to the local or deployed staging site');
const expected=JSON.parse(fs.readFileSync('src/lib/products/catalog-hero-pilot.json','utf8'));
const browser=await puppeteer.launch({executablePath:process.env.BROWSER_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const report={url:base,checkedAt:new Date().toISOString(),views:[],errors:[]};
try {
 for(const mobile of [false,true]) {
  const page=await browser.newPage();
  await page.setViewport(mobile?{width:390,height:844}:{width:1440,height:1100});
  page.on('pageerror',e=>report.errors.push(e.message));
  for(const route of ['/catalog','/catalog/cylinder']) {
  const seen=new Set();
  for(const query of ['family=Cylinder&capacities=9%20ml','family=Cylinder&capacities=28%20ml,50%20ml','family=Cylinder&capacities=9%20ml&roller=plastic','family=Cylinder&capacities=50%20ml&roller=plastic']) {
   const response=await page.goto(`${base}${route}?${query}`,{waitUntil:'networkidle2',timeout:90000});
   assert.equal(response.status(),200);
   await page.waitForSelector('img[data-bb-image-audit="catalog-card"]',{timeout:45000});
   for(const img of await page.$$('img[data-bb-image-audit="catalog-card"]')) {
    if (!await img.evaluate(el=>el.getBoundingClientRect().width>0)) continue;
    await img.evaluate(el=>el.scrollIntoView({block:'center'}));
    await img.evaluate(el=>el.decode());
   }
   const cards=await page.$$eval('img[data-bb-image-audit="catalog-card"]',imgs=>imgs.filter(img=>img.getBoundingClientRect().width>0).map(img=>({sku:img.dataset.bbWebsiteSku,group:img.dataset.bbProductGroupSlug,src:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth>0,frame:{width:img.parentElement.clientWidth,height:img.parentElement.clientHeight},href:img.parentElement.querySelector('a')?.getAttribute('href')})));
   for(const card of cards.filter(c=>c.src.includes('cylinder-pilot-2026-09-22'))) {
    const row=expected.find(r=>r.websiteSku===card.sku);
    assert.ok(row,`Unknown hero ${card.sku}`);
    assert.equal(row.groupSlug,card.group);
    assert.ok(decodeURIComponent(card.src).includes(row.url));
    assert.ok(card.loaded);
    assert.ok(card.href.includes(`sku=${row.websiteSku}`));
    assert.ok(Math.abs(card.frame.width/card.frame.height-10/11)<0.01);
    if(query.includes('roller=plastic')) assert.ok(!card.sku.includes('MtlRoll'));
    seen.add(card.sku);
   }
   report.views.push({mobile,route,query,cards});
  }
  assert.equal(seen.size,28,`Expected all 28 heroes at ${mobile?'mobile':'desktop'} viewport`);
  }
  await page.close();
 }
 assert.deepEqual(report.errors,[]);
 fs.writeFileSync(process.env.REVIEW_REPORT||'/tmp/cylinder-staging-browser.json',JSON.stringify(report,null,2)+'\n');
 console.log('PASS: all 28 exact heroes, master catalog and family finder, both viewports, loaded images, SKU links, material filters, 10:11 frames.');
} finally {await browser.close();}
