import candidate from './local-empire-white-pump.json';
import candidate100 from './local-empire-100ml-white-pump.json';
import type { RegisterStagePayload } from './stage-kit';

/** Review-only completion of this exact unresolved SKU. Never replaces a released assembly. */
export function localEmpireWhitePumpPayload(payload: RegisterStagePayload): RegisterStagePayload {
    if (process.env.NODE_ENV !== 'development' || process.env.VERCEL) return payload;
    return [candidate, candidate100].reduce(completeCandidate, payload);
}

function completeCandidate(payload: RegisterStagePayload, candidate: Pick<typeof candidate100,
    'websiteSku' | 'graceSku' | 'expectedAssembly' | 'expectedPlate' | 'component'>): RegisterStagePayload {
    const expected = candidate.expectedAssembly;
    const assembly = payload.assemblies[candidate.graceSku];
    const plate = payload.plates[expected.plateKey];
    if (!assembly || assembly.renderable || assembly.parts.length ||
        assembly.websiteSku !== candidate.websiteSku || assembly.bodyId !== expected.bodyId ||
        assembly.plateKey !== expected.plateKey || assembly.neck !== expected.neck || assembly.glass !== expected.glass ||
        !plate?.approved || plate.url !== candidate.expectedPlate.url ||
        plate.width !== candidate.expectedPlate.width || plate.height !== candidate.expectedPlate.height ||
        plate.pxPerMm !== candidate.expectedPlate.pxPerMm ||
        !Object.entries(candidate.expectedPlate.anchors).every(([k, v]) => plate.anchors[k as keyof typeof plate.anchors] === v)) return payload;
    return {
        ...payload,
        assemblies: { ...payload.assemblies, [candidate.graceSku]: {
            ...assembly, renderable: true, reason: null,
            parts: [{ role: 'pump', componentId: candidate.component.componentId }],
        } },
        // approved here enables the local renderer; owner visual approval is tracked separately in the manifest.
        components: { ...payload.components, [candidate.component.componentId]: candidate.component as unknown as RegisterStagePayload['components'][string] },
    };
}
