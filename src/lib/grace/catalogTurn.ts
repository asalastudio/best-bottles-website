import { preserveVerifiedGraceCatalogView } from "./refineState";

export type GraceCatalogTicket = Readonly<{ generation: number; revision: number; request: string }>;
export const STALE_CATALOG_ACTION = "This catalogue action was superseded or interrupted. Do not apply its results or navigate from them.";

/** Tickets bind async catalogue work to one customer turn and refinement revision. */
export class GraceCatalogTurn {
    private generation = 0;
    private revision = 0;
    private request = "";
    private active = false;
    private voiceItemId: string | null = null;
    private verified: { ticket: GraceCatalogTicket; message: string } | null = null;

    constructor(private readonly clearPendingDisplays: () => void = () => {}) {}

    begin(request: string): void {
        this.invalidate();
        this.request = request;
        this.active = true;
    }

    beginVoice(itemId: string): void {
        if (this.active && this.voiceItemId === itemId) return;
        this.begin("");
        this.voiceItemId = itemId;
    }

    /** Transcription is asynchronous: enrich its existing turn, never start one. */
    completeVoiceTranscript(itemId: string | undefined, request: string): boolean {
        if (!this.active || !itemId || this.voiceItemId !== itemId) return false;
        this.request = request;
        return true;
    }

    interrupt(): void { this.invalidate(); }

    private invalidate(): void {
        this.generation++;
        this.active = false;
        this.voiceItemId = null;
        this.verified = null;
        this.clearPendingDisplays();
    }

    capture(): GraceCatalogTicket {
        return { generation: this.generation, revision: this.revision, request: this.request };
    }

    beginRefinement(): GraceCatalogTicket {
        this.revision++;
        this.verified = null;
        this.clearPendingDisplays();
        return this.capture();
    }

    isTurnCurrent(ticket: GraceCatalogTicket): boolean {
        return this.active && ticket.generation === this.generation;
    }

    isCurrent(ticket: GraceCatalogTicket): boolean {
        return this.isTurnCurrent(ticket) && ticket.revision === this.revision;
    }

    commitRefinement(ticket: GraceCatalogTicket, message: string, apply: () => void): boolean {
        if (!this.isCurrent(ticket)) return false;
        apply();
        this.verified = { ticket, message };
        return true;
    }

    displayBlock(ticket: GraceCatalogTicket): string | null {
        if (!this.isCurrent(ticket)) return STALE_CATALOG_ACTION;
        if (this.verified && this.isCurrent(this.verified.ticket)
            // A matching late transcript enriches this generation without
            // invalidating work captured before the transcript was available.
            && preserveVerifiedGraceCatalogView(this.request, this.request)) {
            return `${this.verified.message} Keep this requested catalogue view open; do not replace it with a single product page.`;
        }
        return null;
    }

    applyDisplay(ticket: GraceCatalogTicket, apply: () => void): boolean {
        if (this.displayBlock(ticket)) return false;
        apply();
        return true;
    }
}
