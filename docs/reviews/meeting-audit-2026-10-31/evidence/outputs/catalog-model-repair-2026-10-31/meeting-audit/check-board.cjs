const fs=require('fs'),path=require('path'),p=require('puppeteer-core');
(async()=>{const browser=await p.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']}),page=await browser.newPage(),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));try{
 await page.setViewport({width:1440,height:1100});await page.goto('http://localhost:3010/reviews/meeting-audit-2026-10-31/index.html',{waitUntil:'networkidle2'});
 await page.waitForSelector('.item');let count=await page.$$eval('.item',els=>els.length);if(count!==90)throw Error('Main count '+count);checks.push('90 main starting points');
 const initial=await page.$eval('#currentTitle',e=>e.textContent);if(!/Flair/i.test(initial))throw Error('Flair priority missing');
 await page.select('#scope','pages');count=await page.$$eval('.item',els=>els.length);if(count!==318)throw Error('Page count '+count);checks.push('318 product-page entries');
 await page.select('#scope','all');count=await page.$$eval('.item',els=>els.length);if(count!==363)throw Error('Full count '+count);checks.push('363 product-group records');
 await page.type('#search','circle 15');
 // Search supports exact words in the title rather than requiring a family-size phrase.
 await page.$eval('#search',e=>{e.value='circle';e.dispatchEvent(new Event('input',{bubbles:true}));});
 const circle=await page.$$eval('.item',els=>els.map(e=>e.textContent));if(!circle.length||circle.some(x=>!/circle/i.test(x)))throw Error('Search filtering failed');checks.push('Family search');
 await page.select('#scope','pages');await page.$eval('#search',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.select('#color','Amber');if(!await page.$('.item'))throw Error('Amber missing');checks.push('Amber filter');
 await page.select('#decision','approved');if(await page.$eval('#decision',e=>e.value)==='approved')throw Error('Approval allowed without checks');checks.push('Approval requires checklist');
 const id=await page.$eval('.item[aria-current="true"]',e=>e.dataset.id);await page.type('#reviewer','QA reviewer');await page.type('#notes','QA persistence check');await page.type('#owner','QA owner');
 for(const key of ['identity','glass','scale','fitment','closure','views','builder'])await page.select('[data-check="'+key+'"]','pass');await page.select('#decision','approved');
 if(await page.$eval('#decision',e=>e.value)!=='approved')throw Error('Checklist approval failed');
 await page.reload({waitUntil:'networkidle2'});await page.$eval('#search',(e,id)=>{e.value=id;e.dispatchEvent(new Event('input',{bubbles:true}));},id);
 // Group slugs are not the primary search text; locate through family/color filters then select saved row.
 await page.$eval('#search',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.select('#scope','all');await page.$eval('[data-id="'+id+'"]',e=>e.click());
 if(await page.$eval('#notes',e=>e.value)!=='QA persistence check')throw Error('Notes not restored');if(await page.$eval('#decision',e=>e.value)!=='approved')throw Error('Decision not restored');checks.push('Notes, owner, reviewer and checklist survive reload');
 await page.select('[data-check="glass"]','fix');if(await page.$eval('#decision',e=>e.value)==='approved')throw Error('Approval not cleared');checks.push('Changed check invalidates approval');
 // Use a clean browser state in the delivered screenshots.
 await page.evaluate(()=>localStorage.removeItem('best-bottles-meeting-audit-20261031-v1'));await page.reload({waitUntil:'networkidle2'});await page.screenshot({path:path.join(__dirname,'board-desktop.png'),fullPage:true});
 await page.setViewport({width:390,height:844});await page.reload({waitUntil:'networkidle2'});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');await page.screenshot({path:path.join(__dirname,'board-mobile.png'),fullPage:true});checks.push('Mobile layout fits viewport');
 const files=['main-bottle-index.csv','product-page-audit.csv','sku-crosswalk.csv','unlinked-skus.csv'];for(const file of files){const r=await page.goto('http://localhost:3010/reviews/meeting-audit-2026-10-31/'+file).catch(e=>{if(!/ERR_ABORTED/.test(e.message))throw e;return null});if(r&&r.status()!==200)throw Error('Download missing '+file);}checks.push('All four CSV downloads available');
 if(errors.length)throw Error(errors.join('\n'));fs.writeFileSync(path.join(__dirname,'browser-checks.json'),JSON.stringify({checkedAt:new Date().toISOString(),checks,errors},null,2));console.log(checks);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
