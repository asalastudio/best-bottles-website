import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
vi.mock("server-only", () => ({}));
import { validateCertificateBytes, readBoundedDocument, MAX_CERTIFICATE_BYTES } from "../src/lib/portal/certificateDocumentValidation";
describe("certificate structural readability", () => {
    it("accepts a real generated PDF and decodable image", async () => {
        const pdf = await PDFDocument.create(); pdf.addPage();
        const bytes = await pdf.save();
        expect(await validateCertificateBytes(bytes, "application/pdf")).toMatchObject({ size: bytes.length });
        const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "white" } }).png().toBuffer();
        expect(await validateCertificateBytes(png, "image/png")).toMatchObject({ size: png.length });
        await expect(validateCertificateBytes(png, "image/jpeg")).rejects.toThrow(/type/);
        await expect(validateCertificateBytes(png.subarray(0, 20), "image/png")).rejects.toThrow();
    });
    it("rejects forged types, empty, oversized and malformed documents", async () => {
        await expect(validateCertificateBytes(new Uint8Array(), "application/pdf")).rejects.toThrow(/size/);
        await expect(validateCertificateBytes(new Uint8Array(MAX_CERTIFICATE_BYTES + 1), "application/pdf")).rejects.toThrow(/size/);
        await expect(validateCertificateBytes(Buffer.from("<html>not a pdf</html>"), "application/pdf")).rejects.toThrow(/type/);
        await expect(validateCertificateBytes(Buffer.from("%PDF-1.7\nnot a document"), "application/pdf")).rejects.toThrow();
    });
    it("bounds a download even when Content-Length is missing or incorrect", async () => {
        const cancel = vi.fn();
        const response = new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(MAX_CERTIFICATE_BYTES + 1)); }, cancel }));
        await expect(readBoundedDocument(response)).rejects.toThrow(/size/);
        expect(cancel).toHaveBeenCalledOnce();
    });
});
