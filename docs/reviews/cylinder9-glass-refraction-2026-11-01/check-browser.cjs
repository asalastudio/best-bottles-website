const p=require('puppeteer-core'),fs=require('fs');
(async()=>{
 const b=await p.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
 const checks=[],errors=[],d='docs/reviews/cylinder9-glass-refraction-2026-11-01';
 try {for(const width of [1440,390]){
  const page=await b.newPage();await page.setCacheEnabled(false);page.on('pageerror',e=>errors.push(String(e)));await page.setViewport({width,height:1000,deviceScaleFactor:1});
  const res=await page.goto('http://127.0.0.1:3010/reviews/cylinder9-glass-refraction-2026-11-01/index.html?qa='+Date.now(),{waitUntil:'networkidle0',timeout:60000});if(![200,304].includes(res.status()))throw Error('HTTP '+res.status());
  await page.waitForSelector('#material-closeup img');await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
  for(const mode of ['light','dark']){if(mode==='dark')await page.click('#dark');for(const view of ['neck','barrel','base']){
   await page.click('[data-view="'+view+'"]');const result=await page.evaluate(()=>({allImagesLoaded:[...document.images].every(i=>i.complete&&i.naturalWidth>0),overflow:document.documentElement.scrollWidth>innerWidth,uniformImages:[...document.images].map(i=>{const r=i.getBoundingClientRect();return r.width===0||Math.abs(r.width/r.height-i.naturalWidth/i.naturalHeight)<.001}),selected:document.querySelector('[data-view][aria-pressed=true]').dataset.view,darkBackground:document.body.classList.contains('dark')}));
   checks.push({width,mode,view,...result});if(width===1440)await(await page.$('#material-closeup')).screenshot({path:d+'/'+view+'-'+mode+'.png'});
  }}
  await page.click('#dark');await page.click('[data-view="neck"]');await page.click('summary');await page.screenshot({path:d+'/page-'+width+'.png',fullPage:true});
  const full=await page.evaluate(()=>[...document.querySelectorAll('.stage')].map(s=>{const a=s.getBoundingClientRect(),i=s.querySelector('img').getBoundingClientRect();return{uniform:Math.abs(i.width/i.height-743/2116)<.001,inside:i.left>=a.left&&i.right<=a.right&&i.top>=a.top&&i.bottom<=a.bottom}}));checks.push({width,mode:'full',full});await page.close();
 }}finally{await b.close()}
 fs.writeFileSync(d+'/browser-checks.json',JSON.stringify({checks,errors},null,2)+'\n');console.log(JSON.stringify({checks,errors}));if(errors.length||checks.some(c=>c.full?c.full.some(f=>!f.uniform||!f.inside):!c.allImagesLoaded||c.overflow||!c.uniformImages.every(Boolean)||c.selected!==c.view||c.darkBackground!==(c.mode==='dark')))process.exitCode=1;
})();
