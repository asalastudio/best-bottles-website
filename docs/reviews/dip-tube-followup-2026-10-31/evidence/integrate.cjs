const fs=require('fs'),path=require('path'),crypto=require('crypto'),sharp=require('sharp');
const out=__dirname,pub=path.resolve('public/local-kits/dip-tube-followup-2026-10-31');
const before=require('./kits-before.json'),manifestPath='public/local-kits/catalog-followups-2026-10-31/kits.json';
(async()=>{fs.mkdirSync(pub,{recursive:true});if(!fs.existsSync(out+'/manifest-before.json'))fs.copyFileSync(manifestPath,out+'/manifest-before.json');const manifest=JSON.parse(fs.readFileSync(manifestPath)),changes=[],updated={};
for(const [sku,source]of Object.entries(before)){
 const kit=structuredClone(source),body=kit.parts.find(p=>p.slot==='body'),sprayer=kit.parts.find(p=>p.slot==='sprayer');
 const name=kit.register.bodyId.startsWith('sleek')?'mechanism-sleek-8-v1':kit.register.bodyId.startsWith('round')?'mechanism-round-78-v1':'mechanism-tulip-5-v3';
 const base=name.includes('tulip')?'outputs/catalog-model-repair-2026-10-31/renders/':out+'/renders/';
 const bytes=fs.readFileSync(base+name+'.png'),meta=JSON.parse(fs.readFileSync(base+name+'.json')),hash=crypto.createHash('sha256').update(bytes).digest('hex'),image=await sharp(bytes).metadata(),file=name+'.'+hash.slice(0,12)+'.png';
 fs.copyFileSync(base+name+'.png',pub+'/'+file);
 const scale=kit.anchors.pxPerMm/25;const box={x:kit.anchors.axisX+(meta.crop[0]-meta.axis)*scale,y:body.bounds.bottom+(meta.crop[1]-meta.baseline)*scale,width:image.width*scale,height:image.height*scale};
 const tube={slot:'diptube',variantKey:null,zOrder:body.zOrder+.5,explodeIndex:sprayer.explodeIndex,box,bounds:{left:box.x,top:box.y,right:box.x+box.width,bottom:box.y+box.height},assembled:{x:0,y:0},exploded:{...sprayer.exploded},image:{url:'/local-kits/dip-tube-followup-2026-10-31/'+file,key:file,sha256:hash,bytes:bytes.length,width:image.width,height:image.height},image2x:null,mask:null,derivation:'blender-render',componentId:sprayer.componentId};
 const opacity=kit.register.glass==='Amber'?.32:kit.register.glass==='Frosted'?.16:.58;
 kit.parts=kit.parts.filter(p=>p.slot!=='diptube');kit.parts.push({...tube,views:['exploded']},{...tube,views:['sidecar','capon'],opacity});
 const unchanged=source.parts.filter(p=>p.slot!=='diptube');if(JSON.stringify(unchanged)!==JSON.stringify(kit.parts.filter(p=>p.slot!=='diptube')))throw Error('Changed protected part '+sku);
 manifest.rows[sku]=kit;manifest.defaultPdpSkus.push(sku);updated[sku]=kit;
 changes.push({sku,bodyId:kit.register.bodyId,glass:kit.register.glass,defect:name.includes('tulip')?'Tube present but too faint at 0.13 assembled opacity':'Broken extracted tube alpha and disconnected or mismatched pump shaft',fix:'One continuous hollow Blender tube and translucent cartridge, shared by every finish; assembled tint attenuation, full mechanism when exploded',outerDiameterMm:meta.tubeOuterDiameterMm,boreMm:meta.tubeInnerDiameterMm,tipDeflectionMm:meta.tipDeflectionMm,assumedFloorClearanceMm:meta.minimumTipClearanceMm,assembledOpacity:opacity,bodyAndExternalHardwareUnchanged:true,sourceLimits:meta.source});
}
manifest.defaultPdpSkus=[...new Set(manifest.defaultPdpSkus)];fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2));fs.writeFileSync(out+'/kits-after.json',JSON.stringify(updated,null,2));fs.writeFileSync(out+'/defects-by-sku.json',JSON.stringify(changes,null,2));console.log('Updated',changes.length,'SKUs');
})();
