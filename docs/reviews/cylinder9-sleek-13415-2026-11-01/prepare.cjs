const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),assert=require('node:assert/strict');
const directory=__dirname;
const kitFile='public/local-kits/remaining-13-415-2026-11-01/kits.json';
const catalogFile='docs/reviews/remaining-13-415-2026-11-01/remaining-inventory.json';
const kits=JSON.parse(fs.readFileSync(kitFile)).rows,catalog=JSON.parse(fs.readFileSync(catalogFile)),lookup=new Map(catalog.map(r=>[r.id,r]));
const allowed=new Set(['cylinder-9ml-13-415|Clear','cylinder-9ml-13-415|Frosted','sleek-5ml-13-415|Clear','sleek-8ml-13-415|Clear']);
const rows=Object.fromEntries(Object.entries(kits).filter(([,k])=>allowed.has(k.register?.plateKey)));
assert.equal(Object.keys(rows).length,144);
const bodies={};
for(const [sku,k]of Object.entries(rows)){const r=lookup.get(sku);assert.ok(r);const key=k.register.plateKey,d=bodies[key]??={bodyId:k.register.bodyId,glass:k.register.glass,sprayers:0,rollers:0,pour:0,configurations:0};const slots=new Set(k.parts.map(p=>p.slot));d[slots.has('sprayer')?'sprayers':slots.has('roller')?'rollers':'pour']++;d.configurations++;}
for(const row of Object.values(bodies)){assert.equal(row.configurations,36);assert.equal(row.sprayers,8);assert.equal(row.rollers,18);assert.equal(row.pour,10);}
const digest=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest={status:'existing-local-candidates-under-review',configurations:144,bodies,skus:Object.keys(rows).sort(),sources:[kitFile,catalogFile].map(file=>({file,sha256:digest(file)}))};
fs.writeFileSync(path.join(directory,'scope-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(directory,'scope.json'),JSON.stringify({...manifest,rows},null,2)+'\n');
fs.writeFileSync(path.join(directory,'catalog-scope.json'),JSON.stringify(Object.keys(rows).map(s=>lookup.get(s)),null,2)+'\n');
console.log('Prepared exact 144-SKU scope; no source image or runtime index changed');
