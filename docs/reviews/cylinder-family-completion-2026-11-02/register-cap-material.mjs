import fs from 'node:fs';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const dir='docs/reviews/cylinder-family-completion-2026-11-02';
const black=fs.readFileSync(dir+'/sources/cap16-black-clean.png'),white=fs.readFileSync(dir+'/sources/cap16-white-material.png');
const hash=b=>createHash('sha256').update(b).digest('hex');
// Locate the long continuous cap surface, ignoring isolated specks in padding.
// This measures the material placement; it does not retouch either source PNG.
async function core(bytes){const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const rows=new Uint32Array(info.height),cols=new Uint32Array(info.width);
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=128){rows[y]++;cols[x]++;}
 const run=(values,threshold)=>{let start=-1,best=[0,0];for(let i=0;i<=values.length;i++){if(values[i]>threshold){if(start<0)start=i;}else if(start>=0){if(i-start>best[1]-best[0])best=[start,i];start=-1;}}return best;};
 const [left,right]=run(cols,info.height*.1),[top,bottom]=run(rows,info.width*.1);
 return {width:info.width,height:info.height,left,right,top,bottom};}
const b=await core(black),w=await core(white),sx=(b.right-b.left)/(w.right-w.left),sy=(b.bottom-b.top)/(w.bottom-w.top);
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${b.width}" height="${b.height}" viewBox="0 0 ${b.width} ${b.height}"><defs><mask id="outline" maskUnits="userSpaceOnUse" x="0" y="0" width="${b.width}" height="${b.height}" style="mask-type:alpha"><image href="data:image/png;base64,${black.toString('base64')}" width="${b.width}" height="${b.height}"/></mask></defs><g mask="url(#outline)"><image href="data:image/png;base64,${white.toString('base64')}" x="${b.left-w.left*sx}" y="${b.top-w.top*sy}" width="${w.width*sx}" height="${w.height*sy}" preserveAspectRatio="none"/></g></svg>`;
fs.writeFileSync(dir+'/sources/cap16-white-shared-outline.svg',svg);
const composed=await sharp(Buffer.from(svg)).png().toBuffer();
fs.writeFileSync(dir+'/sources/cap16-white-clean.png',composed);
fs.writeFileSync(dir+'/cap-material-registration.json',JSON.stringify({method:'Shared alpha outline with independently registered white material; original source PNGs unchanged',canonicalOutlineSha256:hash(black),whiteMaterialSha256:hash(white),composedMasterSha256:hash(composed),black:b,white:w,materialTransform:{sx,sy},geometry:'The black cap provides the common exterior silhouette. Material fitting never changes that silhouette.'},null,2)+'\n');
console.log(JSON.stringify({sameCapOutline:true,masterSha256:hash(composed)}));
