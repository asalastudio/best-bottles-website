/** Offline regression replay for the preserved 2026-10-20 media checkpoint. */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = {
  ...process.env,
  BB_MEDIA_REVIEW_SNAPSHOT: path.join(root, 'tests/fixtures/local-media-20261020/empire-baseline.json'),
  BB_ROUND78_SNAPSHOT: path.join(root, 'output/round78-spray-completion/production-snapshot.json'),
  BB_DIVA46_SNAPSHOT: path.join(root, 'output/diva46-spray-completion/production-snapshot.json'),
  BB_ROUND78_LOTION_SNAPSHOT: path.join(root, 'output/round78-lotion-completion/production-snapshot.json'),
  BB_ROUND78_PILOT_DIR: path.join(root, 'output/round78-two-bottle-pilot'),
  BB_ROUND78_COMPLETION_DIR: path.join(root, 'output/round78-spray-completion'),
  BB_DIVA46_PILOT_DIR: path.join(root, 'output/diva46-two-bottle-pilot'),
  BB_DIVA46_COMPLETION_DIR: path.join(root, 'output/diva46-spray-completion'),
  BB_ROUND78_LOTION_PILOT_DIR: path.join(root, 'output/round78-lotion-pilot'),
  BB_ROUND78_LOTION_COMPLETION_DIR: path.join(root, 'output/round78-lotion-completion'),
};
const tests = [
  'local-empire-bare-glass', 'local-empire-catalog-hero', 'local-empire-completion',
  'local-media-baseline.integration', 'empire-through-glass', 'local-empire-pilot',
  'local-round78-tubes', 'local-round78-two-bottle-pilot', 'local-round78-spray-completion',
  'local-diva46-tubes', 'local-diva46-two-bottle-pilot', 'local-diva46-spray-completion',
  'local-round78-lotion-tubes', 'local-round78-lotion-pilot', 'local-round78-lotion-completion',
  'pdp-redesign-model', 'register-compose',
].map(name => `tests/${name}.test.ts`);
const replayPath = path.join(root, 'output/local-media-baseline/active.json');
const replayBytes = fs.readFileSync(env.BB_MEDIA_REVIEW_SNAPSHOT);
const createdReplay = !fs.existsSync(replayPath);
if (!createdReplay && !fs.readFileSync(replayPath).equals(replayBytes)) {
  throw new Error('Existing local replay differs from this checkpoint. Preserve it before running this suite.');
}
if (createdReplay) { fs.mkdirSync(path.dirname(replayPath), { recursive: true }); fs.writeFileSync(replayPath, replayBytes); }
let result;
try { result = spawnSync(process.execPath, [path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', ...tests], { cwd: root, env, stdio: 'inherit' });
} finally { if (createdReplay) fs.unlinkSync(replayPath); }
if (result.error) throw result.error;
process.exit(result.status ?? 1);
