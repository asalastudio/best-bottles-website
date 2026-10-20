import assets from './local-empire-bare-glass.json';
import reducer from './local-empire-reducer.json';
import pipetteSources from './local-empire-pipettes.json';
import vintageTube from './local-empire-vintage-tube.json';
import empire100SprayTube from './local-empire-100ml-spray-tube.json';
import additionalSprayTubes from './local-empire-additional-spray-tubes.json';
import whitePumpTube from './local-empire-100ml-white-pump-tube.json';
import type { RegisterKit, RegisterPlate } from './stage-kit';

/** Chooser and glass swatches can render a body without loading a full kit. */
export function localEmpireBodyImage(family: string | null | undefined, capacityMl: number | null | undefined,
    glass: string | null | undefined, neck: string | null | undefined) {
    if (process.env.NODE_ENV !== 'development' || process.env.VERCEL || family !== 'Empire' || glass !== 'Clear' || neck !== '18-415') return null;
    const asset = assets.find(a => a.expectedPlate.bodyId === `empire-${capacityMl}ml-18-415`);
    return asset ? { url: asset.url, width: asset.width, height: asset.height } : null;
}

/** Local review masters. Compose against the captured plate first so its
 * source-tube, closure-seat and component guards still validate the originals.
 * Then align the replacement glass uniformly by axis, shoulder and foot.
 * Landmarks are image registration, not new physical measurements.
 */
export function localEmpireBareGlass(kit: RegisterKit, plate: RegisterPlate | undefined): RegisterKit {
    if (process.env.NODE_ENV !== 'development' || process.env.VERCEL || !plate) return kit;
    const asset = assets.find(a => a.plateKey === kit.register.plateKey);
    if (!asset || plate.bodyId !== asset.expectedPlate.bodyId || plate.glass !== 'Clear' ||
        plate.url !== asset.expectedPlate.url || plate.width !== asset.expectedPlate.width ||
        plate.height !== asset.expectedPlate.height || plate.pxPerMm !== asset.expectedPlate.pxPerMm ||
        !Object.entries(asset.expectedPlate.anchors).every(([key, value]) => plate.anchors[key as keyof typeof plate.anchors] === value)) return kit;
    const body = kit.parts.find(p => p.slot === 'body');
    if (!body || body.image.url !== plate.url || body.image.width !== plate.width || body.image.height !== plate.height) return kit;
    const sourceScale = body.box.height / plate.height;
    const shoulderY = body.box.y + asset.expectedPlate.anchors.shoulderY * sourceScale;
    const scale = (body.bounds.bottom - shoulderY) / (asset.landmarks.baselineY - asset.landmarks.shoulderY);
    if (!(scale > 0)) return kit;
    const round = (n: number) => Math.round(n * 100) / 100;
    const x = kit.anchors.axisX - asset.landmarks.axisX * scale;
    const y = body.bounds.bottom - asset.landmarks.baselineY * scale;
    const replacement = {
        ...body,
        image: { url: asset.url, key: asset.url, sha256: asset.sha256, bytes: asset.bytes, width: asset.width, height: asset.height },
        box: { x: round(x), y: round(y), width: round(asset.width * scale), height: round(asset.height * scale) },
        bounds: { left: round(x + asset.landmarks.left * scale), right: round(x + asset.landmarks.right * scale),
            top: round(y + asset.landmarks.seatY * scale), bottom: body.bounds.bottom },
    };
    let parts = kit.parts.map(p => p === body ? replacement : p);
    // The generic promoted pipette is too long for this cavity. Recover the
    // exact SKU's existing photographic layer and retain its aspect ratio.
    const source = pipetteSources.find(p => p.websiteSku === kit.sku);
    const fitment = parts.find(p => p.slot === 'fitment');
    const pipettes = parts.filter(p => p.slot === 'pipette' && source && fitment &&
        p.image.url === source.expectedUrl && p.image.width === source.expectedWidth && p.image.height === source.expectedHeight &&
        Math.abs(p.box.x - (kit.anchors.axisX - source.expectedAnchor.x * sourceScale * plate.pxPerMm / source.expectedPxPerMm)) < 0.02 &&
        Math.abs(p.box.y - (kit.anchors.seatY - source.expectedAnchor.y * sourceScale * plate.pxPerMm / source.expectedPxPerMm)) < 0.02);
    if (pipettes.length) {
        const photo = source!;
        const photoScale = (replacement.bounds.bottom - replacement.bounds.top) / (photo.sourceBodyBounds.bottom - photo.sourceBodyBounds.top);
        const px = kit.anchors.axisX - (photo.sourceBounds.left + photo.sourceBounds.right) / 2 * photoScale;
        const floor = y + (plate.bodyId.includes('-50ml-') ? 1360 : 1410) * scale;
        const py = Math.min(fitment!.bounds.bottom - 4 - photo.sourceBounds.top * photoScale,
            floor - 3 - photo.sourceBounds.bottom * photoScale);
        const pipette = { ...pipettes[0], image: { url: photo.url, key: photo.url, sha256: photo.sha256, bytes: photo.bytes, width: photo.width, height: photo.height },
            box: { x: round(px), y: round(py), width: round(photo.width * photoScale), height: round(photo.height * photoScale) },
            bounds: { left: round(px + photo.sourceBounds.left * photoScale), right: round(px + photo.sourceBounds.right * photoScale),
                top: round(py + photo.sourceBounds.top * photoScale), bottom: round(py + photo.sourceBounds.bottom * photoScale) } };
        parts = parts.filter(p => !pipettes.includes(p));
        parts.splice(parts.indexOf(replacement) + 1, 0, pipette);
        parts = parts.map((p, zOrder) => ({ ...p, zOrder }));
    }
    // Exact captured reducer SKUs only. The bare Builder stage filters this
    // separate insert out. This is proposed image seating, not a measured bore.
    if (reducer.websiteSkus.includes(kit.sku) && !parts.some(p => p.slot === 'reducer')) {
        const width = (replacement.bounds.right - replacement.bounds.left) * (plate.bodyId.includes('-50ml-') ? 0.24 : 0.19);
        const height = width * reducer.height / reducer.width;
        const box = { x: round(kit.anchors.axisX - width / 2), y: round(replacement.bounds.top + 1), width: round(width), height: round(height) };
        parts.splice(parts.indexOf(replacement) + 1, 0, { ...replacement, slot: 'reducer', explodeIndex: 1,
            componentId: 'local:18-415-reducer', views: ['sidecar', 'capon'],
            image: { url: reducer.url, key: reducer.url, sha256: reducer.sha256, bytes: reducer.bytes, width: reducer.width, height: reducer.height },
            bounds: { left: box.x, top: box.y, right: round(box.x + box.width), bottom: round(box.y + box.height) },
            box, exploded: { dx: 0, dy: 0 } });
        parts = parts.map((p, zOrder) => ({ ...p, zOrder }));
    }
    // Exact source recovery for every Empire spray SKU. Both
    // views use one continuous native PSD tube, aligned beneath its sprayer.
    const sourceTube = [empire100SprayTube, ...additionalSprayTubes].find(row => row.websiteSku === kit.sku && row.plateKey === kit.register.plateKey);
    const spray = sourceTube && parts.find(p => p.slot === 'sprayer' && p.componentId === sourceTube.componentId
        && p.image.url === sourceTube.expectedSprayerUrl);
    if (sourceTube && spray) {
        const tubeScale = (replacement.bounds.bottom - replacement.bounds.top) / sourceTube.sourceBodyHeight;
        const tx = kit.anchors.axisX - sourceTube.axisX * tubeScale;
        const ty = spray.box.y + spray.box.height * sourceTube.visibleBottomFraction - 2;
        parts = parts.map(p => p.slot === 'diptube' && sourceTube.expectedUrls.includes(p.image.url)
            ? { ...p, image: { url: sourceTube.url, key: sourceTube.url,
                sha256: sourceTube.sha256, bytes: sourceTube.bytes,
                width: sourceTube.width, height: sourceTube.height },
                box: { x: round(tx), y: round(ty), width: round(sourceTube.width * tubeScale), height: round(sourceTube.height * tubeScale) },
                bounds: { left: round(tx), top: round(ty), right: round(tx + sourceTube.width * tubeScale), bottom: round(ty + sourceTube.height * tubeScale) } }
            : p);
    }
    const pump = kit.sku === whitePumpTube.websiteSku && kit.register.plateKey === whitePumpTube.plateKey
        ? parts.find(p => p.slot === 'pump' && p.componentId === whitePumpTube.componentId && p.image.url === whitePumpTube.expectedPumpUrl)
        : undefined;
    if (pump) {
        const tubeScale = (replacement.bounds.bottom - replacement.bounds.top) / whitePumpTube.sourceBodyHeight;
        const tx = kit.anchors.axisX - whitePumpTube.axisX * tubeScale;
        const ty = pump.box.y + pump.box.height * whitePumpTube.visibleBottomFraction - 2;
        parts = parts.map(p => p.slot === 'diptube' && whitePumpTube.expectedUrls.includes(p.image.url)
            ? { ...p, image: { url: whitePumpTube.url, key: whitePumpTube.url, sha256: whitePumpTube.sha256,
                bytes: whitePumpTube.bytes, width: whitePumpTube.width, height: whitePumpTube.height },
                box: { x: round(tx), y: round(ty), width: round(whitePumpTube.width * tubeScale), height: round(whitePumpTube.height * tubeScale) },
                bounds: { left: round(tx), top: round(ty), right: round(tx + whitePumpTube.width * tubeScale), bottom: round(ty + whitePumpTube.height * tubeScale) } }
            : p);
    }
    // Follow the visible inner cavity of each generated master, not its outer
    // foot. This hides original-photo rim/base scraps carried by narrow cuts.
    const cavity = plate.bodyId.includes('-50ml-')
        ? [[354,124],[514,124],[514,410],[695,460],[650,1280],[620,1340],[565,1360],[305,1360],[250,1340],[220,1280],[168,460],[354,410]]
        : [[363,128],[507,128],[507,350],[695,422],[645,1325],[615,1380],[565,1410],[305,1410],[255,1380],[225,1325],[175,422],[363,350]];
    parts = parts.map(p => ['diptube', 'pipette'].includes(p.slot) && !p.views?.includes('exploded')
        ? { ...p, throughGlass: { clip: cavity.map(([cx,cy]) => [round(x+cx*scale),round(y+cy*scale)] as [number,number]), opacity: 0.68 } } : p);
    // The 50 ml hero extraction retained only a thin edge of the vintage
    // tube. Recover its intact Photoshop pixels at the registered component
    // scale. Cut its visible length at this cavity's floor, never stretch it.
    parts = parts.map(p => {
        if (p.slot !== 'diptube' || !p.views?.includes('capon') ||
            !vintageTube.expectedUrls.includes(p.image.url) || p.image.width !== 110 || p.image.height !== 1623) return p;
        if (!kit.anchors.pxPerMm) return p;
        const tubeScale = kit.anchors.pxPerMm / vintageTube.pxPerMm;
        const tx = kit.anchors.axisX - vintageTube.axisX * tubeScale;
        const ty = replacement.bounds.top - 8;
        const floor = y + 1360 * scale - 6;
        const outline = vintageTube.outline.map(([sx,sy]) => [tx+sx*tubeScale,ty+sy*tubeScale] as [number,number]);
        const clip: Array<[number,number]> = [];
        for (let i=0;i<outline.length;i++) {
            const a=outline[(i+outline.length-1)%outline.length], b=outline[i];
            if ((a[1]<=floor)!==(b[1]<=floor)) clip.push([round(a[0]+(b[0]-a[0])*(floor-a[1])/(b[1]-a[1])),round(floor)]);
            if(b[1]<=floor) clip.push([round(b[0]),round(b[1])]);
        }
        return {...p, image:{url:vintageTube.url,key:vintageTube.url,sha256:vintageTube.sha256,bytes:vintageTube.bytes,width:vintageTube.width,height:vintageTube.height},
            box:{x:round(tx),y:round(ty),width:round(vintageTube.width*tubeScale),height:round(vintageTube.height*tubeScale)},
            bounds:{left:Math.min(...clip.map(v=>v[0])),right:Math.max(...clip.map(v=>v[0])),top:Math.min(...clip.map(v=>v[1])),bottom:round(floor)},
            throughGlass:{clip,opacity:0.68}};
    });
    return { ...kit, plateSha256: asset.sha256, parts };
}
