/** Shared-layout contact review. These are offline renders, not browser screenshots. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { drawableRegisterKits } from '../src/lib/register/load';
import { assembledKit } from '../src/lib/register/stage-kit';
import { availableViews, stageLayout } from '../src/lib/products/pdp-redesign/stage';
import { resolveListedComponents } from '../src/lib/bottle-builder/components';
import { isBuilderCandidate, previewParts, resolveBuilderConfigurations, reviewedCylinderFiveMlRow } from '../src/lib/bottle-builder/model';
import { bareChooserKit } from '../src/lib/bottle-builder/payload';
import { builderPreviewLayout } from '../src/lib/bottle-builder/preview-layout';
import { previewFrame, layerTransform } from '../src/lib/bottle-builder/preview-frame';
import { sourceTubeMaterialFilter } from '../src/lib/register/source-tube-material';
import { throughGlassAppearance } from '../src/lib/register/through-glass';

const [snapshotFile, out] = process.argv.slice(2);
const baselineOnly = process.env.BB_MEDIA_BASELINE_ONLY === '1';
const applicator = process.env.BB_MEDIA_REVIEW_APPLICATOR ?? 'Perfume Spray Pump';
const family = process.env.BB_MEDIA_REVIEW_FAMILY ?? 'Round';
const capacity = Number(process.env.BB_MEDIA_REVIEW_CAPACITY ?? 78);
assert((family === 'Round' && capacity === 78 && ['Perfume Spray Pump', 'Lotion Pump'].includes(applicator)) || (family === 'Diva' && capacity === 46 && applicator === 'Perfume Spray Pump'), 'Only scoped Round 78 spray/lotion and Diva 46 spray review is supported');
const expectedCount = applicator === 'Lotion Pump' ? 14 : 12;
const reviewLabel = `${family} ${capacity} ${applicator === 'Lotion Pump' ? 'lotion' : 'spray'} tube review`;
assert(snapshotFile && out, 'Supply saved family-baseline.json and output directory');
const s = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
const renders = path.join(out, 'renders'), cache = path.join(out, 'render-cache');
fs.mkdirSync(renders, { recursive: true }); fs.mkdirSync(cache, { recursive: true });
const priorCache = path.join(path.dirname(snapshotFile), 'render-cache');
const images = new Map<string, Promise<string>>();
function png(url: string): Promise<string> {
    if (!images.has(url)) images.set(url, (async () => {
        let bytes: Buffer;
        if (url.startsWith('/')) bytes = fs.readFileSync(path.join(process.cwd(), 'public', url));
        else {
            assert(new URL(url).hostname.endsWith('.public.blob.vercel-storage.com'));
            const name = createHash('sha256').update(url).digest('hex') + '.png';
            const file = path.join(cache, name), prior = path.join(priorCache, name);
            if (!fs.existsSync(file) && fs.existsSync(prior)) fs.copyFileSync(prior, file);
            if (!fs.existsSync(file)) { const response = await fetch(url); assert(response.ok, `Asset ${response.status}: ${url}`); fs.writeFileSync(file, Buffer.from(await response.arrayBuffer())); }
            bytes = fs.readFileSync(file);
        }
        return (await sharp(bytes).png().toBuffer()).toString('base64');
    })());
    return images.get(url)!;
}
const background = '<rect width="100%" height="100%" fill="#f5f3ef"/>';
const nativeMaterial = '<filter id="native-material" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="linear" slope="0.96"/><feFuncG type="linear" slope="0.96"/><feFuncB type="linear" slope="0.96"/></feComponentTransfer></filter>';
async function drawPdp(kit: any, row: any, view: any, name: string) {
    const l = stageLayout(kit, view, row)!; assert(l);
    const parts = await Promise.all([...l.parts].sort((a,b) => a.zIndex-b.zIndex).map(async (p, i) => {
        const b = p.box ?? { leftPct: 0, topPct: 0, widthPct: 100, heightPct: 100 };
        const x = (b.leftPct+p.dxPct)*10, y = (b.topPct+p.dyPct)*11, w = b.widthPct*10, h = b.heightPct*11;
        const clip = p.throughGlass ? `<polygon points="${p.throughGlass.clipPercent.map(([px,py])=>`${x+w*px/100},${y+h*py/100}`).join(' ')}"/>`
            : `<rect x="${x}" y="${y}" width="${w}" height="${h*(1-(p.clipBottomPct??0)/100)}"/>`;
        const material=sourceTubeMaterialFilter(p.url,view);
        return `<clipPath id="c${i}">${clip}</clipPath><g ${p.throughGlass?`opacity="${p.throughGlass.opacity}" style="mix-blend-mode:multiply"`:''}><image x="${x}" y="${y}" width="${w}" height="${h}" ${material?`filter="url(#${material==='brightness(0.96)'?'native-material':'material'})"`:''} clip-path="url(#c${i})" href="data:image/png;base64,${await png(p.url)}"/></g>`;
    }));
    const defs = '<defs><filter id="material" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="linear" slope="2.5" intercept="-1.5"/><feFuncG type="linear" slope="2.5" intercept="-1.5"/><feFuncB type="linear" slope="2.5" intercept="-1.5"/></feComponentTransfer></filter></defs>';
    await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1100">${defs}<defs>${nativeMaterial}</defs>${background}<g transform="translate(${l.frame.x*10} ${l.frame.y*11}) scale(${l.frame.scale})">${parts.join('')}</g></svg>`)).png().toFile(path.join(renders,name));
}
async function drawBuilder(config: any, stage: 'body'|'fitment'|'complete', showCover: boolean, name: string, write = true) {
    const layout = builderPreviewLayout(config, previewParts(config,stage), {stage,showCover}); assert(layout);
    if (!write) { assert(fs.existsSync(path.join(renders,name))); return {stage,showCover,urls:layout.layers.map(l=>l.part.image.url)}; }
    const frame = previewFrame(layout.anchors,layout.layers.map(l=>l.bounds));
    const parts = await Promise.all(layout.layers.map(async (l,i) => {
        const image=`<image width="${l.part.image.width}" height="${l.part.image.height}" ${sourceTubeMaterialFilter(l.part.image.url,showCover?'capon':'sidecar')==='brightness(0.96)'?'filter="url(#native-material)"':''} href="data:image/png;base64,${await png(l.part.image.url)}"/>`;
        const glass=throughGlassAppearance(l.part,showCover?'capon':'sidecar');
        return `<g transform="${layerTransform(l.transform,l.part)??''}" ${glass?`opacity="${glass.opacity}" style="mix-blend-mode:multiply"`:''}>${glass?`<defs><clipPath id="g${i}"><polygon points="${glass.clipPoints}"/></clipPath></defs><g clip-path="url(#g${i})">${image}</g>`:image}</g>`;
    }));
    await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1100"><defs>${nativeMaterial}</defs>${background}<svg width="1000" height="1100" viewBox="${frame.x} ${frame.y} ${frame.width} ${frame.height}">${parts.join('')}</svg></svg>`)).png().toFile(path.join(renders,name));
    return {stage,showCover,urls:layout.layers.map(l=>l.part.image.url)};
}
async function main() {
    Object.assign(process.env,{NODE_ENV:baselineOnly?'production':'development'}); delete process.env.VERCEL;
    const kits = drawableRegisterKits(s.register);
    const sample = process.env.BB_MEDIA_REVIEW_SAMPLE_SKUS?.split(',');
    const rows = s.matrix.rows.filter((r:any)=>r.family===family&&r.capacityMl===capacity&&r.applicator===applicator&&(!sample||sample.includes(r.websiteSku)));
    const lookups = new Map(Object.entries(s.lookups));
    for (const entry of Object.values(s.lookups) as any[]) if(entry?.product?.graceSku) lookups.set(entry.product.graceSku,entry);
    const resolved = await resolveListedComponents(rows.map(reviewedCylinderFiveMlRow),async sku=>{assert(lookups.has(sku),`Uncaptured lookup ${sku}`);return (lookups.get(sku) as any)?.product??null;});
    const eligible = resolved.filter(isBuilderCandidate);
    const configs = resolveBuilderConfigurations(eligible,eligible.map((r:any)=>kits[r.graceSku]??null),eligible.map((r:any)=>s.plates[r.websiteSku]?.image??null),eligible.map((r:any)=>kits[r.graceSku]?(bareChooserKit(assembledKit(kits[r.graceSku]))??null):null));
    const results: any[] = [], held: any[] = [];
    for (const row of rows) {
        const kit = kits[row.websiteSku];
        if (!kit) { held.push({websiteSku:row.websiteSku,reason:s.register.assemblies[row.graceSku]?.reason}); continue; }
        const body = kit.parts.find(p=>p.slot==='body')!; assert(body.image.url===s.register.plates[kit.register.plateKey].url,'Round body source must stay unchanged');
        const views = [];
        const refresh = true;
        for (const view of availableViews(kit,row)) { const file=`${row.websiteSku}-${view}.png`; if(refresh) await drawPdp(kit,row,view,file); else assert(fs.existsSync(path.join(renders,file))); views.push({view,file}); }
        const config = configs.find(c=>c?.id===row.websiteSku); assert(config,`Builder configuration missing: ${row.websiteSku}`);
        const assembled = {...config,kit:assembledKit(kit)};
        const builder = [];
        for (const stage of ['body','fitment','complete'] as const) for (const showCover of [false,true]) builder.push(await drawBuilder(assembled,stage,showCover,`${row.websiteSku}-builder-${stage}-${showCover?'on':'off'}.png`,refresh));
        results.push({websiteSku:row.websiteSku,capacityMl:row.capacityMl,applicator:row.applicator,finish:row.capColor,bodyUrl:body.image.url,bodyBounds:body.bounds,
            reducer:kit.parts.some(p=>p.slot==='reducer'),pdp:views,builder,browserVerified:false});
    }
    const summary = {applicator,reviewMode:baselineOnly?'published-baseline':'local-candidate',method:'Offline shared PDP and Builder layout functions with custom rasterizer; not full BuilderImage camera/blending or browser acceptance',sourceSnapshot:s.capturedAt,generatedAt:new Date().toISOString(),scope:rows.length,integrated:results.length,held,pdpRenders:results.reduce((n,r)=>n+r.pdp.length,0),builderRenders:results.length*6,reducerAssemblies:results.filter(r=>r.reducer).length,browserVerified:false,published:false,results};
    if(!sample){assert.equal(rows.length,expectedCount);assert.equal(results.length,expectedCount);assert.equal(held.length,0);}
    fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(summary,null,2));
    const checks=['websiteSku,surface,view,device,status'];
    for(const r of results) for(const device of ['desktop','physical-iPhone']) {
        for(const v of r.pdp) checks.push(`${r.websiteSku},PDP,${v.view},${device},pending`);
        checks.push(`${r.websiteSku},PDP,zoom,${device},pending`,`${r.websiteSku},Builder,body-fitment-complete,${device},pending`);
    }
    fs.writeFileSync(path.join(out,'manual-ui-checks.csv'),checks.join('\n')+'\n');
    const selections: any[]=[];
    for (const size of [capacity]) for (const app of ['Reducer','Perfume Spray Pump','Lotion Pump','Vintage Bulb Sprayer','Vintage Bulb Sprayer with Tassel']) {
        const r=results.find(r=>r.capacityMl===size&&r.applicator===app&&/Blk|MtGl/.test(r.websiteSku))??results.find(r=>r.capacityMl===size&&r.applicator===app);
        if(r)selections.push(r);
    }
    const cells=[];
    for(let i=0;i<selections.length;i++){
        const r=selections[i], x=(i%5)*300,y=Math.floor(i/5)*370;
        cells.push({input:await sharp(path.join(renders,r.pdp.find((v:any)=>v.view==='capon').file)).resize(300,330).toBuffer(),left:x,top:y+40});
        cells.push({input:Buffer.from(`<svg width="300" height="40"><text x="8" y="16" font-size="12">${r.capacityMl} ml · ${r.applicator.replace('Vintage Bulb Sprayer','Bulb')}</text><text x="8" y="33" font-size="11">${r.websiteSku}</text></svg>`),left:x,top:y});
    }
    await sharp({create:{width:1500,height:740,channels:3,background:'#f5f3ef'}}).composite(cells).jpeg({quality:95}).toFile(path.join(out,'round78-overview.jpg'));
    const allViews=results.flatMap(r=>r.pdp.map((v:any)=>({sku:r.websiteSku,...v})));
    for(let start=0;start<allViews.length;start+=42){
        const selected=allViews.slice(start,start+42), tiles=[];
        for(let i=0;i<selected.length;i++){
            const v=selected[i],x=(i%7)*200,y=Math.floor(i/7)*260;
            tiles.push({input:await sharp(path.join(renders,v.file)).resize(200,220).toBuffer(),left:x,top:y+40});
            tiles.push({input:Buffer.from(`<svg width="200" height="40"><text x="5" y="14" font-size="10">${v.sku}</text><text x="5" y="30" font-size="11">${v.view}</text></svg>`),left:x,top:y});
        }
        await sharp({create:{width:1400,height:Math.ceil(selected.length/7)*260,channels:3,background:'#f5f3ef'}}).composite(tiles).jpeg({quality:95}).toFile(path.join(out,`all-pdp-views-${Math.floor(start/42)+1}.jpg`));
    }
    fs.writeFileSync(path.join(out,'review.html'),`<!doctype html><meta name="viewport" content="width=device-width"><title>${reviewLabel}</title><style>body{font:16px system-ui;background:#f5f3ef;color:#222;margin:24px}section{border-top:1px solid #ccc;padding:20px 0}img{width:250px;max-width:45vw}figure{display:inline-block;margin:8px}h2{font-size:18px}</style><h1>${reviewLabel}</h1><p>${results.length} ${baselineOnly ? 'baseline' : 'local candidate'} assemblies, ${held.length} held. Offline shared-layout renders, not browser screenshots. Nothing published. Bottle and hardware sources remain unchanged. ${baselineOnly ? 'No repair is applied in this baseline.' : 'Tube registration is a local review candidate.'}</p><p>Held: ${held.map(r=>r.websiteSku).join(', ')}.</p>${results.map(r=>`<section><h2>${r.websiteSku} · ${r.capacityMl} ml · ${r.applicator}</h2>${r.pdp.map((v:any)=>`<figure><img src="renders/${v.file}"><figcaption>PDP ${v.view}</figcaption></figure>`).join('')}${['body','fitment','complete'].map(stage=>`<figure><img src="renders/${r.websiteSku}-builder-${stage}-off.png"><figcaption>Builder ${stage}</figcaption></figure>`).join('')}</section>`).join('')}`);
    console.log(JSON.stringify({...summary,results:undefined}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
