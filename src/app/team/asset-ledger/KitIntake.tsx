"use client";

import { useState } from "react";
import Link from "next/link";
import intake from "../../../../data/asset-ledger/boston-kit-intake.json";
import release from "../../../../data/asset-ledger/boston-kit-release.json";

export default function KitIntake() {
    const [lane, setLane] = useState("reuse");
    const [size, setSize] = useState("all");
    const rows = intake.rows.filter(row => row.lane === lane && (size === "all" || String(row.capacityMl) === size));
    const releaseBySku = new Map(release.rows.map(row => [row.sku, row]));
    const approvedCount = release.rows.filter(row => row.approval?.status === "approved").length;
    const pendingCount = release.rows.filter(row => row.approval?.status !== "approved").length;
    const liveCount = release.publicationAuthorized ? approvedCount : 0;
    const releaseLabel = release.publicationAuthorized ? "Live kit · published" : "Approved release row · publication pending ship";
    return <main className="mx-auto max-w-7xl px-4 py-8 text-[#243b30] sm:px-8">
        <Link href="/team/asset-ledger?preview=1" className="underline">← Asset workbench</Link>
        <h1 className="mt-5 font-serif text-4xl">Boston Round · Kits</h1>
        <p className="mt-3 max-w-3xl">First, reuse the existing work. Compare the indexed plate with its saved kit reconstruction, then inspect the separated parts where applicable. Droppers stay assembled. Boston rollers stay seated in the glass, with cap-off viewing where available. These are initial comparisons; component files and interactive behavior still need validation before kit approval.</p>
        <div className="my-6 flex flex-wrap gap-3" role="group" aria-label="Kit work queue">
            {[["reuse", "1. Reuse first · 21"], ["realign", "2. Realign · 4"], ["prepare", "3. Prepare missing kits · 98"]].map(([id, label]) => <button key={id} onClick={() => setLane(id)} aria-pressed={lane === id} className={`rounded-lg border-2 px-4 py-3 font-semibold ${lane === id ? "border-[#243b30] bg-[#243b30] text-white" : "border-amber-300 bg-amber-50"}`}>{label}</button>)}
        </div>
        <section className="mb-6 rounded-xl border border-emerald-400 bg-emerald-50 p-4"><h2 className="text-xl font-semibold">Boston kit release is approved</h2><p className="my-2">{approvedCount} kits are approved against exact plate hashes. {pendingCount} source-qualified candidates remain pending batch review. The approved batch does not need to be tested again.</p><div className="flex flex-wrap gap-3"><Link className="inline-block rounded-lg bg-[#243b30] px-4 py-3 font-semibold text-white" href="/products/boston-round-30ml-amber-20-400-rollon?sku=GBBstnAmb1ozMtlRollonMattBlk&assetPreview=boston">Open the approved pilot →</Link><a className="inline-block rounded-lg border border-[#243b30] px-4 py-3 font-semibold" href="/reviews/boston-kit-release-2026-09-12/comparison.html">Open the 25-row contact sheet →</a></div></section>
        <label className="block">Bottle size <select className="ml-3 rounded border border-gray-400 bg-white p-2" value={size} onChange={event => setSize(event.target.value)}><option value="all">All sizes</option>{[15, 30, 60].map(value => <option key={value} value={value}>{value} mL</option>)}</select></label>
        <p className="my-4">Showing {rows.length} configurations. Live Boston kits: <strong>{liveCount}</strong>. Release-ready approvals: <strong>{approvedCount}</strong>. Pending batch review: <strong>{pendingCount}</strong>. Kit approvals remain separate from plate approvals.</p>
        {lane === "realign" && <p className="mb-5 rounded-lg bg-amber-100 p-4">These four comparisons use the older indexed plate. Rebuild their registration against the corrected plate before approving a kit.</p>}
        {lane === "prepare" && <p className="mb-5 rounded-lg bg-amber-100 p-4">Keep every configuration accounted for. A recorded hold needs source reconciliation; it does not mean the master artwork is missing.</p>}
        <div className="space-y-8">{rows.map(row => { const built = releaseBySku.get(row.sku); const approved = built?.approval?.status === "approved"; return <article key={row.sku} className={`rounded-xl border-2 ${approved ? "border-emerald-500" : "border-gray-300"} bg-white p-4 sm:p-6`}>
            <p className={`text-sm font-semibold ${approved ? "text-emerald-700" : "text-amber-800"}`}>{approved ? releaseLabel : row.lane === "reuse" ? "Existing candidate · batch review pending" : row.lane === "realign" ? "Sizing update needed" : "Kit preparation pending"}</p>
            <h2 className="mt-2 font-serif text-2xl">{row.capacityMl} mL · {row.color} · {row.applicator} · {row.capColor}</h2>
            <p className="mt-2 break-words text-sm">{row.sku}</p>
            {row.componentConcern && <p className="mt-3 rounded-lg bg-amber-100 p-3 font-medium">Component review needed: {row.componentConcern}</p>}
            {row.images.length > 0 ? <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-5">{row.images.filter(img => !row.presentation || img.label !== "Existing separated-parts preview").map(img => <figure key={img.sha256}><figcaption className="min-h-12 text-xs font-semibold sm:text-sm">{img.label}</figcaption>{/* Existing review bytes displayed at equal width; no image transformations. */}<img src={img.url} alt={`${row.capacityMl} mL ${row.color}: ${img.label}`} loading="lazy" className="h-auto w-full" /></figure>)}{row.presentation === "assembled-only" && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-950"><strong>Assembled-only dropper</strong><br />Finish swatches change the complete photographed configuration. No exploded view or exposed pipette is required.</p>}{row.presentation === "roller-seated" && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-950"><strong>Roller stays seated</strong><br />View the matching cap-off photo to see the roller installed in the glass. The cropped lower plug is never shown floating.</p>}</div> : <p className="my-4">{row.reason || "Prepare verified parts against the corresponding plate."}</p>}
            {row.images.length > 0 && <details className="mt-4 text-sm"><summary className="cursor-pointer">Source and review evidence</summary><p className="mt-2 break-all">Master source: {row.sourcePath}</p><p className="break-all">Source SHA-256: {row.sourceSha256}</p>{row.presentationReason && <p className="mt-2">{row.presentationReason}</p>}<p className="mt-2">Component files freshly validated: No. These previews preserve the previous extraction for comparison.</p>{row.reviewNotes?.map(note => <p key={note}>{note}</p>)}</details>}
            <Link className="mt-4 inline-block underline" href={`/products/${row.groupSlug}?sku=${encodeURIComponent(row.sku)}&assetPreview=boston`}>Open product preview</Link>
        </article>; })}</div>
        <p className="mt-8 text-sm">Release manifest: {release.id}. {release.publicationAuthorized ? "Kit media and Convex rows are live for this release." : "No kit media or Convex rows are published until the exact kit ship instruction is given."}</p>
    </main>;
}
