const fs = require('node:fs');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const dir = 'docs/reviews/cylinder-lotion-pumps-2026-11-02';
const file = 'src/lib/paper-doll/approved-kits.generated.json';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,16);
(async () => {
 const { lotionTubeGeometry } = await import(process.cwd() + '/src/lib/register/cylinder-lotion-tube.ts');
 const manifest = JSON.parse(fs.readFileSync(file));
 const beforeFile = dir + '/before-kits.json';
 const before = fs.existsSync(beforeFile) ? JSON.parse(fs.readFileSync(beforeFile)) : {
  version: manifest.version, rows: Object.fromEntries(Object.entries(manifest.rows).filter(([, kit]) => kit.register?.bodyId === 'cylinder-9ml-17-415' && kit.parts.some(part => part.slot === 'pump'))),
 };
 assert.equal(Object.keys(before.rows).length, 15);
 fs.writeFileSync(beforeFile, JSON.stringify(before, null, 2) + '\n');
 const rows = {}, changes = [];
 for (const [sku, original] of Object.entries(before.rows)) {
  const kit = structuredClone(original);
  const seat = Math.max(...kit.parts.filter(part => ['pump','collar'].includes(part.slot)).map(part => part.bounds.bottom));
  const oldTube = kit.parts.find(part => part.slot === 'diptube');
  assert(oldTube && kit.anchors.pxPerMm);
  const top = seat - kit.anchors.pxPerMm;
  const tip = oldTube.bounds.bottom;
  const geometry = lotionTubeGeometry(kit.anchors.axisX, top, tip);
  kit.parts = kit.parts.map(part => part.slot === 'diptube' ? { ...part, ...geometry } : part);
  assert.deepEqual(kit.parts.filter(part => part.slot !== 'diptube'), original.parts.filter(part => part.slot !== 'diptube'));
  assert.deepEqual(kit.anchors, original.anchors);
  assert(tip < kit.parts.find(part => part.slot === 'body').bounds.bottom);
  rows[sku] = kit; manifest.rows[sku] = kit;
  changes.push({ sku, top, tip, exteriorUnchanged: true, bodyUnchanged: true, clearOvercapPreserved: true });
 }
 manifest.version = hash(manifest.rows);
 fs.writeFileSync(file, JSON.stringify(manifest) + '\n');
 fs.writeFileSync('src/lib/paper-doll/approved-kit-index.json', JSON.stringify({ version: manifest.version, skus: Object.keys(manifest.rows).sort() }) + '\n');
 fs.writeFileSync(dir + '/after-kits.json', JSON.stringify({ version: manifest.version, rows }, null, 2) + '\n');
 fs.writeFileSync(dir + '/tube-registration.json', JSON.stringify({ version: manifest.version, scope: 'tube and internal connector only', changes, sourceImage: geometryImage(rows), sourceReference: '25 ml clear Cylinder lotion hero', geometry: 'Uniform source registration. Connection axis and inner-floor endpoints, not exterior pixels, are updated.' }, null, 2) + '\n');
 console.log(JSON.stringify({ version: manifest.version, updated: changes.length, allExteriorsUnchanged: true }));
})();
function geometryImage(rows) { return Object.values(rows)[0].parts.find(part => part.slot === 'diptube').image; }
