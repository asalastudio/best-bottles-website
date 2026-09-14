// Record Jordan's explicit Tulip plate approval against immutable, exact bytes.
// This is an approval lock only: it never uploads, indexes, or publishes.
import {access, mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import sharp from 'sharp';

const root = process.cwd();
const releaseId = 'tulip-plate-release-2026-09-13';
const releaseDir = path.join(root, 'docs/reviews', releaseId);
const reviewPackets = [
  'docs/reviews/tulip-amber-capoff-recovery-2026-09-13/manifest.json',
  'docs/reviews/tulip-clear-capoff-recovery-2026-09-13/manifest.json',
];
const preparedManifestFile = 'dist/paper-doll/technical-reconciliation-2026-09-13/tulip/plates/manifest.json';
const holdEvidenceFile = 'data/asset-ledger/missing-plate-acquisition-2026-09-13.json';
const masterRoot = '/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master';
const clearUncappedFolder = '5.  13-415 Bottles/19. Tulip 6ml Clear/1. Tulip 6ml (Uncapped) PSD ';
const amberUncappedFolder = '5.  13-415 Bottles/4. Tulip 5ml Amber/1. Tulip 5 Amber (Uncapped) PSD ';
const clearCappedFolder = '5.  13-415 Bottles/19. Tulip 6ml Clear/2. Tulip 6ml (Capped) PSD ';
const amberCappedFolder = '5.  13-415 Bottles/4. Tulip 5ml Amber/2. Tulip 5 Amber (Capped) PSD';
const holdSku = 'GBTulip6BlkShSht';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const readJson = async file => {
  const bytes = await readFile(path.join(root, file));
  return {file, bytes, sha256: digest(bytes), data: JSON.parse(bytes)};
};
const fail = message => { throw new Error(`lock-tulip-plates: ${message}`); };
const assert = (condition, message) => { if (!condition) fail(message); };

for (const file of ['approval.json', 'approved-lock.json']) {
  try {
    await access(path.join(releaseDir, file));
    fail(`${file} already exists; approval locks are immutable and cannot be replaced.`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

const [amber, clear, prepared, holdEvidence] = await Promise.all([
  readJson(reviewPackets[0]),
  readJson(reviewPackets[1]),
  readJson(preparedManifestFile),
  readJson(holdEvidenceFile),
]);
const packets = [amber, clear];
assert(amber.data.family === 'Tulip' && clear.data.family === 'Tulip', 'review packets must both be Tulip packets.');
assert(amber.data.sourceRoot === masterRoot && clear.data.sourceRoot === masterRoot, 'a review packet is outside BB-PSD-Files-Master.');
assert(amber.data.summary.rows === 30 && clear.data.summary.rows === 29, 'expected 30 amber and 29 clear prepared rows.');
assert(prepared.data.rows.length === 59, 'the prepared Tulip manifest must contain 59 rows.');

const catalog = JSON.parse((await readFile(path.join(root, 'dist/paper-doll/catalog-plates-2026-09-12/catalog.json'))).toString()).products;
const catalogBySku = new Map(catalog.map(row => [row.websiteSku, row]));
const preparedBySku = new Map(prepared.data.rows.map(row => [row.websiteSku, row]));
assert(preparedBySku.size === 59, 'prepared Tulip rows must have unique catalog SKUs.');
const rows = packets.flatMap(packet => packet.data.rows);
assert(rows.length === 59 && new Set(rows.map(row => row.websiteSku)).size === 59, 'approval batch must contain 59 unique SKUs.');
assert(rows.every(row => row.status === 'pending-review'), 'approval must start from the pending review packets.');

const holdRows = (holdEvidence.data.rows ?? []).filter(row => row.sku === holdSku);
assert(holdRows.length === 1 && holdRows[0].status === 'hold', 'the missing clear short shiny black cap hold is not recorded.');
assert((holdRows[0].holdReasons ?? []).includes('match:no-psd'), 'the Tulip hold must remain an explicit no-PSD hold.');
assert(!preparedBySku.has(holdSku), 'the no-PSD hold cannot be approved as a prepared plate.');
const preparedManifestBySku = new Map(prepared.data.rows.map(row => [row.websiteSku, row]));

const entries = [];
for (const reviewRow of rows.sort((a, b) => a.websiteSku.localeCompare(b.websiteSku))) {
  const catalogRow = catalogBySku.get(reviewRow.websiteSku);
  const preparedRow = preparedManifestBySku.get(reviewRow.websiteSku);
  assert(catalogRow && preparedRow, `exact catalog identity or prepared row is missing for ${reviewRow.websiteSku}.`);
  assert(catalogRow.family === 'Tulip', `catalog family changed for ${reviewRow.websiteSku}.`);
  assert(catalogRow.capacityMl === reviewRow.capacityMl && catalogRow.color === reviewRow.color && catalogRow.neckThreadSize === '13-415', `catalog identity changed for ${reviewRow.websiteSku}.`);
  assert(preparedRow.plate?.sha256 === reviewRow.preparedCapOn?.sha256, `prepared cap-on bytes differ for ${reviewRow.websiteSku}.`);
  assert(preparedRow.plateCapOff?.sha256 === reviewRow.preparedCapOff?.sha256, `prepared cap-off bytes differ for ${reviewRow.websiteSku}.`);
  assert(reviewRow.currentCapOn?.sha256 && /^[a-f0-9]{64}$/.test(reviewRow.currentCapOn.sha256), `current cap-on hash is missing for ${reviewRow.websiteSku}.`);
  assert(reviewRow.preparedCapOn?.sourceLibrary === 'master' && reviewRow.preparedCapOff?.sourceLibrary === 'master', `master source lineage is missing for ${reviewRow.websiteSku}.`);
  const expectedUncapped = reviewRow.color === 'Amber' ? amberUncappedFolder : clearUncappedFolder;
  const expectedCapped = reviewRow.color === 'Amber' ? amberCappedFolder : clearCappedFolder;
  assert(reviewRow.sources?.uncapped?.startsWith(expectedUncapped), `uncapped source is outside the exact ${reviewRow.color.toLowerCase()} master folder for ${reviewRow.websiteSku}.`);
  assert(reviewRow.sources?.capped?.startsWith(expectedCapped), `capped source is outside the exact ${reviewRow.color.toLowerCase()} master folder for ${reviewRow.websiteSku}.`);

  const views = [];
  const current = reviewRow.currentCapOn;
  views.push({role: 'current-on', sha256: current.sha256, bytes: current.bytes, width: current.width, height: current.height, url: current.url, verifiedFrom: current.verifiedFrom ?? 'recorded Blob URL'});
  const packetDir = reviewPackets[reviewRow.color === 'Amber' ? 0 : 1].replace('/manifest.json', '');
  for (const [role, source] of [['on', reviewRow.preparedCapOn], ['off', reviewRow.preparedCapOff]]) {
    const assetPath = path.join(root, packetDir, source.path);
    const bytes = await readFile(assetPath);
    assert(digest(bytes) === source.sha256, `prepared ${role} bytes changed for ${reviewRow.websiteSku}.`);
    const metadata = await sharp(bytes).metadata();
    assert(metadata.format === 'webp' && metadata.width === 1000 && metadata.height === 1100, `prepared ${role} canvas is not 1000 × 1100 for ${reviewRow.websiteSku}.`);
    const sourceRelPath = role === 'on' ? preparedRow.plate.sourceRelPath : preparedRow.plateCapOff.sourceRelPath;
    assert(sourceRelPath && !sourceRelPath.startsWith('/'), `source path is not master-relative for ${reviewRow.websiteSku}.`);
    views.push({
      role,
      sha256: source.sha256,
      bytes: bytes.length,
      width: metadata.width,
      height: metadata.height,
      path: `${packetDir}/${source.path}`,
      sourceLibrary: source.sourceLibrary,
      sourceRelPath,
      sourceSha256: source.sourceSha256,
    });
  }
  const binding = digest(JSON.stringify({websiteSku: reviewRow.websiteSku, productGroupId: catalogRow.productGroupId, familyId: reviewRow.familyId, views: views.map(view => ({role: view.role, sha256: view.sha256}))}));
  entries.push({
    websiteSku: reviewRow.websiteSku,
    recordId: catalogRow._id,
    graceSku: catalogRow.graceSku,
    productGroupId: catalogRow.productGroupId,
    familyId: reviewRow.familyId,
    family: reviewRow.family,
    capacityMl: reviewRow.capacityMl,
    color: reviewRow.color,
    neckThreadSize: catalogRow.neckThreadSize,
    applicator: reviewRow.applicator,
    capColor: reviewRow.capColor,
    binding,
    reviewPackets: [amber.data.id, clear.data.id].filter(id => id === (reviewRow.color === 'Amber' ? amber.data.id : clear.data.id)),
    views,
    sourcePair: {capped: reviewRow.sources.capped, uncapped: reviewRow.sources.uncapped},
    status: 'approved',
    scope: 'plate cap-on and exact master-PSD cap-off visual approval',
    technicalHoldsNotWaived: [],
    publicationAuthorized: false,
  });
}

const reviewedAt = new Date().toISOString();
const approvalId = randomUUID();
const approval = {
  schemaVersion: 1,
  batchId: releaseId,
  reviewedBy: 'Jordan Richter',
  reviewedAt,
  decision: 'Tulip plates are perfect. Jordan explicitly approved and asked to lock them in.',
  source: 'Explicit user approval in this Codex conversation after reviewing the Tulip amber and clear prepared cap-on/cap-off packets.',
  reviewPackets: packets.map(packet => ({id: packet.data.id, file: packet.file, sha256: packet.sha256, rows: packet.data.rows.length})),
  preparedManifest: {file: prepared.file, sha256: prepared.sha256, rows: prepared.data.rows.length},
  visualApproved: true,
  indexingAuthorized: false,
  publicationAuthorized: false,
  heldRows: [{sku: holdSku, family: 'Tulip', capacityMl: 6, color: 'Clear', reason: 'No exact PSD candidate in the verified master source audit (match:no-psd). Preserve as an explicit hold.'}],
  entries,
};
const approvalBytes = Buffer.from(JSON.stringify(approval, null, 2) + '\n');
const approvalFile = path.join(releaseDir, 'approval.json');
await mkdir(releaseDir, {recursive: true});
await writeFile(approvalFile, approvalBytes, {flag: 'wx'});

const lock = {
  schemaVersion: 1,
  release: releaseId,
  approvedAt: reviewedAt,
  actor: 'Jordan Richter · explicit local batch approval',
  approvalId,
  reviewPackets: approval.reviewPackets,
  approvalFile: `docs/reviews/${releaseId}/approval.json`,
  approvalFileSha256: digest(approvalBytes),
  preparedManifest: approval.preparedManifest,
  visualApproved: true,
  publicationAuthorized: false,
  indexingAuthorized: false,
  approvedRows: entries.length,
  heldRows: approval.heldRows,
  rows: entries,
  note: 'Immutable exact-byte approval lock for 59 Tulip plate pairs. The one missing clear SKU remains an explicit no-PSD hold. Upload, indexing, and publication require separate technical verification and a release-specific ship instruction.',
};
const lockBytes = Buffer.from(JSON.stringify(lock, null, 2) + '\n');
await writeFile(path.join(releaseDir, 'approved-lock.json'), lockBytes, {flag: 'wx'});
console.log(JSON.stringify({release: releaseId, approvalId, approvedRows: entries.length, amberRows: amber.data.rows.length, clearRows: clear.data.rows.length, heldRows: approval.heldRows.length, publicationAuthorized: false, approvalFileSha256: digest(approvalBytes), approvedLockSha256: digest(lockBytes)}));
