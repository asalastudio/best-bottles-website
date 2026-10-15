import source from './local-diva46-tubes.json';
import { stackedExplodeOffsets } from '../products/exploded-stack';
import type { RegisterComponent, RegisterKit, RegisterPlate } from './stage-kit';

/** Local reuse candidate for the exact shared sprayers. Source pixels stay intact;
 * photographic fit is constrained by the captured endpoint and glass floor.
 * This does not certify a measured Diva tube length or physical fit.
 */
export function localDiva46Tubes(kit: RegisterKit, plate: RegisterPlate | undefined,
    components: Readonly<Record<string, RegisterComponent>>): RegisterKit {
    if (process.env.NODE_ENV !== 'development' || process.env.VERCEL || !plate) return kit;
    const row = source.plates.find(p => p.websiteSkus.includes(kit.sku));
    if (!row) return kit;
    const e = row.expectedPlate;
    if (plate.approved !== e.approved || plate.url !== e.url || plate.bodyId !== e.bodyId || plate.glass !== e.glass
        || plate.width !== e.width || plate.height !== e.height || plate.pxPerMm !== e.pxPerMm
        || Object.entries(e.anchors).some(([k,v]) => plate.anchors[k as keyof typeof plate.anchors] !== v)) return kit;
    const body=kit.parts.find(p=>p.slot==='body'), holder=kit.parts.find(p=>p.slot==='sprayer');
    const component=holder?.componentId?components[holder.componentId]:undefined;
    const matched=source.components.find(c=>c.componentId===component?.componentId);
    const layers=component?.layers.filter(p=>!p.bodyId)??[];
    if (!body || body.image.url !== plate.url || !holder || !component || !matched || component.approved !== matched.approved
        || component.type !== matched.type || component.layers.some(p=>p.bodyId===plate.bodyId)
        || layers.length !== matched.layers.length || layers.some((p,i)=>{
            const m=matched.layers[i];return p.slot!==m.slot || p.url!==m.url || p.width!==m.width || p.height!==m.height
                || p.pxPerMm!==m.pxPerMm || p.anchor.x!==m.anchor.x || p.anchor.y!==m.anchor.y
                || p.approved!==m.approved || p.solidBottomY!==m.solidBottomY || p.explodeIndex!==m.explodeIndex || p.z!==m.z;
        })) return kit;
    const tubes=kit.parts.filter(p=>p.slot==='diptube'&&p.componentId===holder.componentId);
    const expectedTubes=source.expectedTubes[kit.sku as keyof typeof source.expectedTubes];
    if (!expectedTubes || tubes.length!==expectedTubes.length || tubes.some((p,i)=>{
        const t=expectedTubes[i];return p.componentId!==t.componentId || p.image.url!==t.image.url
            || p.image.width!==t.image.width || p.image.height!==t.image.height
            || JSON.stringify(p.views)!==JSON.stringify(t.views)
            || Object.entries(t.box).some(([key,value])=>p.box[key as keyof typeof p.box]!==value)
            || Object.entries(t.bounds).some(([key,value])=>p.bounds[key as keyof typeof p.bounds]!==value);
    })) return kit;
    const exposed=tubes.find(p=>p.views?.includes('exploded'));
    const seated=tubes.find(p=>p.views?.includes('capon'));
    const layer=matched.layers.find(p=>p.slot==='sprayer'&&p.url===holder.image.url);
    if(!kit.anchors.pxPerMm || tubes.length!==2 || !exposed || !seated || !layer || typeof layer.solidBottomY!=='number')return kit;
    const floor=body.bounds.bottom-source.innerFloorMmAboveFoot*kit.anchors.pxPerMm;
    const top=holder.box.y+layer.solidBottomY*holder.box.height/layer.height-2;
    const bottom=exposed.bounds.bottom;
    if(!(bottom>top) || bottom>=floor)return kit;
    const scale=(bottom-top)/(source.meaningfulBounds.bottom-source.meaningfulBounds.top);
    const round=(n:number)=>Math.round(n*100)/100;
    const x=kit.anchors.axisX-source.headAnchorX*scale, y=top-source.meaningfulBounds.top*scale;
    const box={x:round(x),y:round(y),width:round(source.width*scale),height:round(source.height*scale)};
    const bounds={left:round(x+source.meaningfulBounds.left*scale),top:round(top),right:round(x+source.meaningfulBounds.right*scale),bottom:round(bottom)};
    const inset=(body.bounds.right-body.bounds.left)*.2;
    const clip:Array<[number,number]>=[[round(body.bounds.left+inset),body.bounds.top],[round(body.bounds.right-inset),body.bounds.top],[round(body.bounds.right-inset),round(floor)],[round(body.bounds.left+inset),round(floor)]];
    const parts=kit.parts.map(p=>tubes.includes(p)?{...p,box,bounds,image:{url:source.url,key:source.url,sha256:source.sha256,bytes:source.bytes,width:source.width,height:source.height},
        ...(!p.views?.includes('exploded')?{throughGlass:{clip,opacity:plate.glass==='Frosted'?.22:.65}}:{})}:p);
    const explodedParts=parts.filter(p=>!p.views||p.views.includes('exploded'));
    const offsets=stackedExplodeOffsets(explodedParts);
    return {...kit,parts:parts.map(p=>{const i=explodedParts.indexOf(p);return i<0?p:{...p,exploded:offsets.get(i)??p.exploded};})};
}
