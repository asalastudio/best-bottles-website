/** Move detached units inside a fixed camera. Never resize a bottle or a component.
 * If a physical unit cannot fit, report it to the audit instead of distorting it.
 */
import { explodeUnitKey } from './exploded-stack';
import type { StageBounds, PdpStageFrame } from './pdp-stage-frame';
type Part = { slot: string; componentId?: string | null; explodeIndex: number; bounds: StageBounds };
type Offset = { dx: number; dy: number };
const moved = (b: StageBounds, o: Offset): StageBounds => ({ left: b.left + o.dx, right: b.right + o.dx, top: b.top + o.dy, bottom: b.bottom + o.dy });
const union = (a: StageBounds, b: StageBounds): StageBounds => ({ left: Math.min(a.left,b.left), right: Math.max(a.right,b.right), top: Math.min(a.top,b.top), bottom: Math.max(a.bottom,b.bottom) });
const fits = (b: StageBounds, f: StageBounds) => b.left >= f.left-1e-7 && b.right <= f.right+1e-7 && b.top >= f.top-1e-7 && b.bottom <= f.bottom+1e-7;
const overlaps = (a: StageBounds,b: StageBounds,gap: number) => a.left < b.right+gap-1e-7 && a.right > b.left-gap+1e-7 && a.top < b.bottom+gap-1e-7 && a.bottom > b.top-gap+1e-7;

export function fixedStageOffsets<T extends Part>(parts: readonly T[], offsets: ReadonlyMap<T,Offset>, view: 'sidecar'|'capon'|'exploded', frame: PdpStageFrame, canvas: { width: number; height: number }): Map<T,Offset> {
    const result = new Map(offsets);
    if(view==='capon')return result;
    const body=parts.find(p=>p.slot==='body');if(!body)return result;
    const margin=view==='exploded'?2:0.5;
    const area={left:(margin-frame.x)/100*canvas.width/frame.scale,right:(100-margin-frame.x)/100*canvas.width/frame.scale,top:(margin-frame.y)/100*canvas.height/frame.scale,bottom:(99.5-frame.y)/100*canvas.height/frame.scale};
    // Reserve a visible gap in screen space even when the approved glass is small.
    const gap=canvas.width/frame.scale*(view==='exploded'?.04:.005);
    const movable=parts.filter(p=>p.slot!=='body'&&(view==='exploded'||p.slot==='cap'||p.slot==='overcap'));
    const occupied=parts.filter(p=>!movable.includes(p)).map(p=>moved(p.bounds,result.get(p)??{dx:0,dy:0}));
    const groups=new Map<string,{parts:T[];bounds:StageBounds}>();
    for(const p of movable){const key=explodeUnitKey(p),old=groups.get(key);if(old){old.parts.push(p);old.bounds=union(old.bounds,p.bounds);}else groups.set(key,{parts:[p],bounds:{...p.bounds}});}
    const originalUnits=[...groups.values()].map(unit=>moved(unit.bounds,result.get(unit.parts[0])??{dx:0,dy:0}));
    if(originalUnits.every((bounds,index)=>fits(bounds,area)
        && (view!=="exploded" || [...occupied,...originalUnits.slice(0,index)].every(other=>!overlaps(bounds,other,gap)))))return result;
    // Place the largest mechanism first. Its head, collar and tube remain rigidly registered.
    const units=[...groups.values()].sort((a,b)=>(b.bounds.bottom-b.bounds.top)-(a.bounds.bottom-a.bounds.top));
    for(const unit of units){
        const b=unit.bounds,w=b.right-b.left,h=b.bottom-b.top;
        const preferred=result.get(unit.parts[0])??{dx:0,dy:0};
        const choose = (space: number, available: StageBounds) => {
            const xs=[body.bounds.right+space,body.bounds.left-space-w,available.left,available.right-w,(body.bounds.left+body.bounds.right-w)/2];
            const ys=[body.bounds.bottom-h,available.top,body.bounds.top-space-h,...occupied.flatMap(o=>[o.top-space-h,o.bottom+space])];
            const vertical=ys.map(y=>({dx:preferred.dx,dy:y-b.top}));
            const positions=[preferred,...vertical,...xs.flatMap(x=>ys.map(y=>({dx:x-b.left,dy:y-b.top})))];
            return positions.find(o=>{const q=moved(b,o);return fits(q,available)&&occupied.every(other=>!overlaps(q,other,space));});
        };
        // Wide glass can leave less than 4% beside an unchanged overcap. Use a
        // 1.5% visible gap and 0.5% side margins before leaving a unit offscreen.
        // The bottle, mechanism proportions and existing successful layouts stay fixed.
        const compactArea = { ...area,
            left:(0.5-frame.x)/100*canvas.width/frame.scale,
            right:(99.5-frame.x)/100*canvas.width/frame.scale };
        const chosen=choose(gap,area) ?? (view==='exploded'
            ? choose(canvas.width/frame.scale*.015,compactArea) : undefined);
        if(chosen){for(const p of unit.parts)result.set(p,chosen);occupied.push(moved(b,chosen));}
        else occupied.push(moved(b,preferred));
    }
    return result;
}
