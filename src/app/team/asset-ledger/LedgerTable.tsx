"use client";

import { useMemo, useState } from "react";
import type { CompactRow, Kind } from "@/lib/asset-ledger/types";

const LIMIT = 400;

export default function LedgerTable({ rows, states }: { rows: CompactRow[]; states: Record<Kind, Record<string, string>> }) {
    const [q, setQ] = useState("");
    const [family, setFamily] = useState("");
    const [hero, setHero] = useState("");
    const [plate, setPlate] = useState("");
    const [kit, setKit] = useState("");

    const families = useMemo(() => [...new Set(rows.map((r) => r.family))].sort(), [rows]);
    const uniq = (kind: Kind) => [...new Set(rows.map((r) => r[kind]))].sort();
    const [heroOpts, plateOpts, kitOpts] = useMemo(() => [uniq("hero"), uniq("plate"), uniq("kit")], [rows]); // eslint-disable-line react-hooks/exhaustive-deps

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return rows.filter((r) =>
            (!family || r.family === family) && (!hero || r.hero === hero) && (!plate || r.plate === plate) && (!kit || r.kit === kit) &&
            (!needle || r.sku.toLowerCase().includes(needle) || (r.groupSlug ?? "").includes(needle) || r.heroDetail.toLowerCase().includes(needle) || r.kitDetail.toLowerCase().includes(needle)));
    }, [rows, q, family, hero, plate, kit]);

    const select = (value: string, set: (v: string) => void, options: string[], label: string, kind?: Kind) => (
        <label className="flex flex-col text-xs text-slate">
            {label}
            <select value={value} onChange={(e) => set(e.target.value)} className="mt-1 rounded border border-champagne bg-warm-white px-2 py-1 text-sm text-obsidian">
                <option value="">all</option>
                {options.map((o) => <option key={o} value={o} title={kind ? states[kind][o] : undefined}>{o}</option>)}
            </select>
        </label>
    );

    return (
        <div>
            <div className="mb-3 flex flex-wrap items-end gap-3">
                <label className="flex flex-col text-xs text-slate">
                    search
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="SKU, group slug, card, note" className="mt-1 w-64 rounded border border-champagne bg-warm-white px-2 py-1 text-sm text-obsidian" />
                </label>
                {select(family, setFamily, families, "family")}
                {select(hero, setHero, heroOpts, "hero", "hero")}
                {select(plate, setPlate, plateOpts, "plate", "plate")}
                {select(kit, setKit, kitOpts, "kit", "kit")}
                <span className="pb-1 text-xs text-slate">{filtered.length} of {rows.length} rows{filtered.length > LIMIT ? `, first ${LIMIT} shown` : ""}</span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-champagne bg-warm-white">
                <table className="w-full text-xs">
                    <thead className="bg-travertine text-left uppercase tracking-wide text-slate">
                        <tr>
                            <th className="px-2 py-2">SKU</th>
                            <th className="px-2 py-2">Family</th>
                            <th className="px-2 py-2">Hero</th>
                            <th className="px-2 py-2">Plate</th>
                            <th className="px-2 py-2">Kit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.slice(0, LIMIT).map((r) => (
                            <tr key={r.sku} className="border-t border-champagne/60 align-top">
                                <td className="px-2 py-1 font-mono whitespace-nowrap">
                                    {r.sku}
                                    {!r.productRecord ? <span className="ml-1 text-slate" title="no product record in Convex">?</span> : null}
                                    {r.groupSlug ? <div className="text-[10px] text-slate">{r.groupSlug}</div> : null}
                                </td>
                                <td className="px-2 py-1 whitespace-nowrap">{r.family}</td>
                                <State state={r.hero} detail={r.heroDetail} help={states.hero[r.hero]} />
                                <State state={r.plate} detail={r.plateDetail} help={states.plate[r.plate]} />
                                <State state={r.kit} detail={r.kitDetail} help={states.kit[r.kit]} />
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function State({ state, detail, help }: { state: string; detail: string; help?: string }) {
    const tone = state === "indexed" || state === "plated" || state === "live" ? "bg-muted-gold/25" : state.startsWith("approved") || state === "candidate" || state === "plated-cap-on-only" ? "bg-champagne/50" : state === "none" || state === "no-plate" || state === "not-applicable" ? "" : "bg-travertine";
    return (
        <td className="px-2 py-1">
            <span title={help} className={`inline-block rounded px-1.5 py-0.5 ${tone}`}>{state}</span>
            {detail ? <div className="mt-0.5 max-w-xs text-[10px] leading-tight text-slate">{detail}</div> : null}
        </td>
    );
}
