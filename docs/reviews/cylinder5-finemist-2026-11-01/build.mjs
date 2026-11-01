import fs from 'node:fs';
import crypto from 'node:crypto';
import {tubeSvg,TUBE} from './tube-reference-layer.mjs';
const dir='docs/reviews/cylinder5-finemist-2026-11-01',out='public/local-kits/cylinder5-finemist-2026-11-01',review='public/reviews/cylinder5-finemist-2026-11-01';fs.mkdirSync(review,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const original=JSON.parse(fs.readFileSync(dir+'/before-kits.json')),inventory=JSON.parse(fs.readFileSync('docs/reviews/cylinder5-all71-2026-11-01/inventory.json')).filter(r=>r.sprayer),hardware=JSON.parse(fs.readFileSync(dir+'/hardware-assets.json'));
const reference=original.rows.GBCyl5SpryGlMatt,ppm=reference.register.pxPerMm,diameterMm=1.1;
// The measured 53.23 mm outer height and 48.80 mm depth leave a 4.43 mm base.
// Allow another 0.9 mm above that interior floor; do not stretch the shaft width.
const baseThicknessMm=53.23-48.80,tipClearanceMm=baseThicknessMm+0.9;
// Lift to the upper shoulder crest so glass corners do not protrude above the collar.
const shoulderY=reference.glassSizing.landmarkY-21,tubeTop=shoulderY-2*ppm,tubeBottom=reference.parts.find(p=>p.slot==='body').bounds.bottom-tipClearanceMm*ppm;
const nativePxPerMm=39/diameterMm,scale=ppm/nativePxPerMm,nativeHeight=(tubeBottom-tubeTop)/scale;
const raw=fs.readFileSync(dir+'/sources/approved-mechanism.png');
const svg=Buffer.from(tubeSvg(nativeHeight/TUBE.pxPerMm,'data:image/png;base64,'+raw.toString('base64')));const tubeHash=sha(svg),tubeFile='mechanism-5ml.'+tubeHash.slice(0,12)+'.svg';fs.writeFileSync(out+'/'+tubeFile,svg);
const tubeAsset={url:'/local-kits/cylinder5-finemist-2026-11-01/'+tubeFile,sha256:tubeHash,bytes:svg.length,width:180,height:nativeHeight};
const rows={},checks=[];
for(const c of inventory){const kit=structuredClone(original.rows[c.sku]);const sourceSku=c.sku.replace('GBCylBlu5','GBCyl5');const body=kit.parts.find(p=>p.slot==='body');
 const registered=[];
 for(const slot of ['sprayer','overcap']){const part=structuredClone(kit.parts.find(p=>p.slot===slot)),a=hardware[sourceSku+'|'+slot];if(!a)throw Error('Missing PSD layer '+c.sku);let s=part.box.width/a.width;const [l,t,r,b]=a.ink;
 if(slot==='overcap'){const h=registered.find(p=>p.slot==='sprayer').bounds;const targetWidth=(h.right-h.left)*1.02,minHeight=h.bottom-h.top+0.3*ppm;s=Math.max(targetWidth/(r-l),minHeight/(b-t));}
 part.box={x:kit.anchors.axisX-(l+r)/2*s,y:shoulderY-b*s,width:a.width*s,height:a.height*s};part.bounds={left:part.box.x+l*s,top:part.box.y+t*s,right:part.box.x+r*s,bottom:shoulderY};const{ink,source,sourceSha256,excludedOpaqueSpecks,...image}=a;part.image={...image,key:''};registered.push(part);}
 const head=registered.find(p=>p.slot==='sprayer'),cid=head.componentId;
 const tube={slot:'diptube',variantKey:null,zOrder:2,explodeIndex:1,box:{x:kit.anchors.axisX-86*scale,y:tubeTop,width:180*scale,height:tubeBottom-tubeTop},bounds:{left:kit.anchors.axisX-86*scale,top:tubeTop,right:kit.anchors.axisX+94*scale,bottom:tubeBottom},assembled:{x:0,y:0},exploded:{dx:0,dy:0},image:{...tubeAsset,key:''},image2x:null,mask:null,derivation:'psd-layer',componentId:cid};
 const tubes=c.glass==='Clear'?[{...structuredClone(tube),views:['sidecar','capon'],opacity:0.62},{...structuredClone(tube),views:['exploded']}]:[{...tube,views:['exploded']}];
 kit.parts=[body,...tubes,...registered];rows[c.sku]=kit;checks.push({sku:c.sku,glass:c.glass,finish:c.capColor,bodyUrl:body.image.url,bodyHash:body.image.sha256,shoulderY,tipClearanceMm,tubeDiameterMm:diameterMm});
}
if(Object.keys(rows).length!==15)throw Error('Unexpected scope');const version=sha(JSON.stringify(rows)).slice(0,12);
fs.writeFileSync(out+'/kits.json',JSON.stringify({version,rows,defaultPdpSkus:Object.keys(rows)},null,2)+'\n');
fs.writeFileSync('src/lib/products/cylinder5-sprayer-index.json',JSON.stringify({version,bodyId:'cylinder-5ml-13-415',kitFile:out+'/kits.json',skus:Object.keys(rows)},null,2)+'\n');
fs.writeFileSync(dir+'/registration.json',JSON.stringify({version,shoulderY,diameterMm,baseThicknessMm,tipClearanceMm,tubeTop,tubeBottom,nativeHeight,scale,sourceSha256:sha(raw),tubeAsset,checks},null,2)+'\n');
fs.writeFileSync(review+'/model.json',JSON.stringify({version,configurations:inventory.map(c=>({websiteSku:c.sku,productGroupSlug:c.slug,glassLabel:c.glass,finishLabel:c.capColor,bodyUrl:c.bodyUrl})),tubeAsset},null,2)+'\n');
console.log(JSON.stringify({version,skus:inventory.length,diameterMm,tubeLengthMm:(tubeBottom-tubeTop)/ppm,shoulderY,tipClearanceMm}));
