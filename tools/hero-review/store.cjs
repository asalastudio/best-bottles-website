const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const statuses = new Set(['pending', 'approved', 'changes_requested', 'rejected']);
function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function read(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return { schemaVersion: 1, decisions: {}, history: [] }; throw e; }
}
function save(file, rows, input) {
  const row = rows.find(r => r.sku === input.sku);
  if (!row) fail('Unknown image. Reload the review.');
  if (row.sizingLocked) fail('This approved image is locked; create a new revision for changes.', 409);
  if (row.assetSha256 !== input.assetSha256) fail('This image has changed. Reload before reviewing its new version.', 409);
  if (!statuses.has(input.status) || typeof input.notes !== 'string' || input.notes.length > 4000) fail('Invalid decision or note (maximum 4,000 characters).');
  const data = read(file), key = row.sku + ':' + row.assetSha256;
  const previous = data.decisions[key];
  if (input.revision !== (previous?.revision || 0)) fail('This decision was updated in another tab. Reload to see the saved decision.', 409);
  const targetHeight = input.targetHeight === undefined ? (previous?.targetHeight || null) : input.targetHeight;
  if (targetHeight !== null && (typeof targetHeight !== 'object' || !Number.isFinite(targetHeight.heightPercent) || targetHeight.heightPercent < 10 || targetHeight.heightPercent > 90 || !['bottle_with_fitment', 'glass_body', 'glass_shoulder'].includes(targetHeight.measurement) || targetHeight.baselinePercent !== 91)) fail('Choose a target height from 10 to 90%, measured from the 91% baseline.');
  const decision = { sku: row.sku, assetSha256: row.assetSha256, status: input.status, notes: input.notes, targetHeight,
    revision: (previous?.revision || 0) + 1, updatedAt: new Date().toISOString(), scope: 'visual-feedback-only' };
  data.decisions[key] = decision;
  data.history.push(decision);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.' + crypto.randomUUID() + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(data, null, 2));
  fs.renameSync(temp, file);
  return decision;
}
module.exports = { read, save };
