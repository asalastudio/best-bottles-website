const p=require('puppeteer-core'),fs=require('fs');
(async()=>{
 const browser=await p.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
 const checks=[],errors=[],doc='docs/reviews/cylinder9-sunburst-2026-11-01';
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage();await page.setCacheEnabled(false);page.on('pageerror',e=>errors.push(String(e)));
   await page.setViewport({width,height:1000,deviceScaleFactor:1});
   const response=await page.goto('http://127.0.0.1:3010/reviews/cylinder9-sunburst-2026-11-01/index.html?qa='+Date.now(),{waitUntil:'networkidle0',timeout:60000});
   if(![200,304].includes(response.status()))throw Error('HTTP '+response.status());
   await page.waitForSelector('#stages .stage img');
   await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
   for(const bg of ['','checker','dark']){
    await page.click('[data-bg="'+bg+'"]');
    const result=await page.evaluate(()=>({imagesDecoded:[...document.images].every(i=>i.complete&&i.naturalWidth>0),overflow:document.documentElement.scrollWidth>innerWidth,imageCount:document.images.length,background:document.body.className,uniformRatios:[...document.querySelectorAll('.stage img')].map(i=>{const b=i.getBoundingClientRect();return Math.abs((b.width/b.height)/(i.naturalWidth/i.naturalHeight)-1)<.001})}));
    checks.push({width,...result});
    await page.screenshot({path:doc+'/comparison-'+width+'-'+(bg||'catalog')+'.png',fullPage:true});
   }await page.close();
  }
 }finally{await browser.close()}
 fs.writeFileSync(doc+'/browser-checks.json',JSON.stringify({checks,errors,notes:['Initial browser harness required HTTP 200 and stopped on valid cached HTTP 304. Rerun disables cache and accepts 304 before inspecting rendered content.']},null,2)+'\n');
 console.log(JSON.stringify({checks,errors}));
 if(errors.length||checks.some(c=>!c.imagesDecoded||c.overflow||!c.uniformRatios.every(Boolean)))process.exitCode=1;
})();