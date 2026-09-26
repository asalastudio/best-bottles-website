export type GraceMemoryDestination = {
    href: string;
    title: string;
    sku?: string;
    at: number;
};

export type GraceMemoryCorrection = {
    text: string;
    at: number;
};

export type GraceMemoryNote = {
    profile?: string;
    lastCorrection?: GraceMemoryCorrection;
    lastDestination?: GraceMemoryDestination;
    updatedAt: number;
};

const PROFILE_MAX = 400;
const CORRECTION_MAX = 400;
const TITLE_MAX = 120;

export function clipMemoryText(value: string, max: number): string {
    const trimmed = value.trim();
    if (trimmed.length <= max) return trimmed;
    return `${trimmed.slice(0, max - 1)}…`;
}

export function formatGraceMemoryLines(note: GraceMemoryNote | null | undefined): string[] {
    if (!note) return [];
    const lines = ["MEMORY:"];
    if (note.profile?.trim()) {
        lines.push(`Profile: ${clipMemoryText(note.profile, PROFILE_MAX)}`);
    }
    if (note.lastCorrection?.text.trim()) {
        lines.push(`Last correction: ${clipMemoryText(note.lastCorrection.text, CORRECTION_MAX)}`);
    }
    if (note.lastDestination?.href.trim()) {
        const title = note.lastDestination.title.trim()
            ? clipMemoryText(note.lastDestination.title, TITLE_MAX)
            : "previous page";
        const sku = note.lastDestination.sku?.trim() ? ` SKU ${note.lastDestination.sku.trim()}` : "";
        lines.push(`Last destination: ${title} (${note.lastDestination.href})${sku}`);
    }
    if (lines.length === 1) return [];
    lines.push("Honor the last correction. Treat last destination as history unless they are still on that URL.");
    return lines;
}

export type RememberNoteKind = "profile" | "correction" | "destination";

function isSiteRelativePath(value: string): boolean {
    return value.startsWith("/") && !value.startsWith("//");
}

/**
 * The path a destination note stores. The model often calls the tool with
 * `href: null` after moving the customer, and the Convex mutation then rejects
 * the note ("Destination must be a site-relative path"); the page the customer
 * is on is the destination in that case. A full URL on our own origin is
 * reduced to its path. Profile and correction notes carry no path.
 */
export function resolveRememberNoteHref({
    kind,
    href,
    currentPath,
}: {
    kind: RememberNoteKind;
    href?: string | null;
    currentPath?: string | null;
}): string | null {
    if (kind !== "destination") return null;
    const candidate = (href ?? "").trim();
    if (isSiteRelativePath(candidate)) return candidate;
    if (/^https?:\/\//i.test(candidate)) {
        try {
            const url = new URL(candidate);
            const path = `${url.pathname}${url.search}`;
            if (isSiteRelativePath(path)) return path;
        } catch {
            /* not a URL after all */
        }
    }
    const fallback = (currentPath ?? "").trim();
    return isSiteRelativePath(fallback) ? fallback : null;
}

export function normalizeRememberNoteKind(value: unknown): RememberNoteKind | null {
    if (value === "profile" || value === "correction" || value === "destination") return value;
    return null;
}
