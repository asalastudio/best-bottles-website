"use client";

import { useEffect, useMemo } from "react";
import { useQueries } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

/** Grace memory is optional; a backend failure must not unmount the storefront. */
export function useGraceMemory(ownerKey: string) {
    const queries = useMemo(() => ({ memory: { query: api.graceMemory.getByOwner, args: { ownerKey } } }), [ownerKey]);
    const { memory } = useQueries(queries);
    const failed = memory instanceof Error;
    useEffect(() => {
        if (failed) console.warn("[Grace] Saved preferences are unavailable; continuing without memory.");
    }, [failed]);
    return (failed ? null : memory) as FunctionReturnType<typeof api.graceMemory.getByOwner> | undefined;
}
