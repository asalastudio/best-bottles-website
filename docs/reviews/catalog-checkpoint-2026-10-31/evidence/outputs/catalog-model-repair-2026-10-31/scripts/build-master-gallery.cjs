const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'../../..'),dir=path.join(root,'outputs/catalog-model-repair-2026-10-31/reports/glass-body-overview'),dest=path.join(root,'public/reviews/glass-body-overview-2026-10-31');
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n))),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title=r=>`${r.family} ${r.capacityMl} ml`,key=r=>r.bodyId+'|'+r.glass;
const method=p=>p.source?.library?.includes('Blender')?'Blender':'GPT image generation';
async function sheet(rows,file,cols=6,tileW=280,tileH=380){const imgH=318,layers=[];for(let i=0;i<rows.length;i++){const a=rows[i],x=i%cols*tileW,y=Math.floor(i/cols)*tileH;layers.push({input:await sharp(a.localPath).flatten({background:'#F5F3EF'}).resize(tileW-20,imgH-15,{fit:'contain',background:'#F5F3EF'}).png().toBuffer(),left:x+10,top:y+8});const lines=[a.title,a.subtitle,a.detail].filter(Boolean);layers.push({input:Buffer.from(`<svg width="${tileW}" height="62"><rect width="100%" height="100%" fill="#f5f3ef"/>${lines.map((t,j)=>`<text x="10" y="${15+j*17}" font-family="Arial" font-size="${j===0?13:10}" fill="${j===0?'#252522':'#74654d'}">${esc(String(t).slice(0,45))}</text>`).join('')}</svg>`),left:x,top:y+318});}await sharp({create:{width:cols*tileW,height:Math.ceil(rows.length/cols)*tileH,channels:3,background:'#F5F3EF'}}).composite(layers).png().toFile(path.join(dest,file));}
(async()=>{
const old=read('existing-approved-images.json'),regRaw=read('registered-body-masters.json'),histRaw=read('historical-ai-body-masters.json'),sum=read('recovery-summary.json'),snap=read('register-snapshot.json');
const bodyMap=new Map(snap.register.map(r=>[r.body.bodyId,r.body]));let registered=[],historical=[];fs.mkdirSync(path.join(dest,'masters'),{recursive:true});
for(const [src,arr]of[[regRaw,registered],[histRaw,historical]])for(const p of src.filter(r=>r.recovered)){const body=bodyMap.get(p.bodyId)||{};const hash=p.fileSha256||p.image?.sha256||p.sha256;const url='masters/'+hash+'.png';if(!fs.existsSync(path.join(dest,url)))fs.copyFileSync(p.localPath,path.join(dest,url));arr.push({bodyId:p.bodyId,plateKey:p.plateKey,glass:p.glass,family:p.family||body.family||p.bodyId.split('-')[0],capacityMl:p.capacityMl||body.capacityMl||Number(p.bodyId.match(/([\d.]+)ml/)?.[1]),neck:body.neck||'',url,localPath:path.join(dest,url),method:src===regRaw?method(p):'GPT image generation',approval:src===regRaw?p.anchorStatus:'Historical record; may be superseded',source:p.source,anchors:p.anchors,pxPerMm:p.pxPerMm,hashVerified:p.hashVerified,hashBasis:p.hashBasis,recordedHash:p.image?.sha256||p.sha256,fileSha256:p.fileSha256,checks:p.checks||null});}
for(const p of registered){
 if(p.bodyId==='vial-2ml-8-425'&&p.glass==='Clear')p.newIssue='Hold: this older shape was rejected today. Preserve the local regenerated replacement.';
 if(p.bodyId==='cream-jar-20ml-40mm')p.newIssue='Hold: wrong shallow-dish source; bare jar needs to be recovered.';
 if(p.bodyId==='vial-2ml-13-425')p.newIssue='Review: the top appears closed in this plate; verify against the source.';
}
const sort=(a,b)=>a.family.localeCompare(b.family)||a.capacityMl-b.capacityMl||a.bodyId.localeCompare(b.bodyId)||a.glass.localeCompare(b.glass);registered.sort(sort);historical.sort(sort);
const group=rows=>{const m=new Map();for(const r of rows){const prev=m.get(r.bodyId);if(!prev||r.glass==='Clear')m.set(r.bodyId,r);}return [...m.values()].sort(sort)};
const notes={
'circle-15ml-13-415':'Hold: depth renders round; source model is 49.7 mm deep versus the 17 mm filename specification. Recheck side profile.',
'circle-30ml-15-415':'Hold: neck opening and threads are not evident; horizontal profile bands visible.',
'circle-50ml-18-415':'Hold: strongly faceted outline and broad dark wall reflections.',
'circle-100ml-18-415':'Review: horizontal profile bands visible; compare depth and outline to registered master.',
'cream-jar-3ml-20mm':'Hold: apparent combined closure/body shape, not a reliable bare-glass master.',
'cylinder-9ml-13-415':'Review: very tall solid-looking foot; compare to the later registered Blender body.',
'cylinder-50ml-16mm':'Review: simplified crimp neck and strong dark foot line.',
'heart-decorative-4ml-8mm':'Hold: stopper appears joined to the glass body.',
'elegant-30ml-15-415':'Hold: neck opening and threads are not evident; horizontal profile bands visible.',
'footed-rectangle-10ml-13-415':'Hold: cap-shaped top remains in the body mesh.',
'slim-50ml-18-415':'Hold: body ends in a closed dome; bare neck is missing.',
'vial-2ml-8-425':'Hold: old body shape and neck; compare to today’s regenerated 2 ml vial.',
'vial-4ml-13-425':'Review: no visible thread detail in this front study.',
'flair-15ml-13-415':'Review: reconstructed drawing-based body; compare fluting, shoulder and glass thickness to the source photo.',
'sleek-5ml-13-415':'Review: reconstructed body; compare shoulder, base thickness and proportions to the source photo.',
 'tulip-5ml-13-415':'Review: reconstructed body; compare shape to the existing amber master before approval.'};
const bodies=read('body-queue.json').map(a=>({...a,url:'bodies/'+a.bodyId+'.png',localPath:path.join(dest,'bodies',a.bodyId+'.png'),method:'New Blender review study',approval:'Not approved',glass:'Clear study',finding:notes[a.bodyId]||'Review: front view available; source accuracy, side profile and closure fit are not signed off.'}));
const findings=bodies.map(a=>({bodyId:a.bodyId,skus:a.skus,status:a.finding.startsWith('Hold:')?'hold':'review',finding:a.finding,screenshot:a.url,scope:'Front-view visual screening only. No approval of model dimensions, all viewpoints or assemblies.'}));fs.writeFileSync(path.join(dir,'visual-findings.json'),JSON.stringify(findings,null,2));
const comparisons=bodies.map(b=>({bodyId:b.bodyId,family:b.family,capacityMl:b.capacityMl,study:b,master:group(registered).find(r=>r.bodyId===b.bodyId)||null,ai:group(historical).find(r=>r.bodyId===b.bodyId)||null}));
const representative=group(registered),historicalRep=group(historical);
await sheet(representative.map(a=>({...a,title:title(a),subtitle:a.glass+' · '+a.neck,detail:a.method+' · '+a.approval})), 'registered-body-designs.png');
await sheet(registered.map(a=>({...a,title:title(a),subtitle:a.glass+' · '+a.neck,detail:a.method+' · '+a.approval})), 'registered-body-colors.png',7,240,380);
await sheet(historicalRep.map(a=>({...a,title:title(a),subtitle:a.glass+' · '+a.neck,detail:'Earlier GPT body master'})), 'historical-ai-body-designs.png');
const matchPairs=comparisons.filter(a=>a.master).flatMap(a=>[{...a.master,title:title(a.master),subtitle:'EXISTING REGISTERED MASTER',detail:a.master.method},{...a.study,title:title(a.study),subtitle:'TODAY’S BLENDER STUDY',detail:a.study.finding}]);await sheet(matchPairs,'bodies-side-by-side.png',6,280,380);
const data={checkedAt:sum.checkedAt,summary:sum,registered,historical,bodies,comparisons,existing:old,missing:read('missing-bodies.json'),counts:{registeredDesigns:representative.length,registeredColors:registered.length,historicalDesigns:historicalRep.length,historicalColors:historical.length,blenderStudies:bodies.length}};fs.writeFileSync(path.join(dest,'inventory.json'),JSON.stringify(data,null,2));
const json=JSON.stringify(data).replace(/</g,'\\u003c');const html=fs.readFileSync(path.join(__dirname,'master-gallery.html'),'utf8').replace('/*__DATA__*/',`const DATA=${json};`);fs.writeFileSync(path.join(dest,'index.html'),html);
console.log(JSON.stringify(data.counts));
})().catch(e=>{console.error(e);process.exit(1)});
