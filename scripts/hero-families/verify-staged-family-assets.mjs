/** Verify hosted delivery bytes against local approved files without altering either. */
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const base=process.env.REVIEW_URL;if(!base)throw new Error('Set REVIEW_URL');
const rows=[...JSON.parse(fs.readFileSync('src/lib/products/catalog-hero-pilot.json')),...JSON.parse(fs.readFileSync('src/lib/products/catalog-hero-cre-pilot.json'))];
const hash=b=>createHash('sha256').update(b).digest('hex');const out=[];let i=0;
await Promise.all(Array.from({length:4},async()=>{for(;;){const n=i++;if(n>=rows.length)return;const r=rows[n];const response=await fetch(base+r.url,{signal:AbortSignal.timeout(120000)});assert.equal(response.status,200,r.websiteSku);const b=Buffer.from(await response.arrayBuffer());const local=fs.readFileSync(`public${r.url}`);assert.equal(hash(b),hash(local),r.websiteSku);assert.deepEqual([b.readUInt32BE(16),b.readUInt32BE(20)],[2080,2288]);out.push({sku:r.websiteSku,family:r.family,url:r.url,sha256:hash(b),dimensions:[2080,2288],status:response.status});}}));
out.sort((a,b)=>a.sku.localeCompare(b.sku));fs.writeFileSync(process.env.REVIEW_REPORT||'/tmp/family-assets.json',JSON.stringify({checkedAt:new Date().toISOString(),url:base,result:'pass',count:out.length,rows:out},null,2)+'\n');console.log(`PASS ${out.length} hosted exact hashes and 2080 x 2288 canvases`);
