import fs from 'node:fs';import {drawableRegisterKits} from '../src/lib/register/load';
const out='output/diva46-two-bottle-pilot';
for(const env of ['production','development']){const p=`${out}/${env}`;const s=JSON.parse(fs.readFileSync(p+'-snapshot.json','utf8'));const kits=drawableRegisterKits(s.register);fs.writeFileSync(p+(process.argv.includes('--after')?'-after-kits':'-before-kits')+'.json',JSON.stringify(kits,null,2));
if(env==='development'&&process.argv.includes('--after'))fs.writeFileSync(`${out}/kits.json`,JSON.stringify(s.matrix.rows.filter((r:any)=>['GBDiva46SpryShnSl','GBDivaFrst46SpryShnSl'].includes(r.websiteSku)).map((row:any)=>({row:{...row,sourceCapColor:row.capColor,capColor:'Shiny Silver'},kit:kits[row.websiteSku]})),null,2));}
