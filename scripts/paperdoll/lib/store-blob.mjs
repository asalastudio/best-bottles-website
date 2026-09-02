// Vercel Blob adapter for the plate store.
//
// The store is write-once: every key is content-addressed (the filename
// starts with the sha256 of the bytes), so an object that already exists is
// by definition the same bytes and the upload is skipped. Nothing here ever
// overwrites or deletes.
import { head, put } from "@vercel/blob";

const ONE_YEAR = 31536000;

export function createBlobStore({ token = process.env.BLOB_READ_WRITE_TOKEN } = {}) {
    if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not set (the importer needs it; the site never does)");
    return {
        provider: "vercel-blob",

        /** Upload bytes under an exact key. Returns the public URL. Idempotent on an existing key. */
        async putObject(key, bytes, contentType) {
            try {
                const blob = await put(key, bytes, {
                    access: "public",
                    addRandomSuffix: false,
                    allowOverwrite: false,
                    contentType,
                    cacheControlMaxAge: ONE_YEAR,
                    token,
                });
                return { url: blob.url, existed: false };
            } catch (error) {
                if (String(error?.message ?? error).toLowerCase().includes("already exists")) {
                    const existing = await this.headObject(key);
                    if (!existing) throw error;
                    return { url: existing.url, existed: true };
                }
                throw error;
            }
        },

        /** Metadata for a key, or null. Keys are looked up by pathname on the store. */
        async headObject(key) {
            try {
                const meta = await head(key, { token });
                return { url: meta.url, size: meta.size, contentType: meta.contentType };
            } catch (error) {
                if (String(error?.message ?? error).toLowerCase().includes("not found")) return null;
                throw error;
            }
        },
    };
}

/**
 * The gate the importer applies before it writes a row: the PUBLIC url must
 * answer 200 with the expected type and length, and with CORS, so the page
 * and WebGL can both use it. This is checked over the network, not via the
 * SDK, because the SDK cannot see what a browser will see.
 */
export async function verifyPublicUrl(url, { expectedBytes, expectedContentType }) {
    const res = await fetch(url, { method: "HEAD", headers: { Origin: "https://www.bestbottles.com" } });
    const problems = [];
    if (res.status !== 200) problems.push(`status ${res.status}`);
    const type = res.headers.get("content-type") ?? "";
    if (expectedContentType && !type.startsWith(expectedContentType)) problems.push(`content-type ${type}`);
    const length = Number(res.headers.get("content-length") ?? "0");
    if (expectedBytes && length !== expectedBytes) problems.push(`content-length ${length} != ${expectedBytes}`);
    const acao = res.headers.get("access-control-allow-origin");
    if (acao !== "*") problems.push(`access-control-allow-origin ${acao ?? "(none)"}`);
    const cache = res.headers.get("cache-control") ?? "";
    if (!/max-age=\d{6,}/.test(cache)) problems.push(`cache-control ${cache || "(none)"}`);
    return { ok: problems.length === 0, problems };
}
