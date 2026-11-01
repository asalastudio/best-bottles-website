import { describe, expect, it } from 'vitest';
import { fixedStageOffsets } from '@/lib/products/fixed-stage-placement';
import { stackedExplodeOffsets } from '@/lib/products/exploded-stack';
const parts=[
 {slot:'body',explodeIndex:0,bounds:{left:379.29,right:620.71,top:566,bottom:1061}},
 {slot:'sprayer',componentId:'spray',explodeIndex:1,bounds:{left:417.58,right:584.01,top:388.75,bottom:698.15}},
 {slot:'diptube',componentId:'spray',explodeIndex:1,bounds:{left:474.8,right:525.2,top:630,bottom:1030}},
 {slot:'overcap',componentId:'spray',explodeIndex:2,bounds:{left:400.95,right:600.92,top:340.84,bottom:710.88}},
];
const frame={x:1,y:-4.09,scale:.98};const canvas={width:1000,height:1100};
describe('fixed stage spacing',()=>{
 it('keeps a visible gap around the glass while the sprayer and tube move as one unit',()=>{
  const initial=stackedExplodeOffsets(parts);const result=fixedStageOffsets(parts,new Map(parts.map((part,i)=>[part,initial.get(i)!])),'exploded',frame,canvas);
  expect(result.get(parts[0])).toEqual({dx:0,dy:0});expect(result.get(parts[1])).toEqual(result.get(parts[2]));
  const units=[[parts[0]],[parts[1],parts[2]],[parts[3]]].map(unit=>({left:Math.min(...unit.map(p=>p.bounds.left+result.get(p)!.dx)),right:Math.max(...unit.map(p=>p.bounds.right+result.get(p)!.dx)),top:Math.min(...unit.map(p=>p.bounds.top+result.get(p)!.dy)),bottom:Math.max(...unit.map(p=>p.bounds.bottom+result.get(p)!.dy))}));
  for(const b of units){expect(b.left*frame.scale+frame.x*10).toBeGreaterThanOrEqual(5-1e-6);expect(b.right*frame.scale+frame.x*10).toBeLessThanOrEqual(995+1e-6);expect(b.top*frame.scale+frame.y*11).toBeGreaterThanOrEqual(5.5-1e-6);expect(b.bottom*frame.scale+frame.y*11).toBeLessThanOrEqual(1094.5+1e-6);}
  for(let a=0;a<units.length;a++)for(let b=a+1;b<units.length;b++){const u=units[a],v=units[b];const gap=Math.max(v.left-u.right,u.left-v.right,v.top-u.bottom,u.top-v.bottom)*frame.scale;expect(gap).toBeGreaterThanOrEqual(39.9);}
 });
 it('separates crowded units even when they already fit inside the frame',()=>{
  const initial=new Map(parts.map(part=>[part,{dx:0,dy:0}]));
  initial.set(parts[1],{dx:208.13,dy:0});initial.set(parts[2],{dx:208.13,dy:0});
  initial.set(parts[3],{dx:0,dy:-260});
  const result=fixedStageOffsets(parts,initial,'exploded',frame,canvas);
  expect(result.get(parts[0])).toEqual({dx:0,dy:0});
  expect(result.get(parts[1])).toEqual(result.get(parts[2]));
  const body=parts[0].bounds,sprayer=parts[1].bounds,offset=result.get(parts[1])!;
  const gap=Math.max(sprayer.left+offset.dx-body.right,body.left-sprayer.right-offset.dx,sprayer.top+offset.dy-body.bottom,body.top-parts[2].bounds.bottom-offset.dy)*frame.scale;
  expect(gap).toBeGreaterThanOrEqual(39.9);
 });
 it('fits a wide Circle bottle without shrinking the glass or breaking the mechanism',()=>{
  const circle=[
   {slot:'body',explodeIndex:0,bounds:{left:237.66,right:762.34,top:380,bottom:1061}},
   {slot:'sprayer',componentId:'spray',explodeIndex:1,bounds:{left:412.38704091341583,right:585.9461370123693,top:187.0578591817317,bottom:534.1760513796385}},
   {slot:'diptube',componentId:'spray',explodeIndex:1,bounds:{left:474.824,right:525.176,top:421.9533308696747,bottom:1029.9537308696747}},
   {slot:'overcap',componentId:'spray',explodeIndex:2,bounds:{left:399.1522740247383,right:601.7859372026641,top:163.19335870599426,bottom:531.1019124643196}},
  ];
  const camera={scale:.9899192364170338,x:.50403817914831,y:-4.48220998531572};
  const initial=stackedExplodeOffsets(circle);
  const result=fixedStageOffsets(circle,new Map(circle.map((p,i)=>[p,initial.get(i)!])),'exploded',camera,canvas);
  expect(result.get(circle[0])).toEqual({dx:0,dy:0});
  expect(result.get(circle[1])).toEqual(result.get(circle[2]));
  const units=[[circle[0]],[circle[1],circle[2]],[circle[3]]].map(unit=>({left:Math.min(...unit.map(p=>p.bounds.left+result.get(p)!.dx)),right:Math.max(...unit.map(p=>p.bounds.right+result.get(p)!.dx)),top:Math.min(...unit.map(p=>p.bounds.top+result.get(p)!.dy)),bottom:Math.max(...unit.map(p=>p.bounds.bottom+result.get(p)!.dy))}));
  for(const b of units){expect(b.left*camera.scale+camera.x*10).toBeGreaterThanOrEqual(5-1e-6);expect(b.right*camera.scale+camera.x*10).toBeLessThanOrEqual(995+1e-6);expect(b.top*camera.scale+camera.y*11).toBeGreaterThanOrEqual(5.5-1e-6);expect(b.bottom*camera.scale+camera.y*11).toBeLessThanOrEqual(1094.5+1e-6);}
  for(let a=0;a<units.length;a++)for(let b=a+1;b<units.length;b++){const u=units[a],v=units[b];expect(Math.max(v.left-u.right,u.left-v.right,v.top-u.bottom,u.top-v.bottom)*camera.scale).toBeGreaterThanOrEqual(15-1e-6);}
 });
 it('does not move seated components when the cap is on',()=>{
  const offsets=new Map(parts.map(p=>[p,{dx:0,dy:0}]));expect(fixedStageOffsets(parts,offsets,'capon',frame,canvas)).toEqual(offsets);
 });
});
