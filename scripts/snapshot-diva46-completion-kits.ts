import fs from 'node:fs';import {drawableRegisterKits} from '../src/lib/register/load';
const reference=JSON.parse(fs.readFileSync('output/round78-spray-completion/kits.json','utf8'));
const finishForKit=(kit:any)=>{const head=kit.parts.find((p:any)=>p.slot==='sprayer');const match=reference.find((e:any)=>e.kit.parts.some((p:any)=>p.slot==='sprayer'&&p.componentId===head.componentId&&p.image.url===head.image.url));if(!match)throw new Error('Unmatched registered sprayer');return match.row.capColor;};
const out='output/diva46-spray-completion';
for(const env of ['production','development']){const p=`${out}/${env}`;const s=JSON.parse(fs.readFileSync(p+'-snapshot.json','utf8'));const kits=drawableRegisterKits(s.register);fs.writeFileSync(p+(process.argv.includes('--after')?'-after-kits':'-before-kits')+'.json',JSON.stringify(kits,null,2));
if(env==='development'&&process.argv.includes('--after'))fs.writeFileSync(`${out}/kits.json`,JSON.stringify(s.matrix.rows.filter((r:any)=>kits[r.websiteSku]).map((row:any)=>({row:{...row,sourceCapColor:row.capColor,capColor:finishForKit(kits[row.websiteSku])},kit:kits[row.websiteSku]})),null,2));}
