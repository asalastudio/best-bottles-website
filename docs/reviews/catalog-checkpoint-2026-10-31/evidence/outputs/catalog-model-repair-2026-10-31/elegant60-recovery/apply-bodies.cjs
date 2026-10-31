// Recover the existing registered GPT masters without altering their pixels.
const fs=require('fs'),path=require('path'),sharp=require('sharp'),crypto=require('crypto'),assert=require('assert/strict');
const root=process.cwd(),out=__dirname,kitFile=path.join(root,'public/local-kits/elegant60-reducer-2026-10-31/kits.json');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{const backup=path.join(out,'before-kits.json');if(!fs.existsSync(backup))fs.copyFileSync(kitFile,backup);const seatBackup=path.join(out,'before-cap-seating-kits.json');if(!fs.existsSync(seatBackup))fs.copyFileSync(kitFile,seatBackup);const kits=JSON.parse(fs.readFileSync(kitFile));const plates=JSON.parse(fs.readFileSync(path.join(out,'../reports/glass-body-overview/registered-body-masters.json'))).filter(p=>p.bodyId==='elegant-60ml-18-415');const records=[];
for(const p of plates){const bytes=fs.readFileSync(p.localPath),rgba=await sharp(bytes).ensureAlpha().raw().toBuffer();assert.equal(hash(rgba),p.image.sha256);assert.equal(hash(bytes),p.fileSha256);const file=`body-${p.glass.toLowerCase()}-gpt-r5-${p.image.sha256.slice(0,12)}.png`;fs.copyFileSync(p.localPath,path.join(path.dirname(kitFile),file));
for(const kit of Object.values(kits.rows).filter(k=>k.register.glass===p.glass)){const original=structuredClone(kit),b=kit.parts.find(x=>x.slot==='body');const scale=(kit.anchors.baselineY-kit.anchors.seatY)/(p.anchors.baselineY-p.anchors.seatY);b.box={x:kit.anchors.axisX-p.anchors.axisX*scale,y:kit.anchors.seatY-p.anchors.seatY*scale,width:p.image.width*scale,height:p.image.height*scale};b.image={...p.image,url:'/local-kits/elegant60-reducer-2026-10-31/'+file,key:'',sha256:hash(bytes),bytes:bytes.length};b.image2x=null;b.mask=null;kit.plateSha256=hash(bytes);
// The shared stage envelope is deliberately retained. Uniform placement maps
// the approved rim/axis/foot, and never stretches the new master to a rectangle.
assert.deepEqual(kit.anchors,original.anchors);assert.deepEqual(kit.parts.filter(x=>x.slot!=='body'),original.parts.filter(x=>x.slot!=='body'));assert(Math.abs(b.box.y+p.anchors.baselineY*scale-kit.anchors.baselineY)<1e-8);assert(Math.abs(b.box.y+p.anchors.seatY*scale-kit.anchors.seatY)<1e-8);assert(Math.abs(b.box.x+p.anchors.axisX*scale-kit.anchors.axisX)<1e-8);
// Local visual seating correction requested 2026-10-31: skirt ends flush at
// the shoulder, with no exposed neck gap and no overlap into the body.
// Target from the recovered image, not the old shoulder-snapping seat drop.
// This is a visual fit review datum, not a new manufacturer measurement.
const cap=kit.parts.find(x=>x.slot==='cap'), oldCapBounds=structuredClone(JSON.parse(fs.readFileSync(seatBackup)).rows[kit.sku].parts.find(x=>x.slot==='cap').bounds);
const capSeatY=b.box.y+p.anchors.shoulderY*scale;
// Seat the visible cap edge, excluding transparent padding in source crops.
const capCache=path.join(out,'cap-source-cache');fs.mkdirSync(capCache,{recursive:true});const capPath=path.join(capCache,hash(cap.image.url)+'.png');
if(!fs.existsSync(capPath)){const res=await fetch(cap.image.url);assert(res.ok);fs.writeFileSync(capPath,Buffer.from(await res.arrayBuffer()));}
const {data:cp,info:ci}=await sharp(capPath).ensureAlpha().raw().toBuffer({resolveWithObject:true});let alphaBottom=0;
for(let yy=0;yy<ci.height;yy++)for(let xx=0;xx<ci.width;xx++)if(cp[(yy*ci.width+xx)*4+3]>32)alphaBottom=yy+1;
assert(alphaBottom>0);const visibleBottom=cap.box.y+alphaBottom/ci.height*cap.box.height;
const capDy=capSeatY-visibleBottom;
cap.box.y+=capDy;cap.bounds.top+=capDy;cap.bounds.bottom=capSeatY;
assert(Math.abs(cap.bounds.bottom-(b.box.y+p.anchors.shoulderY*scale))<1e-8);
assert(cap.bounds.top < kit.anchors.seatY);
assert.deepEqual(kit.parts.filter(x=>!['body','cap'].includes(x.slot)),original.parts.filter(x=>!['body','cap'].includes(x.slot)));
records.push({capAlphaBottomPx:alphaBottom,capSourceHeightPx:ci.height,capSeatY,capShiftY:capSeatY-oldCapBounds.bottom,oldCapBounds,newCapBounds:cap.bounds,shoulderClearanceMasterPx:0,sku:kit.sku,glass:p.glass,file,source:p.source,revision:p.revision,hashVerified:true,fileSha256:hash(bytes),pixelSha256:p.image.sha256,sourceAnchors:p.anchors,scale,box:b.box,stageAnchorsUnchanged:true,capSeatingCorrected:true,reducerUnchanged:true,stageEnvelopeUnchanged:true});}
}
assert.equal(records.length,24);fs.writeFileSync(kitFile,JSON.stringify(kits,null,2));fs.writeFileSync(path.join(out,'body-recovery-report.json'),JSON.stringify({localOnly:true,upscaleRecordFound:false,rows:records},null,2));console.log('Recovered verified body masters for',records.length,'local reducer SKU kits');})();
