import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';
import { loadBuilderBodies } from '../src/lib/bottle-builder/server';
// Read-only census. Run with the preload, and supply an explicit output directory:
// node --require ./scripts/media-completion-audit-preload.cjs --import tsx ./scripts/media-completion-builder-audit.ts /path/to/evidence
const outDir = process.argv[2];
if (!outDir) throw new Error('Pass the evidence output directory');
fs.mkdirSync(outDir, { recursive: true });
const site = process.env.MEDIA_AUDIT_SITE ?? 'https://best-bottles-website.vercel.app';
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
async function main() {
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const families = (await client.query(anyApi.matrix.listFamilies, {})).map((f: {family: string})=>f.family);
  const offered: Record<string, unknown> = {};
  const bodyIds: Array<{family:string,id:string}> = [];
  for (const family of families) {
    const {rows,truncated} = await client.query(anyApi.matrix.getFamilyRows,{family});
    if(truncated) throw new Error('truncated '+family);
    const bodies = await loadBuilderBodies(rows, { strictRegister: true });
    for(const b of bodies) {
      bodyIds.push({family,id:b.id});
      for(const c of b.configurations) offered[c.id] = {bodyId:b.id,family,color:c.color,fitment:c.fitment,closure:c.closure};
    }
  }
  fs.writeFileSync(outDir+'/builder-replay.json',JSON.stringify({collectedAt:new Date().toISOString(),sourceCommit,endpoint:process.env.NEXT_PUBLIC_CONVEX_URL,offered,bodyIds}));
  console.log('local code replay',Object.keys(offered).length,'options',bodyIds.length,'bodies');
  const served: Record<string,unknown>={};
  const errors:unknown[]=[];
  for(let i=0;i<bodyIds.length;i+=4) await Promise.all(bodyIds.slice(i,i+4).map(async b=>{
    const url=new URL('/api/bottle-builder/bodies', site);
    url.searchParams.set('family',b.family);url.searchParams.set('bodyId',b.id);
    const response=await fetch(url,{signal:AbortSignal.timeout(30000)});const data=await response.json();
    if(!response.ok||!Array.isArray(data.configurations)){errors.push({b,status:response.status,data});return;}
    for(const c of data.configurations) served[c.id]={bodyId:b.id,family:b.family,color:c.color,fitment:c.fitment,closure:c.closure};
  }));
  const familyResponse=await fetch(new URL('/api/bottle-builder/families',site),{signal:AbortSignal.timeout(30000)});
  const familyPayload=await familyResponse.json();
  const servedFamilies=Array.isArray(familyPayload.families)?familyPayload.families.map((f:{family:string})=>f.family):[];
  const unexpectedFamilies=servedFamilies.filter((f:string)=>!families.includes(f));
  if(!familyResponse.ok||!servedFamilies.length||unexpectedFamilies.length)errors.push({kind:'family-scope',status:familyResponse.status,unexpectedFamilies});
  fs.writeFileSync(outDir+'/builder-served.json',JSON.stringify({collectedAt:new Date().toISOString(),site,servedFamilies,served,errors}));
  console.log('live server',Object.keys(served).length,'options','errors',errors.length,'replay differences',Object.keys(offered).filter(s=>!served[s]).length,Object.keys(served).filter(s=>!offered[s]).length);
  if(errors.length)throw new Error('Incomplete live census; inspect saved errors before using counts');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
