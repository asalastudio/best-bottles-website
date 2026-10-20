import fs from 'node:fs';
import {drawableRegisterKits} from '../src/lib/register/load';
const out='output/round78-lotion-completion';
for(const env of ['production','development']){
 const p=`${out}/${env}`,s=JSON.parse(fs.readFileSync(p+'-snapshot.json','utf8'));
 const kits=drawableRegisterKits(s.register);
 fs.writeFileSync(p+(process.argv.includes('--after')?'-after-kits':'-before-kits')+'.json',JSON.stringify(kits,null,2));
 if(env==='development'&&process.argv.includes('--after')){
  const rows=s.matrix.rows.filter((r:any)=>kits[r.websiteSku]);
  const result=rows.map((row:any)=>{
   const kit=kits[row.websiteSku],head=kit.parts.find(p=>p.slot==='pump');
   const match=rows.find((r:any)=>r.color==='Clear'&&kits[r.websiteSku].parts.some(p=>p.slot==='pump'&&p.componentId===head?.componentId&&p.image.url===head?.image.url));
   if(!match)throw new Error(`Unmatched registered pump for ${row.websiteSku}`);
   return {row:{...row,sourceCapColor:row.capColor,capColor:match.capColor},kit};
  });
  if(result.length!==14)throw new Error('Expected fourteen lotion variants');
  fs.writeFileSync(`${out}/kits.json`,JSON.stringify(result,null,2));
 }
}
