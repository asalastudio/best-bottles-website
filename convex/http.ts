import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { MAX_CERTIFICATE_BYTES } from "./certificateDocuments";

const http = httpRouter();
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-store" };
http.route({ path: "/certificate-upload", method: "OPTIONS", handler: httpAction(async () => new Response(null, { headers: cors, status: 204 })) });
http.route({ path: "/certificate-upload", method: "POST", handler: httpAction(async (ctx, request) => {
    let stored: Awaited<ReturnType<typeof ctx.storage.store>> | undefined;
    try {
        const ticket = request.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
        if (!/^[a-f0-9]{64}$/.test(ticket)) return new Response("Upload unauthorized", { status: 401, headers: cors });
        const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ticket));
        const ticketHash = Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, "0")).join("");
        const documentId = await ctx.runMutation(internal.certificateDocuments.claim, { ticketHash });
        const type = request.headers.get("Content-Type") ?? "";
        if (!["application/pdf", "image/png", "image/jpeg"].includes(type)) return new Response("Unsupported document", { status: 415, headers: cors });
        const reader = request.body?.getReader();
        if (!reader) return new Response("Empty document", { status: 400, headers: cors });
        const chunks: Uint8Array<ArrayBuffer>[] = [];
        let size = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > MAX_CERTIFICATE_BYTES) { await reader.cancel(); return new Response("Document too large", { status: 413, headers: cors }); }
            chunks.push(new Uint8Array(value));
        }
        if (!size) return new Response("Empty document", { status: 400, headers: cors });
        stored = await ctx.storage.store(new Blob(chunks, { type }));
        await ctx.runMutation(internal.certificateDocuments.uploaded, { documentId, storageId: stored });
        return Response.json({ documentId }, { headers: cors });
    } catch {
        // Delete only an unregistered blob created by this request, never historical files.
        if (stored) await ctx.storage.delete(stored);
        return new Response("Upload did not complete. Request a new upload.", { status: 400, headers: cors });
    }
}) });
export default http;
