/** Read-only asset verification. --remote additionally GETs the 14 existing images. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const root = path.resolve(import.meta.dirname, '../..');
const review = path.join(root, 'docs/reviews/empire-round-release-prep-2026-10-20');
const inventory = JSON.parse(fs.readFileSync(path.join(review, 'asset-inventory.json'), 'utf8'));
const hash = data => createHash('sha256').update(data).digest('hex');
const local = [];
for (const asset of inventory.assets) {
    const data = fs.readFileSync(path.join(root, 'public', asset.releaseUrl));
    assert.equal(hash(data), asset.sha256);
    assert.equal(data.length, asset.bytes);
    const meta = await sharp(data).metadata();
    assert(meta.width > 0 && meta.height > 0);
    local.push({ url: asset.releaseUrl, sha256: asset.sha256, bytes: data.length, width: meta.width, height: meta.height });
}
const remote = [];
const approvedRemote = new Map();
for (const name of ['local-empire-completion-provenance.json', 'local-round78-completion-provenance.json']) {
    for (const row of JSON.parse(fs.readFileSync(path.join(root, 'src/lib/products', name), 'utf8'))) {
        for (const layer of row.layers) if (layer.url.startsWith('https://')) {
            if (approvedRemote.has(layer.url)) assert.equal(approvedRemote.get(layer.url), layer.sha256);
            approvedRemote.set(layer.url, layer.sha256);
        }
    }
}
if (process.argv.includes('--remote')) {
    for (const url of inventory.existingRemoteUrls) {
        const parsed = new URL(url);
        assert.equal(parsed.hostname, 'yzy7l20k4yt6znzz.public.blob.vercel-storage.com');
        const filenameSha256 = parsed.pathname.match(/([0-9a-f]{64})\.png$/)?.[1];
        const expected = approvedRemote.get(url);
        assert(expected, 'Every remote dependency must have a recorded approval-source hash');
        const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
        assert(response.ok, `Remote asset status ${response.status}`);
        const data = Buffer.from(await response.arrayBuffer());
        const actualSha256 = hash(data);
        const meta = await sharp(data).metadata();
        assert(meta.width > 0 && meta.height > 0);
        if (actualSha256 === expected) {
            const cache = path.join(root, 'output/media-release-source-cache');
            fs.mkdirSync(cache, { recursive: true });
            fs.writeFileSync(path.join(cache, `${actualSha256}.png`), data);
        }
        remote.push({ url, sha256: actualSha256, approvedSha256: expected, matchesApproval: actualSha256 === expected, filenameSha256, matchesFilename: actualSha256 === filenameSha256, bytes: data.length, width: meta.width, height: meta.height, status: response.status });
    }
}
const receipt = { revision: inventory.revision, verifiedAt: new Date().toISOString(), local, remote, remoteVerified: process.argv.includes('--remote') && remote.every(a => a.matchesApproval), writes: 'local receipt only; no remote writes' };
fs.writeFileSync(path.join(review, process.argv.includes('--remote') ? 'remote-asset-verification.json' : 'local-asset-verification.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({localReferences: local.length, uniqueLocalFiles: new Set(local.map(a => a.url)).size, remote: remote.length, remoteHashMismatches: remote.filter(a => !a.matchesFilename).length, approvalMismatches: remote.filter(a => !a.matchesApproval).length, ok: !remote.some(a => !a.matchesApproval)}));

if (remote.some(a => !a.matchesApproval)) process.exitCode = 1;
