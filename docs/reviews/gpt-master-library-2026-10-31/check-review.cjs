const fs=require('fs'),pp=require('puppeteer-core');
(async()=>{const out='outputs/catalog-model-repair-2026-10-31/gpt-master-library';const b=await pp.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.setViewport({width:1450,height:1050});await p.goto('http://localhost:3010/reviews/gpt-master-library-2026-10-31/index.html',{waitUntil:'networkidle0'});await p.waitForFunction(()=>window.masterRows?.length===109);
async function images(){await p.evaluate(()=>document.querySelectorAll('img').forEach(x=>x.loading='eager'));await p.evaluate(()=>Promise.all([...document.querySelectorAll('img')].map(im=>im.decode().catch(()=>{}))));}
let pages=[];for(let i=0;i<6;i++){await images();if(!i)await p.screenshot({path:out+'/desktop.png'});pages.push(await p.evaluate(()=>({page:document.querySelector('#page').textContent,keys:[...document.querySelectorAll('#grid .card')].map(x=>x.dataset.key),broken:[...document.images].filter(x=>!x.naturalWidth).map(x=>x.src),geometry:[...document.querySelectorAll('#grid .card')].map(card=>{const r=window.masterRows.find(r=>r.plateKey===card.dataset.key),stage=card.querySelector('.stage').getBoundingClientRect(),img=card.querySelector('img').getBoundingClientRect();const ax=(img.x-stage.x)+r.anchors.axisX*img.width/r.verification.width,base=(img.y-stage.y)+r.anchors.baselineY*img.height/r.verification.height;return{key:r.plateKey,axisErrorPx:Math.abs(ax-stage.width*.5),baselineErrorPx:Math.abs(base-stage.height*.91),uniformScaleError:Math.abs(img.width/r.verification.width-img.height/r.verification.height)}})})));if(i<5)await p.evaluate(()=>document.querySelector('#next').click());}
await p.click('#show-preferred');await images();
const preferredReview=await p.evaluate(()=>({
 count:document.querySelector('#count').textContent,
 keys:[...document.querySelectorAll('#grid .card')].map(x=>x.dataset.key),
 allProtected:window.masterRows.filter(r=>r.visualReview.decision==='preferred-candidate').every(r=>r.visualReview.protectedReference&&!r.visualReview.finalVisualApproval&&!r.visualReview.assemblyVerified)
}));
if(preferredReview.keys.length!==10||!preferredReview.allProtected)throw new Error('Preferred candidate selection is incorrect');
await p.select('#review-status','individual-review');
const pendingReview=await p.$eval('#count',x=>x.textContent);
if(!pendingReview.startsWith('98 '))throw new Error('Unreviewed bodies were incorrectly approved');
await p.select('#review-status','held-wrong-source');
const heldKeys=await p.$$eval('#grid .card',cards=>cards.map(c=>c.dataset.key));
if(heldKeys.length!==1||heldKeys[0]!=='cream-jar-20ml-40mm|White')throw new Error('Existing hold was lost');
await p.select('#review-status','');
await p.select('#family','Cylinder');await p.select('#glass','Cobalt Blue');await images();const filters=await p.$eval('#count',x=>x.textContent);await p.select('#mode','large');await p.setViewport({width:390,height:844});await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:out+'/mobile.png'});const mobile=await p.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth}));const all=pages.flatMap(x=>x.geometry);const report={checkedAt:new Date().toISOString(),pages:pages.map(({geometry,...x})=>x),uniqueKeys:new Set(pages.flatMap(x=>x.keys)).size,errors,preferredReview,pendingReview,heldKeys,filters,mobile,maxAxisErrorPx:Math.max(...all.map(x=>x.axisErrorPx)),maxBaselineErrorPx:Math.max(...all.map(x=>x.baselineErrorPx)),maxUniformScaleError:Math.max(...all.map(x=>x.uniformScaleError)),scope:'Source-gallery scale placement and image load verification. Not storefront/component visual approval.'};
fs.writeFileSync(out+'/browser-checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,pages:pages.map(x=>({page:x.page,images:x.keys.length,broken:x.broken.length}))},null,2));await b.close();if(errors.length||pages.some(x=>x.broken.length)||report.uniqueKeys!==109)process.exit(1);
})().catch(e=>{console.error(e.message);process.exit(1)});
