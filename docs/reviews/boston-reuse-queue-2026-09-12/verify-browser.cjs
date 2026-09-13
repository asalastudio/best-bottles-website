const assert=require('node:assert/strict');
const fs=require('node:fs');
const puppeteer=require('puppeteer-core');
(async()=>{
 const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try {
  const page=await browser.newPage();await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto('http://localhost:3040/team/asset-ledger?preview=1',{waitUntil:'networkidle2'});assert.equal(response.status(),200);
  const ledger=JSON.parse(fs.readFileSync('src/lib/asset-ledger/ledger.json'));const rows=ledger.rows.filter(r=>r.productRecord&&r.family==='Boston Round');
  const text=()=>page.$eval('#reuse-queue',e=>e.innerText);
  const click=async(label)=>{const found=await page.evaluate(label=>{const el=[...document.querySelectorAll('#reuse-queue button')].find(e=>e.textContent===label);el?.click();return !!el;},label);assert(found,label);};
  const select=async(label,value)=>{await page.evaluate(({label,value})=>{const el=[...document.querySelectorAll('#reuse-queue label')].find(e=>e.firstChild.textContent===label).querySelector('select');el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));},{label,value});};
  const waitFor=async(t)=>page.waitForFunction(t=>document.querySelector('#reuse-queue').innerText.includes(t),{},t);
  await waitFor('16 of 16 configurations');
  await click('30 mL · 53');await waitFor('53 of 53 configurations');
  await click('60 mL · 54');await waitFor('54 of 54 configurations');
  await click('All sizes · 123');await waitFor('123 of 123 configurations');
  await click('15 mL · 16');await waitFor('16 of 16 configurations');
  await select('Glass color','Amber');const amber=rows.filter(r=>r.capacityMl===15&&r.color==='Amber').length;await waitFor(`${amber} of 16 configurations`);
  await click('Clear queue filters');await select('Asset to focus on','kit');await select('Next-action filter','review');await waitFor('8 of 16 configurations');
  await click('Clear queue filters');await click('Show next 4 configurations');await waitFor('showing 16');assert.equal(await page.$$eval('#reuse-queue article',e=>e.length),16);
  await page.evaluate(()=>{const old=URL.createObjectURL;URL.createObjectURL=function(blob){window.queueDownload=blob;return old.call(this,blob);};});await click('Download family inventory');
  const csv=await page.evaluate(()=>window.queueDownload.text());assert.equal(csv.split('\r\n').length,124);fs.writeFileSync('docs/reviews/boston-reuse-queue-2026-09-12/inventory.csv',csv);
  await click('30 mL · 53');await waitFor('53 of 53 configurations');
  await page.$eval('#reuse-queue input',e=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(e,'GBBstn1ozBlkCapSht');e.dispatchEvent(new Event('input',{bubbles:true}));});
  await waitFor('1 of 53 configurations');assert((await text()).includes('Resized image approved'));
  await page.$eval('#reuse-queue article summary',e=>e.click());await click('Open saved final image review');await page.waitForFunction(()=>document.body.innerText.includes('Approved — saved'));
  await page.evaluate(()=>{const el=[...document.querySelectorAll('button')].find(e=>e.textContent==='Close image review');el?.click();});
  await click('15 mL · 16');await waitFor('16 of 16 configurations');
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'docs/reviews/boston-reuse-queue-2026-09-12/after-desktop.png'});
  await page.$eval('#reuse-queue',e=>e.scrollIntoView());await page.screenshot({path:'docs/reviews/boston-reuse-queue-2026-09-12/queue-desktop.png'});
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'docs/reviews/boston-reuse-queue-2026-09-12/after-mobile.png'});
  await page.$eval('#reuse-queue',e=>e.scrollIntoView());await page.screenshot({path:'docs/reviews/boston-reuse-queue-2026-09-12/queue-mobile.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await click('30 mL · 53');await waitFor('53 of 53 configurations');await click('15 mL · 16');await waitFor('16 of 16 configurations');
  assert.deepEqual(errors,[]);
  const result={http:response.status(),pageErrors:errors,familyRows:rows.length,sizeCounts:[16,53,54],csvRows:123,mobileOverflow:false,checks:['size batches','glass-color filter','kit review filter','pagination','family CSV export','exact approved 30 mL review preserved','mobile size switching'],snapshot:ledger.generatedAt};fs.writeFileSync('docs/reviews/boston-reuse-queue-2026-09-12/browser-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
