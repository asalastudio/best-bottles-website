/** Only changes the fixed isolated review alias. Never promotes a production deployment. */
const { chromium } = require('/Users/jordanrichter/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const [active, off] = process.argv.slice(2);
const alias = 'best-bottles-media-review-asala.vercel.app', origin = `https://${alias}`;
const node = '/Users/jordanrichter/.hermes/node/bin/node';
const vc = '/Users/jordanrichter/.local/lib/node_modules/vercel/dist/vc.js';
const project = 'prj_JFb1sYpDTmvfUR2qfOOL9TJmF5yt', team = 'team_CGyACzn1BhcZitDAKUiZRzax';
const revision = 'empire-round26-03baed749353:all';
const output = 'docs/reviews/isolated-preview-deployment-2026-10-20';
assert(process.env.VERCEL_OIDC_TOKEN);
function inspect(url) {
  assert(/^https:\/\/best-bottles-media-review-[a-z0-9-]+\.vercel\.app$/.test(url));
  const d = JSON.parse(execFileSync(node, [vc, 'api', `/v13/deployments/${new URL(url).host}?teamId=${team}`, '--scope', 'asala'], { encoding: 'utf8' }));
  assert.equal(d.projectId, project); assert.equal(d.readyState, 'READY'); assert.notEqual(d.target, 'production');
  return { id: d.id, url, target: d.target, mode: d.meta.mediaMode };
}
function point(url) { execFileSync(node, [vc, 'alias', 'set', url, alias, '--scope', 'asala'], { stdio: 'pipe' }); }
async function revisionAtAlias(wanted) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const r = await fetch(`${origin}/api/bottle-builder/families?mediaRevision=${encodeURIComponent(wanted)}`, {
      redirect: 'error', headers: { 'x-vercel-trusted-oidc-idp-token': process.env.VERCEL_OIDC_TOKEN },
    });
    if (r.status === 200 && r.headers.get('x-bb-media-revision') === wanted) return;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw Error('Alias did not serve expected revision: ' + wanted);
}
(async () => {
  const report = { alias, active: inspect(active), off: inspect(off), checkedAt: new Date().toISOString() };
  assert.equal(report.active.mode, 'all'); assert.equal(report.off.mode, 'off');
  point(active); await revisionAtAlias(revision);
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route(`${origin}/**`, route => route.continue({ headers: {
      ...route.request().headers(), 'x-vercel-trusted-oidc-idp-token': process.env.VERCEL_OIDC_TOKEN,
    } }));
    const page = await context.newPage();
    await page.goto(`${origin}/matrix?family=Empire`, { waitUntil: 'networkidle' });
    await page.locator('[data-bottle-builder]').waitFor();
    point(off); await revisionAtAlias('media-off-v1');
    execFileSync('/Users/jordanrichter/.hermes/node/bin/node', ['--import', 'tsx', 'scripts/media-release/check-hosted.cjs', origin, 'off', 'rollback-off'], { stdio: 'pipe', env: process.env });
    await page.getByRole('button', { name: /^100 ml, 18-415 neck/ }).click();
    await page.getByRole('button', { name: 'Refresh bottle builder', exact: true }).waitFor({ timeout: 30000 });
    report.oldTabRequestedRefresh = true;
    await page.screenshot({ path: `${output}/rollback-old-tab-refresh.png`, fullPage: false });
    await Promise.all([
      page.waitForEvent('domcontentloaded', { timeout: 30000 }),
      page.getByRole('button', { name: 'Refresh bottle builder', exact: true }).click(),
    ]);
    await page.waitForLoadState('networkidle');
    await page.locator('[data-bottle-builder]:visible').first().waitFor({ timeout: 30000 });
    const recovered = page.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/bottle-builder/bodies' &&
      response.status() === 200 && response.headers()['x-bb-media-revision'] === 'media-off-v1',
    { timeout: 30000 });
    await page.getByRole('button', { name: /^100 ml, 18-415 neck/ }).click();
    await recovered;
    await page.getByRole('button', { name: 'Choose Your Fitment', exact: true }).first().click();
    await page.getByRole('button', { name: 'Perfume Sprayer', exact: true }).waitFor();
    report.refreshRecovered = true;
    report.recoveredRevision = 'media-off-v1';
    await page.screenshot({ path: `${output}/rollback-refreshed-builder.png`, fullPage: false });
  } finally {
    point(active); await revisionAtAlias(revision);
    report.activeRestored = true;
    await browser.close();
    fs.writeFileSync(`${output}/rollback.json`, JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify(report));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
