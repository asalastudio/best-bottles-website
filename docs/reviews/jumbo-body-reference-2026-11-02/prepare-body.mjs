import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const dir='docs/reviews/jumbo-body-reference-2026-11-02',src=dir+'/sources';
const guide=fs.readFileSync(src+'/50ml-complete-glass-geometry-guide.png');
const material=fs.readFileSync(src+'/50ml-v03-studio-material.png');
const sha=b=>createHash('sha256').update(b).digest('hex');
const {data,info}=await sharp(guide).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const w=info.width,h=info.height,seen=new Uint8Array(w*h);let largest=[];
for(let i=0;i<w*h;i++){
 if(seen[i]||data[i*4+3]<32)continue;
 const queue=[i];seen[i]=1;
 for(let j=0;j<queue.length;j++){
  const at=queue[j],x=at%w,y=Math.floor(at/w);
  for(const n of [x?at-1:-1,x+1<w?at+1:-1,y?at-w:-1,y+1<h?at+w:-1]){
   if(n<0||seen[n]||data[n*4+3]<32)continue;seen[n]=1;queue.push(n);
  }
 }
 if(queue.length>largest.length)largest=queue;
}
const mask=new Uint8Array(w*h);
for(const at of largest){const x=at%w,y=Math.floor(at/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(x+dx>=0&&x+dx<w&&y+dy>=0&&y+dy<h)mask[(y+dy)*w+x+dx]=1;}
const spans=[];let outline='';
for(let y=0;y<h;y++){
 let first=w,last=-1,x=0;
 while(x<w){if(!mask[y*w+x]){x++;continue;}const start=x;while(x<w&&mask[y*w+x])x++;first=Math.min(first,start);last=Math.max(last,x);}
 // PSD cutout holes describe a retouching mask, not holes in the glass.
 // Retain the outer contour and fill the interior for the new glass material.
 if(last>first)outline+=`M${first} ${y}h${last-first}v1h${first-last}z`;
 spans.push({left:first,right:last});
}
// The original photograph supplies the contour and its narrow edge band.
// Generated material is projected uniformly inside neck/body regions, without
// stretching either source image or replacing the product silhouette.
let inner='';
for(let y=12;y<h-12;y++){
 const nearby=spans.slice(y-12,y+13),l=Math.max(...nearby.map(s=>s.left))+12,r=Math.min(...nearby.map(s=>s.right))-12;
 if(r>l)inner+=`M${l} ${y}h${r-l}v1h${l-r}z`;
}
const image=(bytes,x,y,width,height)=>`<image href="data:image/png;base64,${bytes.toString('base64')}" x="${x}" y="${y}" width="${width}" height="${height}"/>`;
const shoulder=195,axis=w/2,sourceAxis=386.5;
const bodyScale=(h-shoulder)/(1944-384),neckScale=shoulder/(384-107);
const body=image(material,axis-sourceAxis*bodyScale,shoulder-384*bodyScale,768*bodyScale,2048*bodyScale);
const neck=image(material,axis-sourceAxis*neckScale,-107*neckScale,768*neckScale,2048*neckScale);
const defs=`<defs><clipPath id="body"><rect y="${shoulder}" width="${w}" height="${h-shoulder}"/></clipPath><clipPath id="neck"><rect width="${w}" height="${shoulder}"/></clipPath><mask id="glass" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}" style="mask-type:alpha"><path d="${outline}" fill="white"/></mask><mask id="edge" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}" style="mask-type:luminance"><rect width="${w}" height="${h}" fill="white"/><path d="${inner}" fill="black"/></mask></defs>`;
const wrap=content=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w*2}" height="${h*2}" viewBox="0 0 ${w} ${h}">${defs}<g mask="url(#glass)">${content}</g></svg>`;
const svg=wrap(`<rect width="${w}" height="${h}" fill="white"/><g clip-path="url(#body)">${body}</g><g clip-path="url(#neck)">${neck}</g><g mask="url(#edge)">${image(guide,0,0,w,h)}</g>`);
fs.writeFileSync(src+'/50ml-body-psd-geometry-studio.svg',svg);
const rendered=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
const reference=await sharp(Buffer.from(wrap(`<rect width="${w}" height="${h}" fill="white"/>`))).ensureAlpha().raw().toBuffer();
let alphaDifferences=0;for(let i=3;i<rendered.length;i+=4)if(rendered[i]!==reference[i])alphaDifferences++;
assert.equal(alphaDifferences,0);
await sharp(Buffer.from(svg)).png().toFile(dir+'/50ml-body-registered.png');
const mouth=spans.slice(0,8),mouthWidth=Math.max(...mouth.map(s=>s.right))-Math.min(...mouth.map(s=>s.left));
const result={status:'corrected-candidate-not-approved',bodyId:'cylinder-50ml-16mm',glass:'Clear',sourceFile:src+'/50ml-body-psd-geometry-studio.svg',sourceSha256:sha(Buffer.from(svg)),guideSha256:sha(guide),materialSha256:sha(material),alphaDifferences,
 image:{width:w*2,height:h*2},anchors:{axisX:axis*2,seatY:0,shoulderY:shoulder*2,baselineY:h*2},mouthWidthPx:mouthWidth*2,
 scale:{targetPct:53,baselinePct:91,source:'Existing five-height canvas curve; original complete PSD neck/body silhouette'},
 uniformMaterialProjection:{bodyScale,neckScale,sourceAxis},geometry:'Complete PSD body and glass-neck retouch pixels supply the outer silhouette. Disconnected debris is excluded and internal retouch cutout holes are filled. Generated material does not define the contour.',sourceReference:'Owner supplied GBCyl50RollBlk 50 ml reference, 98 mm without cap, 37 mm diameter. The 28 ml is a separate master.'};
fs.writeFileSync(dir+'/body-registration.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({alphaDifferences,mouthWidthPx:result.mouthWidthPx,anchors:result.anchors}));
