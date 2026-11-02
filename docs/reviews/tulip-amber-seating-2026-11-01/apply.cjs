const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const directory=__dirname,file='src/lib/paper-doll/approved-kits.generated.json',manifest=JSON.parse(fs.readFileSync(file));
const originalFile=directory+'/before-kits.json';const rows=fs.existsSync(originalFile)?JSON.parse(fs.readFileSync(originalFile)).rows:Object.fromEntries(Object.entries(manifest.rows).filter(([,k])=>k.register?.plateKey==='tulip-5ml-13-415|Amber'&&k.parts.some(p=>p.slot==='sprayer')));assert.equal(Object.keys(rows).length,8);const measured=JSON.parse(fs.readFileSync(directory+'/visible-edge-measurements.json')).measurements;
const before=structuredClone(rows),adjustments=[];
for(const [sku,kit]of Object.entries(rows)){
 assert.ok(!kit.register.shoulderContactAdjustmentPx,'already amended');

 const edge=measured.find(r=>r.sku===sku);assert.ok(edge);const shoulder=edge.shoulderContactY,drop=edge.dropPx;assert.ok(drop>0&&drop<40);
 for(const part of kit.parts){if(part.slot==='sprayer'){part.box.y+=drop;part.bounds.top+=drop;part.bounds.bottom=shoulder;part.trimBottomPct=edge.clipBottomPct;}
 if(part.slot==='diptube'){part.box.y+=drop;part.bounds.top+=drop;part.trimBottomPct+=drop/part.box.height*100;if(part.views?.includes('sidecar')){part.zOrder=.5;part.opacity=.18;part.blendMode='multiply';}}}
 kit.register.shoulderContactAdjustmentPx=drop;kit.register.shoulderContactY=shoulder;manifest.rows[sku]=kit;adjustments.push({sku,dropPx:drop,shoulderContactY:shoulder,seatedTubeOpacity:.18,seatedTubeBehindGlass:true,innerFloorY:kit.parts.find(p=>p.slot==='diptube').bounds.bottom});
}
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
manifest.version=hash(manifest.rows).slice(0,16);fs.writeFileSync(file,JSON.stringify(manifest)+'\n');fs.writeFileSync('src/lib/paper-doll/approved-kit-index.json',JSON.stringify({version:manifest.version,skus:Object.keys(manifest.rows).sort()})+'\n');
fs.writeFileSync(directory+'/before-kits.json',JSON.stringify({rows:before},null,2)+'\n');fs.writeFileSync(directory+'/after-kits.json',JSON.stringify({rows},null,2)+'\n');
fs.writeFileSync('public/local-kits/tulip-amber-seating-2026-11-01/kits.json',JSON.stringify({version:manifest.version,defaultPdpSkus:Object.keys(rows),rows},null,2)+'\n');
fs.writeFileSync(directory+'/adjustments.json',JSON.stringify({authorization:'Jordan explicitly requested both the visible neck gap and the pale amber mechanism be corrected in this chat on November 1.',imageBytesChanged:false,bodyPartsUnchanged:true,clearTulipUnchanged:true,adjustments},null,2)+'\n');
for(const [sku,kit]of Object.entries(rows)){assert.deepEqual(kit.parts.find(p=>p.slot==='body'),before[sku].parts.find(p=>p.slot==='body'));for(const [i,p]of kit.parts.entries())assert.deepEqual(p.image,before[sku].parts[i].image);}
console.log('Corrected eight amber sprayers: shoulder contact, seated internals behind glass, unchanged body and image bytes');
