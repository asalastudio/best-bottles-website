import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const dir = 'docs/reviews/jumbo-roller-psd-match-2026-11-02';
const src = 'docs/reviews/cylinder-family-completion-2026-11-02/sources';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const png = name => fs.readFileSync(src + '/' + name);
const metal = png('28-metal-black-layer-2.png');
const plastic = png('28-plastic-white-layer-2.png');
const housing = png('28-plastic-white-layer-4.png');
assert.equal(hash(metal), '001af9d1c245b08758027496b2bd8371fbc4b971cc60ea08fa3d31a5d7a16103');
assert.equal(hash(plastic), 'b5176bfd01982ede60b193f0f16e5d3a554b455ce4a500811701e0e2a18b9b96');
assert.equal(hash(housing), 'dc2bbd9d44b68b59a7ae186f57af3caab82060df02dbaab7fc8c53eede3faecb');
const image = (bytes, x, y, w, h) => `<image href="data:image/png;base64,${bytes.toString('base64')}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
const wrap = (w, h, body, clip = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><clipPath id="viewport"><rect width="${w}" height="${h}"/></clipPath>${clip ? `<clipPath id="outline">${clip}</clipPath>` : ''}</defs><g clip-path="url(#viewport)"><g${clip ? ' clip-path="url(#outline)"' : ''}>${body}</g></g></svg>`;

// A display clip discards isolated cutout debris. Original image bytes stay
// embedded and the main photographic component, including its feathered edge,
// is retained. This does not paint, recolor, sharpen, or invent ball pixels.
function mainComponentClip(data, width, height) {
    const visited = new Uint8Array(width * height); let largest = [];
    for (let i = 0; i < visited.length; i++) {
        if (visited[i] || data[i * 4 + 3] < 32) continue;
        const queue = [i]; visited[i] = 1;
        for (let j = 0; j < queue.length; j++) {
            const at = queue[j], x = at % width, y = Math.floor(at / width);
            for (const next of [x ? at - 1 : -1, x + 1 < width ? at + 1 : -1, y ? at - width : -1, y + 1 < height ? at + width : -1]) {
                if (next < 0 || visited[next] || data[next * 4 + 3] < 32) continue;
                visited[next] = 1; queue.push(next);
            }
        }
        if (queue.length > largest.length) largest = queue;
    }
    const mask = new Uint8Array(width * height);
    for (const at of largest) {
        const x = at % width, y = Math.floor(at / width);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height) mask[(y + dy) * width + x + dx] = 1;
    }
    let path = '';
    for (let y = 0; y < height; y++) {
        let x = 0;
        while (x < width) {
            if (!mask[y * width + x]) { x++; continue; }
            const left = x; while (x < width && mask[y * width + x]) x++;
            path += `M${left} ${y}h${x-left}v1h${left-x}z`;
        }
    }
    return { mask, path: `<path d="${path}"/>`, retainedPixels: largest.length };
}

const cases = [
    { kind: 'metal', width: 336, height: 220, bytes: metal, body: image(metal, 0, 0, 336, 404), ball: { x: 75, y: 5, width: 200, height: 52 }, sourceHash: hash(metal) },
    { kind: 'plastic', width: 357, height: 244, bytes: plastic, body: image(plastic, 0, 0, 339, 576) + image(housing, 22, 68, 335, 351), ball: { x: 95, y: 14, width: 190, height: 54 }, sourceHash: hash(plastic) },
];
const results = [];
for (const item of cases) {
    const before = await sharp(Buffer.from(wrap(item.width, item.height, item.body))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const clip = mainComponentClip(before.data, item.width, item.height);
    const svg = wrap(item.width, item.height, item.body, clip.path);
    const path = dir + '/sources/roller16-' + item.kind + '-native-psd.svg'; fs.writeFileSync(path, svg);
    const final = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
    const native = await sharp(item.bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let comparedBallPixels = 0, changedBallPixels = 0;
    for (let y = item.ball.y; y < item.ball.y + item.ball.height; y++) for (let x = item.ball.x; x < item.ball.x + item.ball.width; x++) {
        const i = (y * item.width + x) * 4, j = (y * native.info.width + x) * 4;
        if (native.data[j + 3] !== 255 || !clip.mask[y * item.width + x]) continue;
        comparedBallPixels++;
        if ([0, 1, 2, 3].some(c => native.data[j + c] !== final[i + c])) changedBallPixels++;
    }
    assert(comparedBallPixels > 5000, 'Not enough native ball pixels compared');
    assert.equal(changedBallPixels, 0, 'Native ball pixels changed');
    await sharp(Buffer.from(svg)).png().toFile(dir + '/' + item.kind + '-native-preview.png');
    results.push({ kind: item.kind, sourceSha256: item.sourceHash, sourceSvg: path, svgSha256: hash(svg), width: item.width, height: item.height,
        comparedBallPixels, changedBallPixels, cleanup: 'SVG clip removes only detached alpha debris; source photograph and connected edge remain unpainted', lowerPlug: false });
}
fs.writeFileSync(dir + '/native-ball-verification.json', JSON.stringify({ status: 'local-review', masterMethod: 'Original PSD layer pixels at native positions', results }, null, 2) + '\n');
console.log(JSON.stringify(results.map(({kind, comparedBallPixels, changedBallPixels})=>({kind, comparedBallPixels, changedBallPixels}))));
