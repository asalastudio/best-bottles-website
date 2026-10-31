const fs=require('fs'),path=require('path'),crypto=require('crypto'),sharp=require('sharp'),{ConvexHttpClient}=require('convex/browser');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'outputs/catalog-model-repair-2026-10-31/reports/glass-body-overview');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));
async function pool(rows,fn,n=6){let i=0;return Promise.all(Array.from({length:n},async()=>{while(i<rows.length){const row=rows[i++];await fn(row)}}));}
(async()=>{
const env=fs.readFileSync(path.join(root,'.env.local'),'utf8').split('\n').find(l=>l.startsWith('NEXT_PUBLIC_CONVEX_URL='));
const url=env.slice(env.indexOf('=')+1).replace(/^["']|["']$/g,'').trim();const client=new ConvexHttpClient(url);
const historical=read('data/register/bodies/bodies-measurements.json');
const bodyIds=new Set(historical.map(a=>a.bodyId));for(const line of fs.readFileSync(path.join(root,'data/register/bodies.csv'),'utf8').split('\n').slice(1)){const id=line.split(',')[0].replace(/^"|"$/g,'');if(id)bodyIds.add(id)}
const tokenLine=fs.readFileSync(path.join(root,'.env.local'),'utf8').split('\n').find(l=>l.startsWith('BEST_BOTTLES_CONVEX_WRITE_TOKEN='));
let bodyEnumeration='saved catalog IDs';
if(tokenLine){const token=tokenLine.slice(tokenLine.indexOf('=')+1).replace(/^["']|["']$/g,'').trim();try{let cursor=null;do{const page=await client.query('register:listPage',{writeToken:token,table:'bodies',cursor,numItems:250});for(const b of page.page)bodyIds.add(b.bodyId);if(page.isDone)break;cursor=page.continueCursor}while(cursor);bodyEnumeration='all register bodies via read-only paginated query';}catch{bodyEnumeration='saved catalog IDs; complete list unavailable';}}
let register=[],errors=[];
await pool([...bodyIds],async bodyId=>{try{const a=await client.query('register:body',{bodyId});if(a)register.push(a)}catch(e){errors.push({bodyId,error:e.message})}});
register.sort((a,b)=>a.body.bodyId.localeCompare(b.body.bodyId));
const counts=await client.query('register:counts',{});fs.writeFileSync(path.join(out,'register-snapshot.json'),JSON.stringify({checkedAt:new Date().toISOString(),endpoint:url,counts,bodyEnumeration,register,errors},null,2));
let registered=[];for(const r of register)for(const p of r.plates)registered.push({...p,family:r.body.family,capacityMl:r.body.capacityMl,body:r.body});
const blobBase=new URL(registered[0].image.url).origin;
async function copyImage(row,url,sha,dir,name){try{const file=path.join(out,dir,name);fs.mkdirSync(path.dirname(file),{recursive:true});let bytes;if(fs.existsSync(file))bytes=fs.readFileSync(file);else{const res=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!res.ok)throw new Error('HTTP '+res.status);bytes=Buffer.from(await res.arrayBuffer());}row.fileSha256=digest(bytes);row.hashVerified=row.fileSha256===sha;row.hashBasis='file bytes';if(!row.hashVerified){const pixels=await sharp(bytes).ensureAlpha().raw().toBuffer();row.pixelSha256=digest(pixels);row.hashVerified=row.pixelSha256===sha;row.hashBasis='decoded RGBA pixels';}if(!row.hashVerified)throw new Error('file and pixel hash mismatch');if(!fs.existsSync(file))fs.writeFileSync(file,bytes);row.localPath=file;row.recovered=true;}catch(e){row.recovered=false;row.recoveryError=e.message}}
await pool(registered,async p=>{await copyImage(p,p.image.url,p.image.sha256,'registered',p.image.sha256+'.png')});
await pool(historical,async p=>{const key=`register/plates/${p.bodyId}/${p.glass.toLowerCase().replace(/ /g,'-')}/${p.sha256}.png`;p.recoveryUrl=blobBase+'/'+key;await copyImage(p,p.recoveryUrl,p.sha256,'historical-ai',p.sha256+'.png');});
fs.writeFileSync(path.join(out,'registered-body-masters.json'),JSON.stringify(registered,null,2));fs.writeFileSync(path.join(out,'historical-ai-body-masters.json'),JSON.stringify(historical,null,2));
const tally=(rs,key)=>rs.reduce((a,r)=>{const k=key(r);a[k]=(a[k]||0)+1;return a},{});
const summary={checkedAt:new Date().toISOString(),registerBodies:register.length,registerPlates:registered.length,currentRecovered:registered.filter(r=>r.recovered).length,currentSources:tally(registered,r=>r.source.library),currentStatuses:tally(registered,r=>r.anchorStatus),historicalRecords:historical.length,historicalRecovered:historical.filter(r=>r.recovered).length,historicalBodies:new Set(historical.map(r=>r.bodyId)).size,failedHistorical:historical.filter(r=>!r.recovered).map(r=>({key:r.plateKey,error:r.recoveryError})),errors};fs.writeFileSync(path.join(out,'recovery-summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
})().catch(e=>{console.error(e.message);process.exit(1)});
