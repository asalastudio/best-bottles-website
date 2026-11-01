import fs from 'node:fs';
import { stageLayout,effectiveView,isClosureSlot } from '@/lib/products/pdp-redesign/stage';
import { offBottle } from '@/lib/products/kit-frame';
const out='outputs/catalog-model-repair-2026-10-31/reports/catalog-scale';
const kits=JSON.parse(fs.readFileSync(out+'/kits-after.json','utf8'));
const products=JSON.parse(fs.readFileSync('outputs/catalog-model-repair-2026-10-31/sources/catalog-production.json','utf8')).rows;
const groups=new Map<string,any[]>();for(const p of products){const kit=kits[p.websiteSku]??kits[p.graceSku];if(kit?.glassSizing&&kit.register){const g=groups.get(kit.register.bodyId)??[];g.push({p,kit});groups.set(kit.register.bodyId,g);}}
function fits(p:any,original:any,factor:number){
 const kit={...original,glassSizing:{...original.glassSizing,heightPct:original.glassSizing.heightPct*factor}};
 for(const view of ['sidecar','capon','exploded'] as const){
  const l=stageLayout(kit,view,p)!;const actual=effectiveView(view,kit,p);
  const parts=[...kit.parts].filter((r:any)=>!r.views||r.views.includes(actual)).sort((a:any,b:any)=>a.zOrder-b.zOrder).map((r:any)=>actual==='exploded'||actual==='sidecar'&&isClosureSlot(r.slot)?offBottle(r):r);
  for(let i=0;i<l.parts.length;i++){
   const q=l.parts[i],b={...parts[i].bounds};if(q.clipBottomPct&&parts[i].box)b.bottom=Math.min(b.bottom,parts[i].box.y+parts[i].box.height*(1-q.clipBottomPct/100));
   const x=(v:number)=>l.frame.x+(v/kit.canvas.width*100+q.dxPct)*l.frame.scale;
   const y=(v:number)=>l.frame.y+(v/kit.canvas.height*100+q.dyPct)*l.frame.scale;
   if(x(b.left)<0||y(b.top)<0||x(b.right)>100||y(b.bottom)>100)return false;
  }
 }return true;
}
const rows:any[]=[];
for(const [bodyId,entries]of groups){let factor=1;while(factor>.10&&!entries.every(({p,kit})=>fits(p,kit,factor)))factor=Math.round((factor-.01)*100)/100;const ok=entries.every(({p,kit})=>fits(p,kit,factor));rows.push({bodyId,factor,configurations:entries.length,pass:ok,approvedTargetPct:entries[0].kit.glassSizing.heightPct,interactiveSpanPct:entries[0].kit.glassSizing.heightPct*factor,reason:factor<1?'Fixed clearance envelope across all captured colors, hardware and views. This is a technical preview exception, not approval to change the catalog render target.':null});}
fs.writeFileSync(out+'/interactive-clearance.json',JSON.stringify({checkedAt:new Date().toISOString(),source:'local-register-payload.json',baselinePct:91,axisPct:50,method:'One body-level factor, shared by both stages, every color, hardware choice and view. Never calculated from the selected cap. Original catalog targets are retained. Conservative layer rectangles include transparent padding.',rows},null,2));
fs.writeFileSync('src/lib/register/catalog-clearance.generated.json',JSON.stringify(Object.fromEntries(rows.filter(r=>r.factor<1).map(r=>[r.bodyId,{factor:r.factor,reason:r.reason}])),null,2)+'\n');
console.log(JSON.stringify({bodies:rows.length,clearanceExceptions:rows.filter(r=>r.factor<1),failures:rows.filter(r=>!r.pass)},null,2));
