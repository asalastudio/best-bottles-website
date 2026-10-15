import spraySource from './local-round78-tubes.json';
import lotionSource from './local-round78-lotion-tubes.json';
import type { RegisterComponent, RegisterKit, RegisterPlate } from './stage-kit';
import { stackedExplodeOffsets } from '../products/exploded-stack';

/** Intact source-layer pilot. The source glass has no usable rim datum;
 * register shoulder-to-foot uniformly and seat the head under its own sprayer.
 * Neither the glass nor the closure's assembled placement is changed.
 */
export function localRound78Tubes(kit: RegisterKit, plate: RegisterPlate | undefined,
    components: Readonly<Record<string, RegisterComponent>>): RegisterKit {
    if (process.env.NODE_ENV !== 'development' || process.env.VERCEL || !plate) return kit;
    const source = [spraySource, lotionSource].find(s => s.plates.some(p => p.websiteSkus.includes(kit.sku)));
    if (!source) return kit;
    const row=source.plates.find(r=>r.websiteSkus.includes(kit.sku));
    if(!row) return kit;
    const expected=row.expectedPlate;
    if(plate.approved!==expected.approved||plate.bodyId!==expected.bodyId || plate.glass!==expected.glass || plate.url!==expected.url
        ||plate.width!==expected.width||plate.height!==expected.height||plate.pxPerMm!==expected.pxPerMm
        ||Object.entries(expected.anchors).some(([k,v])=>plate.anchors[k as keyof typeof plate.anchors]!==v))return kit;
    const holderSlot = source === lotionSource ? 'pump' : 'sprayer';
    const body=kit.parts.find(p=>p.slot==='body'), holder=kit.parts.find(p=>p.slot===holderSlot);
    const component=holder?.componentId?components[holder.componentId]:undefined;
    const matched=source.components.find(c=>c.componentId===component?.componentId);
    // Development also carries Empire-specific layers on these shared parts.
    // They do not participate in Round composition. A future Round-specific
    // layer takes precedence and invalidates this generic-source pilot.
    const mechanismLayers=component?.layers.filter(p=>!p.bodyId)??[];
    if(!body||body.image.url!==plate.url||!holder||!component||!matched||component.approved!==matched.approved||component.type!==matched.type
        ||component.layers.some(p=>p.bodyId===plate.bodyId)
        ||mechanismLayers.length!==matched.layers.length||mechanismLayers.some((p,i)=>{
            const e=matched.layers[i];return p.slot!==e.slot||p.url!==e.url||p.width!==e.width||p.height!==e.height
                ||p.pxPerMm!==e.pxPerMm||p.anchor.x!==e.anchor.x||p.anchor.y!==e.anchor.y
                ||p.explodeIndex!==e.explodeIndex||p.z!==e.z||p.solidBottomY!==e.solidBottomY;
        }))return kit;
    const tubes=kit.parts.filter(p=>p.slot==='diptube'&&p.componentId===holder.componentId);
    if(tubes.length!==2||!tubes.some(p=>p.views?.includes('capon'))||!tubes.some(p=>p.views?.includes('exploded')))return kit;
    const round=(n:number)=>Math.round(n*100)/100;
    if(typeof plate.anchors.shoulderY!=='number'||!kit.anchors.pxPerMm)return kit;
    const plateScale=body.box.height/plate.height;
    const shoulder=body.box.y+plate.anchors.shoulderY*plateScale;
    const scale=(body.bounds.bottom-shoulder)/(source.bodyBaselineY-source.bodyShoulderY);
    const x=kit.anchors.axisX-source.headAnchorX*scale;
    const pumpLayer = source === lotionSource ? matched.layers.find(p => p.slot === 'pump' && p.url === holder.image.url) : undefined;
    if (source === lotionSource && (!pumpLayer || typeof pumpLayer.solidBottomY !== 'number')) return kit;
    // Pump images contain transparent rows below their solid collar. Join to
    // that measured edge, not to the padded image rectangle.
    const holderBottom = pumpLayer ? holder.box.y + pumpLayer.solidBottomY * holder.box.height / pumpLayer.height : holder.bounds.bottom;
    const y=holderBottom-2-source.meaningfulBounds.top*scale;
    const box={x:round(x),y:round(y),width:round(source.width*scale),height:round(source.height*scale)};
    const bounds={left:round(x+source.meaningfulBounds.left*scale),right:round(x+source.meaningfulBounds.right*scale),
        top:round(y+source.meaningfulBounds.top*scale),bottom:round(y+source.meaningfulBounds.bottom*scale)};
    const floor=body.bounds.bottom-source.innerFloorMmAboveFoot*kit.anchors.pxPerMm;
    if(!(scale>0)||bounds.bottom>=floor)return kit;
    const left=body.bounds.left+(body.bounds.right-body.bounds.left)*0.2;
    const right=body.bounds.right-(body.bounds.right-body.bounds.left)*0.2;
    const clip:Array<[number,number]>=[[round(left),body.bounds.top],[round(right),body.bounds.top],[round(right),round(floor)],[round(left),round(floor)]];
    const parts=kit.parts.map(p=>tubes.includes(p)?{...p,box,bounds,
        image:{url:source.url,key:source.url,sha256:source.sha256,bytes:source.bytes,width:source.width,height:source.height},
        ...(!p.views?.includes('exploded')?{throughGlass:{clip,opacity:plate.glass==='Frosted'?0.22:0.65}}:{})}:p);
    const exposed=parts.filter(p=>!p.views||p.views.includes('exploded'));
    const offsets=stackedExplodeOffsets(exposed);
    // Copy rather than mutate unchanged kit parts while restacking the new tube.
    return {...kit,parts:parts.map(p=>{
        const index=exposed.indexOf(p);return index<0?p:{...p,exploded:offsets.get(index)??p.exploded};
    })};
}
