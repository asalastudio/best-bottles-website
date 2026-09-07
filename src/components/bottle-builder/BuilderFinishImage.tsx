"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CATALOG_CAP_FAMILY, catalogCapKind, catalogCapPhoto, catalogCapPhotoFrame } from "@/lib/products/catalog-cap-photos";
import { isClosurePart, type BuilderConfiguration } from "@/lib/bottle-builder/model";
import BuilderImage from "./BuilderImage";

/** Show the actual photographed finish, never a whole bottle in a cap tile. */
export default function BuilderFinishImage({ config }: { config: BuilderConfiguration }) {
    const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
    const parts = (config.kit?.parts ?? []).filter(isClosurePart);
    const kind = config.fitment === "Screw Cap" || config.fitment === "Reducer" ? "plain"
        : catalogCapKind([config.fitment]);
    const preview = { id: config.id, websiteSku: config.id, label: config.closure };
    const exact = kind ? catalogCapPhoto(preview, [], kind, failed) : undefined;
    const needsComponentPhoto = !parts.length && !exact && kind !== null;
    const photos = useQuery(api.productPlates.byFamily, needsComponentPhoto
        ? { familyId: `${CATALOG_CAP_FAMILY[kind]}-${config.neck}`, limit: 200 } : "skip");
    // Some plain caps are indexed in the roll-on-cap merchandising family.
    // The shared resolver still rejects roller caps for a plain-cap choice.
    const plainCaps = useQuery(api.productPlates.byFamily, needsComponentPhoto && kind === "plain"
        ? { familyId: `roll-on-cap-${config.neck}`, limit: 200 } : "skip");
    const rows = [...(photos?.page ?? []), ...(plainCaps?.page ?? [])];
    const url = exact ?? (kind ? catalogCapPhoto(preview, rows, kind, failed) : undefined) ?? (config.finishComponent.imageUrl && !failed.has(config.finishComponent.imageUrl) ? config.finishComponent.imageUrl : undefined);

    if (parts.length) return <BuilderImage config={config} parts={parts} label={config.closure} thumbnail />;
    if (!url) return <span role="img" aria-label={`${config.closure} — cap photo unavailable`}>Cap photo coming soon</span>;
    const frame = catalogCapPhotoFrame(url);
    // Component photos are already published at their own native aspect ratio.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={config.closure} loading="lazy" onError={() => setFailed(current => new Set([...current, url]))}
        style={frame ? { position: "absolute", maxWidth: "none", ...frame }
            : { width: "100%", height: "100%", objectFit: "contain" }} />;
}
