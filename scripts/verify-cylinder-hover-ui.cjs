const fs=require('node:fs');
const path=require('node:path');
const runtime=process.env.CYLINDER_RUNTIME_ROOT || process.cwd();
const puppeteer=require(require.resolve('puppeteer-core',{paths:[runtime]}));
const heroes=require(path.resolve('src/lib/products/cylinder-catalog-heroes.json'));
const base=process.env.CYLINDER_UI_URL || 'http://localhost:3002';
const out=path.resolve('output/cylinder-hover-ui');fs.mkdirSync(out,{recursive:true});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const report={base,at:new Date().toISOString(),views:[],errors:[]};
 try{
  for(const [name,route,mobile] of [['catalog-desktop','/catalog?families=Cylinder&limit=240',false],['family-desktop','/catalog/cylinder',false],['catalog-mobile','/catalog?families=Cylinder&limit=240',true],['family-mobile','/catalog/cylinder',true]]){
   console.log('Checking '+name);const context=await browser.createBrowserContext();const page=await context.newPage();
   page.on('pageerror',e=>report.errors.push({name,error:e.message}));
   await page.setViewport({width:mobile?390:1440,height:mobile?844:1000,isMobile:mobile,hasTouch:mobile});
   await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>document.querySelectorAll('div[data-bb-studio-hero="true"]').length===52,{timeout:60000});
   const cards=await page.$$('div[data-bb-studio-hero="true"]');const checks=[];
   for(const el of cards){
    await el.evaluate(e=>e.scrollIntoView({block:'center'}));
    await page.waitForFunction(e=>[...e.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0),{timeout:60000},el);
    await el.hover();
    await page.waitForFunction((e,expected)=>e.dataset.hoverReady==='true'&&getComputedStyle(e.querySelector('[data-bb-hero-state="filled"]')).opacity===expected,{timeout:10000},el,mobile?'0':'1');
    const result=await el.evaluate(e=>({sku:e.dataset.bbWebsiteSku,slug:e.dataset.bbProductGroupSlug,ready:e.dataset.hoverReady,opacity:getComputedStyle(e.querySelector('[data-bb-hero-state="filled"]')).opacity,href:e.querySelector('a').getAttribute('href'),states:[...e.querySelectorAll('img')].map(i=>({state:i.dataset.bbHeroState,src:i.currentSrc,transform:i.style.transform,naturalWidth:i.naturalWidth,mask:getComputedStyle(i).maskImage}))}));
    const hero=heroes.find(h=>h.websiteSku===result.sku);if(!hero)throw Error('Unmapped SKU '+result.sku);
    if(result.opacity!==(mobile?'0':'1')||result.ready!=='true')throw Error('Hover '+JSON.stringify(result));
    if(new URL(result.href,base).searchParams.get('sku')!==result.sku)throw Error('Wrong pictured SKU route');
    for(const s of result.states){const url=s.state==='empty'?hero.url:hero.hoverUrl;if(!decodeURIComponent(s.src).includes(url))throw Error('Wrong state asset');if(s.mask!=='none')throw Error('Unexpected image masking');}
    checks.push(result);
   }
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal overflow '+name);
   await page.mouse.move(0,0);await page.evaluate(()=>scrollTo(0,0));await delay(400);
   await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
   await cards[0].evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(out,name+'-viewport.png')});
   const plastic=await page.$('div[data-bb-studio-hero="true"][data-bb-website-sku="PbClear4ozFlpWh"]');await plastic.evaluate(e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:path.join(out,name+'-plastics.png')});
   await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
   if(await page.$eval('[data-bb-hero-state="filled"]',i=>getComputedStyle(i).transitionDuration)!=='0s')throw Error('Reduced motion');
   report.views.push({name,cards:checks.length,checks,overflow:false,reducedMotion:true});await context.close();
  }
  console.log('Checking failed-hover fallback');
  const context=await browser.createBrowserContext();const page=await context.newPage();await page.setRequestInterception(true);
  page.on('request',r=>decodeURIComponent(r.url()).includes('/cylinder-hover/')&&r.url().includes('-filled.')?r.abort():r.continue());
  await page.goto(base+'/catalog?families=Cylinder&limit=240',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('div[data-bb-studio-hero="true"]');const first=await page.$('div[data-bb-studio-hero="true"]');await first.evaluate(e=>e.scrollIntoView());await first.hover();await page.waitForFunction(e=>!!e.querySelector('[data-bb-hero-state="empty"]')?.naturalWidth&&!e.querySelector('[data-bb-hero-state="filled"]'),{timeout:30000},first);
  const fallback=await first.evaluate(e=>({emptyVisible:!!e.querySelector('[data-bb-hero-state="empty"]')?.naturalWidth,filledRemoved:!e.querySelector('[data-bb-hero-state="filled"]'),ready:e.dataset.hoverReady}));
  if(!fallback.emptyVisible||!fallback.filledRemoved||fallback.ready!=='false')throw Error('Fallback '+JSON.stringify(fallback));report.failedHoverFallback=fallback;
  fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(report,null,2));
  if(report.errors.length)throw Error('Browser errors '+JSON.stringify(report.errors));
  console.log('208 catalog/finder desktop/touch hover checks passed across all 52 pairs.');
 }finally{await browser.close();}
})();
