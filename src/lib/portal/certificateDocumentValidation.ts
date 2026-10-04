import "server-only";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

export const MAX_CERTIFICATE_BYTES = 15 * 1024 * 1024;
/** Structural readability, not legal authenticity or a malware certification. */
export async function validateCertificateBytes(bytes: Uint8Array, contentType: string) {
    if (!bytes.length || bytes.length > MAX_CERTIFICATE_BYTES) throw new Error("invalid_document_size");
    if (contentType === "application/pdf") {
        if (Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-") throw new Error("invalid_document_type");
        const pdf = await PDFDocument.load(bytes, { throwOnInvalidObject: true, updateMetadata: false });
        if (pdf.isEncrypted || pdf.getPageCount() < 1 || pdf.getPageCount() > 100) throw new Error("unreadable_document");
        for (const page of pdf.getPages()) {
            const { width, height } = page.getSize();
            if (!(width > 0 && height > 0)) throw new Error("unreadable_document");
        }
    } else if (contentType === "image/png" || contentType === "image/jpeg") {
        const img = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "warning" });
        const meta = await img.metadata();
        if (meta.format !== (contentType === "image/png" ? "png" : "jpeg")) throw new Error("invalid_document_type");
        await img.resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).raw().toBuffer();
    } else throw new Error("invalid_document_type");
    return { contentType, size: bytes.length };
}

export async function readBoundedDocument(response: Response) {
    if (!response.ok || !response.body) throw new Error("document_not_available");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_CERTIFICATE_BYTES) { await reader.cancel(); throw new Error("invalid_document_size"); }
        chunks.push(value);
    }
    return Buffer.concat(chunks);
}
