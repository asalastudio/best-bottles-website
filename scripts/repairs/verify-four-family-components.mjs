import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const base = process.env.REPAIR_PREVIEW_URL || 'http://localhost:3056';
const output = 'output/four-family-component-cleanup';
fs.mkdirSync(output, {recursive: true});
const recipes = JSON.parse(fs.readFileSync('convex/repairs/fourFamilyComponents.json', 'utf8'));
const browser = await puppeteer.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, protocolTimeout: 180000});
const results = [];
const finishes = [
  ['Black, Shiny Silver Collar','GBCrclFrst100AnSpTslBlk'], ['Gold','GBCrclFrst100AnSpTslGl'],
  ['Ivory + Silver','GBCrclFrst100AnSpTslIvySl'], ['Ivory Gold','GBCrclFrst100AnSpTslIvyGl'],
  ['Lavender, Shiny Silver Collar','GBCrclFrst100AnSpTslLvn'], ['Matte Silver','GBCrclFrst100AnSpTslMtSl'],
  ['Pink, Shiny Gold Collar','GBCrclFrst100AnSpTslPnk'], ['White, Shiny Silver Collar','GBCrclFrst100AnSpTslWht'],
];
async function label(page, value) {
  await page.waitForFunction(value => [...document.querySelectorAll('button[aria-label]')].some(b => b.offsetWidth && !b.disabled && b.getAttribute('aria-label') === value), {timeout:45000}, value);
  const handle = await page.evaluateHandle(value => [...document.querySelectorAll('button[aria-label]')].find(b => b.offsetWidth && !b.disabled && b.getAttribute('aria-label') === value), value);
  if (!handle.asElement()) throw Error(`Missing enabled choice: ${value}`);
  await handle.asElement().click();
}
async function textButton(page, value) {
  await page.waitForFunction(value => [...document.querySelectorAll('button')].some(b => b.offsetWidth && !b.disabled && b.innerText.trim() === value), {timeout:45000}, value);
  const handle = await page.evaluateHandle(value => [...document.querySelectorAll('button')].find(b => b.offsetWidth && !b.disabled && b.innerText.trim() === value), value);
  if (!handle.asElement()) throw Error(`Missing enabled button: ${value}`);
  await handle.asElement().click();
}
async function choose(page, body, color) {
  const hydrated = page.waitForResponse(r => r.url().includes('/api/bottle-builder/families') && r.status() === 200, {timeout:60000});
  const response = await page.goto(`${base}/matrix?family=Circle`, {waitUntil:'domcontentloaded', timeout:180000});
  await hydrated;
  if (response.status() !== 200) throw Error(`Builder HTTP ${response.status()}`);
  await page.waitForSelector(`button[aria-label="${body}"]`, {timeout:60000});
  await label(page,body);
  await page.waitForNetworkIdle({idleTime:500,timeout:15000}).catch(()=>{});
  const colorVisible = await page.evaluate(color => [...document.querySelectorAll('[aria-label="Bottle options"] button')].some(b=>b.offsetWidth && !b.disabled && b.getAttribute('aria-label') === color), color);
  if (color === 'Frosted' || colorVisible) await label(page,color);
  await textButton(page,'Choose Fitment');
  await label(page,'Vintage Style Bulb Sprayer with Tassel');
}
try {
  let page = await browser.newPage(); await page.setViewport({width:1440,height:1080});
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(`${page.url()}\n${e.stack}`));
  await choose(page,'100 ml, 18-415 neck','Frosted');
  for (const [finish,sku] of finishes) {
    await label(page,finish);
    const expected = recipes.kitRoles.find(r => r.sku === sku).after.parts.find(p => p.slot === 'sprayer').sha256;
    await page.waitForFunction(hash => [...document.querySelectorAll('[aria-label="Live bottle preview"] [data-builder-layer="sprayer"]')].some(i => (i.getAttribute('href') || i.getAttribute('src') || '').includes(hash)), {timeout:30000},expected);
    const layers = await page.$$eval('[aria-label="Live bottle preview"] [data-builder-layer]', nodes => nodes.map(n => ({slot:n.getAttribute('data-builder-layer'),url:n.getAttribute('href')||n.getAttribute('src')})));
    if (layers.filter(l => l.slot === 'body').length !== 1) throw Error(`Wrong body count: ${sku}`);
    await page.screenshot({path:`${output}/${sku}.png`});
    results.push({surface:'builder',sku,layers,pass:true}); console.log('Builder passed:',sku);
  }
  await page.close(); page = await browser.newPage(); await page.setViewport({width:1440,height:1080});
  await choose(page,'50 ml, 18-415 neck','Clear'); await label(page,'Matte Silver');
  const sku='GBCrcl50AnSpTslMtSl',expected=recipes.kitRoles.find(r=>r.sku===sku).after.parts.find(p=>p.slot==='sprayer').sha256;
  await page.waitForFunction(hash => [...document.querySelectorAll('[data-builder-layer="sprayer"]')].some(i=>(i.getAttribute('href')||i.getAttribute('src')||'').includes(hash)),{timeout:30000},expected);
  await page.screenshot({path:`${output}/${sku}.png`}); results.push({surface:'builder',sku,pass:true});
  await page.close();

  for (const width of [1440,390]) for (const slug of [
    'cylinder-9ml-clear-17-415-rollon','circle-50ml-frosted-18-415-antiquespray',
    'round-78ml-frosted-18-415-antiquespray','empire-50ml-clear-18-415-perfumespray',
  ]) {
    const pdp=await browser.newPage(); await pdp.setViewport({width,height:1000});
    pdp.on('pageerror',e=>pageErrors.push(`${pdp.url()}\n${e.stack}`));
    const response=await pdp.goto(`${base}/products/${slug}`,{waitUntil:'domcontentloaded',timeout:180000});
    await pdp.waitForSelector('[data-testid="pdp-focused-cta"], [data-testid="mobile-pdp"]',{timeout:45000});
    await pdp.waitForFunction(() => [...document.images].filter(i=>i.offsetWidth && i.getBoundingClientRect().top < innerHeight)
      .every(i => i.complete && i.naturalWidth > 0), {timeout:30000});
    const state=await pdp.evaluate(()=>({title:document.querySelector('h1')?.textContent,
      secondary:!!document.querySelector('[data-testid="pdp-desktop-secondary"]'),
      text:document.body.innerText,brokenImages:[...document.images].filter(i=>i.offsetWidth && i.complete&&!i.naturalWidth).map(i=>i.src)}));
    if(response.status()!==200||state.secondary||!state.title||state.brokenImages.length)throw Error(`PDP failed ${slug}/${width}`);
    await pdp.screenshot({path:`${output}/${slug}-${width}.png`});
    results.push({surface:'pdp',slug,width,http:response.status(),...state,pass:true});
    console.log('PDP passed:',slug,width);await pdp.close();
  }
  const component=await browser.newPage();
  await component.goto(`${base}/products/cap-closure-18-415`,{waitUntil:'domcontentloaded',timeout:180000});
  await component.waitForSelector('[data-testid="pdp-desktop-secondary"]',{timeout:45000});
  results.push({surface:'component-pdp',slug:'cap-closure-18-415',secondaryRetained:true,pass:true});
  results.push({pageErrors});
  if(pageErrors.length)throw Error(pageErrors.join('\n'));
} catch (e) {
  for (const p of await browser.pages()) if (p.url().startsWith(base)) {
    results.push({failureUrl:p.url(),state:await p.evaluate(()=>document.body.innerText)});
    await p.screenshot({path:`${output}/failure.png`});
  }
  results.push({error:e.stack}); console.error(e.stack); process.exitCode=1;
}
finally { fs.writeFileSync(`${output}/browser-checks.json`,JSON.stringify({checkedAt:new Date().toISOString(),base,results},null,2)+'\n'); await browser.close(); }
