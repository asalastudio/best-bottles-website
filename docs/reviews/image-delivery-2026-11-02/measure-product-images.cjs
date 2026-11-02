const fs = require('node:fs');
const path = require('node:path');
const P = require(process.cwd() + '/node_modules/puppeteer-core');
const origin = process.env.PERF_ORIGIN || 'https://best-bottles-website.vercel.app';
const out = process.env.PERF_OUT || '/private/tmp/bb-image-performance-baseline';
const routes = (process.env.PERF_ROUTES || '/products/sleek-8ml-clear-13-415-finemist?cap=matte-gold,/products/tulip-6ml-clear-13-415-finemist?cap=shiny-silver,/products/cylinder-9ml-frosted-13-415-finemist?cap=matte-black').split(',');
const repetitions = Number(process.env.PERF_REPEAT || 1);
const cases = Array.from({ length: repetitions }, () => routes).flat();
const safeUrl = value => { const url = new URL(value); for (const key of [...url.searchParams.keys()]) if (/bypass|token|secret|signature|authorization|vercel_share/i.test(key)) url.searchParams.set(key, '[redacted]'); return url.href; };
const report = { origin, startedAt: new Date().toISOString(), runs: [] };
const pause = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(out, { recursive: true });
const save = () => fs.writeFileSync(path.join(out, 'timings.json'), JSON.stringify(report, null, 2));
(async () => {
 const b = await P.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
 try {
  // Establish private-preview access once. Fresh contexts below receive only
  // the access cookies in memory, never a warm product cache or landing page.
  let accessCookies = [];
  if (process.env.PERF_ACCESS_FILE) {
   const authContext = await b.createBrowserContext(), authPage = await authContext.newPage();
   await authPage.goto(fs.readFileSync(process.env.PERF_ACCESS_FILE, 'utf8').trim(), { waitUntil: 'domcontentloaded', timeout: 60000 });
   accessCookies = await authContext.cookies();
   await authContext.close();
  }
  for (const route of cases) {
   const context = await b.createBrowserContext();
   if (accessCookies.length) await context.setCookie(...accessCookies);
   const p = await context.newPage();
   await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
   const cdp = await p.createCDPSession();
   await cdp.send('Network.enable');
   await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
   // Controlled fast 4G: 9 Mbps down, 1.5 Mbps up, 80 ms RTT. CPU stays native.
   await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 80, downloadThroughput: 9 * 1000 * 1000 / 8, uploadThroughput: 1.5 * 1000 * 1000 / 8 });
   const reqs = new Map();
   cdp.on('Network.requestWillBeSent', e => reqs.set(e.requestId, { url: safeUrl(e.request.url), type: e.type, start: e.timestamp, priority: e.request.initialPriority }));
   cdp.on('Network.responseReceived', e => Object.assign(reqs.get(e.requestId) || {}, { status: e.response.status, mime: e.response.mimeType, fromDiskCache: e.response.fromDiskCache,
    vercelRequestId: e.response.headers['x-vercel-id'], serverTiming: e.response.headers['server-timing'] }));
   cdp.on('Network.loadingFinished', e => Object.assign(reqs.get(e.requestId) || {}, { bytes: e.encodedDataLength, end: e.timestamp }));
   cdp.on('Network.loadingFailed', e => Object.assign(reqs.get(e.requestId) || {}, { failed: e.errorText, end: e.timestamp }));
   await p.evaluateOnNewDocument(() => {
    window.__bottlePerf = { lcp: [], heroReadyMs: null, stageSeenMs: null };
    new PerformanceObserver(list => { for (const e of list.getEntries()) window.__bottlePerf.lcp.push({ time: e.startTime, size: e.size, url: e.url, tag: e.element?.tagName }); }).observe({ type: 'largest-contentful-paint', buffered: true });
    const timer = setInterval(() => {
     const stage = document.querySelector('[data-testid="pdp-stage"]');
     if (!stage) return;
     if (!window.__bottlePerf.stageSeenMs) window.__bottlePerf.stageSeenMs = performance.now();
     const imgs = [...stage.querySelectorAll('img')];
     if (imgs.length && imgs.every(i => i.complete && i.naturalWidth > 0) && !window.__bottlePerf.heroReadyMs) {
      Promise.all(imgs.map(i => i.decode())).then(() => requestAnimationFrame(() => requestAnimationFrame(() => { if (!window.__bottlePerf.heroReadyMs) window.__bottlePerf.heroReadyMs = performance.now(); })));
     }
    }, 25);
    setTimeout(() => clearInterval(timer), 60000);
   });
   const started = Date.now();
   try {
   await p.goto(origin + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
   if (!p.url().startsWith(origin + '/products/')) throw Error('Preview access did not reach the product page');
   await p.waitForFunction(() => window.__bottlePerf.heroReadyMs, { timeout: 60000 }).catch(() => {});
   await pause(2500);
   const metrics = await p.evaluate(() => ({
    ...window.__bottlePerf,
    nav: performance.getEntriesByType('navigation').map(e => ({ ttfb: e.responseStart, responseEnd: e.responseEnd, dom: e.domContentLoadedEventEnd, load: e.loadEventEnd, transferSize: e.transferSize })),
    paints: performance.getEntriesByType('paint').map(e => ({ name: e.name, time: e.startTime })),
    hero: [...document.querySelectorAll('[data-testid="pdp-stage"] img')].map(i => ({ url: i.currentSrc, width: i.width, height: i.height, naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight, slot: i.closest('[data-slot]')?.dataset.slot })),
    resources: performance.getEntriesByType('resource').map(e => ({ url: e.name, start: e.startTime, duration: e.duration, bytes: e.transferSize, decoded: e.decodedBodySize, initiator: e.initiatorType }))
   }));
   for (const resource of metrics.resources) resource.url = safeUrl(resource.url);
   for (const lcp of metrics.lcp) if (lcp.url) lcp.url = safeUrl(lcp.url);
   const requests = [...reqs.values()].filter(r => /^https?:/.test(r.url));
   const heroResources = metrics.resources.filter(r => metrics.hero.some(i => i.url === r.url));
   const row = { route, heroFirstRequestMs: Math.min(...heroResources.map(r=>r.start)), heroLastResponseMs: Math.max(...heroResources.map(r=>r.start+r.duration)), profile: 'mobile 390x844 DPR2, fast 4G 9Mbps down/1.5Mbps up/80ms RTT, native CPU, empty browser cache', ...metrics, requests };
   report.runs.push(row); save();
   await p.screenshot({ path: path.join(out, String(report.runs.length) + '.png') });
   console.log(JSON.stringify({ route, heroReadyMs: metrics.heroReadyMs, ttfb: metrics.nav[0]?.ttfb, lcp: metrics.lcp.at(-1)?.time, imageBytes: requests.filter(r => r.type === 'Image').reduce((n,r) => n + (r.bytes || 0), 0), images: requests.filter(r=>r.type==='Image').length }));
   } catch (error) {
    // A stalled navigation is a failed sample, not a missing measurement.
    // Do not persist cookies, access-link URLs or arbitrary error stacks.
    report.runs.push({ route, failed: true, error: error.name, elapsedMs: Date.now() - started,
     requests: [...reqs.values()].filter(r => /^https?:/.test(r.url)) }); save();
    console.log(JSON.stringify({ route, failed: true, error: error.name, elapsedMs: Date.now() - started }));
   }
   await context.close();
  }
 } finally { await Promise.race([b.close(), pause(5000)]); b.process()?.kill('SIGTERM'); }
 report.finishedAt = new Date().toISOString(); save();
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
