/** Offline geometry evidence, not a browser test or artwork approval.
 * Usage: npx tsx scripts/review-boston15-stage-views.ts SOURCE_RECOVERY_DIRECTORY
 * Reads preserved source assemblies; never changes catalogues or source pixels.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { availableViews, effectiveView, stageEnvelope, stageLayout, STAGE_VIEWS,
    type KitLike, type StageContext, type StageLayout } from '../src/lib/products/pdp-redesign/stage';

type SourceAssembly = {
    websiteSku: string; glass: string; componentId: string;
    recordedCatalogueState: string; catalogueCorrectionPending: boolean;
    parts: KitLike['parts']; stageAnchors: KitLike['anchors'];
};
type ImageInfo = { data: string; width: number; height: number; ink: { left: number; top: number; right: number; bottom: number } };
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

async function main() {
    const root = process.argv[2];
    if (!root) throw new Error('Source recovery directory required');
    const destination = path.join(root, 'stage-view-review');
    fs.mkdirSync(destination, { recursive: true });
    const sources: SourceAssembly[] = JSON.parse(fs.readFileSync(path.join(root, 'source-assemblies/assemblies.json'), 'utf8'));
    const plan = JSON.parse(fs.readFileSync(path.join(root, 'boston15-source-plan.json'), 'utf8'));
    const entries = sources.map(source => {
        const sourcePlan = plan.assemblies[source.websiteSku];
        if (!sourcePlan?.sourceFitment) throw new Error(`Missing source fitment: ${source.websiteSku}`);
        const kit: KitLike = { sku: source.websiteSku, canvas: { width: 1000, height: 1100 },
            anchors: source.stageAnchors, parts: source.parts,
            register: { bodyId: sourcePlan.bodyId, plateKey: `${sourcePlan.bodyId}|${source.glass}`, glass: source.glass } };
        const context: StageContext = { family: 'Boston Round', capacityMl: 15,
            color: source.glass, applicator: sourcePlan.sourceFitment, websiteSku: source.websiteSku };
        return { source, kit, context };
    });
    const envelope = stageEnvelope(entries.map(entry => entry.kit));
    const imageCache = new Map<string, ImageInfo>();
    async function imageInfo(filename: string): Promise<ImageInfo> {
        const cached = imageCache.get(filename);
        if (cached) return cached;
        // No remote retrieval: all reviewed layers must be the preserved local files.
        if (!path.isAbsolute(filename) || !fs.existsSync(filename)) throw new Error(`Missing local image: ${filename}`);
        const bytes = fs.readFileSync(filename);
        const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        let left = info.width, top = info.height, right = 0, bottom = 0;
        for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
            if (data[(y * info.width + x) * info.channels + info.channels - 1] < 16) continue;
            left = Math.min(left, x); top = Math.min(top, y);
            right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
        }
        if (right <= left || bottom <= top) throw new Error(`No visible pixels: ${filename}`);
        const result = { data: bytes.toString('base64'), width: info.width, height: info.height, ink: { left, top, right, bottom } };
        imageCache.set(filename, result);
        return result;
    }
    async function render(layout: StageLayout, filename: string) {
        if (layout.backdrop || layout.floorShadows.length) throw new Error('This offline adapter does not reproduce studio backdrops');
        const { width, height } = layout.canvas;
        const diagnostics = [];
        const elements = [];
        for (const [index, part] of [...layout.parts].sort((a, b) => a.zIndex - b.zIndex).entries()) {
            const source = await imageInfo(part.url);
            const b = part.box ?? { leftPct: 0, topPct: 0, widthPct: 100, heightPct: 100 };
            const x = (b.leftPct + part.dxPct) * width / 100;
            const y = (b.topPct + part.dyPct) * height / 100;
            const w = b.widthPct * width / 100, h = b.heightPct * height / 100;
            const clipHeight = h * (1 - (part.clipBottomPct ?? 0) / 100);
            const transformX = (v: number) => v * layout.frame.scale + layout.frame.x * width / 100;
            const transformY = (v: number) => v * layout.frame.scale + layout.frame.y * height / 100;
            const visibleBottom = Math.min(source.ink.bottom * h / source.height, clipHeight);
            const visibleTop = source.ink.top * h / source.height;
            const bounds = { left: transformX(x + source.ink.left * w / source.width),
                top: transformY(y + visibleTop), right: transformX(x + source.ink.right * w / source.width),
                bottom: transformY(y + visibleBottom) };
            const visible = visibleBottom > visibleTop;
            const withinCanvas = visible && Object.values(bounds).every(Number.isFinite)
                && bounds.left >= -0.5 && bounds.top >= -0.5 && bounds.right <= width + 0.5 && bounds.bottom <= height + 0.5;
            diagnostics.push({ slot: part.slot, source: part.url, bounds, visible, withinCanvas, clipBottomPct: part.clipBottomPct ?? 0 });
            elements.push(`<defs><clipPath id="part-${index}"><rect x="${x}" y="${y}" width="${w}" height="${clipHeight}"/></clipPath></defs><image x="${x}" y="${y}" width="${w}" height="${h}" clip-path="url(#part-${index})" href="data:image/png;base64,${source.data}"/>`);
        }
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#f5f3ef"/><g transform="translate(${layout.frame.x * width / 100} ${layout.frame.y * height / 100}) scale(${layout.frame.scale})">${elements.join('')}</g></svg>`;
        await sharp(Buffer.from(svg)).png().toFile(path.join(destination, filename));
        return diagnostics;
    }
    const rows: Array<{
        websiteSku: string; glass: string; componentId: string; recordedCatalogueState: string;
        catalogueCorrectionPending: boolean; view: string; file: string; frame: StageLayout['frame'];
        parts: Awaited<ReturnType<typeof render>>; allPartsWithinCanvas: boolean;
        browserVerified: boolean; artworkApproved: boolean; released: boolean;
    }> = [];
    const requests = [];
    for (const { source, kit, context } of entries) {
        const supported = availableViews(kit, context);
        for (const request of STAGE_VIEWS) requests.push({ websiteSku: kit.sku, requested: request.id,
            offered: supported.includes(request.id), effective: effectiveView(request.id, kit, context), browserVerified: false });
        for (const view of supported) {
            const layout = stageLayout(kit, view, context, { envelope });
            if (!layout) throw new Error(`Missing layout: ${kit.sku}/${view}`);
            const filename = `${kit.sku}--${view}.png`;
            const parts = await render(layout, filename);
            rows.push({ websiteSku: kit.sku, glass: source.glass, componentId: source.componentId,
                recordedCatalogueState: source.recordedCatalogueState, catalogueCorrectionPending: source.catalogueCorrectionPending,
                view, file: filename, frame: layout.frame, parts, allPartsWithinCanvas: parts.every(p => p.withinCanvas),
                browserVerified: false, artworkApproved: false, released: false });
        }
    }
    const bodyPositions = entries.map(({ kit }) => {
        const own = rows.filter(row => row.websiteSku === kit.sku && row.view !== 'exploded');
        return { websiteSku: kit.sku, stableAcrossSeatedViews: own.every(row => JSON.stringify(row.parts.find(p => p.slot === 'body')?.bounds)
            === JSON.stringify(own[0].parts.find(p => p.slot === 'body')?.bounds)) };
    });
    const receipt = { createdAt: new Date().toISOString(), method: 'Offline rasterization of storefront stageLayout; no browser, network, approval or publication.',
        limitations: ['Uses the 21 candidate kits as a shared envelope; deployed envelopes may include other finishes.',
            'Source plan fitment is used; catalogue correction flags remain pending.',
            'Visible bounds use alpha >=16, not an assessment of occlusion, edge quality or photographic correctness.',
            'No CSS, image loading, responsive controls, cart, or device checks.'],
        sourceCombinations: entries.length, supportedViews: rows.length, requestedViews: requests.length,
        failedBounds: rows.filter(row => !row.allPartsWithinCanvas).map(row => `${row.websiteSku}/${row.view}`),
        bodyPositions, requests, rows };
    fs.writeFileSync(path.join(destination, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
    const columns = ['websiteSku', 'glass', 'componentId', 'recordedCatalogueState', 'catalogueCorrectionPending', 'view', 'file', 'allPartsWithinCanvas', 'browserVerified', 'artworkApproved', 'released'] as const;
    const csv = [columns.join(','), ...rows.map(row => columns.map(key => JSON.stringify(String(row[key]))).join(','))].join('\n');
    fs.writeFileSync(path.join(destination, 'matrix.csv'), csv + '\n');
    const tiles = await Promise.all(rows.map(async(row, i) => ({ input: await sharp(path.join(destination, row.file)).resize(250,275)
        .extend({ top: 40, bottom: 5, left: 0, right: 0, background: '#f5f3ef' }).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="250" height="40"><text x="8" y="15" font-size="9">${escape(row.websiteSku)}</text><text x="8" y="31" font-size="10">${row.view} | LOCAL CANDIDATE</text></svg>`), top: 0, left: 0 }]).png().toBuffer(), left: i % 7 * 250, top: Math.floor(i / 7) * 320 })));
    await sharp({ create: { width: 1750, height: Math.ceil(rows.length / 7) * 320, channels: 3, background: '#f5f3ef' } })
        .composite(tiles).jpeg({ quality: 95 }).toFile(path.join(destination, 'contact-sheet.jpg'));
    console.log(JSON.stringify({ sourceCombinations: entries.length, supportedViews: rows.length, requestedViews: requests.length,
        failedBounds: receipt.failedBounds, unstableBodies: bodyPositions.filter(row => !row.stableAcrossSeatedViews), browserVerified: false }));
    if (receipt.failedBounds.length || bodyPositions.some(row => !row.stableAcrossSeatedViews)) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
