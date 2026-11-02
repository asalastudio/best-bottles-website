import fs from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import type { ReviewKit as KitLike, ReviewPart as KitPartLike, FamilySnapshot, RecoveredMaster } from './review-types';
const dir='docs/reviews/cylinder-family-completion-2026-11-02',out='public/local-kits/cylinder-family-completion-2026-11-02';
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const catalog=Object.values((read(dir+'/current-family-snapshot.json') as FamilySnapshot).families).flatMap(f=>f.rows);
const library=read('docs/reviews/cylinder-master-materials-2026-10-31/family-inventory.json').rows as RecoveredMaster[];
fs.mkdirSync(out,{recursive:true});
async function image(file:string,name:string){
    const raw=fs.readFileSync(file),{data,info}=await sharp(raw).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let left=info.width,top=info.height,right=-1,bottom=-1;
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=32){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    const webp=await sharp(raw).webp({lossless:true,effort:6}).toBuffer();
    const decoded=await sharp(webp).ensureAlpha().raw().toBuffer();
    let alphaDifferences=0,visibleColorDifferences=0;
    for(let i=0;i<data.length;i+=4){if(data[i+3]!==decoded[i+3])alphaDifferences++;if(data[i+3]>0&&(data[i]!==decoded[i]||data[i+1]!==decoded[i+1]||data[i+2]!==decoded[i+2]))visibleColorDifferences++;}
    assert.equal(alphaDifferences,0);assert.equal(visibleColorDifferences,0);
    const hash=sha(webp),path=out+'/'+name+'.'+hash.slice(0,12)+'.webp';fs.writeFileSync(path,webp);
    return {sourceFile:file,sourceSha256:sha(raw),sourceBytes:raw.length,alphaDifferences,visibleColorDifferences,
        image:{url:'/'+path.slice('public/'.length),key:'',sha256:hash,bytes:webp.length,width:info.width,height:info.height},bounds:{left,top,right:right+1,bottom:bottom+1}};
}
const nativeDir='docs/reviews/jumbo-roller-psd-match-2026-11-02';
const nativeVerification=read(nativeDir+'/native-ball-verification.json');
assert(nativeVerification.results.every((r:{changedBallPixels:number})=>r.changedBallPixels===0),'Original PSD ball pixels must remain unchanged');
const inserts={metal:await image(nativeDir+'/sources/roller16-metal-native-psd.svg','roller16-metal-native-psd'),plastic:await image(nativeDir+'/sources/roller16-plastic-native-psd.svg','roller16-plastic-native-psd')};
const caps={Black:await image(dir+'/sources/cap16-black-clean.png','cap16-black'),White:await image(dir+'/sources/cap16-white-clean.png','cap16-white')};
const dims:Record<number,{height:number;diameter:number;closedHeight:number}>={28:{height:81,diameter:31,closedHeight:100},50:{height:98,diameter:37,closedHeight:116}};
// Registration width from the original 28 ml photo: the white flange spans
// approximately 294 px against 445 px of a 31 mm body. This is not a new caliper measurement.
const flangeWidthMm=294/445*31;
const ref=library.find(r=>r.bodyId==='cylinder-28ml-16mm');
assert(ref?.sourceAvailable,'The 28 ml source must be available before registering shared jumbo hardware');
const capHeightMm=100-81*(ref.anchors.baselineY-ref.anchors.shoulderY)/(ref.anchors.baselineY-ref.anchors.seatY);
const rows:Record<string,KitLike>={},configurations:Record<string, unknown>[]=[];
function part(slot:string,asset:Awaited<ReturnType<typeof image>>,axis:number,base:number,scale:number,id:string,index:number):KitPartLike{
    const b=asset.bounds,x=axis-(b.left+b.right)/2*scale,y=base-b.bottom*scale;
    return {slot,variantKey:null,componentId:id,zOrder:index,explodeIndex:index,assembled:{x:0,y:0},exploded:{dx:0,dy:0},image:asset.image,
        box:{x,y,width:asset.image.width*scale,height:asset.image.height*scale},bounds:{left:x+b.left*scale,top:y+b.top*scale,right:x+b.right*scale,bottom:base}};
}
for(const row of catalog.filter(r=>r.category==='Glass Bottle'&&r.neckThreadSize==='16mm'&&[28,50].includes(r.capacityMl ?? 0))){
    assert(row.capacityMl===28||row.capacityMl===50,'Unexpected jumbo roller capacity');
    assert(row.capColor==='Black'||row.capColor==='White','Unexpected jumbo roller cap finish');
    const d=dims[row.capacityMl],master=library.find(r=>r.bodyId==='cylinder-'+row.capacityMl+'ml-16mm'&&r.glass==='Clear');assert(master?.sourceAvailable);
    const bytes=fs.readFileSync(master.sourceFile);assert.equal(sha(bytes),master.fileSha256);
    const info=await sharp(bytes).metadata(),scale=800/(master.anchors.baselineY-master.anchors.seatY),ppm=800/d.height;
    const file='body-'+master.bodyId+'.'+master.fileSha256.slice(0,12)+'.png';fs.writeFileSync(out+'/'+file,bytes);
    const axis=500,seat=261,foot=1061,x=axis-master.anchors.axisX*scale,y=seat-master.anchors.seatY*scale;
    const shoulder=y+master.anchors.shoulderY*scale;
    const body:KitPartLike={slot:'body',variantKey:null,componentId:null,zOrder:0,explodeIndex:0,assembled:{x:0,y:0},exploded:{dx:0,dy:0},
        image:{url:'/local-kits/cylinder-family-completion-2026-11-02/'+file,key:'',sha256:master.fileSha256,bytes:bytes.length,width:info.width!,height:info.height!},
        box:{x,y,width:info.width!*scale,height:info.height!*scale},bounds:{left:axis-d.diameter*ppm/2,top:seat,right:axis+d.diameter*ppm/2,bottom:foot}};
    const kind=row.applicator==='Metal Roller Ball'?'metal':'plastic',insert=inserts[kind];
    const roller=part('roller',insert,axis,seat+.25*ppm,flangeWidthMm*ppm/(insert.bounds.right-insert.bounds.left),'review:roller-16mm-'+kind,1);
    const capAsset=caps[row.capColor as keyof typeof caps];assert(capAsset,'Unknown 16 mm cap finish');
    const cap=part('cap',capAsset,axis,shoulder,capHeightMm*ppm/(capAsset.bounds.bottom-capAsset.bounds.top),'review:cap-16mm-'+row.capColor.toLowerCase(),2);
    const kit:KitLike={sku:row.websiteSku,familyId:'review:'+master.plateKey,canvas:{width:1000,height:1100},
        anchors:{axisX:axis,neckAxisX:axis,seatY:seat,baselineY:foot,pxPerMm:ppm},
        register:{bodyId:master.bodyId,plateKey:master.plateKey,glass:'Clear',pxPerMm:ppm},
        glassSizing:{heightPct:master.scale.targetPct,baselinePct:master.scale.baselinePct,landmarkY:shoulder,source:master.scale.source},parts:[body,roller,cap]};
    rows[row.websiteSku]=kit;
    configurations.push({sku:row.websiteSku,bodyId:master.bodyId,applicator:row.applicator,capColor:row.capColor,bodySha256:master.fileSha256,
        rimY:seat,flangeBottomY:roller.bounds.bottom,overRim:true,protrudingPlug:false,capBottomY:cap.bounds.bottom,shoulderY:shoulder,
        closedCapClearancePx:roller.bounds.top-cap.bounds.top,registrationBasis:'Original PSD ball artwork and native housing offsets, uniformly registered as shared 16 mm hardware. User confirmed no bottom plug and an internal annular track.'});
    assert(roller.bounds.top>=cap.bounds.top-ppm,'Cap does not cover ball');
}
assert.equal(Object.keys(rows).length,8);
fs.writeFileSync(out+'/roller-kits.json',JSON.stringify({rows,defaultPdpSkus:[]},null,2)+'\n');
fs.writeFileSync(dir+'/roller-registration.json',JSON.stringify({status:'candidate-not-approved',camera:'Near eye level, flat flange',hardware:'Over-rim 16 mm roller assembly, internal seating track, no projecting lower plug',
    sourceAuthority:'Original 28 ml PSD component layers supply the ball shape, exposure, and material for both 28/50 ml. User confirmed the over-rim housing has no bottom plug.',nativeBallVerification:nativeVerification,measuredBottles:dims,
    estimatedRegistration:{flangeWidthMm,capHeightMm,notice:'Image registration only. These are not confirmed physical component measurements.'},inserts,caps,configurations},null,2)+'\n');
console.log(JSON.stringify({configurations:Object.keys(rows).length,overRim:true,protrudingPlug:false}));
