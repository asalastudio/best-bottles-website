const fs = require('fs');
const root = '/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/.claude/worktrees/branch-setup-localhost-c1fea9';
const pp = require(root + '/node_modules/puppeteer-core');
const generated = 'f769786d251fa57fa592825f790db1c62d9f3c75d8031647313bd15a9ee591d8.body.png';
const out = root + '/docs/reviews/vial-2ml-source-correction-2026-10-31/default-local-navigation';
fs.mkdirSync(out, { recursive: true });
(async () => {
 const browser = await pp.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page = await browser.newPage();
 const checks = [];
 try {
  await page.setViewport({width:1440,height:1050});
  const verify = async (name) => {
   await page.waitForFunction(hash => [...document.querySelectorAll('[data-testid="pdp-stage"] img')].some(i => decodeURIComponent(i.currentSrc || i.src).includes(hash) && i.complete && i.naturalWidth > 0), {}, generated);
   const data = await page.evaluate(() => ({url:location.href,hasPreviewFlag:new URL(location.href).searchParams.has('assetPreview'),overflow:document.documentElement.scrollWidth>innerWidth,pick:document.querySelector('[data-testid="pdp-pick-line"]')?.textContent,body:[...document.querySelectorAll('[data-testid="pdp-stage"] img')].map(i=>({url:i.currentSrc,loaded:i.complete&&i.naturalWidth>0}))}));
   if (data.hasPreviewFlag || data.overflow || data.body.some(i=>!i.loaded)) throw Error(name + ': ' + JSON.stringify(data));
   checks.push({name,...data});await page.screenshot({path:out+'/'+name+'.png'});
  };
  await page.goto('http://localhost:3010/catalog?search=GBVialClr2mlWhtCap',{waitUntil:'domcontentloaded',timeout:60000});
  const link='a[href^="/products/vial-2ml-clear-8-425"]';await page.waitForSelector(link,{timeout:30000});await page.click(link);
  await verify('catalog-entry');
  await page.reload({waitUntil:'domcontentloaded'});await verify('reload');
  await page.click('[data-cap-id="black"]');await page.waitForFunction(()=>document.querySelector('[data-testid="pdp-pick-line"]')?.textContent.includes('Black') || document.querySelector('[data-testid="pdp-pick-line"]')?.textContent.includes('BLACK'));
  await verify('black-cap');
  for (const view of ['capon','exploded','sidecar']) {await page.click('[data-testid="pdp-view-'+view+'"]');await new Promise(r=>setTimeout(r,500));await verify('black-'+view);}
  await page.evaluate(()=>[...document.querySelectorAll('[data-testid="pdp-glass-lineup"] button')].find(b=>b.textContent.trim()==='Amber').click());
  await page.waitForFunction(()=>location.pathname.includes('vial-2ml-amber'));
  await page.waitForFunction(()=>document.querySelector('[data-testid="pdp-pick-line"]')?.textContent.toLowerCase().includes('amber'));
  const amberGenerated=await page.evaluate(hash=>[...document.querySelectorAll('[data-testid="pdp-stage"] img')].some(i=>decodeURIComponent(i.currentSrc||i.src).includes(hash)),generated);
  if(amberGenerated)throw Error('Clear candidate applied to amber');checks.push({name:'amber-unchanged',passed:true});
  await page.evaluate(()=>[...document.querySelectorAll('[data-testid="pdp-glass-lineup"] button')].find(b=>b.textContent.trim()==='Clear').click());
  await page.waitForFunction(()=>location.pathname.includes('vial-2ml-clear'));
  await verify('return-from-amber');
  await page.goto('http://localhost:3010/products/vial-2ml-clear-8-425?cap=white',{waitUntil:'domcontentloaded'});await verify('normal-white-url');
  await page.setViewport({width:390,height:844});await page.reload({waitUntil:'domcontentloaded'});await verify('mobile-reload');
  fs.writeFileSync(out+'/checks.json',JSON.stringify(checks,null,2));console.log(JSON.stringify({passed:checks.length,names:checks.map(c=>c.name)}));
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
