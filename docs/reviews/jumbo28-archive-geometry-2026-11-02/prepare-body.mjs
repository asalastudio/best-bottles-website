import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const dir='docs/reviews/jumbo28-archive-geometry-2026-11-02',src=dir+'/sources';
const guide=fs.readFileSync(src+'/28ml-complete-glass-geometry-guide.png');
const material=fs.readFileSync(src+'/28ml-gpt-studio-material-v1.png');
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
for(let y=4;y<h-4;y++){
 const nearby=spans.slice(y-4,y+5),l=Math.max(...nearby.map(s=>s.left))+4,r=Math.min(...nearby.map(s=>s.right))-4;
 if(r>l)inner+=`M${l} ${y}h${r-l}v1h${l-r}z`;
}
const image=(bytes,x,y,width,height)=>`<image href="data:image/png;base64,${bytes.toString('base64')}" x="${x}" y="${y}" width="${width}" height="${height}"/>`;
const shoulder=166,axis=w/2,sourceAxis=396;
const bodyScale=(h-shoulder)/(1926-380),neckScale=shoulder/(380-90);
const body=image(material,axis-sourceAxis*bodyScale,shoulder-380*bodyScale,792*bodyScale,1985*bodyScale);
const neck=image(material,axis-sourceAxis*neckScale,-90*neckScale,792*neckScale,1985*neckScale);
const defs=`<defs><clipPath id="body"><rect y="${shoulder}" width="${w}" height="${h-shoulder}"/></clipPath><clipPath id="neck"><rect width="${w}" height="${shoulder}"/></clipPath><mask id="glass" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}" style="mask-type:alpha"><path d="${outline}" fill="white"/></mask><mask id="edge" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}" style="mask-type:luminance"><rect width="${w}" height="${h}" fill="white"/><path d="${inner}" fill="black"/></mask></defs>`;
const wrap=content=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w*2}" height="${h*2}" viewBox="0 0 ${w} ${h}">${defs}<g mask="url(#glass)">${content}</g></svg>`;
const svg=wrap(`<rect width="${w}" height="${h}" fill="white"/><g clip-path="url(#body)">${body}</g><g clip-path="url(#neck)">${neck}</g><g mask="url(#edge)">${image(guide,0,0,w,h)}</g>`);
fs.writeFileSync(src+'/28ml-body-archive-geometry-studio.svg',svg);
const rendered=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
const reference=await sharp(Buffer.from(wrap(`<rect width="${w}" height="${h}" fill="white"/>`))).ensureAlpha().raw().toBuffer();
let alphaDifferences=0;for(let i=3;i<rendered.length;i+=4)if(rendered[i]!==reference[i])alphaDifferences++;
assert.equal(alphaDifferences,0);
await sharp(Buffer.from(svg)).png().toFile(dir+'/28ml-body-registered.png');
const mouth=spans.slice(0,8),mouthWidth=Math.max(...mouth.map(s=>s.right))-Math.min(...mouth.map(s=>s.left));
const result={status:'corrected-candidate-not-approved',bodyId:'cylinder-28ml-16mm',glass:'Clear',sourceFile:src+'/28ml-body-archive-geometry-studio.svg',sourceSha256:sha(Buffer.from(svg)),guideSha256:sha(guide),materialSha256:sha(material),alphaDifferences,
 image:{width:w*2,height:h*2},anchors:{axisX:axis*2,seatY:0,shoulderY:shoulder*2,baselineY:h*2},mouthWidthPx:mouthWidth*2,
 scale:{targetPct:50.5,baselinePct:91,source:'Existing five-height canvas curve; owner-specified archive PSD complete neck/body silhouette'},
 uniformMaterialProjection:{bodyScale,neckScale,sourceAxis,sourceSize:[792,1985]},nativeEdgeBandPx:4,geometry:'Complete archive PSD body and glass-neck retouch pixels supply the outer silhouette. Disconnected debris is excluded and internal retouch cutout holes are filled. Generated material does not define the contour.',sourceReference:'Owner specified archive 13. 16 mm / 2. 28ml Uncapped / GBCyl28RollWht. Physical reference is GBCyl1ozRollWht, 81 mm without cap, 31 mm diameter. The 50 ml master and hardware image pixels remain unchanged.'};
fs.writeFileSync(dir+'/body-registration.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({alphaDifferences,mouthWidthPx:result.mouthWidthPx,anchors:result.anchors}));
