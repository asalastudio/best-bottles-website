/**
 * Links inside Grace's chat text.
 *
 * The text fallback (askGrace, GPT-5 with the six catalogue tools) has no
 * browser tools, so since 2026-09-26 its prompt tells it to share product
 * pages as markdown links built from the tool rows. The chat bubble rendered
 * plain text, so those links have to be found and turned into anchors here.
 *
 * Only site-relative paths are linked (a single leading slash, no scheme, no
 * protocol-relative `//`). Anything else stays text.
 */

export type GraceMessageSegment =
    | { type: "text"; text: string }
    | { type: "link"; label: string; href: string };

const MARKDOWN_LINK = /\[([^\]\n]{1,200})\]\((\/[^\s)]*)\)/g;
const BARE_PATH = /(^|[\s(])(\/(?:products|catalog|matrix|request-quote|request-sample|contact)(?:\/[^\s)<>"']*)?(?:\?[^\s)<>"']*)?)/g;

function isSiteRelative(href: string): boolean {
    return href.startsWith("/") && !href.startsWith("//");
}

/** Trailing sentence punctuation is not part of a bare path Grace typed. */
function trimBarePath(path: string): string {
    return path.replace(/[.,;:!?]+$/, "");
}

/** Splits a message into text and link segments. Text-only input yields one text segment. */
export function splitGraceMessageLinks(text: string): GraceMessageSegment[] {
    if (!text) return [];
    const segments: GraceMessageSegment[] = [];
    let cursor = 0;
    const pushText = (chunk: string) => {
        if (!chunk) return;
        for (const part of splitBarePaths(chunk)) segments.push(part);
    };
    for (const match of text.matchAll(MARKDOWN_LINK)) {
        const [whole, label, href] = match;
        const start = match.index ?? 0;
        if (!isSiteRelative(href)) continue;
        pushText(text.slice(cursor, start));
        segments.push({ type: "link", label: label.trim() || href, href });
        cursor = start + whole.length;
    }
    pushText(text.slice(cursor));
    return segments;
}

function splitBarePaths(chunk: string): GraceMessageSegment[] {
    const out: GraceMessageSegment[] = [];
    let cursor = 0;
    for (const match of chunk.matchAll(BARE_PATH)) {
        const [, lead, rawPath] = match;
        const start = (match.index ?? 0) + lead.length;
        const path = trimBarePath(rawPath);
        if (!isSiteRelative(path)) continue;
        out.push({ type: "text", text: chunk.slice(cursor, start) });
        out.push({ type: "link", label: path, href: path });
        cursor = start + path.length;
    }
    out.push({ type: "text", text: chunk.slice(cursor) });
    return out.filter((segment) => segment.type === "link" || segment.text.length > 0);
}

/** True when the message carries at least one site link. */
export function graceMessageHasLinks(text: string): boolean {
    return splitGraceMessageLinks(text).some((segment) => segment.type === "link");
}
