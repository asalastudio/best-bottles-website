import { afterEach, describe, expect, it, vi } from "vitest";
import { customerDeclaredExpirationIsPast, customerDeclaredExpirationLabel, parseCustomerDeclaredExpiration } from "../src/lib/portal/certificateExpiration";

afterEach(() => vi.unstubAllEnvs());
describe("customer-declared calendar dates", () => {
    it.each(["America/Los_Angeles", "Pacific/Kiritimati"])("preserves the printed date in %s", (tz) => {
        vi.stubEnv("TZ", tz);
        const value = parseCustomerDeclaredExpiration("date", "2028-02-29");
        expect(value).toEqual({ kind: "date", date: "2028-02-29" });
        expect(customerDeclaredExpirationLabel(value)).toBe("2028-02-29");
    });
    it.each(["", "2027-02-29", "2028-02-30", "2028-13-01", "2028-00-01", "2028-01-00", "0000-01-01", "12/31/2028", "2028-12-31T23:00:00-08:00"])("rejects invalid/date-time input %s", (date) => {
        expect(() => parseCustomerDeclaredExpiration("date", date)).toThrow("invalid_customer_declared_expiration");
    });
    it("accepts past dates for review and distinguishes no-expiration, unspecified and legacy absence", () => {
        const value = parseCustomerDeclaredExpiration("date", "2000-01-01");
        expect(value).toEqual({ kind: "date", date: "2000-01-01" });
        expect(customerDeclaredExpirationIsPast(value, Date.UTC(2026, 9, 2))).toBe(true);
        expect(customerDeclaredExpirationIsPast({ kind: "date", date: "2026-10-02" }, Date.UTC(2026, 9, 2, 23, 59))).toBe(false);
        expect(parseCustomerDeclaredExpiration("none", "2000-01-01")).toEqual({ kind: "none" });
        expect(parseCustomerDeclaredExpiration("unspecified")).toEqual({ kind: "unspecified" });
        expect(parseCustomerDeclaredExpiration(undefined)).toBeUndefined();
        expect(customerDeclaredExpirationLabel(undefined)).toBe("Not provided");
        expect(() => parseCustomerDeclaredExpiration("approved", "2099-01-01")).toThrow();
    });
});
