"use client";

import { useMemo, useState } from "react";
import { componentReviewHistoryAction, refreshComponentQueueAction, saveComponentReviewAction, componentReviewChoicesAction, applyComponentReviewAction } from "@/app/team/components/actions";
import { csvCell, describeReconciliationIssue } from "@/lib/catalog/reconciliation-csv";
import { validateReview, type QueueRow, type ReviewDraft, type ReviewQueue, type SavedReview, type ComponentChoices } from "../../../convex/componentReconciliationData";
import { COMPONENT_VOCABULARY, componentSearchText } from "../../../convex/componentVocabulary";

const labels = { pending: "Pending review", needs_information: "Needs information", confirmed: "Association confirmed", correction_proposed: "Correction proposed" };
const emptyDraft: ReviewDraft = { decision: "pending", correctComponentSku: "", notes: "", sourceUrl: "" };
const inputClass = "w-full rounded border border-champagne bg-white px-3 py-2 text-sm text-obsidian";
const buttonClass = "rounded border border-champagne bg-white px-4 py-2 text-sm text-obsidian disabled:opacity-50";

function Evidence({ label, url, text }: { label: string; url: string | null; text: string | null }) {
    return <div className="rounded border border-champagne bg-white p-4">
        <h3 className="text-sm font-semibold">{label}</h3>
        <p className="mt-2 text-sm leading-6 text-slate">{text || "No source description captured. This needs clarification."}</p>
        {url && <a href={url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-muted-gold underline">Open exact source page ↗</a>}
    </div>;
}

function ReviewForm({ row, connected, onSave, saving }: { row: QueueRow; connected: boolean; onSave: (draft: ReviewDraft) => void; saving: boolean }) {
    const [draft, setDraft] = useState<ReviewDraft>(row.review ? {
        decision: row.review.decision, correctComponentSku: row.review.correctComponentSku,
        notes: row.review.notes, sourceUrl: row.review.sourceUrl,
    } : emptyDraft);
    const [history, setHistory] = useState<SavedReview[] | null>(null);
    const [error, setError] = useState("");
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [choices, setChoices] = useState<ComponentChoices | null>(null), [componentSearch, setComponentSearch] = useState("");
    const [loadingChoices, setLoadingChoices] = useState(false), [applying, setApplying] = useState(false), [applyMessage, setApplyMessage] = useState("");
    const set = (field: keyof ReviewDraft, value: string) => setDraft(current => ({ ...current, [field]: value }));
    return <div className="grid gap-5 border-t border-champagne bg-linen p-4 sm:p-6 lg:grid-cols-2">
        <div className="space-y-3">
            <h2 className="font-serif text-2xl">{row.bottleSku}</h2>
            <p className="text-sm text-slate">{row.bottleName}</p>
            <p className="text-sm"><strong>Proposed component:</strong> {row.componentSku} · {row.componentName}</p>
            <p className="text-sm">Neck: bottle {row.neck || "unknown"} / component {row.componentNeck || "unknown"}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate">{row.issues.map(issue => <li key={issue}>{describeReconciliationIssue(issue)}</li>)}</ul>
            <Evidence label="Bottle catalog evidence" url={row.sourceUrl} text={row.sourceDescription} />
            <Evidence label="Component catalog evidence" url={row.componentSourceUrl} text={row.componentSourceDescription} />
        </div>
        <form className="space-y-4" onSubmit={event => { event.preventDefault(); const problem = validateReview(draft); setError(problem ?? ""); if (!problem) onSave(draft); }}>
            <h3 className="text-lg font-semibold">Team review</h3>
            <label className="block text-sm">Decision<select className={`${inputClass} mt-1`} value={draft.decision} onChange={event => setDraft(current => ({ ...current, decision: event.target.value as ReviewDraft["decision"], correctComponentSku: event.target.value === "correction_proposed" ? current.correctComponentSku : "" }))}>
                {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            {draft.decision === "correction_proposed" && <div className="space-y-2">
                <button type="button" className={buttonClass} disabled={!connected || loadingChoices} onClick={async () => {
                    setLoadingChoices(true); const result = await componentReviewChoicesAction(row.id); setLoadingChoices(false);
                    if (result.ok) setChoices(result.choices); else setError(result.error);
                }}>{loadingChoices ? "Loading components…" : "Load components for this neck"}</button>
                {choices && <>
                    <label className="block text-sm">Find a component<input className={`${inputClass} mt-1`} value={componentSearch} onChange={e => setComponentSearch(e.target.value)} placeholder="SKU, spray top, roller ball, reducer…" /></label>
                    <label className="block text-sm">Correct component<select className={`${inputClass} mt-1`} value={draft.correctComponentSku} onChange={e => set("correctComponentSku", e.target.value)}>
                        <option value="">Choose a component</option>
                        {choices.candidates.filter(c => c.sku === draft.correctComponentSku || componentSearchText(c.name, c.kind, c.sku).includes(componentSearch.toLowerCase())).map(c => <option key={c.sku} value={c.sku}>{c.kind} · {c.sku} · {c.neck} · {c.name}</option>)}
                    </select></label>
                    <p className="text-xs text-slate">{choices.candidates.length} catalog components share this neck. Confirm the correct hardware type and source evidence before submitting.</p>
                </>}
                {!choices && <p className="text-xs text-slate">Load the current catalog list to select a part. {draft.correctComponentSku && `Saved proposal: ${draft.correctComponentSku}.`}</p>}
            </div>}
            <label className="block text-sm">Clarification or correction notes<textarea className={`${inputClass} mt-1`} rows={4} maxLength={4000} value={draft.notes} onChange={event => set("notes", event.target.value)} placeholder="Explain what is correct, what needs changing, or what evidence is missing." /></label>
            <label className="block text-sm">Supporting source URL<input type="url" className={`${inputClass} mt-1`} maxLength={1500} value={draft.sourceUrl} onChange={event => set("sourceUrl", event.target.value)} placeholder="https://www.bestbottles.com/product/…" /></label>
            <p className="text-xs leading-5 text-slate">Confirming an association records the team’s decision. Proposing a correction does not replace the component on the website. Neither decision certifies the artwork or physical fit.</p>
            {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
            <button disabled={!connected || saving} className="rounded bg-obsidian px-5 py-2.5 text-sm text-white disabled:opacity-50" type="submit">{saving ? "Saving…" : "Save team review"}</button>
            {row.review && <p className="text-xs text-slate">Last saved by {row.review.actorEmail || row.review.actorId} · {new Date(row.review.updatedAt).toLocaleString()} · Revision {row.review.revision}</p>}
            {row.review?.decision === "correction_proposed" && <div className="rounded border border-champagne p-3 text-sm">
                <p>Saved proposal: replace {row.componentSku} with <strong>{row.review.correctComponentSku}</strong> for {row.bottleSku}.</p>
                <p className="mt-2 text-xs text-slate">Submitting updates this association in Convex for PDP, Build Your Bottle and Grace’s component lookup. Images and Shopify products remain unchanged; a changed part may need artwork review.</p>
                <button type="button" className={`${buttonClass} mt-3`} disabled={!connected || !choices || applying || saving || (Object.keys(emptyDraft) as Array<keyof ReviewDraft>).some(key => draft[key] !== row.review?.[key])} onClick={async () => {
                    if (!choices || !row.review) return;
                    setApplying(true); setError(""); const result = await applyComponentReviewAction({ caseId: row.id, evidenceSha: row.evidenceSha, expectedReviewRevision: row.review.revision, expectedCatalogVersion: choices.catalogVersion }); setApplying(false);
                    if (result.ok) { setChoices(current => current ? { ...current, catalogVersion: result.catalogVersion, appliedSku: result.appliedSku } : current); setApplyMessage(result.warning || `Applied ${result.appliedSku} to the catalog association. Grace uses the updated live component lookup.`); } else setError(result.error);
                }}>{applying ? "Submitting…" : "Submit saved correction to catalog"}</button>
                {!choices && <p className="mt-2 text-xs">Load current component choices before submitting.</p>}
                {choices?.appliedSku && <p className="mt-2">Currently applied: {choices.appliedSku}</p>}
                {applyMessage && <p role="status" className="mt-2">{applyMessage}</p>}
            </div>}
            <div className="border-t border-champagne pt-3">
                <button type="button" disabled={!connected || loadingHistory} className="text-sm underline disabled:opacity-50" onClick={async () => {
                    setLoadingHistory(true); const response = await componentReviewHistoryAction(row.id); setLoadingHistory(false);
                    if (response.ok) setHistory(response.history); else setError(response.error);
                }}>{loadingHistory ? "Loading history…" : "View shared review history"}</button>
                {history && <ul className="mt-3 space-y-3 text-sm">{history.length === 0 && <li>No saved reviews yet.</li>}{history.map((item, i) => <li key={`${item.updatedAt}-${i}`} className="border-l-2 border-champagne pl-3">
                    <p>{labels[item.decision]} · {item.actorEmail || item.actorId} · {new Date(item.updatedAt).toLocaleString()}</p>
                    <p className="mt-1 text-slate">{item.notes}</p>
                    {item.correctComponentSku && <p>Proposed SKU: {item.correctComponentSku}</p>}
                    {item.sourceUrl && <a className="underline" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Review evidence ↗</a>}
                    {item.evidenceSha !== row.evidenceSha && <p className="text-xs text-slate">Review of an earlier audit; current evidence needs a new decision.</p>}
                </li>)}</ul>}
            </div>
        </form>
    </div>;
}

export default function ComponentReviewQueue({ initialQueue, initialConnected, preview }: { initialQueue: ReviewQueue; initialConnected: boolean; preview: boolean }) {
    const [queue, setQueue] = useState(initialQueue), [connected, setConnected] = useState(initialConnected);
    const [search, setSearch] = useState(""), [family, setFamily] = useState(""), [decision, setDecision] = useState("");
    const [selected, setSelected] = useState<string | null>(null), [saving, setSaving] = useState(false), [refreshing, setRefreshing] = useState(false), [message, setMessage] = useState("");
    const visible = useMemo(() => queue.rows.filter(row => (!family || row.family === family)
        && (!decision || (row.review?.decision ?? "pending") === decision)
        && `${row.bottleSku} ${row.componentSku} ${row.bottleName} ${row.componentName}`.toLowerCase().includes(search.toLowerCase())), [queue, search, family, decision]);
    const pending = queue.rows.filter(row => !row.review || ["pending", "needs_information"].includes(row.review.decision)).length;
    function download() {
        const header = ["Review ID", "Evidence version", "Audit date", "Family", "Capacity mL", "Glass", "Bottle SKU", "Fitment", "Finish", "Bottle neck", "Component SKU", "Component neck", "Audit result", "Issue to clarify", "Bottle source", "Component source", "Decision", "Correct component SKU", "Notes", "Supporting source", "Reviewer", "Reviewed at", "Shared review state"];
        const lines = visible.map(row => [row.id, row.evidenceSha, queue.checkedAt, row.family, row.capacityMl, row.glass, row.bottleSku, row.fitment, row.finish, row.neck, row.componentSku, row.componentNeck,
            row.status, row.issues.map(describeReconciliationIssue).join("; "), row.sourceUrl, row.componentSourceUrl,
            row.review ? labels[row.review.decision] : connected ? "Pending review" : "Unknown - shared database unavailable", row.review?.correctComponentSku, row.review?.notes, row.review?.sourceUrl,
            row.review?.actorEmail || row.review?.actorId, row.review ? new Date(row.review.updatedAt).toISOString() : "", connected ? "Loaded" : "Unavailable"]);
        const blob = new Blob(["\uFEFF" + [header, ...lines].map(line => line.map(csvCell).join(",")).join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "best-bottles-component-review.csv"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return <section className="mt-7">
        <div className="flex flex-wrap items-center justify-between gap-4 border-y border-champagne py-4">
            <p className="text-sm"><strong>{queue.rows.length} pilot associations</strong> across Cylinder, Circle, Round and Empire{connected ? ` · ${pending} awaiting clarification` : ""}<span className="mt-1 block text-xs text-slate">Text audit: {queue.checkedAt ? new Date(queue.checkedAt).toLocaleString() : "Not run"}. This is a sampled review, not a complete catalog audit.</span></p>
            <div className="flex gap-2"><button className={buttonClass} disabled={!visible.length} onClick={download}>Download CSV ({visible.length})</button><button className={buttonClass} disabled={preview || refreshing || saving} onClick={async () => {
                setRefreshing(true); const response = await refreshComponentQueueAction(); setRefreshing(false);
                if (response.ok) { setQueue(response.queue); setConnected(true); setSelected(null); setMessage("Shared reviews refreshed."); } else { setConnected(false); setMessage(response.error); }
            }}>{refreshing ? "Refreshing…" : "Refresh shared reviews"}</button></div>
        </div>
        {!connected && <p role="status" className="my-4 rounded border border-champagne bg-white p-4 text-sm">{preview ? "Local evidence preview. Shared decisions cannot be saved here." : "Shared review database unavailable. Showing the bundled audit evidence only; current team decisions are unknown and saving is disabled."}</p>}
        {message && <p role="status" className="my-3 text-sm">{message}</p>}
        <div className="my-5 grid gap-3 sm:grid-cols-3">
            <input aria-label="Search bottle or component" className={inputClass} placeholder="Find a bottle or component SKU" value={search} onChange={e => setSearch(e.target.value)} />
            <select aria-label="Filter family" className={inputClass} value={family} onChange={e => setFamily(e.target.value)}><option value="">All families</option>{[...new Set(queue.rows.map(row => row.family))].sort().map(f => <option key={f}>{f}</option>)}</select>
            <select aria-label="Filter review decision" className={inputClass} value={decision} disabled={!connected} onChange={e => setDecision(e.target.value)}><option value="">All review decisions</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </div>
        <div className="space-y-3">{visible.map(row => <article key={row.id} className="overflow-hidden rounded border border-champagne bg-white">
            <button type="button" aria-expanded={selected === row.id} disabled={saving} className="flex w-full flex-wrap items-start justify-between gap-3 p-4 text-left" onClick={() => setSelected(selected === row.id ? null : row.id)}>
                <span><span className="block font-semibold">{row.family} {row.capacityMl} mL · {row.glass}</span><span className="mt-1 block text-sm text-slate">{row.bottleSku} → {row.componentSku}</span><span className="mt-1 block text-xs text-slate">{row.fitment} · {row.finish}</span></span>
                <span className="text-right"><span className="block text-sm">{connected ? labels[row.review?.decision ?? "pending"] : "Review state unavailable"}</span><span className="mt-1 block text-xs text-slate">{row.status === "not_evaluated" ? "Audit not evaluated" : row.issues.length ? `${row.issues.length} points to clarify` : "Text evidence aligned"}</span><span className="mt-2 block text-sm text-muted-gold">{selected === row.id ? "Close review −" : "Review evidence +"}</span></span>
            </button>
            {selected === row.id && <ReviewForm key={`${row.id}-${row.review?.revision ?? 0}`} row={row} connected={connected} saving={saving} onSave={async draft => {
                setSaving(true); setMessage(""); const result = await saveComponentReviewAction({ caseId: row.id, evidenceSha: row.evidenceSha, expectedRevision: row.review?.revision ?? 0, draft }); setSaving(false);
                if (result.ok) { setQueue(current => ({ ...current, rows: current.rows.map(item => item.id === row.id ? { ...item, review: result.review } : item) })); setMessage("Review saved for the team. Catalog association unchanged."); } else setMessage(result.error);
            }} />}
        </article>)}{visible.length === 0 && <p className="py-10 text-center text-slate">No associations match these filters.</p>}</div>
        <details className="mt-6 rounded border border-champagne bg-white p-4"><summary className="cursor-pointer text-sm font-semibold">Component names and common terms</summary><p className="mt-3 text-sm text-slate">These terms help find the right component. Matching a name does not establish a compatible neck or fit.</p><dl className="mt-4 grid gap-4 sm:grid-cols-2">{COMPONENT_VOCABULARY.map(entry => <div key={entry.name}><dt className="text-sm font-semibold">{entry.name}</dt><dd className="mt-1 text-sm text-slate">{entry.aliases.join(", ")}</dd></div>)}</dl></details>
    </section>;
}
