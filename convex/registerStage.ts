import { query } from "./_generated/server";
import { type Infer, v } from "convex/values";
import { registerSlotV } from "./registerValidators";

/**
 * Component register, Phase 5: what a stage needs to draw SKUs from the
 * register (docs/COMPONENT_REGISTER_PHASE_4_RENDERER.md, "Phase 5").
 *
 * One round trip for up to 50 Grace SKUs of one page or one builder body:
 * the body plates and component layers those SKUs share, each returned ONCE
 * and keyed, plus a per-SKU assembly saying which plate and which parts it
 * draws. Geometry and URLs only; the register's provenance stays in
 * register:composition. A SKU is `renderable` when its own parts resolved,
 * its plate is approved and every layer it draws is approved; a consumer
 * keeps drawing the legacy kit for anything else.
 */

const anchorsV = v.object({ axisX: v.number(), seatY: v.number(), baselineY: v.number(), shoulderY: v.union(v.number(), v.null()) });

const plateV = v.object({
    plateKey: v.string(),
    bodyId: v.string(),
    glass: v.string(),
    url: v.string(),
    width: v.number(),
    height: v.number(),
    pxPerMm: v.number(),
    anchors: anchorsV,
    approved: v.boolean(),
});

const layerV = v.object({
    slot: registerSlotV,
    z: v.union(v.literal("behind-body"), v.literal("front")),
    explodeIndex: v.number(),
    url: v.string(),
    width: v.number(),
    height: v.number(),
    pxPerMm: v.number(),
    anchor: v.object({ x: v.number(), y: v.number() }),
    approved: v.boolean(),
});

const componentV = v.object({
    componentId: v.string(),
    type: v.string(),
    layers: v.array(layerV),
    approved: v.boolean(),
});

const bodyV = v.object({
    bodyId: v.string(),
    family: v.string(),
    capacityMl: v.union(v.number(), v.null()),
    neck: v.string(),
    dims: v.object({
        heightBareMm: v.union(v.number(), v.null()),
        diameterMm: v.union(v.number(), v.null()),
        widthMm: v.union(v.number(), v.null()),
    }),
});

const assemblyV = v.object({
    graceSku: v.string(),
    websiteSku: v.union(v.string(), v.null()),
    bodyId: v.string(),
    plateKey: v.string(),
    glass: v.string(),
    neck: v.string(),
    parts: v.array(v.object({ role: v.string(), componentId: v.string() })),
    renderable: v.boolean(),
    reason: v.union(v.string(), v.null()),
});

export const stagePayloadV = v.object({
    plates: v.record(v.string(), plateV),
    components: v.record(v.string(), componentV),
    bodies: v.record(v.string(), bodyV),
    assemblies: v.record(v.string(), v.union(assemblyV, v.null())),
});

const MAX_SKUS_PER_LOOKUP = 50;

export const forSkus = query({
    args: { graceSkus: v.array(v.string()) },
    returns: stagePayloadV,
    handler: async (ctx, args) => {
        const plates: Record<string, Infer<typeof plateV>> = {};
        const components: Record<string, Infer<typeof componentV>> = {};
        const bodies: Record<string, Infer<typeof bodyV>> = {};
        const assemblies: Record<string, Infer<typeof assemblyV> | null> = {};
        const missingComponents = new Set<string>();

        for (const graceSku of [...new Set(args.graceSkus)].slice(0, MAX_SKUS_PER_LOOKUP)) {
            const assembly = await ctx.db.query("registerAssemblies").withIndex("by_graceSku", (q) => q.eq("graceSku", graceSku)).first();
            if (!assembly) { assemblies[graceSku] = null; continue; }

            if (!(assembly.plateKey in plates)) {
                const plate = await ctx.db.query("registerBodyPlates").withIndex("by_plateKey", (q) => q.eq("plateKey", assembly.plateKey)).first();
                if (plate) {
                    plates[assembly.plateKey] = {
                        plateKey: plate.plateKey, bodyId: plate.bodyId, glass: plate.glass,
                        url: plate.image.url, width: plate.image.width, height: plate.image.height,
                        pxPerMm: plate.pxPerMm, anchors: plate.anchors, approved: plate.anchorStatus === "approved",
                    };
                }
            }
            if (!(assembly.bodyId in bodies)) {
                const body = await ctx.db.query("registerBodies").withIndex("by_bodyId", (q) => q.eq("bodyId", assembly.bodyId)).first();
                if (body) {
                    bodies[assembly.bodyId] = {
                        bodyId: body.bodyId, family: body.family, capacityMl: body.capacityMl, neck: body.neck,
                        dims: { heightBareMm: body.dims.heightBareMm, diameterMm: body.dims.diameterMm, widthMm: body.dims.widthMm },
                    };
                }
            }
            for (const part of assembly.build.parts) {
                if (part.componentId in components || missingComponents.has(part.componentId)) continue;
                const component = await ctx.db.query("registerComponents").withIndex("by_componentId", (q) => q.eq("componentId", part.componentId)).first();
                if (!component) { missingComponents.add(part.componentId); continue; }
                components[part.componentId] = {
                    componentId: component.componentId,
                    type: component.type,
                    layers: component.layers.map((layer) => ({
                        slot: layer.slot, z: layer.z, explodeIndex: layer.explodeIndex,
                        url: layer.image.url, width: layer.image.width, height: layer.image.height,
                        pxPerMm: layer.pxPerMm, anchor: layer.anchor, approved: layer.anchorStatus === "approved",
                    })),
                    approved: component.layers.length > 0 && component.layersStatus === "approved",
                };
            }

            const plate = plates[assembly.plateKey];
            const reason = assembly.status === "quarantine" || assembly.status === "retired"
                ? `assembly is ${assembly.status}`
                : assembly.build.status !== "resolved"
                    ? `own parts ${assembly.build.status}${assembly.build.reason ? `: ${assembly.build.reason}` : ""}`
                    : !plate
                        ? "no body plate for this glass"
                        : !plate.approved
                            ? "body plate not approved"
                            : assembly.build.parts.length === 0
                                ? "no parts to draw"
                                : assembly.build.parts.find((part) => !components[part.componentId])
                                    ? "a part has no component record"
                                    : assembly.build.parts.find((part) => !components[part.componentId].approved)
                                        ? "a part's layers are not approved"
                                        : null;
            assemblies[graceSku] = {
                graceSku: assembly.graceSku, websiteSku: assembly.websiteSku,
                bodyId: assembly.bodyId, plateKey: assembly.plateKey, glass: assembly.glass, neck: assembly.neck,
                parts: assembly.build.parts.map((part) => ({ role: part.role, componentId: part.componentId })),
                renderable: reason === null,
                reason,
            };
        }
        return { plates, components, bodies, assemblies };
    },
});
