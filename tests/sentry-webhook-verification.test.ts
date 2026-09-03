import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifySentryWebhook } from "../src/lib/sentry-webhooks";

const SECRET = "test-client-secret";
const body = JSON.stringify({ action: "created", data: { issue: { id: "1", title: "boom" } } });
const sign = (payload: string, secret = SECRET) => createHmac("sha256", secret).update(payload, "utf8").digest("hex");

describe("verifySentryWebhook", () => {
    let previous: string | undefined;
    beforeEach(() => {
        previous = process.env.SENTRY_WEBHOOK_CLIENT_SECRET;
        process.env.SENTRY_WEBHOOK_CLIENT_SECRET = SECRET;
    });
    afterEach(() => {
        if (previous === undefined) delete process.env.SENTRY_WEBHOOK_CLIENT_SECRET;
        else process.env.SENTRY_WEBHOOK_CLIENT_SECRET = previous;
    });

    it("accepts Sentry's hex HMAC-SHA256 over the raw body", () => {
        expect(verifySentryWebhook(Buffer.from(body), sign(body))).toBe(true);
    });

    it("accepts an upper-case digest", () => {
        expect(verifySentryWebhook(Buffer.from(body), sign(body).toUpperCase())).toBe(true);
    });

    it("covers the bytes, not the parsed value — reformatting invalidates the signature", () => {
        // Guards the flaw an earlier draft had: normalising through
        // JSON.parse/stringify let a tampered body reuse a valid signature.
        const pretty = JSON.stringify(JSON.parse(body), null, 2);
        expect(verifySentryWebhook(Buffer.from(pretty), sign(body))).toBe(false);
        expect(verifySentryWebhook(Buffer.from(body + " "), sign(body))).toBe(false);
        expect(verifySentryWebhook(Buffer.from(body + "\n"), sign(body))).toBe(false);
    });

    it("rejects a wrong secret, a tampered body, a missing header, and an unset secret", () => {
        expect(verifySentryWebhook(Buffer.from(body), sign(body, "other"))).toBe(false);
        expect(verifySentryWebhook(Buffer.from(body + " "), sign(body))).toBe(false);
        expect(verifySentryWebhook(Buffer.from(body), null)).toBe(false);
        delete process.env.SENTRY_WEBHOOK_CLIENT_SECRET;
        expect(verifySentryWebhook(Buffer.from(body), sign(body))).toBe(false);
    });
});
