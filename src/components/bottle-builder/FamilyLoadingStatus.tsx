"use client";
export default function FamilyLoadingStatus({ status, onRetry }: { status: "loading" | "ready" | "error"; onRetry: () => void }) {
    if (status === "ready") return null;
    return <div className="text-sm text-[#615b52]" role="status">
        {status === "loading" ? "Loading other bottle families…" : <><span>Other bottle families couldn’t load. </span><button type="button" className="min-h-11 px-2 underline underline-offset-4" onClick={onRetry}>Try again</button></>}
    </div>;
}
