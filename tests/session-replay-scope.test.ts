/**
 * Which pages session replay is allowed to record.
 *
 * This is the test that matters most in the analytics layer. Replay captures
 * the rendered DOM, and the authenticated surfaces carry shipping addresses,
 * billing emails, order values, seller's-permit numbers and uploaded
 * certificates. Input masking does not help with any of that, because it is
 * rendered text rather than form values — the only protection is never
 * recording those routes at all.
 *
 * A regression here is silent: recordings would simply start containing
 * customer data, and nothing would fail.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mayRecordSession, NEVER_RECORD_PREFIXES } from "../src/lib/analytics/sessionReplayScope";

describe("session replay scope", () => {
    it("records the public storefront", () => {
        for (const path of [
            "/",
            "/catalog",
            "/catalog?view=line",
            "/products/cylinder-9ml-clear-13-415",
            "/collections/perfume-vials-bottles",
            "/blog",
            "/about",
            "/contact",
            "/matrix",
        ]) {
            expect(mayRecordSession(path), `${path} should be recordable`).toBe(true);
        }
    });

    it("never records an authenticated surface", () => {
        for (const path of [
            "/portal",
            "/portal/account",
            "/portal/drafts/abc123",
            "/portal/tax-exemption",
            "/team",
            "/team/resale-certificates",
            "/team/portal-accounts",
            "/executive",
            "/studio",
            "/studio/desk",
            "/sign-in",
            "/sign-up",
            // With a query string: the first version of this module compared
            // the raw pathname, so "?" defeated the whole deny list.
            "/portal?tab=orders",
            "/team/resale-certificates?status=pending",
            "/executive?preview=1",
            "/portal/account#shipping",
        ]) {
            expect(mayRecordSession(path), `${path} must never be recorded`).toBe(false);
        }
    });

    it("never records the Grace workspace, where people describe unreleased products", () => {
        expect(mayRecordSession("/grace-workspace")).toBe(false);
        expect(mayRecordSession("/grace-workspace?project=abc")).toBe(false);
    });

    it("is not fooled by casing", () => {
        expect(mayRecordSession("/Portal/Account")).toBe(false);
        expect(mayRecordSession("/TEAM")).toBe(false);
    });

    it("does not treat a lookalike public route as protected", () => {
        // /portal-guide is marketing content, not the portal.
        expect(mayRecordSession("/portal-guide")).toBe(true);
        expect(mayRecordSession("/teamwork")).toBe(true);
    });

    it("fails closed on anything it cannot parse", () => {
        expect(mayRecordSession(null)).toBe(false);
        expect(mayRecordSession(undefined)).toBe(false);
        expect(mayRecordSession("")).toBe(false);
        expect(mayRecordSession("not-a-path")).toBe(false);
        expect(mayRecordSession("javascript:alert(1)")).toBe(false);
    });

    it("handles a full URL as well as a bare path", () => {
        expect(mayRecordSession("https://www.bestbottles.com/catalog")).toBe(true);
        expect(mayRecordSession("https://www.bestbottles.com/portal/account")).toBe(false);
    });

    it("covers every authenticated area the app actually serves", () => {
        // Guards against a route group being added without the scope catching
        // up — the failure mode is silent, so the list is asserted explicitly.
        for (const prefix of ["/portal", "/team", "/executive", "/studio", "/sign-in", "/sign-up"]) {
            expect(NEVER_RECORD_PREFIXES, `${prefix} missing from the deny list`).toContain(prefix);
        }
    });
});

describe("replay wiring", () => {
    const analytics = readFileSync(resolve(process.cwd(), "src/lib/analytics.ts"), "utf8");
    const provider = readFileSync(resolve(process.cwd(), "src/components/AnalyticsProvider.tsx"), "utf8");

    it("never starts recording on its own", () => {
        // disable_session_recording keeps it off at init; the provider turns it
        // on per route. A page nobody considered is therefore not recorded.
        expect(analytics).toContain("disable_session_recording: true");
    });

    it("masks inputs wherever it does record", () => {
        expect(analytics).toContain("maskAllInputs: true");
    });

    it("re-evaluates on every navigation, not once at startup", () => {
        // This is a single-page app: a customer can walk from the catalogue
        // into the portal without a page load, and a recording started on the
        // storefront would follow them in.
        expect(provider).toContain("mayRecordSession(pathname)");
    });
});
