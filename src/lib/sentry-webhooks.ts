/**
 * Sentry integration-platform webhook verification.
 *
 * Sentry signs every delivery with HMAC-SHA256 over the JSON body using the
 * Internal Integration's Client Secret and sends the hex digest in
 * `Sentry-Hook-Signature`. Mirrors verifyShopifyWebhook: raw bytes, constant
 * time compare, fail closed.
 */
import { createHmac, timingSafeEqual } from "crypto";

function hexDigest(secret: string, payload: Buffer | string): Buffer {
    return Buffer.from(createHmac("sha256", secret).update(payload).digest("hex"), "utf8");
}

function safeEqual(a: Buffer, b: Buffer): boolean {
    return a.length === b.length && timingSafeEqual(a, b);
}

export function verifySentryWebhook(rawBody: Buffer, signatureHeader: string | null): boolean {
    const secret = process.env.SENTRY_WEBHOOK_CLIENT_SECRET?.trim();
    if (!secret) {
        console.error("[Sentry Webhook] SENTRY_WEBHOOK_CLIENT_SECRET not set");
        return false;
    }
    if (!signatureHeader) return false;

    const provided = Buffer.from(signatureHeader.trim().toLowerCase(), "utf8");

    try {
        // ONLY the exact bytes Sentry transmitted. An earlier draft also accepted
        // JSON.stringify(JSON.parse(body)) as a convenience for proxies that
        // re-serialise; that made the signature cover the parsed *value* rather
        // than the bytes, so a payload with trailing whitespace (or any other
        // difference JSON.parse discards) verified against a signature minted
        // for the original. Next.js hands us the untouched body via
        // req.arrayBuffer(), so raw comparison is both correct and strict.
        return safeEqual(hexDigest(secret, rawBody), provided);
    } catch {
        return false;
    }
}
