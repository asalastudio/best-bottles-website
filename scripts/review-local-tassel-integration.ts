/** Offline evidence only: uses saved read-only catalogue/register snapshots and
 * the same composition/layout functions as PDP and Builder. Not browser QA.
 * npx tsx scripts/review-local-tassel-integration.ts EVIDENCE_DIRECTORY
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { drawableRegisterKits } from '../src/lib/register/load';
import { assembledKit } from '../src/lib/register/stage-kit';
import assets from '../src/lib/register/local-tassel-assets.json';
import rings from '../src/lib/register/local-diva-rings.json';
import { availableViews, effectiveView, glassFrame, stageLayout, BEHIND_GLASS_SLOTS } from '../src/lib/products/pdp-redesign/stage';
import { catalogConfigurationFromRow, previewParts, builderCartItem, reviewedCylinderFiveMlRow, groupBuilderBodies, deriveBuilder } from '../src/lib/bottle-builder/model';
import { resolveListedComponents } from '../src/lib/bottle-builder/components';
import { builderPreviewLayout, builderBodyFrame } from '../src/lib/bottle-builder/preview-layout';
import { layerTransform } from '../src/lib/bottle-builder/preview-frame';

const sha = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
async function main() {
    const root = process.argv[2]; assert(root, 'Evidence directory required');
    const read = (name: string) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
    const write = (name: string, data: unknown) => fs.writeFileSync(path.join(root, name), JSON.stringify(data, null, 2) + '\n');
    const payload = read('register-stage.json'), products = read('products.json'), scope = read('scope.json');
    const families = read('matrix-families.json');
    Object.assign(process.env, { NODE_ENV: 'production' }); const before = drawableRegisterKits(payload);
    Object.assign(process.env, { NODE_ENV: 'development' }); const after = drawableRegisterKits(payload);
    const productByGrace = new Map<string, any>(products.map((p: any) => [p.graceSku, p]));
    const matrix = await resolveListedComponents(Object.values(families).flatMap((f: any) => f.rows).map(reviewedCylinderFiveMlRow),
        async sku => productByGrace.get(sku) ?? null);
    const configs = matrix.flatMap(row => {
        const kit = after[row.graceSku ?? ''];
        const config = kit && catalogConfigurationFromRow(row, assembledKit(kit));
        return config ? [config] : [];
    });
    const builderBodies = groupBuilderBodies(configs);
    const pages = products.flatMap((p: any) => after[p.graceSku] ? [{ kit: after[p.graceSku], applicator: p.applicator }] : []);
    const ringReview = process.argv.includes('--rings');
    const affected = scope.filter((p: any) => after[p.graceSku]
        && after[p.graceSku].parts.some(part => part.slot === 'ring') === ringReview);
    assert.equal(affected.length, ringReview ? Number(process.argv.find(a=>a.startsWith('--count='))?.split('=')[1] ?? 4) : 104, 'Fresh scope changed; reconcile before accepting');
    const untouched = Object.keys(before).filter(sku => !before[sku].parts.some(p => assets.some(a => a.componentId === p.componentId)));
    for (const sku of untouched) assert.deepEqual(after[sku], before[sku], `Unrelated kit changed: ${sku}`);
    const cacheDir = path.join(root, 'image-cache'), renderDir = path.join(root, 'renders');
    fs.mkdirSync(cacheDir, { recursive: true }); fs.mkdirSync(renderDir, { recursive: true });
    const cache = new Map<string, { data: string; width: number; height: number; ink: number[] }>();
    const imageReceipts: any[] = [];
    async function image(url: string) {
        const hit = cache.get(url); if (hit) return hit;
        let bytes: Buffer;
        if (url.startsWith('/')) bytes = fs.readFileSync(path.join(process.cwd(), 'public', url));
        else {
            const parsed = new URL(url);
            assert(parsed.protocol === 'https:' && parsed.hostname.endsWith('.public.blob.vercel-storage.com'), `Unapproved source host: ${parsed.hostname}`);
            const filename = path.join(cacheDir, createHash('sha256').update(url).digest('hex') + '.png');
            if (!fs.existsSync(filename)) {
                const response = await fetch(url); assert(response.ok, `Source image failed: ${response.status} ${url}`);
                fs.writeFileSync(filename, Buffer.from(await response.arrayBuffer()));
            }
            bytes = fs.readFileSync(filename);
        }
        const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        let l=info.width,t=info.height,r=0,b=0;
        for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) if(data[(y*info.width+x)*info.channels+info.channels-1]>=16) {
            l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x+1);b=Math.max(b,y+1);
        }
        assert(r>l && b>t, `Empty image: ${url}`);
        const asset=assets.find(a=>a.url===url);
        if(asset) { assert.equal(sha(bytes),asset.sha256); assert.equal(info.width,asset.sourceWidth); assert.equal(info.height,asset.sourceHeight); }
        const ringAsset=rings.find(a=>a.url===url);
        if(ringAsset) { assert.equal(sha(bytes),ringAsset.sha256); assert.equal(info.width,ringAsset.width); assert.equal(info.height,ringAsset.height); }
        // librsvg cannot reliably decode an embedded WebP. Normalize only the
        // in-memory review raster; source files and website assets stay intact.
        const png = await sharp(bytes).png().toBuffer();
        const result={data:png.toString('base64'),width:info.width,height:info.height,ink:[l,t,r,b]};
        cache.set(url,result); imageReceipts.push({url,sha256:sha(bytes),width:info.width,height:info.height,decoded:true}); return result;
    }
    const rows: any[]=[];
    for(const product of affected.sort((a: any,b: any)=>a.websiteSku.localeCompare(b.websiteSku))) {
        const kit=after[product.graceSku], ringSource=rings.find(r=>r.graceSku===product.graceSku);
        const old=before[ringReview ? ringSource!.donorGraceSku : product.graceSku];
        const sprayer=kit.parts.find(p=>p.slot==='sprayer')!;
        const asset=assets.find(a=>a.componentId===sprayer.componentId) ?? (ringReview ? {componentId:sprayer.componentId!,url:old.parts.find(p=>p.slot==='sprayer')!.image.url} : null);
        assert(asset); assert.equal(sprayer.image.url,asset.url);
        if(ringReview) {
            const ring=kit.parts.find(p=>p.slot==='ring')!;
            assert.equal(ring.image.url,ringSource!.url);
            assert.deepEqual(ring.exploded,{dx:0,dy:0});
            assert.equal(kit.register.seatSignature,old.register.seatSignature);
            for(const part of kit.parts.filter(p=>p.slot!=='ring')) {
                const previous=old.parts.find(p=>p.slot===part.slot && JSON.stringify(p.views)===JSON.stringify(part.views))!;
                assert.deepEqual(part.box,previous.box); assert.deepEqual(part.bounds,previous.bounds);
                if(part.slot!=='sprayer') assert.deepEqual(part.image,previous.image);
            }
        } else {
            assert.deepEqual(kit.parts.map(({image,...p})=>p),old.parts.map(({image,...p})=>p));
            assert.deepEqual(kit.parts.filter(p=>p.slot!=='sprayer'),old.parts.filter(p=>p.slot!=='sprayer'));
        }
        assert.deepEqual(kit.anchors,old.anchors); assert.deepEqual(after[product.websiteSku],kit);
        const config=configs.find(c=>c.id===product.websiteSku); assert(config, `Builder configuration missing: ${product.websiteSku}`);
        const offered = deriveBuilder(builderBodies, {bodyId:config.bodyId,color:config.color,fitment:config.fitment,closure:config.closure,quantity:1}).configuration;
        assert.equal(offered?.id, product.websiteSku, `Builder choice missing or ambiguous: ${product.websiteSku}`);
        const cart=builderCartItem(config,1); assert.equal(cart.websiteSku,product.websiteSku); assert.equal(cart.graceSku,product.graceSku);
        assert.equal(cart.shopifyVariantId,product.shopifyVariantId);
        const context={family:product.family,capacityMl:product.capacityMl,color:product.color,applicator:product.applicator,websiteSku:product.websiteSku};
        const views=availableViews(kit,context); assert.deepEqual(views,['capon']);
        const frame=glassFrame({kit,applicator:product.applicator},pages,{});
        const layout=stageLayout(kit,'capon',context,frame)!; assert(layout);
        const pdpParts: any[]=[]; const elements=[];
        for(const [i,part] of [...layout.parts].sort((a,b)=>a.zIndex-b.zIndex).entries()) {
            const source=await image(part.url), box=part.box??{leftPct:0,topPct:0,widthPct:100,heightPct:100};
            const w=box.widthPct*10,h=box.heightPct*11,x=(box.leftPct+part.dxPct)*10,y=(box.topPct+part.dyPct)*11;
            const ch=h*(1-(part.clipBottomPct??0)/100);
            const [l,t,r,b]=source.ink;
            const bounds={left:(x+l*w/source.width)*layout.frame.scale+layout.frame.x*10,
                top:(y+t*h/source.height)*layout.frame.scale+layout.frame.y*11,
                right:(x+r*w/source.width)*layout.frame.scale+layout.frame.x*10,
                bottom:(y+Math.min(b*h/source.height,ch))*layout.frame.scale+layout.frame.y*11};
            pdpParts.push({slot:part.slot,bounds,withinCanvas:bounds.left>=-.5&&bounds.top>=-.5&&bounds.right<=1000.5&&bounds.bottom<=1100.5});
            elements.push(`<defs><clipPath id="p${i}"><rect x="${x}" y="${y}" width="${w}" height="${ch}"/></clipPath></defs><image x="${x}" y="${y}" width="${w}" height="${h}" clip-path="url(#p${i})" href="data:image/png;base64,${source.data}"/>`);
        }
        const pdpFile=`renders/${product.websiteSku}--pdp.png`;
        await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1100"><rect width="100%" height="100%" fill="#f5f3ef"/><g transform="translate(${layout.frame.x*10} ${layout.frame.y*11}) scale(${layout.frame.scale})">${elements.join('')}</g></svg>`)).resize(600,660).png().toFile(path.join(root,pdpFile));
        const candidates=configs.filter(c=>c.bodyId===config.bodyId);
        const reference=candidates.find(c=>c.color===config.color&&c.fitment==='Vintage Bulb Sprayer'&&c.kit?.completeness==='full')
            ?? candidates.find(c=>c.color===config.color&&c.kit?.completeness==='full'&&c.fitment!=='Reducer')??config;
        const states=[]; let builderFile='';
        for(const stage of ['body','fitment','complete'] as const) for(const showCover of [false,true]) {
            const bl=builderPreviewLayout(config,previewParts(config,stage),{stage,showCover,bodyReference:reference})!; assert(bl);
            const bf=builderBodyFrame(config,candidates,reference,bl);
            assert(Object.values(bf).every(Number.isFinite));
            const parts=bl.layers.map(l=>({slot:l.part.slot,url:l.part.image.url,bounds:l.bounds,
                withinFrame:l.bounds.left>=bf.x-.5&&l.bounds.top>=bf.y-.5&&l.bounds.right<=bf.x+bf.width+.5&&l.bounds.bottom<=bf.y+bf.height+.5}));
            if(stage!=='body') {
                assert(parts.some(p=>p.url===asset.url));
                if(ringReview) assert(parts.some(p=>p.url===ringSource!.url), `Ring absent from ${stage}`);
            }
            states.push({stage,showCover,frame:bf,parts});
            if(stage==='complete'&&!showCover) {
                const layers=[];
                for(const [i,{part,transform}] of bl.layers.entries()) {
                    const source=await image(part.image.url); let clip='';
                    if(part.box&&BEHIND_GLASS_SLOTS.has(part.slot)&&part.box.y+part.box.height>kit.anchors.baselineY+.5) {
                        const visible=Math.max(0,(kit.anchors.baselineY-part.box.y)/part.box.height*part.image.height);
                        clip=`<defs><clipPath id="b${i}"><rect width="${part.image.width}" height="${visible}"/></clipPath></defs>`;
                    }
                    layers.push(`<g transform="${layerTransform(transform,part)??''}">${clip}<image width="${part.image.width}" height="${part.image.height}" ${clip?`clip-path="url(#b${i})"`:''} href="data:image/png;base64,${source.data}"/></g>`);
                }
                builderFile=`renders/${product.websiteSku}--builder.png`;
                await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="660" viewBox="${bf.x} ${bf.y} ${bf.width} ${bf.height}"><rect x="${bf.x}" y="${bf.y}" width="${bf.width}" height="${bf.height}" fill="#f5f3ef"/>${layers.join('')}</svg>`)).png().toFile(path.join(root,builderFile));
            }
        }
        rows.push({websiteSku:product.websiteSku,graceSku:product.graceSku,family:product.family,capacityMl:product.capacityMl,color:product.color,finish:config.closure,componentId:asset.componentId,
            productGroupSlug:config.product.productGroupSlug,asset:asset.url,geometryUnchanged:true,builderSelectionIdentity:true,cartIdentityMatches:true,pdpFile,builderFile,pdpParts,states,
            viewRequests:['capon','sidecar','exploded'].map(v=>({requested:v,effective:effectiveView(v as any,kit,context),offered:views.includes(v as any)})),
            builtLocally:true,sourceArtworkApproved:!ringReview,browserVerified:false,assemblyVisuallyApproved:false,published:false});
        if(rows.length%16===0) console.log(`${rows.length}/${affected.length} offline assemblies rendered`);
    }
    const exceptions=scope.filter((p:any)=>!after[p.graceSku]).map((p:any)=>({websiteSku:p.websiteSku,graceSku:p.graceSku,category:p.category,
        reason:payload.assemblies[p.graceSku]?.reason??'Standalone component: no bottle register assembly',browserVerified:false}));
    const receipt={createdAt:new Date().toISOString(),method:'Offline shared production composition/layout code; saved catalogue snapshot; source-asset decoding. Not browser or live-site verification.',
        limitations:['No CSS multiply blending, image optimizer, network recovery, responsive controls, cart UI or physical Safari checks.',
            'Builder envelopes include register-renderable configurations from affected families; legacy-only configurations may extend the browser camera.',
            'Source artwork approval does not establish assembled-product visual acceptance.'],
        combinationCount:rows.length,unchangedAliasCount:untouched.length,byComponent:Object.fromEntries([...new Set(rows.map(r=>r.componentId))].map(id=>[id,rows.filter(r=>r.componentId===id).length])),
        pdpBoundsFailures:rows.filter(r=>r.pdpParts.some((p:any)=>!p.withinCanvas)).map(r=>r.websiteSku),
        builderBoundsFailures:rows.filter(r=>r.states.some((s:any)=>s.parts.some((p:any)=>!p.withinFrame))).map(r=>r.websiteSku),
        rows,exceptions,imageReceipts};
    write('verification.json',receipt);
    fs.writeFileSync(path.join(root,'manual-browser-matrix.csv'),['websiteSku,graceSku,productGroupSlug,finish,componentId,PDP,Builder,cart,mobileSafari',...rows.map(r=>[r.websiteSku,r.graceSku,r.productGroupSlug,r.finish,r.componentId,'PENDING','PENDING','PENDING','PENDING'].map(x=>JSON.stringify(x)).join(','))].join('\n')+'\n');
    const names=[...new Set(rows.map(r=>r.family))];
    for(const family of names) {
        const own=rows.filter(r=>r.family===family),tiles=[];
        for(const [i,r] of own.entries()) {
            const pair=await sharp({create:{width:400,height:250,channels:3,background:'#f5f3ef'}}).composite([
                {input:await sharp(path.join(root,r.pdpFile)).resize(200,220).toBuffer(),left:0,top:30},
                {input:await sharp(path.join(root,r.builderFile)).resize(200,220).toBuffer(),left:200,top:30},
                {input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="30"><text x="8" y="12" font-size="10">${esc(r.websiteSku)}</text><text x="8" y="25" font-size="9">PDP left / Builder right - offline</text></svg>`),left:0,top:0}]).png().toBuffer();
            tiles.push({input:pair,left:i%4*400,top:Math.floor(i/4)*250});
        }
        await sharp({create:{width:1600,height:Math.ceil(own.length/4)*250,channels:3,background:'#f5f3ef'}}).composite(tiles).jpeg({quality:94}).toFile(path.join(root,`contact-${family}.jpg`));
    }
    console.log(JSON.stringify({combinations:rows.length,states:rows.length*6,decodedImages:imageReceipts.length,exceptions:exceptions.length,pdpBoundsFailures:receipt.pdpBoundsFailures,builderBoundsFailures:receipt.builderBoundsFailures}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
