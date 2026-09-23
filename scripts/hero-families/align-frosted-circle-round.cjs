// Whole-image registration only. Keeps native source bytes, components and shadows.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve(process.argv[2]||'output/imagegen/frosted-circle-round-family'),out=path.join(root,'aligned');fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))),measurements=JSON.parse(fs.readFileSync(path.join(root,'verified-native-landmarks.json')));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const svg=s=>Buffer.from(s),esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
(async()=>{let results=[];
for(const r of manifest.rows){const m=measurements.find(m=>m.sku===r.sku);if(!m||m.measurementStatus!=='visually-checked-native-seat-and-glass-foot')throw Error('Unverified '+r.sku);
 const metadata=await sharp(r.rawOutput).metadata();if(metadata.width!==2080||metadata.height!==2288)throw Error('Native dimensions '+r.sku);
 const record=JSON.parse(fs.readFileSync(r.rawOutput.replace(/\.png$/,'.render.json')));if(record.outputSha256!==hash(r.rawOutput))throw Error('Hash '+r.sku);
 const span=2288*r.target.shoulderPct/100,s=span/(m.glassFootY-m.closureSeatY);let x=(1-s)*m.centerX,y=2082.08-s*m.glassFootY;const b=m.artworkBounds;
 if(s*(b[2]-b[0])>2032)throw Error('Artwork too wide '+r.sku);
 x=Math.min(Math.max(x,24-s*b[0]),2056-s*b[2]);const bounds=[s*b[0]+x,s*b[1]+y,s*b[2]+x,s*b[3]+y];if(bounds[1]<24||bounds[3]>2264)throw Error('Artwork clipped '+r.sku);
 const file=path.join(out,r.sku+'-2080x2288.png');const data=fs.readFileSync(r.rawOutput).toString('base64');
 await sharp(svg(`<svg width="2080" height="2288" xmlns="http://www.w3.org/2000/svg"><rect width="2080" height="2288" fill="#F5F3EF"/><image href="data:image/png;base64,${data}" width="2080" height="2288" transform="translate(${x} ${y}) scale(${s})"/></svg>`)).png().toFile(file);
 results.push({sku:r.sku,family:r.family,capacityMl:r.capacityMl,catalog:r.catalog,nativePath:r.rawOutput,nativeSha256:hash(r.rawOutput),finalPath:file,finalSha256:hash(file),size:[2080,2288],targetSpanPct:r.target.shoulderPct,glassFootPct:91,closureSeatY:2082.08-span,glassFootY:2082.08,measurementUncertaintyPx:m.uncertaintyPx*s,transform:{scale:s,x,y},transformedArtworkBounds:bounds,presentation:r.presentation,status:'aligned-awaiting-user-batch-review'});
}
fs.writeFileSync(path.join(root,'aligned-exports.json'),JSON.stringify({status:'technical-checks-complete-user-review-pending',rows:results},null,2)+'\n');
for(const family of ['Circle','Round']){const rows=results.filter(r=>r.family===family);if(!rows.length)continue;for(const guides of [true,false]){const comps=[],w=880,h=118+Math.ceil(rows.length/2)*550;
 comps.push({input:svg(`<svg width="880" height="118"><text x="20" y="36" font-family="Arial" font-size="28">Frosted ${family} · ${rows.length} heroes</text><text x="20" y="68" font-family="Arial" font-size="17">2080 × 2288 exports · glass foot at 91%</text><text x="20" y="94" font-family="Arial" font-size="15">${guides?'Gold: cap/glass junction · Green: glass foot':'Clean review · updated frosted material reference'}</text></svg>`),left:0,top:0});
 for(const [i,r]of rows.entries()){const left=i%2*440,top=118+Math.floor(i/2)*550;comps.push({input:await sharp(r.finalPath).resize(420,462).png().toBuffer(),left:left+10,top});let lines=guides?`<path d="M10 ${462*.91}H430" stroke="#188679" stroke-width="1.3"/><path d="M10 ${462*(91-r.targetSpanPct)/100}H430" stroke="#b5852d" stroke-width="1.3" stroke-dasharray="5 4"/>`:'';
 comps.push({input:svg(`<svg width="440" height="550">${lines}<text x="10" y="486" font-family="Arial" font-size="20">${r.capacityMl} mL · ${esc(r.catalog.applicator)}</text><text x="10" y="510" font-family="Arial" font-size="15">${esc(r.sku)}</text><text x="10" y="533" font-family="Arial" font-size="14">Glass span ${r.targetSpanPct}% · base 91%</text></svg>`),left,top});}
 await sharp({create:{width:w,height:h,channels:3,background:'#f5f3ef'}}).composite(comps).jpeg({quality:94}).toFile(path.join(root,family+'-final-'+(guides?'guided':'clean')+'.jpg'));
 }}
 // Same canvas and zoom before / after for the approved pilot identities.
 const comps=[];let row=0;for(const sku of (process.argv[2]?manifest.rows.map(r=>r.sku):['GBCrclFrst50SpryMtGl','GBRndFrst78SpryMtGl'])){const r=manifest.rows.find(r=>r.sku===sku),final=results.find(r=>r.sku===sku);for(const [col,f] of [r.framedInput,final.finalPath].entries()){comps.push({input:await sharp(f).resize(420,462).png().toBuffer(),left:col*440+10,top:70+row*520});}comps.push({input:svg(`<svg width="880" height="50"><text x="10" y="25" font-size="18" font-family="Arial">${sku} · same canvas and target span</text></svg>`),left:0,top:535+row*520});row++;}
 comps.push({input:svg('<svg width="880" height="70"><text x="10" y="40" font-family="Arial" font-size="23">Previous render</text><text x="450" y="40" font-family="Arial" font-size="23">Corrected render</text></svg>'),left:0,top:0});await sharp({create:{width:880,height:70+row*520,channels:3,background:'#f5f3ef'}}).composite(comps).jpeg({quality:94}).toFile(path.join(root,'material-before-after.jpg'));
 console.log(JSON.stringify({exports:results.length,byFamily:{Circle:results.filter(r=>r.family==='Circle').length,Round:results.filter(r=>r.family==='Round').length},scaleRange:[Math.min(...results.map(r=>r.transform.scale)),Math.max(...results.map(r=>r.transform.scale))]}));
})().catch(e=>{console.error(e);process.exitCode=1});
