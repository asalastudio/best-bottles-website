import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const dir='docs/reviews/cylinder-family-completion-2026-11-02';
const data=JSON.parse(await fs.readFile(dir+'/register-kits-before.json','utf8')).kits;
const known=JSON.parse(await fs.readFile('docs/reviews/cylinder25-18415-2026-11-01/source-media.json','utf8'));
const chosen=Object.values(data).filter(k=>['cylinder-50ml-18-415','cylinder-100ml-18-415'].includes(k.register.bodyId));
const urls=[...new Set(chosen.flatMap(k=>k.parts.map(p=>p.image.url)))];
const index={};let next=0;
await fs.mkdir(dir+'/sources',{recursive:true});
await Promise.all(Array.from({length:4},async()=>{while(next<urls.length){const url=urls[next++];let file,bytes;
 if(known[url]){file=known[url].file;bytes=await fs.readFile(file);}
 else if(url.startsWith('/')){file='public'+url;bytes=await fs.readFile(file);}
 else {const response=await fetch(url);if(!response.ok)throw Error(url+' HTTP '+response.status);bytes=Buffer.from(await response.arrayBuffer());const sha=createHash('sha256').update(bytes).digest('hex');file=dir+'/sources/'+sha+'.png';await fs.writeFile(file,bytes);}
 const sha256=createHash('sha256').update(bytes).digest('hex');
 const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let left=info.width,right=-1,top=info.height,bottom=-1;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){if(data[(y*info.width+x)*4+3]>=32){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
 index[url]={file,sha256,bytes:bytes.length,width:info.width,height:info.height,visibleBounds:{left,top,right:right+1,bottom:bottom+1},alphaThreshold:32};
}}));
await fs.writeFile(dir+'/source-media.json',JSON.stringify(index,null,2)+'\n');
console.log(JSON.stringify({configurations:chosen.length,sources:urls.length}));
