#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const rootArg = args.indexOf('--root');
if (rootArg !== -1 && (!args[rootArg + 1] || args[rootArg + 1].startsWith('--'))) throw new Error('--root requires a path');
const root = resolve(rootArg === -1 ? resolve(packageDir, '../../..') : args[rootArg + 1]);
const apply = args.includes('--apply');
const digest = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const inside = (base, path) => {
  const result = resolve(base, path), rel = relative(base, result);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error(`Unsafe package path: ${path}`);
  return result;
};
const manifest = JSON.parse(readFileSync(resolve(packageDir, 'manifest.json'), 'utf8'));
// Verify the entire package before writing any destination files.
for (const entry of manifest.files) {
  if (digest(inside(packageDir, entry.path)) !== entry.sha256) throw new Error(`Checksum mismatch: ${entry.path}`);
}
const files = manifest.files.filter(e => e.restoreTo).map(entry => {
  if (!/^public\/(local-kits|reviews)\//.test(entry.restoreTo) && !/^public\/images\/pdp\/backdrops\/cylinder-5ml-13-415-(clear|cobalt)\.webp$/.test(entry.restoreTo)) throw new Error(`Unexpected destination: ${entry.restoreTo}`);
  return { ...entry, destination: inside(root, entry.restoreTo), sourceFile: inside(packageDir, entry.path) };
});
const backupRoot = resolve(root, 'outputs/catalog-model-repair-2026-10-31/checkpoint-restore-backups', new Date().toISOString().replace(/[:.]/g, '-'));
let copied = 0, unchanged = 0, backedUp = 0;
for (const file of files) {
  if (existsSync(file.destination) && digest(file.destination) === file.sha256) { unchanged++; continue; }
  if (existsSync(file.destination)) {
    backedUp++;
    if (apply) {
      const backup = inside(backupRoot, file.restoreTo);
      mkdirSync(dirname(backup), { recursive: true });
      copyFileSync(file.destination, backup);
    }
  }
  copied++;
  if (apply) {
    mkdirSync(dirname(file.destination), { recursive: true });
    copyFileSync(file.sourceFile, file.destination);
    if (digest(file.destination) !== file.sha256) throw new Error(`Restored checksum mismatch: ${file.restoreTo}`);
  }
}
console.log(JSON.stringify({ mode: apply ? 'restored' : 'dry-run', verifiedFiles: manifest.files.length, copied, unchanged, backedUp, ...(backedUp ? { backupRoot } : {}) }, null, 2));
