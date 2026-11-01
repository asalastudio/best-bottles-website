import fs from 'node:fs';
import crypto from 'node:crypto';
const dir='docs/reviews/cylinder5-cobalt-material-2026-11-01',out='public/local-kits/cylinder5-masters-2026-11-01';fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const old=JSON.parse(fs.readFileSync('public/local-kits/cylinder5-all71-2026-11-01/kits.json')),spray=JSON.parse(fs.readFileSync('public/local-kits/cylinder5-finemist-2026-11-01/kits.json'));
const previous={...old.rows,...spray.rows};fs.writeFileSync(dir+'/before-kits.json',JSON.stringify({rows:previous},null,2)+'\n');
const raw=fs.readFileSync(dir+'/generated-cobalt.png'),hash=sha(raw),nativeName='body-cobalt-native.'+hash.slice(0,12)+'.png';fs.writeFileSync(out+'/'+nativeName,raw);
// Register native output to the old rim/base and center. No stretch, recoloring or opaque matte.
// Old alpha bounds: [181,17,734,1704]; new: [182,19,736,1706].
const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="914" height="1721" viewBox="0 0 914 1721"><image x="-1.5" y="-2" width="914" height="1721" href="data:image/png;base64,'+raw.toString('base64')+'"/></svg>');
const svgHash=sha(svg),name='body-cobalt.'+svgHash.slice(0,12)+'.svg';fs.writeFileSync(out+'/'+name,svg);
const image={url:'/local-kits/cylinder5-masters-2026-11-01/'+name,sha256:svgHash,bytes:svg.length,width:914,height:1721,key:''};
const rows=structuredClone(previous),changed=[];
for(const [sku,kit] of Object.entries(rows)){if(!sku.startsWith('GBCylBlu5'))continue;const body=kit.parts.find(p=>p.slot==='body');body.image=image;body.image2x=null;changed.push(sku);}
if(changed.length!==35||Object.keys(rows).length!==71)throw Error('Unexpected 5 ml scope');
const version=sha(JSON.stringify(rows)).slice(0,12);
fs.writeFileSync(out+'/kits.json',JSON.stringify({version,rows,defaultPdpSkus:Object.keys(rows)},null,2)+'\n');
fs.writeFileSync('src/lib/products/cylinder5-master-index.json',JSON.stringify({version,kitFile:out+'/kits.json',skus:Object.keys(rows),cobaltSkus:changed,body:image},null,2)+'\n');
fs.writeFileSync(dir+'/manifest.json',JSON.stringify({version,method:'Built-in GPT image edit, exact model version not exposed',scope:changed,source5ml:'public/local-kits/gpt-13-415-2026-10-31/cylinder5-cobalt-candidate-v3.c51b7b6df61f.png',materialReference9ml:'public/local-kits/cylinder9-masters-2026-11-01/body-cobalt.9499ee157608.png',nativeFile:out+'/'+nativeName,nativeSha256:hash,registered:image,translationNativePx:{x:-1.5,y:-2},geometry:'Unchanged layout and anchors; native output silhouette IoU 99.06%, width +0.18%, height unchanged. Only translation applied; no geometric warp.',status:'local review candidate; not newly approved; not deployed'},null,2)+'\n');
console.log(JSON.stringify({version,changed:changed.length,image}));
