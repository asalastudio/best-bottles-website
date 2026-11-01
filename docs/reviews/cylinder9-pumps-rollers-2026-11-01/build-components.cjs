const fs=require('fs'),crypto=require('crypto');
const dir='docs/reviews/cylinder9-pumps-rollers-2026-11-01',out='public/local-kits/cylinder9-masters-2026-11-01',review='public/reviews/cylinder9-pumps-rollers-2026-11-01';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const previous=JSON.parse(fs.readFileSync(dir+'/before-kits.json')),index=JSON.parse(fs.readFileSync(dir+'/before-index.json')),library=structuredClone(previous),assets=index.assets;
// These SVG envelopes keep the generated material pixels unchanged. The smooth
// clipping contours remove exterior alpha debris from the displayed component.
const silhouettes={
 'lotion-head':{w:1322,h:1190,d:'M 358 216 Q 358 176 418 176 Q 661 156 907 176 Q 967 178 967 218 L 967 698 Q 1013 700 1013 736 L 1013 1024 Q 1013 1036 996 1036 L 326 1036 Q 310 1036 310 1023 L 310 737 Q 310 702 358 698 Z',ink:[310,169,1013,1036]},
 'roller-metal':{w:1052,h:1494,d:'M 272 321 C 305 195 416 119 526 119 C 636 119 747 195 780 321 Q 865 319 865 370 L 865 662 Q 916 679 916 700 L 916 741 Q 916 763 780 765 L 759 1327 Q 759 1351 736 1351 L 315 1351 Q 294 1351 294 1327 L 273 765 Q 135 763 135 741 L 135 700 Q 135 680 186 662 L 186 370 Q 186 319 272 321 Z',ink:[135,119,916,1351]},
 'roller-plastic':{w:1052,h:1494,d:'M 272 321 C 305 195 416 119 526 119 C 636 119 747 195 780 321 Q 865 319 865 370 L 865 662 Q 916 679 916 700 L 916 741 Q 916 763 780 765 L 759 1327 Q 759 1351 736 1351 L 315 1351 Q 294 1351 294 1327 L 273 765 Q 135 763 135 741 L 135 700 Q 135 680 186 662 L 186 370 Q 186 319 272 321 Z',ink:[135,119,916,1351]}
};
for(const[name,v]of Object.entries(silhouettes)){
 const png=fs.readFileSync(dir+'/sources/'+name+'-generated-v01.png');
 const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${v.w}" height="${v.h}" viewBox="0 0 ${v.w} ${v.h}"><defs><clipPath id="contour"><path d="${v.d}"/></clipPath></defs><image width="${v.w}" height="${v.h}" href="data:image/png;base64,${png.toString('base64')}" clip-path="url(#contour)"/></svg>`);
 const hash=sha(svg),file=name+'.'+hash.slice(0,12)+'.svg';fs.writeFileSync(out+'/'+file,svg);assets[name]={url:'/local-kits/cylinder9-masters-2026-11-01/'+file,sha256:hash,bytes:svg.length,width:v.w,height:v.h};fs.writeFileSync(review+'/'+name+'.svg',svg);
}
const config=JSON.parse(fs.readFileSync('data/paper-doll/CYL-9ML/configurations.json'));
const source=previous.rows.GBCyl9SpryBlk,basecollar=source.parts.find(p=>p.slot==='collar'),basetube=source.parts.find(p=>p.slot==='diptube'),basecap=source.parts.find(p=>p.slot==='overcap');
const dimPart=(slot,asset,scale,x,y,bounds,z,id,ix=0)=>({slot,variantKey:null,zOrder:z,explodeIndex:ix,bounds,assembled:{x:0,y:0},exploded:{dx:0,dy:0},image:{...assets[asset],key:''},image2x:null,mask:null,derivation:'psd-layer',box:{x,y,width:assets[asset].width*scale,height:assets[asset].height*scale},componentId:id});
const selected=[];
for(const c of config){
 if(c.applicatorKey==='fine-mist-sprayer')continue;
 const kit=library.rows[c.websiteSku],body=kit.parts.find(p=>p.slot==='body');
 if(c.applicatorKey==='lotion-pump'){
  const id=kit.register.componentIds[0],f={'Black':'black','Gold':'gold','Matte Silver':'matte-silver'}[c.finishLabel];
  const collar={...structuredClone(basecollar),componentId:id,image:{...assets['collar-'+f],key:''}};
  const cap={...structuredClone(basecap),componentId:id};
  const tube={...structuredClone(basetube),componentId:id};if(c.glassLabel!=='Clear')tube.views=['exploded'];
  const s=159.2/(1013-310),x=500-(310+1013)/2*s,y=290-1036*s;
  const head=dimPart('pump','lotion-head',s,x,y,{left:x+310*s,top:y+169*s,right:x+1013*s,bottom:290},4,id,1);
  kit.parts=[tube,body,head,collar,cap];
 }else{
  const kind=c.applicatorKey==='metal-roller'?'metal':'plastic',id=kit.register.componentIds.find(id=>id.includes('Rollon'));
  const a='roller-'+kind,s=157.11/(916-135),x=500-(135+916)/2*s,y=body.bounds.top-765*s;
  const insert=dimPart('roller',a,s,x,y,{left:x+135*s,top:y+119*s,right:x+916*s,bottom:y+1351*s},0,id,0);
  const cap=structuredClone(kit.parts.find(p=>p.slot==='cap'));
  kit.parts=[insert,body,cap];
 }
 selected.push(c);
}
library.version=sha(JSON.stringify({assets,rows:library.rows})).slice(0,12);index.version=library.version;
fs.writeFileSync(out+'/kits.json',JSON.stringify(library,null,2)+'\n');fs.writeFileSync('src/lib/products/cylinder9-master-index.json',JSON.stringify(index,null,2)+'\n');fs.writeFileSync(dir+'/component-registration.json',JSON.stringify({version:library.version,scope:selected.map(c=>c.websiteSku),silhouettes,pumpTube:'Reused approved fine-mist visual mechanism/tube; lotion internals are a review representation, manufacturer mechanism dimensions unconfirmed.',rollerSeat:'Underside of flange at body.bounds.top; lower plug behind glass in assembled view; whole insert moves together.',status:'Local candidates, pending visual approval'},null,2)+'\n');
fs.writeFileSync(review+'/model.json',JSON.stringify({version:library.version,configurations:selected.map(({websiteSku,productGroupSlug,glassLabel,applicatorKey,finishLabel})=>({websiteSku,productGroupSlug,glassLabel,applicatorKey,finishLabel})),assets},null,2));
console.log(JSON.stringify({version:library.version,pumps:selected.filter(c=>c.applicatorKey==='lotion-pump').length,rollers:selected.filter(c=>c.applicatorKey!=='lotion-pump').length}));
