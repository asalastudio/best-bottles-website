// User-authorized, non-generative background finishing for exactly five SKUs.
// No geometric transform. Original files and the other 26 exports are immutable.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),sharp=require('sharp');
const root=path.resolve('output/imagegen/elegant-2026-09-23'),out=path.join(root,'background-cleanup/v2');
const original=JSON.parse(fs.readFileSync(path.join(root,'aligned-exports.json'))),W=2080,H=2288,BONE=[245,243,239];
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const configs={
 GBElgFrst60AnSpGl:{shape:'<path d="M840 1056 Q840 1030 862 1024 C1000 998 1440 1000 1646 1024 Q1680 1032 1678 1060 L1678 2034 Q1678 2081 1644 2085 L879 2085 Q838 2077 840 2042Z"/><path d="M1097 533 C1038 452 823 365 737 368 C596 365 480 422 451 514 C420 562 431 650 456 707 C535 830 637 875 745 867 C924 864 1058 795 1101 703 L1115 650 L1180 633 L1180 559 L1105 541Z"/><path d="M1170 643 L1170 543 Q1180 435 1243 435 Q1310 436 1311 543 L1311 649 L1283 649 L1283 694 L1311 694 L1311 730 L1403 730 L1403 1007 L1080 1007 L1080 744 Q1080 723 1170 725 L1170 691 L1201 691 L1201 647Z"/>',shadow:[1280,2077,780,140]},
 GBElg15Gl:{shape:'<rect x="570" y="1186" width="689" height="905" rx="45"/><rect x="794" y="952" width="245" height="253" rx="22"/><rect x="1380" y="1608" width="331" height="481" rx="20"/>',shadow:[1120,2080,875,130]},
 GBElg60SpryMtGl:{shape:'<rect x="476" y="1000" width="880" height="1091" rx="49"/><rect x="742" y="634" width="343" height="379" rx="15"/><rect x="792" y="419" width="244" height="224" rx="24"/><rect x="1442" y="1418" width="386" height="671" rx="23"/>',shadow:[1140,2079,910,133]},
 GBElgFrst60DrpGl:{shape:'<rect x="491" y="1004" width="857" height="1087" rx="42"/><rect x="725" y="701" width="388" height="318" rx="22"/><path d="M803 719 Q825 623 821 479 C819 365 1017 365 1017 479 Q1009 623 1032 719Z"/>',shadow:[919,2081,700,140]},
 GBElgFrst100AnSpTslGl:{shape:'<path d="M1013 816 Q1013 798 1051 793 C1292 770 1586 772 1827 793 Q1870 797 1870 822 L1870 2031 Q1866 2083 1831 2087 H1052 Q1013 2075 1013 2030Z"/><rect x="1282" y="522" width="305" height="271" rx="22"/><path d="M1365 455 L1365 385 Q1369 269 1431 269 Q1503 272 1503 385 L1503 467 L1475 467 L1475 506 L1504 506 L1504 535 H1388 V505 H1410 V466Z"/><rect x="1240" y="365" width="141" height="111" rx="15"/>',goldRegion:[75,350,1270,2140],shadow:[1050,2088,997,148]}
};
function terms(x,y){return [1,x,y,x*x,x*y,y*y,x*x*x,x*x*y,x*y*y,y*y*y];}
function solve(a,b){const n=b.length,m=a.map((r,i)=>[...r,b[i]]);for(let k=0;k<n;k++){let p=k;for(let i=k+1;i<n;i++)if(Math.abs(m[i][k])>Math.abs(m[p][k]))p=i;[m[k],m[p]]=[m[p],m[k]];const v=m[k][k];if(Math.abs(v)<1e-9)throw Error('Singular background fit');for(let j=k;j<=n;j++)m[k][j]/=v;for(let i=0;i<n;i++)if(i!==k){const f=m[i][k];for(let j=k;j<=n;j++)m[i][j]-=f*m[k][j];}}return m.map(r=>r[n]);}
function fit(samples){const a=Array.from({length:10},()=>Array(10).fill(0)),b=Array.from({length:3},()=>Array(10).fill(0));for(const [t,c]of samples)for(let i=0;i<10;i++){for(let j=0;j<10;j++)a[i][j]+=t[i]*t[j];for(let ch=0;ch<3;ch++)b[ch][i]+=t[i]*c[ch];}return b.map(v=>solve(a,v));}
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),smooth=v=>{v=Math.min(1,Math.max(0,v));return v*v*(3-2*v)};
(async()=>{fs.mkdirSync(out,{recursive:true});let results=[];
for(const [sku,cfg]of Object.entries(configs)){
 const r=original.rows.find(r=>r.sku===sku);if(hash(r.finalPath)!==r.finalSha256)throw Error('Source changed '+sku);
 const {data:src,info}=await sharp(r.finalPath).removeAlpha().raw().toBuffer({resolveWithObject:true});if(info.width!==W||info.height!==H||info.channels!==3)throw Error('Canvas '+sku);
 const svg=Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${H}" fill="black"/><g fill="white" stroke="white" stroke-width="8" stroke-linejoin="round">${cfg.shape}</g></svg>`);
 let hard=await sharp(svg).removeAlpha().greyscale().raw().toBuffer();
 if(cfg.goldRegion){const [x0,y0,x1,y1]=cfg.goldRegion;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const p=y*W+x,i=p*3;if(src[i]-src[i+2]>23||Math.max(src[i],src[i+1],src[i+2])<170)hard[p]=255;}
 // Fill enclosed highlights within gold strands and collar shapes via exterior flood fill.
 const seen=new Uint8Array(W*H),queue=new Int32Array(W*H);let n=0,at=0;for(let x=0;x<W;x++){queue[n++]=x;seen[x]=1;queue[n++]=(H-1)*W+x;seen[(H-1)*W+x]=1;}for(let y=1;y<H-1;y++){queue[n++]=y*W;seen[y*W]=1;queue[n++]=y*W+W-1;seen[y*W+W-1]=1;}
 while(at<n){const p=queue[at++];for(const q of [p-W,p+W,p-1,p+1])if(q>=0&&q<W*H&&!seen[q]&&hard[q]<128){seen[q]=1;queue[n++]=q;}}
 for(let p=0;p<hard.length;p++)if(!seen[p])hard[p]=255;
 }
 const feather=await sharp(hard,{raw:{width:W,height:H,channels:1}}).blur(5).greyscale().raw().toBuffer();
 const eroded=await sharp(hard,{raw:{width:W,height:H,channels:1}}).blur(13).greyscale().raw().toBuffer();
 const protect=Buffer.alloc(W*H);for(let p=0;p<protect.length;p++)protect[p]=Math.max(hard[p],feather[p]);
 await sharp(protect,{raw:{width:W,height:H,channels:1}}).png().toFile(path.join(out,sku+'-protection-mask.png'));
 // Estimate the original low-frequency lighting field using only empty background.
 let samples=[];const t=r.transform;
 for(let y=40;y<H-40;y+=20)for(let x=40;x<W-40;x+=20){const p=y*W+x;if(protect[p]>1||y>1880)continue;if(x<t.x+20||x>t.x+W*t.scale-20||y<t.y+20||y>t.y+H*t.scale-20)continue;const c=[src[p*3],src[p*3+1],src[p*3+2]];if(Math.min(...c)<215)continue;samples.push([terms((x-W/2)/W,(y-H/2)/H),c]);}
 let coef=fit(samples);for(let iter=0;iter<2;iter++){samples=samples.filter(([v,c])=>Math.max(...c.map((z,i)=>Math.abs(z-dot(coef[i],v))))<3);coef=fit(samples);}
 const result=Buffer.alloc(src.length);let corePixels=0,changedCore=0;const [cx,cy,rx,ry]=cfg.shadow;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const p=y*W+x,i=p*3,dist=Math.sqrt(((x-cx)/rx)**2+((y-cy)/ry)**2),shadowWeight=smooth((1-dist)/.32),v=terms((x-W/2)/W,(y-H/2)/H);
  const field=coef.map(c=>Math.min(255,Math.max(215,dot(c,v))));
  const contrast=Math.max(...field.map((bg,ch)=>Math.abs(src[i+ch]-bg)));
  // Preserve the complete interior. Refine only the narrow silhouette boundary
  // against its estimated original backdrop to avoid a retained-background halo.
  const a=eroded[p]>=254?1:protect[p]/255*smooth((contrast-2)/5);
  for(let ch=0;ch<3;ch++){
   const bg=field[ch],residual=src[i+ch]-bg;
   // Retain original localized shadow/bounce signal; flat open background is exact bone.
   const floor=BONE[ch]+shadowWeight*residual;
   result[i+ch]=Math.round(Math.max(0,Math.min(255,a*src[i+ch]+(1-a)*floor)));
  }
  if(a===1){corePixels++;if(result[i]!==src[i]||result[i+1]!==src[i+1]||result[i+2]!==src[i+2])changedCore++;}
 }
 if(changedCore)throw Error('Protected artwork changed '+sku);
 const file=path.join(out,sku+'-bone-2080x2288.png');await sharp(result,{raw:{width:W,height:H,channels:3}}).png().toFile(file);
 results.push({...r,previousFinalPath:r.finalPath,previousFinalSha256:r.finalSha256,finalPath:file,finalSha256:hash(file),backgroundCleanup:{method:'Masked local background replacement with original localized shadow residual; no model call or spatial transform',target:'#F5F3EF',protectedArtworkPixels:corePixels,protectedArtworkPixelsChanged:changedCore,backgroundFitSamples:samples.length,backgroundFit:coef,shadowRegion:cfg.shadow},status:'background-cleanup-awaiting-visual-review'});
 console.log(sku,'protected unchanged',corePixels);
}
for(const r of original.rows)if(hash(r.finalPath)!==r.finalSha256)throw Error('Original modified '+r.sku);
fs.writeFileSync(path.join(out,'cleanup-exports.json'),JSON.stringify({scope:'five-only',unchanged:26,rows:results},null,2)+'\n');
})();
