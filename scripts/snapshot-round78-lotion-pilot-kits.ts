import fs from 'node:fs';
import {drawableRegisterKits} from '../src/lib/register/load';
const out='output/round78-lotion-pilot';
const pilotSkus=['LBRnd78LtnShnSl','LBRndFrst78LtnShnSl'];
for(const env of ['production','development']){
 const p=`${out}/${env}`;
 const s=JSON.parse(fs.readFileSync(p+'-snapshot.json','utf8'));
 const kits=drawableRegisterKits(s.register);
 fs.writeFileSync(p+(process.argv.includes('--after')?'-after-kits':'-before-kits')+'.json',JSON.stringify(kits,null,2));
 if(env==='development'&&process.argv.includes('--after')){
  const rows=s.matrix.rows.filter((r:any)=>pilotSkus.includes(r.websiteSku)).map((row:any)=>{
   const kit=kits[row.websiteSku],pump=kit.parts.find(p=>p.slot==='pump');
   if(pump?.componentId!=='CMP-LPM-SSLV-18-415')throw new Error(`Unexpected pump for ${row.websiteSku}`);
   // Both exact-SKU legacy pages identify Shiny Silver. The raw frosted matrix
   // capColor is a glass label; retain it without changing backend records.
   return {row:{...row,sourceCapColor:row.capColor,capColor:'Shiny Silver'},kit};
  });
  if(rows.length!==2)throw new Error('Expected both pilot SKUs');
  fs.writeFileSync(`${out}/kits.json`,JSON.stringify(rows,null,2));
 }
}
