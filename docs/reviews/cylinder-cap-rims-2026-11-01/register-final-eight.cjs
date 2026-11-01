const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');
const root=process.cwd(),dir='docs/reviews/cylinder-cap-rims-2026-11-01',out='public/local-kits/cylinder-cap-rims-2026-11-01';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const kp='public/local-kits/cylinder9-masters-2026-11-01/kits.json',ip='src/lib/products/cylinder9-master-index.json';
const kit=JSON.parse(fs.readFileSync(kp)),index=JSON.parse(fs.readFileSync(ip));
if(!fs.existsSync(dir+'/before-final-set-kits.json'))fs.copyFileSync(kp,dir+'/before-final-set-kits.json');
const rawBase='/Users/jordanrichter/.codex/generated_images/01a190e7-4abb-7e82-8786-970248f1c27f/';
const sources=JSON.parse(fs.readFileSync(dir+'/final-eight-sources.json')).map(s=>[s.id,s.key,s.path]);
const assets={};
for(const[id,finish,filename]of sources){
 const raw=fs.readFileSync(filename);fs.writeFileSync(dir+'/sources/cap9-polished-'+finish+'-candidate.png',raw);
 // Register the unchanged generated pixels to the measured cap, retaining the shallow top and curved bottom.
 // The silhouette follows the approved generated edges and excludes isolated alpha debris outside them.
 const d='M 199 1193 L 199 190 C 199 156 255 136 580 136 C 905 136 963 156 963 190 L 963 1193 C 963 1214 913 1227 581 1227 C 249 1227 199 1214 199 1193 Z';
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1943" height="2718" viewBox="0 0 1943 2718"><svg x="12" y="12" width="1919" height="2694" viewBox="199 136 764 1091" preserveAspectRatio="none"><defs><clipPath id="cap"><path d="'+d+'"/></clipPath></defs><image width="1161" height="1355" href="data:image/png;base64,'+raw.toString('base64')+'" clip-path="url(#cap)"/></svg></svg>';
 const bytes=Buffer.from(svg),sha256=hash(bytes),file='cap9-final-'+finish+'.'+sha256.slice(0,12)+'.svg';fs.writeFileSync(out+'/'+file,bytes);
 assets[id]={url:'/local-kits/cylinder-cap-rims-2026-11-01/'+file,key:'',sha256,bytes:bytes.length,width:1943,height:2718};
}
const changed=[];
for(const[sku,row]of Object.entries(kit.rows)){const cap=row.parts.find(p=>p.slot==='cap');if(!cap||!assets[cap.componentId])continue;const before=structuredClone(cap),body=row.parts.find(p=>p.slot==='body');const s=row.anchors.pxPerMm;const w=19.19*s,h=26.94*s;const center=row.anchors.neckAxisX??row.anchors.axisX;const bottom=450.53646337388;
 cap.bounds={left:center-w/2,right:center+w/2,top:bottom-h,bottom};cap.box={x:center-w/2-1.26,y:bottom-h-1.26,width:w+2.52,height:h+2.52};cap.image=assets[cap.componentId];cap.image2x=null;
 assert.equal(row.parts.find(p=>p.slot==='body'),body);changed.push({sku,before:before.image.url,after:cap.image.url});
}
kit.version=hash(JSON.stringify(kit.rows)).slice(0,12);index.version=kit.version;
fs.writeFileSync(kp,JSON.stringify(kit,null,2)+'\n');fs.writeFileSync(ip,JSON.stringify(index,null,2)+'\n');
fs.writeFileSync(dir+'/final-eight-registration.json',JSON.stringify({version:kit.version,heightMm:26.94,diameterMm:19.19,approved:'Eight generated finishes matched to owner-approved polished pair geometry and measured registration. Owner visual approval of these eight pending.',assets,changed,sourcePixelOutline:[199,136,764,1091]},null,2)+'\n');
console.log(JSON.stringify({version:kit.version,changed:changed.length,assets:Object.values(assets).map(a=>a.url)}));
