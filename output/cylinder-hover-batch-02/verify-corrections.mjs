import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import puppeteer from 'puppeteer-core';
const report=JSON.parse(await fs.readFile('output/cylinder-hover-batch-02/normalization-report.json'));
for(const r of report.rows){const m=await sharp(r.output).metadata();assert.equal(m.width,2080);assert.equal(m.height,2288);assert(r.backgroundMeanRGB.every((v,i)=>Math.abs(v-[245,243,239][i])<1));}
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const url='http://localhost:3000/preview/cylinder-hover-batch-02/index.html';
const checks=[];
try{
for(const width of [390,768,1440]){const p=await browser.newPage();await p.setViewport({width,height:900,isMobile:width===390,hasTouch:width===390});await p.goto(url,{waitUntil:'networkidle0'});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await p.$$eval('img',xs=>xs.filter(x=>x.complete&&x.naturalWidth===2080&&x.naturalHeight===2288).length),20);checks.push(`images and no overflow at ${width}px`);await p.close();}
const p=await browser.newPage();await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await p.goto(url,{waitUntil:'networkidle0'});assert.equal(await p.$eval('.filled',e=>getComputedStyle(e).transitionDuration),'0s');checks.push('reduced motion');await p.close();
const fail=await browser.newPage();await fail.setRequestInterception(true);fail.on('request',r=>r.url().includes('-on.png')?r.abort():r.continue());await fail.goto(url,{waitUntil:'networkidle0'});assert.equal(await fail.$$('.filled').then(x=>x.length),0);assert.equal(await fail.$$eval('.photo img',xs=>xs.filter(x=>x.complete&&x.naturalWidth===2080).length),10);checks.push('all ten hover failures preserve default images');await fail.close();
}finally{await browser.close();}
await fs.writeFile('output/cylinder-hover-batch-02/correction-checks.json',JSON.stringify({checks,files:20,backgroundMeanToleranceRGB:1},null,2));console.log(checks.join('\n'));
