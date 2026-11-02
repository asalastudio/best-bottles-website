const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const dir = 'docs/reviews/cylinder25-18415-2026-11-01';
const out = 'public/local-kits/cylinder25-18415-2026-11-01';
const read = p => JSON.parse(fs.readFileSync(p));
const hash = raw => crypto.createHash('sha256').update(raw).digest('hex');
const catalog = read(dir + '/current-catalog.json').configurations;
const original = read(dir + '/current-kits.json').kits;
const sources = read(dir + '/source-media.json');
const recovered = read('docs/reviews/cylinder-master-materials-2026-10-31/family-inventory.json').rows.find(r => r.plateKey === 'cylinder-25ml-18-415|Clear');
assert.equal(catalog.length, 45);
assert.equal(recovered.scale.targetPct, 46.5);
assert.equal(recovered.scale.baselinePct, 91);
fs.mkdirSync(out, { recursive: true });
const bodySource = sources[original[catalog[0].id].parts.find(p => p.slot === 'body').image.url];
assert.equal(bodySource.sha256, recovered.fileSha256);
const bodyBytes = fs.readFileSync(bodySource.file);
assert.equal(hash(bodyBytes), recovered.fileSha256);
const bodyName = 'body-cylinder-25ml-clear-18-415.' + bodySource.sha256.slice(0, 12) + '.png';
fs.writeFileSync(path.join(out, bodyName), bodyBytes);
const sprayRaw = fs.readFileSync('docs/reviews/cylinder5-finemist-2026-11-01/sources/approved-mechanism.png');
const lotionMaster = fs.readFileSync('public/local-kits/lotion9-flair-fit-2026-11-01/lotion-mechanism-slim.fd1f18d27439.svg', 'utf8');
function tubeImage(kind, height, ppm) {
    let svg;
    if (kind === 'spray') {
        const scale = ppm / (39 / 1.1), H = height / scale, middle = H - 376 - 555;
        assert.ok(middle > 0);
        const section = (y,h,sy,sh) => `<svg x="0" y="${y}" width="180" height="${h}" viewBox="430 ${sy} 180 ${sh}" preserveAspectRatio="none" overflow="hidden"><use href="#source"/></svg>`;
        svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="${H}" viewBox="0 0 180 ${H}"><defs><image id="source" href="data:image/png;base64,${sprayRaw.toString('base64')}" width="1024" height="1536"/></defs>${section(0,376,98,376)}${section(376,middle,474,426)}${section(376+middle,555,900,555)}</svg>`;
        const bytes=Buffer.from(svg), sha=hash(bytes), name='spray-tube.'+sha.slice(0,12)+'.svg';fs.writeFileSync(out+'/'+name,bytes);
        return {image:{url:'/local-kits/cylinder25-18415-2026-11-01/'+name,key:'',sha256:sha,bytes:bytes.length,width:180,height:H},width:180*scale,headHalf:86*scale,tipOffset:94*scale};
    }
    const headS=6*ppm/158,headH=751*headS,shaftS=1.5*ppm/26;
    assert.ok(height>headH);
    const defs=lotionMaster.match(/<defs>(.*?)<\/defs>/s)[1];
    svg=`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="${height}" viewBox="0 0 180 ${height}"><defs>${defs}</defs><g transform="translate(90 0) scale(${headS}) translate(-512 -47)"><use href="#material" clip-path="url(#upper)"/></g><g transform="translate(90 ${headH}) scale(${shaftS} ${(height-headH)/690}) translate(-513 -797)"><use href="#material" clip-path="url(#shaft)"/></g></svg>`;
    const bytes=Buffer.from(svg),sha=hash(bytes),name='lotion-tube.'+sha.slice(0,12)+'.svg';fs.writeFileSync(out+'/'+name,bytes);
    return {image:{url:'/local-kits/cylinder25-18415-2026-11-01/'+name,key:'',sha256:sha,bytes:bytes.length,width:180,height},width:180,headHalf:90,tipOffset:62*shaftS};
}

const rows = {}, changes = [], held = [];
for (const c of catalog) {
    if (c.fitment === 'Vintage Bulb Sprayer with Tassel') {
        held.push({sku:c.id,reason:'source-and-frame-reconciliation',detail:'The current one-piece tassel layer extends below the fixed 91% glass baseline and outside the shared frame. The inspected black registered component also has a gold collar while its exact legacy product shows silver. Recover and verify exact component layers from the 25 ml master PSD before registration. No source was substituted and no glass was shrunk to conceal the defect.'});
        continue;
    }
    const before = original[c.id];
    assert.ok(before && before.sku === c.id);
    assert.equal(before.register.plateKey, recovered.plateKey);
    const kit = structuredClone(before);
    const body = kit.parts.find(p => p.slot === 'body');
    body.image = { ...body.image, url: '/local-kits/cylinder25-18415-2026-11-01/' + bodyName,
        sha256: bodySource.sha256, bytes: bodySource.bytes };
    const landmarkY = body.box.y + recovered.anchors.shoulderY * body.box.height / body.image.height;
    kit.glassSizing = { heightPct: recovered.scale.targetPct, baselinePct: recovered.scale.baselinePct,
        landmarkY, source: recovered.scale.source };
    // The source's inner-floor landmark is separate from the external foot.
    // The fluid mechanisms reuse the approved spray and lotion materials with separately registered shaft widths.
    const innerFloorY = body.box.y + 1935 * body.box.height / body.image.height;
    for (const part of kit.parts) {
        const source = sources[part.image.url];
        if (source) {
            assert.equal(hash(fs.readFileSync(source.file)), source.sha256);
            part.image = { ...part.image, sha256: source.sha256, bytes: source.bytes };
        }
        if (part.slot === 'diptube') {
            delete part.views; // The actual source tube travels with its own pump/sprayer in exploded view.
            const tail = Math.max(0, part.box.y + part.box.height - innerFloorY);
            part.trimBottomPct = tail / part.box.height * 100;
        }
    }
    if (c.fitment === 'Fine Mist Sprayer' || c.fitment === 'Lotion Pump') {
        const old = kit.parts.find(p => p.slot === 'diptube'), ppm = kit.anchors.pxPerMm;
        const axis=kit.anchors.neckAxisX??kit.anchors.axisX;
        const top=landmarkY-2*ppm,tip=innerFloorY-.5*ppm,height=tip-top;
        const fit=tubeImage(c.fitment==='Lotion Pump'?'lotion':'spray',height,ppm);
        const tube={...structuredClone(old),image:fit.image,image2x:null,mask:null,
            box:{x:axis-fit.headHalf,y:top,width:fit.width,height},
            bounds:{left:axis-fit.headHalf,top,right:axis+fit.tipOffset,bottom:tip},
            assembled:{x:0,y:0},exploded:{dx:0,dy:0},zOrder:2,explodeIndex:1};
        delete tube.trimBottomPct;
        const detached=structuredClone(tube);detached.views=['exploded'];
        tube.views=['sidecar','capon'];tube.opacity=.62;tube.blendMode='multiply';
        kit.parts.splice(kit.parts.indexOf(old),1,tube,detached);
    }
    rows[c.id] = kit;
    changes.push({ sku: c.id, fitment: c.fitment, finish: c.closure, bodySha256: bodySource.sha256,
        bodyBoundsPreserved: JSON.stringify(body.bounds) === JSON.stringify(before.parts.find(p => p.slot === 'body').bounds),
        nativeTopGeometryPreserved: kit.parts.filter(p => p.slot !== 'body' && p.slot !== 'diptube').every(p => {
            const old = before.parts.find(q => q.slot === p.slot && q.componentId === p.componentId);
            return JSON.stringify(p.box) === JSON.stringify(old.box) && JSON.stringify(p.bounds) === JSON.stringify(old.bounds);
        }), innerFloorY, floorBasis: 'Visual inner-floor landmark in the existing 2192 px body source; not a new depth measurement',
        sourceComponents: kit.parts.filter(p => p.componentId).map(p => ({ slot: p.slot, componentId: p.componentId, sha256: p.image.sha256 })) });
}
assert.ok(changes.every(r => r.bodyBoundsPreserved && r.nativeTopGeometryPreserved));
const version = hash(JSON.stringify(rows)).slice(0, 12);
fs.writeFileSync(out + '/kits.json', JSON.stringify({ version, rows, defaultPdpSkus: [] }, null, 2) + '\n');
fs.writeFileSync(dir + '/registration.json', JSON.stringify({ version, status: 'pilot-review', catalogCount: 45, preparedCount: 36, held,
    bodySource, target: recovered.scale, changes, publication: 'No production recipes or catalog records changed' }, null, 2) + '\n');
const representatives = ['GBcyl25SpryMtGl','GBcyl25SpryShnBlk','LBCyl25LtnMtGl','LBCyl25LtnShnSl','GBCyl25RdcrShnGl','GBCyl25DrpGl','GBCyl25AnSpGl'].map(sku => {
    const c = catalog.find(r => r.id === sku); assert.ok(c, sku);
    return { sku, family: c.family, glass: c.color, applicator: c.fitment, capColor: c.closure,
        url: '/products/' + c.product.productGroupSlug + '?sku=' + encodeURIComponent(sku) + '&assetPreview=kits',
        bodyUrl: rows[sku].parts.find(p => p.slot === 'body').image.url };
});
fs.writeFileSync(dir + '/representatives.json', JSON.stringify(representatives, null, 2) + '\n');
assert.equal(Object.keys(rows).length,36);assert.equal(held.length,9);console.log('Prepared 36 exact 25 ml recipes; 9 tassel assemblies held for source/frame reconciliation');
