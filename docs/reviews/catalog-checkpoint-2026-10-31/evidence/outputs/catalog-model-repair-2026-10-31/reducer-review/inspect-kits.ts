import fs from 'node:fs';
import {kitFromRegister} from '@/lib/register/stage-kit';
const p=JSON.parse(fs.readFileSync('outputs/catalog-model-repair-2026-10-31/reports/catalog-scale/register-payload-precise-raccoon-123.json','utf8')).payload;
const rows=Object.entries(p.assemblies).filter(([k,v]:any)=>v?.bodyId==='elegant-60ml-18-415'&&v.websiteSku?.includes('Rdcr')).map(([k,v]:any)=>({graceSku:k,assembly:v,kit:kitFromRegister(k,p)}));
fs.writeFileSync('outputs/catalog-model-repair-2026-10-31/reducer-review/source-kits.json',JSON.stringify(rows,null,2));
console.log(rows.length,rows[0].kit?.anchors,rows[0].kit?.parts.map(p=>({slot:p.slot,box:p.box,bounds:p.bounds})),rows[0].kit?.register);
