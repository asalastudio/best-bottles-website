import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = '/tmp/claude-0/-home-user-best-bottles-website/1dbfd9ca-9557-5228-abec-9cca62f6e5d3/scratchpad';
const URL = 'http://localhost:8123/index.html';

const browser = await chromium.launch({ executablePath: EXE, args:['--no-sandbox','--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport:{ width:1440, height:900 }, deviceScaleFactor:1 });
const errors = [];
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: '+e.message));

await page.goto(URL, { waitUntil:'load' });

// wait for loader to finish
await page.waitForFunction(() => document.getElementById('loader').classList.contains('done'), { timeout: 20000 });
console.log('LOADER unlocked. pct=', await page.textContent('#loader-pct'));
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/v1_coldopen.png` });

// helper: drive the Lenis smooth-scroll target to an absolute Y, wait to settle, snap frame
async function scrollTo(frac){
  await page.evaluate(f => {
    const y = (document.documentElement.scrollHeight - window.innerHeight) * f;
    if (window.__bbLenis) window.__bbLenis.target = y; else window.scrollTo(0,y);
  }, frac);
  await page.waitForTimeout(1400);
}

const shots = [
  [0.10, 'v2_coldopen_settled'],
  [0.20, 'v3_combinations_start'],
  [0.28, 'v4_combinations_mid'],
  [0.33, 'v5_combinations_climax'],
  [0.44, 'v6_light'],
  [0.62, 'v7_range'],
  [0.75, 'v8_close'],
  [0.85, 'v9_macro'],
  [0.93, 'v10_specs'],
  [1.00, 'v11_cta'],
];
const st = {};
for (const [f, name] of shots){
  await scrollTo(f);
  st[name] = await page.evaluate(()=>({ ...window.__bbScrollTrigger, combo: document.getElementById('combo-num')?.textContent }));
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name, JSON.stringify(st[name]));
}

console.log('WEBGL refraction ok:', await page.evaluate(()=>window.__bbRefraction?.ok));
console.log('FRAMES loaded seqs:', await page.evaluate(()=>Object.fromEntries(Object.entries(window.__bbFrames).map(([k,v])=>[k,v.length]))));
console.log('CONSOLE ERRORS:', errors.length, errors.slice(0,8));

await browser.close();
