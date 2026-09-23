// Bounded, restartable execution of the explicitly requested 47-image batch.
const fs = require('fs');
const {spawn} = require('child_process');
require('dotenv').config({path:'/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/.env.local',quiet:true});
if (!process.env.OPENAI_API_KEY) throw Error('OPENAI_API_KEY is not configured');
const manifest = 'output/imagegen/boston-diva-2026-09-23/manifest.json';
const rows = JSON.parse(fs.readFileSync(manifest)).rows;
const boston = rows.filter(r=>r.family==='Boston Round');
const diva = rows.filter(r=>r.family==='Diva');
const queue=[];
for(let i=0;i<Math.max(boston.length,diva.length);i++) {
  if(boston[i]) queue.push(boston[i]);
  if(diva[i]) queue.push(diva[i]);
}
let next=0, completed=0, failed=false;
async function worker() {
  while (!failed && next<queue.length) {
    const row=queue[next++];
    const code=await new Promise(resolve=>{
      const child=spawn('python3',['scripts/hero-families/render-frosted-circle-round.py','--manifest',manifest,'--sku',row.sku,'--execute'],{env:{...process.env,SSL_CERT_FILE:'/etc/ssl/cert.pem'},stdio:'inherit'});
      child.on('error',()=>resolve(-1));child.on('close',resolve);
    });
    if(code!==0){failed=true;console.error(`STOP: ${row.sku} exited ${code}. Inspect before retrying.`);}
    else console.log(`BATCH PROGRESS ${++completed}/${queue.length}`);
  }
}
Promise.all([worker(),worker(),worker()]).then(()=>{process.exitCode=failed?1:0;console.log(`Batch finished: ${completed}/${queue.length}; stopped=${failed}`);});
