const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const out = __dirname;
const kit = require('../../../public/local-kits/catalog-followups-2026-10-31/kits.json').rows.GBTulipAmb5SpryGlMatt;
const url = 'http://localhost:3010/products/tulip-5ml-amber-13-415-finemist?cap=matte-gold';
const pause = () => new Promise(r => setTimeout(r, 450));
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
  const report = [];
  try {
    const page = await browser.newPage();
    for (const viewport of [{width:1440,height:1100},{width:390,height:844}]) {
      await page.setViewport(viewport);
      await page.goto(url, {waitUntil:'networkidle2',timeout:60000});
      let firstBody;
      for (const view of ['sidecar','capon','exploded','sidecar']) {
        await page.$eval('[data-testid="pdp-view-'+view+'"]', button => button.click());
        await pause();
        const current = await page.evaluate((kit) => {
          const stage = document.querySelector('[data-testid="pdp-stage"]');
          const s = stage.getBoundingClientRect();
          const rect = selector => {
            const b = stage.querySelector(selector).getBoundingClientRect();
            const slot = stage.querySelector(selector).parentElement.dataset.slot;
            const part = kit.parts.find(p => p.slot === slot);
            const scaleX=b.width/part.box.width, scaleY=b.height/part.box.height;
            return {left:b.left-s.left+(part.bounds.left-part.box.x)*scaleX,right:b.left-s.left+(part.bounds.right-part.box.x)*scaleX,top:b.top-s.top+(part.bounds.top-part.box.y)*scaleY,bottom:b.top-s.top+(part.bounds.bottom-part.box.y)*scaleY,width:(part.bounds.right-part.bounds.left)*scaleX,height:(part.bounds.bottom-part.bounds.top)*scaleY};
          };
          return {view:stage.dataset.view,stage:{width:s.width,height:s.height},body:rect('[data-slot="body"] img'),sprayer:rect('[data-slot="sprayer"] img'),tube:rect('[data-slot="diptube"] img'),cap:rect('[data-slot="overcap"] img'),loaded:[...stage.querySelectorAll('img')].every(i=>i.complete && i.naturalWidth),overflow:document.documentElement.scrollWidth>innerWidth};
        }, kit);
        if (!current.loaded || current.overflow) throw Error('Missing artwork or page overflow');
        firstBody ??= current.body;
        for (const key of ['left','right','top','bottom']) if(Math.abs(current.body[key]-firstBody[key])>0.5) throw Error('Bottle moved: '+key);
        if(view==='exploded') {
          const union = (a,b) => ({left:Math.min(a.left,b.left),right:Math.max(a.right,b.right),top:Math.min(a.top,b.top),bottom:Math.max(a.bottom,b.bottom)});
          const units=[current.body,union(current.sprayer,current.tube),current.cap];
          const gaps=[];
          for(let a=0;a<units.length;a++) for(let b=a+1;b<units.length;b++) gaps.push(Math.max(units[a].left-units[b].right,units[b].left-units[a].right,units[a].top-units[b].bottom,units[b].top-units[a].bottom));
          current.gaps=gaps;
          if(Math.min(...gaps)<8) throw Error('Insufficient visible separation: '+gaps);
          for(const u of units) if(u.left<0 || u.top<0 || u.right>current.stage.width || u.bottom>current.stage.height) throw Error('Part cropped');
          await (await page.$('[data-testid="pdp-stage"]')).screenshot({path:path.join(out,viewport.width+'-spacing-exploded.png')});
          if (viewport.width < 900) {
            const labels = await page.$eval('[data-testid="pdp-component-details"]', element => { const b=element.getBoundingClientRect(); return {count:element.querySelectorAll('dt').length,left:b.left,right:b.right}; });
            if(labels.count!==4 || labels.left<0 || labels.right>viewport.width) throw Error('Mobile labels missing or clipped');
            await page.evaluate(() => scrollTo(0, 0));
            await page.screenshot({path:path.join(out,'390-spacing-with-details.png'),fullPage:true});
          }
          await page.$eval('[data-testid="pdp-zoom"]', button => button.click());
          await pause();
          if(!await page.$('[data-testid="pdp-stage"][data-zoomed="true"]')) throw Error('Zoom did not open');
          await page.keyboard.press('Escape');
          if(await page.$('[data-testid="pdp-stage"][data-zoomed="true"]')) throw Error('Zoom did not close');
        }
        report.push({viewport,...current});
      }
    }
    await page.setViewport({width:1440,height:1100});
    await page.goto('http://localhost:3010/catalog?search=Tulip&category=Glass+Bottle&sort=capacity-asc',{waitUntil:'networkidle2',timeout:60000});
    const link=await page.$('a[href*="/products/tulip-5ml-amber-13-415-finemist"]');
    if(!link) throw Error('Tulip catalog link missing');
    await Promise.all([page.waitForNavigation({waitUntil:'networkidle2'}),link.click()]);
    await page.waitForSelector('[data-testid="pdp-stage"]');
    report.push({catalogNavigation:'passed',url:page.url(),note:'Catalog card links directly to product page; no application quick-view dialog.'});
    fs.writeFileSync(path.join(out,'spacing-browser-checks.json'),JSON.stringify(report,null,2));
    console.log('Passed desktop/mobile spacing, stationary glass, zoom reset, and catalog navigation');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
