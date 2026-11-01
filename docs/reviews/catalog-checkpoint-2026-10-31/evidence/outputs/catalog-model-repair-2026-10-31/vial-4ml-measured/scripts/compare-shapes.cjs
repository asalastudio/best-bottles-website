const fs=require('fs'),path=require('path'),sharp=require('sharp'),crypto=require('crypto');
const dir=path.resolve(__dirname,'..');
async function profile(file){
 const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});let box={left:info.width,top:info.height,right:0,bottom:0},transparent=0;const spans=[];
 for(let y=0;y<info.height;y++){let l=info.width,r=0;for(let x=0;x<info.width;x++){const a=data[(y*info.width+x)*4+3];if(a===0)transparent++;if(a>32){l=Math.min(l,x);r=Math.max(r,x+1)}}spans[y]=[l,r];if(r>l){box.left=Math.min(box.left,l);box.right=Math.max(box.right,r);box.top=Math.min(box.top,y);box.bottom=Math.max(box.bottom,y+1)}}
 const h=box.bottom-box.top,w=box.right-box.left,median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)];
 const mid=spans.slice(Math.round(box.top+h*.3),Math.round(box.top+h*.8));const center=median(mid.map(([l,r])=>(l+r)/2)),bodyWidth=median(mid.map(([l,r])=>r-l));
 const widths=Array.from({length:501},(_,i)=>{const y=Math.min(box.bottom-1,Math.round(box.top+h*i/500));const [l,r]=spans[y];return [(l-center)/bodyWidth,(r-center)/bodyWidth]});
 const shoulder=widths.findIndex((v,i)=>i>50&&(v[1]-v[0])>.98)/500;
 return {file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),dimensions:[info.width,info.height],box,bodyWidth,nativeAspect:w/h,transparent,shoulder,widths};
}
(async()=>{const base=await profile(dir+'/sunburst/clear-v3.png'),result={reference:{...base,widths:undefined},colors:{}};
 for(const color of ['amber','green','cobalt']){const file=dir+'/sunburst/'+color+'-v2.png';if(!fs.existsSync(file))continue;const p=await profile(file);const errors=[];for(let i=5;i<490;i++)for(let j=0;j<2;j++)errors.push(p.widths[i][j]-base.widths[i][j]);const rms=Math.sqrt(errors.reduce((a,x)=>a+x*x,0)/errors.length),max=Math.max(...errors.map(Math.abs)),shoulderDelta=p.shoulder-base.shoulder;result.colors[color]={...p,widths:undefined,normalizedEdgeRms:rms,maxNormalizedEdgeDelta:max,shoulderHeightFractionDelta:shoulderDelta,geometryConsistent:rms<.02&&max<.06&&Math.abs(shoulderDelta)<.015};}
 fs.writeFileSync(dir+'/shape-consistency.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(Object.values(result.colors).some(c=>!c.geometryConsistent))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
