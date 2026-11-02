import fs from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { availableViews, stageLayout, type StageView } from '../../../src/lib/products/pdp-redesign/stage';
import type { ReviewKit as KitLike, FamilySnapshot, RecoveredMaster, ReviewHold } from './review-types';
import { builderBodyIdentity, type CatalogRow } from '../../../src/lib/bottle-builder/model';
import { withCylinder25CopperOvercap } from '../../../src/lib/register/cylinder25-copper-overcap';

const dir='docs/reviews/cylinder-family-completion-2026-11-02';
const out='public/local-kits/cylinder-family-completion-2026-11-02';
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const hash=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
const raw=read(dir+'/register-kits-before.json').kits as Record<string,KitLike>;
const catalog=Object.values((read(dir+'/current-family-snapshot.json') as FamilySnapshot).families).flatMap(f=>f.rows) as CatalogRow[];
const library=read('docs/reviews/cylinder-master-materials-2026-10-31/family-inventory.json').rows as RecoveredMaster[];
const media=read(dir+'/source-media.json');
const rows:Record<string,KitLike>={}, before:Record<string,KitLike>={}, changes:Record<string, unknown>[]=[], held:ReviewHold[]=[];
const tubeSources:Array<Record<string, unknown> & { image: {bytes:number} }>=[];
fs.mkdirSync(out,{recursive:true});
const nativeLotion=fs.readFileSync('docs/reviews/cylinder-lotion-pumps-2026-11-02/sources/lotion-tube-clean.png');
const nativeSpray=fs.readFileSync('docs/reviews/cylinder5-finemist-2026-11-01/sources/approved-mechanism.png');
const reference25=read('public/local-kits/cylinder25-material-cleanup-2026-11-02/kits.json');
const old25=read('public/local-kits/cylinder25-18415-2026-11-01/kits.json');
const lotionReference=reference25.rows.LBCyl25LtnMtGl as KitLike;
const referenceTube=lotionReference.parts.find(p=>p.slot==='diptube')!;
const lotionSourceScalePerStageMm=referenceTube.box!.width/725/lotionReference.anchors.pxPerMm!;
const sprayReference=old25.rows.GBcyl25SpryMtGl as KitLike;
const sprayScalePerStageMm=sprayReference.parts.find(p=>p.slot==='diptube')!.box!.width/180/sprayReference.anchors.pxPerMm!;
// These are visual source-image landmarks, not newly asserted physical depths.
const floors:Record<string,number>={'cylinder-50ml-18-415':1970,'cylinder-100ml-18-415':1974};

async function makeTube(kind:'lotion'|'spray'|'bulb',bodyId:string,height:number,ppm:number){
    const source=kind==='spray'?nativeSpray:nativeLotion;
    const scale=ppm*(kind==='spray'?sprayScalePerStageMm:lotionSourceScalePerStageMm*(kind==='bulb'?.7:1));
    const width=kind==='spray'?180:235,H=height/scale;
    const head=kind==='spray'?376:kind==='lotion'?278:0;
    assert(H>head+100,'Mechanism must fit above its shaft');
    const section=(y:number,h:number,sx:number,sy:number,sw:number,sh:number)=>`<svg x="0" y="${y}" width="${width}" height="${h}" viewBox="${sx} ${sy} ${sw} ${sh}" preserveAspectRatio="none" overflow="hidden"><use href="#material"/></svg>`;
    const sections=kind==='spray'
        ? section(0,376,430,98,180,376)+section(376,H-376-555,430,474,180,426)+section(H-555,555,430,900,180,555)
        : (kind==='lotion'?section(0,278,240,157,235,278):'')+section(head,H-head,240,435,235,1662);
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${H}" viewBox="0 0 ${width} ${H}"><defs><image id="material" href="data:image/png;base64,${source.toString('base64')}" width="${kind==='spray'?1024:725}" height="${kind==='spray'?1536:2170}"/></defs>${sections}</svg>`;
    const svgSha=hash(svg),name=kind+'-'+bodyId+'.'+svgSha.slice(0,12)+'.svg';
    fs.writeFileSync(dir+'/sources/'+name,svg);
    // A lossless display export of the layer composition. No texture retouching,
    // outline synthesis, or change to the approved source-material pixels.
    const png=await sharp(Buffer.from(svg)).png().toBuffer();
    const webp=await sharp(png).webp({lossless:true,effort:6}).toBuffer();
    const decodedPng=await sharp(png).ensureAlpha().raw().toBuffer();
    const decodedWebp=await sharp(webp).ensureAlpha().raw().toBuffer();
    let alphaDifferences=0,visibleColorDifferences=0;
    for(let i=0;i<decodedPng.length;i+=4){
        if(decodedPng[i+3]!==decodedWebp[i+3])alphaDifferences++;
        if(decodedPng[i+3]>0 && (decodedPng[i]!==decodedWebp[i]||decodedPng[i+1]!==decodedWebp[i+1]||decodedPng[i+2]!==decodedWebp[i+2]))visibleColorDifferences++;
    }
    assert.equal(alphaDifferences,0,'Tube alpha changed');
    assert.equal(visibleColorDifferences,0,'Visible tube color changed');
    const sha=hash(webp),file=kind+'-tube.'+sha.slice(0,12)+'.webp';
    fs.writeFileSync(out+'/'+file,webp);
    const meta=await sharp(webp).metadata();
    const image={url:'/local-kits/cylinder-family-completion-2026-11-02/'+file,key:'',sha256:sha,bytes:webp.length,width:meta.width!,height:meta.height!};
    const result={image,width:width*scale,height,axisOffset:(kind==='spray'?86:88.5)*scale,headBottom:head};
    tubeSources.push({bodyId,kind,sourceMaterialSha256:hash(source),registrationSvg:dir+'/sources/'+name,registrationSha256:svgSha,image,headBottom:head,widthScale:scale,alphaDifferences,visibleColorDifferences});
    return result;
}

for(const bodyId of Object.keys(floors)){
    const group=catalog.filter(r=>r.category==='Glass Bottle'&&raw[r.websiteSku!]?.register?.bodyId===bodyId);
    const master=library.find(r=>r.bodyId===bodyId&&r.glass==='Clear');
    assert(master?.sourceAvailable,bodyId+' lacks a recovered body');
    const bodyBytes=fs.readFileSync(master.sourceFile);assert.equal(hash(bodyBytes),master.fileSha256);
    const bodyFile='body-'+bodyId+'.'+master.fileSha256.slice(0,12)+'.png';
    fs.writeFileSync(out+'/'+bodyFile,bodyBytes);
    const sample=raw[group[0].websiteSku!],sampleBody=sample.parts.find(p=>p.slot==='body')!;
    const shoulder=sampleBody.box!.y+master.anchors.bodyShoulderY!*sampleBody.box!.height/sampleBody.image.height;
    const innerFloor=sampleBody.box!.y+floors[bodyId]*sampleBody.box!.height/sampleBody.image.height;
    const ppm=sample.anchors.pxPerMm!,tip=innerFloor-.5*ppm,top=shoulder-ppm;
    const mechanisms={lotion:await makeTube('lotion',bodyId,tip-top,ppm),spray:await makeTube('spray',bodyId,tip-top,ppm),bulb:await makeTube('bulb',bodyId,tip-top,ppm)};
    for(const row of group){
        const sku=row.websiteSku!,original=raw[sku];assert(original&&original.sku===sku);
        if(row.applicator==='Vintage Bulb Sprayer with Tassel'){
            held.push({sku,bodyId,reason:'tassel-source-and-frame-reconciliation',detail:'The shared hanging artwork needs exact collar-color and fixed-frame reconciliation. This recipe was not substituted or silently scaled.'});continue;
        }
        const kit=structuredClone(original),body=kit.parts.find(p=>p.slot==='body')!;
        before[sku]=structuredClone(original);
        body.image={...body.image,url:'/local-kits/cylinder-family-completion-2026-11-02/'+bodyFile,sha256:master.fileSha256,bytes:bodyBytes.length};
        kit.glassSizing={heightPct:master.scale.targetPct,baselinePct:master.scale.baselinePct,landmarkY:body.box!.y+master.anchors.shoulderY*body.box!.height/body.image.height,source:master.scale.source};
        const adjustments:Array<{slot:string;dx:number;dy:number;visibleBottom:number}>=[];
        for(const part of kit.parts){
            if(part.slot==='body'||part.slot==='diptube')continue;
            const m=media[part.image.url];assert(m,'Missing native asset '+part.image.url);
            assert.equal(hash(fs.readFileSync(m.file)),m.sha256);
            part.image={...part.image,sha256:m.sha256,bytes:m.bytes};
            if(!['pump','sprayer','overcap'].includes(part.slot)||row.applicator==='Vintage Bulb Sprayer')continue;
            const box=part.box!,v=m.visibleBounds;
            const dx=kit.anchors.axisX-(box.x+(v.left+v.right)/2/m.width*box.width);
            const dy=shoulder-(box.y+v.bottom/m.height*box.height);
            part.box={...box,x:box.x+dx,y:box.y+dy};
            part.bounds={left:part.box.x+v.left/m.width*box.width,top:part.box.y+v.top/m.height*box.height,right:part.box.x+v.right/m.width*box.width,bottom:shoulder};
            adjustments.push({slot:part.slot,dx,dy,visibleBottom:shoulder});
        }
        const kind=row.applicator==='Lotion Pump'?'lotion':row.applicator==='Perfume Spray Pump'?'spray':row.applicator==='Vintage Bulb Sprayer'?'bulb':null;
        if(kind){
            const material=mechanisms[kind],old=kit.parts.find(p=>p.slot==='diptube');assert(old,'No tube holder for '+sku);
            const holder=kit.parts.find(p=>p.slot===(kind==='lotion'?'pump':'sprayer'))!;
            const layer={...structuredClone(old),image:material.image,image2x:null,mask:null,
                box:{x:kit.anchors.axisX-material.axisOffset,y:top,width:material.width,height:material.height},
                bounds:{left:kit.anchors.axisX-material.axisOffset,top,right:kit.anchors.axisX-material.axisOffset+material.width,bottom:tip},
                zOrder:1,explodeIndex:holder.explodeIndex,componentId:holder.componentId,assembled:{x:0,y:0},exploded:{dx:0,dy:0}};
            delete layer.trimBottomPct;
            const seated={...layer,views:['sidecar','capon'] as StageView[],opacity:kind==='bulb'?.7:.62,blendMode:'multiply' as const};
            const detached={...structuredClone(layer),views:['exploded'] as StageView[],opacity:1};
            kit.parts=kit.parts.filter(p=>p.slot!=='diptube');kit.parts.push(seated,detached);
        }
        // The same defective 18-415 copper crop is shared across these sizes.
        // Reuse the cleaned cap while preserving the newly registered visible edge.
        const compatible=withCylinder25CopperOvercap(kit.parts,'cylinder-25ml-18-415');
        kit.parts=compatible.map(part=>{
            if(part.slot!=='overcap'||!part.image.url.includes('e8eb5bb9035ca88d'))return part;
            const dx=kit.anchors.axisX-(part.bounds.left+part.bounds.right)/2,dy=shoulder-part.bounds.bottom;
            return {...part,box:{...part.box!,x:part.box!.x+dx,y:part.box!.y+dy},bounds:{left:part.bounds.left+dx,right:part.bounds.right+dx,top:part.bounds.top+dy,bottom:shoulder}};
        });
        assert.deepEqual(body.box,original.parts.find(p=>p.slot==='body')!.box);
        assert.deepEqual(body.bounds,original.parts.find(p=>p.slot==='body')!.bounds);
        rows[sku]=kit;changes.push({sku,bodyId,bodySha256:master.fileSha256,bodyGeometryPreserved:true,innerFloorY:innerFloor,tipY:kind?tip:null,tubeKind:kind,headAndCapAlignment:adjustments,source:'Recovered body and registered original component artwork; clean shared internal material'});
    }
}
// Carry the existing 25 ml candidate forward, rather than creating another body.
const confirmed25 = new Set(read(dir+'/physical-profile-crosswalk.json').fitmentPolicy25ml.allowedApplicators);
for(const [sku,kit] of Object.entries(reference25.rows) as Array<[string,KitLike]>){
    const record=catalog.find(row=>row.websiteSku===sku)!;
    if(!confirmed25.has(record.applicator)){
        held.push({sku,bodyId:'cylinder-25ml-18-415',reason:'25ml-fitment-scope',detail:'Imported '+record.applicator+' row is outside Jordan\'s confirmed 25 ml reducer, sprayer, lotion, bulb and tassel set. Original record and artwork remain preserved for reconciliation.'});
        continue;
    }
    rows[sku]=kit;before[sku]=raw[sku];
}
const bulb25=catalog.filter(row=>row.capacityMl===25&&row.family==='Cylinder'&&row.applicator==='Vintage Bulb Sprayer');
if(bulb25.length){
    const sample=rows[bulb25[0].websiteSku!],oldBody=old25.rows[bulb25[0].websiteSku!].parts.find((p:{slot:string})=>p.slot==='body');
    const ppm=sample.anchors.pxPerMm!,top=sample.glassSizing!.landmarkY!-ppm;
    const floor=oldBody.box.y+1935*oldBody.box.height/oldBody.image.height,tip=floor-.5*ppm;
    const material=await makeTube('bulb','cylinder-25ml-18-415',tip-top,ppm);
    for(const row of bulb25){const kit=rows[row.websiteSku!],old=kit.parts.find(p=>p.slot==='diptube')!,holder=kit.parts.find(p=>p.slot==='sprayer')!;
        const part={...structuredClone(old),image:material.image,image2x:null,mask:null,
            box:{x:kit.anchors.axisX-material.axisOffset,y:top,width:material.width,height:tip-top},
            bounds:{left:kit.anchors.axisX-material.axisOffset,top,right:kit.anchors.axisX-material.axisOffset+material.width,bottom:tip},
            views:['sidecar','capon'] as StageView[],opacity:.7,blendMode:'multiply' as const,zOrder:1,componentId:holder.componentId,explodeIndex:holder.explodeIndex};
        delete part.trimBottomPct;kit.parts=kit.parts.filter(p=>p.slot!=='diptube');kit.parts.push(part);
        changes.push({sku:row.websiteSku,bodyId:'cylinder-25ml-18-415',tubeKind:'bulb',innerFloorY:floor,tipY:tip,presentation:'assembled color swatches only'});
    }
}
held.push(...read('docs/reviews/cylinder25-18415-2026-11-01/registration.json').held.map((x:ReviewHold)=>({...x,bodyId:'cylinder-25ml-18-415'})));
for(const row of catalog.filter(r=>r.category==='Glass Bottle'&&r.capacityMl===30))held.push({sku:row.websiteSku,bodyId:'cylinder-30ml-18-415',reason:'fixed-classic-spray-source',detail:'Native PSD and live reference recovered. It includes a matching metal base; a separate plain body is not yet validated. Keep the existing source until that assembly is reconciled.'});

const rollerFile=dir+'/roller-registration.json';
if(fs.existsSync(rollerFile)){
    const rollerData=read(rollerFile);
    const rollerKits=read(out+'/roller-kits.json').rows;
    Object.assign(rows,rollerKits);
    changes.push(...rollerData.configurations);
}
const version=hash(JSON.stringify(rows)).slice(0,16);
fs.writeFileSync(out+'/kits.json',JSON.stringify({version,status:'local-visual-review',rows,defaultPdpSkus:[]},null,2)+'\n');
fs.writeFileSync(dir+'/registration.json',JSON.stringify({version,status:'review-candidates-not-production',scopeRows:catalog.length,glassRows:catalog.filter(r=>r.category==='Glass Bottle').length,preparedRows:Object.keys(rows).length,held,tubeSources,changes,publication:'Existing approved recipes untouched. No backend/catalog mutation. Localhost assetPreview=gpt13 only.'},null,2)+'\n');
const entries=Object.entries(rows).map(([sku,kit])=>{
    const row=catalog.find(r=>r.websiteSku===sku)!;assert(row);
    const context={websiteSku:sku,family:row.family!,color:row.color!,capacityMl:row.capacityMl,applicator:row.applicator};
    const views=availableViews(kit,context);
    return {sku,profile:builderBodyIdentity(row).bodyId,capacityMl:row.capacityMl,neck:row.neckThreadSize,glass:row.color,title:(row.applicator??'Pour bottle')+' · '+row.capColor,
        product:'/products/'+row.productGroupSlug+'?sku='+encodeURIComponent(sku)+'&assetPreview=gpt13',views,
        before:before[sku]?Object.fromEntries(views.map(view=>[view,stageLayout({...before[sku],glassSizing:kit.glassSizing},view,context)])):null,
        after:Object.fromEntries(views.map(view=>[view,stageLayout(kit,view,context)]))};
});
fs.writeFileSync(dir+'/review-data.json',JSON.stringify(entries,null,2)+'\n');
console.log(JSON.stringify({version,prepared:entries.length,held:held.length,tubeSources:tubeSources.length,tubeDisplayBytes:tubeSources.reduce((n,s)=>n+s.image.bytes,0)}));
