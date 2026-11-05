// Kept apart from openaiRealtimeAdapter.ts so callers can test `instanceof`
// without pulling the OpenAI Agents realtime SDK into the first page load.

/** The live Realtime transport is gone; reconnect before sending again. */
export class GraceRealtimeDisconnectedError extends Error {
    constructor(message = "Grace Realtime is not connected.") {
        super(message);
        this.name = "GraceRealtimeDisconnectedError";
    }
}

export class GraceRealtimeConnectionCancelledError extends Error {
    constructor() {
        super("Grace Realtime connection was cancelled.");
        this.name = "GraceRealtimeConnectionCancelledError";
    }
}
