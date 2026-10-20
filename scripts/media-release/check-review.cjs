const { chromium } = require('/Users/jordanrichter/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');const crypto=require('node:crypto');const path=require('node:path');
(async()=>{
 const out=path.join(process.cwd(),'docs/reviews/empire-round-release-prep-2026-10-20');
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
 const page=await browser.newPage({viewport:{width:1365,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));const external=[];page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:3010/'))external.push(r.url());});
 await page.goto('http://127.0.0.1:3010/',{waitUntil:'networkidle'});
 const images=await page.locator('img').evaluateAll(imgs=>imgs.map(i=>({url:i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0})));
 if(images.length!==26||images.some(i=>!i.loaded)||errors.length||external.length)throw Error(JSON.stringify({images,errors,external}));
 await page.screenshot({path:path.join(out,'local-review-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'local-review-mobile.png'),fullPage:true});
 const overflows=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);if(overflows)throw Error('Mobile overflow');
 const manifest=JSON.parse(fs.readFileSync('src/lib/media-release/manifest.json','utf8'));
 for(const url of new Set(Object.values(manifest.assetMap))){const res=await page.request.get('http://127.0.0.1:3010'+url);if(!res.ok())throw Error('Asset unavailable');const sha=crypto.createHash('sha256').update(await res.body()).digest('hex');if(!url.includes(sha))throw Error('Served hash mismatch');}
 const report={kind:'local contact sheet, not hosted storefront QA',catalogImages:images.length,assetHashesOverHttp:new Set(Object.values(manifest.assetMap)).size,desktop:'1365x1000',mobile:'390x844',mobileOverflow:overflows,pageErrors:errors,externalRequests:external};fs.writeFileSync(path.join(out,'local-review-browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
