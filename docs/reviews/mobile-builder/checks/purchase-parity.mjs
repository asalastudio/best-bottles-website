import p from "puppeteer-core";
import assert from "node:assert/strict";
import fs from "node:fs";

(async()=>{const browser=await p.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const results=[];try{
for(const [body,fitment,finish] of [['5 ml, 13-415 neck','Metal Roller','Matte Gold Cap'],['9 ml, 17-415 neck','Fine Mist Sprayer',null],['50 ml, 18-415 neck','Lotion Pump','Copper'],['50 ml, 18-415 neck','Vintage Bulb Sprayer',null]]){
 console.log("branch",body,fitment);let chosenFinish=finish;let baseline;
 for(const mobile of [false,true]){console.log("surface",mobile);const page=await browser.newPage();page.setDefaultTimeout(20000);await page.setViewport({width:mobile?390:1440,height:mobile?844:1000,isMobile:true,hasTouch:true});let request;await page.setRequestInterception(true);page.on('request',r=>{if(r.url().includes('/api/bottle-builder/validate')){request=JSON.parse(r.postData());return r.respond({status:503,contentType:'application/json',body:JSON.stringify({error:'Verification only'})})}return r.continue()});
 await page.goto('http://localhost:3001'+'/matrix?family=Cylinder',{waitUntil:'domcontentloaded',timeout:120000});const scope=mobile?'[data-mobile-builder]':'[data-bottle-builder]';await page.waitForSelector(scope,{timeout:120000});
 const option=async label=>{await page.locator(scope+' '+(mobile?'input[type=radio]':'button')+'[aria-label="'+label+'"]').click();await new Promise(r=>setTimeout(r,100))};
 const button=async text=>{await page.evaluate(({scope,text})=>{const b=[...document.querySelectorAll(scope+' button')].find(b=>b.textContent.trim()===text&&b.getBoundingClientRect().height>0);if(!b)throw Error('No button '+text);b.click()},{scope,text});await new Promise(r=>setTimeout(r,150))};
 await option(body);if(mobile)await button('Continue to glass');await option('Clear');await button(mobile?'Continue to fitment':'Choose Fitment');await option(fitment);if(mobile)await button('Continue to finish');
 if(!chosenFinish)chosenFinish=await page.$eval(scope+' '+(mobile?'input[type=radio]':'[class*=closureGrid] button[aria-label]'),e=>e.getAttribute('aria-label'));
 await option(chosenFinish);await button(mobile?'Review bottle':'Review Your Bottle');await page.waitForSelector(scope+' input[type=number]');
 const price=await page.$eval(scope,e=>({unit:e.innerText.match(/Unit price\s*(\$[\d,.]+)/i)?.[1],total:e.innerText.match(/Total[^$]*?(\$[\d,.]+)/i)?.[1]}));
 if(body.startsWith('5 ml')){await page.setViewport({width:1440,height:1000,isMobile:true,hasTouch:true});await new Promise(r=>setTimeout(r,400));await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'docs/reviews/mobile-builder/'+(mobile?'after':'before')+'-desktop-matched.png'});await page.setViewport({width:mobile?390:1440,height:mobile?844:1000,isMobile:true,hasTouch:true});await new Promise(r=>setTimeout(r,300));}
 await button(mobile?(await page.$$eval(scope+' button',es=>es.find(e=>e.textContent.includes('Add to cart ·')).textContent.trim())):'Add to Cart');await page.waitForFunction(()=>document.body.innerText.includes('Verification only'),{timeout:30000});
 if(!mobile)baseline={request,price};else {assert.deepEqual(request,baseline.request);assert.deepEqual(price,baseline.price);results.push({body,fitment,finish:chosenFinish,request,baselinePrice:baseline.price,mobilePrice:price});}
 await page.close();
 }
}
fs.writeFileSync('docs/reviews/mobile-builder/purchase-parity.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
