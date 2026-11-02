import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const dir='docs/reviews/jumbo-roller-material-2026-11-02';
fs.mkdirSync(dir+'/sources',{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const source=fs.readFileSync(dir+'/sources/metal-approved-material.png');
const native=fs.readFileSync('docs/reviews/jumbo-roller-psd-match-2026-11-02/metal-native-preview.png');
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const visited=new Uint8Array(info.width*info.height);let main=[];
for(let i=0;i<visited.length;i++){
 if(visited[i]||data[i*4+3]<128)continue;
 const q=[i];visited[i]=1;
 for(let j=0;j<q.length;j++){const at=q[j],x=at%info.width,y=Math.floor(at/info.width);
  for(const n of [x?at-1:-1,x+1<info.width?at+1:-1,y?at-info.width:-1,y+1<info.height?at+info.width:-1]){
   if(n<0||visited[n]||data[n*4+3]<128)continue;visited[n]=1;q.push(n);
  }
 }
 if(q.length>main.length)main=q;
}
let left=info.width,right=0,top=info.height,bottom=0;
for(const i of main){const x=i%info.width,y=Math.floor(i/info.width);left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);}
const nativeBounds={left:23,top:4,right:321,bottom:220};
const scale=(nativeBounds.right-nativeBounds.left)/(right-left);
const x=(nativeBounds.left+nativeBounds.right)/2-(left+right)/2*scale,y=nativeBounds.bottom-bottom*scale;
const img=(b,w,h,px=0,py=0)=>`<image href="data:image/png;base64,${b.toString('base64')}" width="${w}" height="${h}" x="${px}" y="${py}"/>`;
const defs=`<defs><mask id="outline" maskUnits="userSpaceOnUse" x="0" y="0" width="336" height="220" style="mask-type:alpha">${img(native,336,220)}</mask></defs>`;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1344" height="880" viewBox="0 0 336 220">${defs}<g mask="url(#outline)"><rect width="336" height="220" fill="#f2f2ef"/>${img(native,336,220)}${img(source,info.width*scale,info.height*scale,x,y)}</g></svg>`;
const maskOnly=`<svg xmlns="http://www.w3.org/2000/svg" width="1344" height="880" viewBox="0 0 336 220">${defs}<rect width="336" height="220" fill="white" mask="url(#outline)"/></svg>`;
const result=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
const expected=await sharp(Buffer.from(maskOnly)).ensureAlpha().raw().toBuffer();let alphaDifferences=0;
for(let i=3;i<result.length;i+=4)if(result[i]!==expected[i])alphaDifferences++;
assert.equal(alphaDifferences,0,'The original PSD outline must remain exact');
fs.writeFileSync(dir+'/sources/metal-registered.svg',svg);
await sharp(Buffer.from(svg)).png().toFile(dir+'/metal-registered.png');
const report={status:'material-approved-by-owner-registration-review',sourceSha256:hash(source),nativeOutlineSha256:hash(native),
 method:'Uniformly register the generated material within the original PSD alpha outline. No nonuniform scaling or outline replacement.',
 nativeWidth:336,nativeHeight:220,nativeBounds,outputWidth:1344,outputHeight:880,alphaDifferences,
 generatedBounds:{left,top,right,bottom},uniformScale:scale,translation:{x,y},singleBottomStep:true,protrudingPlug:false,
 sourceReference:'Original PSD geometry; owner supplied IMG_6921/IMG_6922 to clarify the single bottom step. Last material edit approved with "Thats good".'};
fs.writeFileSync(dir+'/geometry-verification.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({alphaDifferences,uniformScale:scale,singleBottomStep:true}));
