import drawings from './local-diva-rings.json';
import type { RegisterStagePayload } from './stage-kit';

/** Local source review only. Exact catalogue identities, each SKU's own PSD ring,
 * and the already measured non-ring sibling. No catalogue/reference writes. */
export function localDivaRingChunkSize(): number {
    return process.env.NODE_ENV === 'development' ? 50 - drawings.length : 50;
}

export function localDivaRingDependencies(skus: readonly string[]): string[] {
    if (process.env.NODE_ENV !== 'development') return [...skus];
    return [...new Set([...skus, ...drawings.filter(r => skus.includes(r.graceSku)).map(r => r.donorGraceSku)])];
}

export function localDivaRingPayload(payload: RegisterStagePayload): RegisterStagePayload {
    if (process.env.NODE_ENV !== 'development') return payload;
    const assemblies = { ...payload.assemblies }, components = { ...payload.components };
    let changed = false;
    for (const row of drawings) {
        const target = assemblies[row.graceSku], donor = assemblies[row.donorGraceSku];
        const plate = payload.plates[row.plateKey], expected = row.expectedPlate;
        // Prefer a future completed production assembly. Never override changed
        // product identity, body registration, or a donor's component assignment.
        if (!target || target.renderable || target.websiteSku !== row.websiteSku
            || target.bodyId !== row.bodyId || target.plateKey !== row.plateKey
            || target.glass !== 'Clear' || target.neck !== '18-415'
            || !donor?.renderable || donor.bodyId !== row.bodyId || donor.plateKey !== row.plateKey
            || donor.glass !== 'Clear' || donor.neck !== '18-415'
            || donor.parts.length !== 1 || donor.parts[0].componentId !== row.sprayerComponentId
            || donor.parts[0].role !== 'sprayer' || !plate?.approved
            || plate.url !== expected.url || plate.width !== expected.width || plate.height !== expected.height
            || plate.pxPerMm !== expected.pxPerMm
            || ['axisX','seatY','baselineY','shoulderY'].some(k => plate.anchors[k as keyof typeof plate.anchors] !== expected.anchors[k as keyof typeof expected.anchors])) continue;
        const sprayer = components[row.sprayerComponentId];
        if (!sprayer?.approved || !sprayer.layers.length) continue;
        if (row.expectedSprayer && (sprayer.type !== row.expectedSprayer.type
            || sprayer.layers.length !== row.expectedSprayer.layers.length
            || sprayer.layers.some((layer, i) => {
                const expected = row.expectedSprayer!.layers[i];
                return layer.url !== expected.url || layer.slot !== expected.slot
                    || layer.width !== expected.width || layer.height !== expected.height
                    || layer.pxPerMm !== expected.pxPerMm || layer.anchor.x !== expected.anchor.x
                    || layer.anchor.y !== expected.anchor.y || layer.z !== expected.z
                    || layer.explodeIndex !== expected.explodeIndex;
            }))) continue;
        components[row.ringComponentId] = { componentId: row.ringComponentId, type: 'ring', approved: true,
            layers: [{ slot: 'ring', url: row.url, width: row.width, height: row.height,
                pxPerMm: row.pxPerMm, anchor: row.anchor, z: 'front', explodeIndex: 0, approved: true }] };
        assemblies[row.graceSku] = { ...target, parts: [...donor.parts, { role: 'ring', componentId: row.ringComponentId }],
            renderable: true, reason: null };
        changed = true;
    }
    return changed ? { ...payload, assemblies, components } : payload;
}
