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

export function normalizeRememberNoteKind(value: unknown): RememberNoteKind | null {
    if (value === "profile" || value === "correction" || value === "destination") return value;
    return null;
}
