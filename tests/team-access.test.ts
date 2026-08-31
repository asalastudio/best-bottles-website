import { describe, expect, it } from "vitest";
import { getUserEmailAddresses, hasExecutiveHubAccess, hasTeamHubAccess } from "../src/lib/teamAccess";

describe("Team Hub access", () => {
    it("allows known Best Bottles staff and admin roles", () => {
        for (const role of ["support", "employee", "team", "admin", "executive", "super_admin", "founder", "ceo"]) {
            expect(hasTeamHubAccess({ role })).toBe(true);
        }
    });

    it("allows role arrays and explicit Team Hub access flags", () => {
        expect(hasTeamHubAccess({ roles: ["customer", "admin"] })).toBe(true);
        expect(hasTeamHubAccess({ teamRoles: ["team"] })).toBe(true);
        expect(hasTeamHubAccess({ teamHubAccess: true })).toBe(true);
        expect(hasTeamHubAccess({ teamAccess: true })).toBe(true);
    });

    it("allows default approved and configured team emails", () => {
        expect(hasTeamHubAccess({}, { emailAddresses: ["jordan@asala.ai"] })).toBe(true);
        expect(hasTeamHubAccess({}, { emailAddresses: ["abbas@nematinternational.com"] })).toBe(true);
        expect(hasTeamHubAccess({}, { emailAddresses: ["JORDAN@ASALA.AI"] })).toBe(true);
        expect(
            hasTeamHubAccess({}, {
                emailAddresses: ["ops@bestbottles.com"],
                allowedEmails: ["ops@bestbottles.com"],
            }),
        ).toBe(true);
    });

    it("does not allow missing metadata or customer-only roles", () => {
        expect(hasTeamHubAccess(undefined)).toBe(false);
        expect(hasTeamHubAccess({})).toBe(false);
        expect(hasTeamHubAccess({ role: "customer" })).toBe(false);
        expect(hasTeamHubAccess({ roles: ["customer"] })).toBe(false);
        expect(hasTeamHubAccess({}, { emailAddresses: ["customer@example.com"] })).toBe(false);
    });
});

describe("Executive Hub access", () => {
    it("allows known Best Bottles executive and admin roles", () => {
        for (const role of ["employee", "admin", "executive", "super_admin", "founder", "ceo"]) {
            expect(hasExecutiveHubAccess({ role })).toBe(true);
        }
    });

    it("allows role arrays and explicit Executive Hub access flags", () => {
        expect(hasExecutiveHubAccess({ roles: ["customer", "executive"] })).toBe(true);
        expect(hasExecutiveHubAccess({ teamRoles: ["admin"] })).toBe(true);
        expect(hasExecutiveHubAccess({ executiveHubAccess: true })).toBe(true);
        expect(hasExecutiveHubAccess({ executiveAccess: true })).toBe(true);
    });

    it("allows default approved and configured executive emails", () => {
        expect(hasExecutiveHubAccess({}, { emailAddresses: ["jordan@asala.ai"] })).toBe(true);
        expect(hasExecutiveHubAccess({}, { emailAddresses: ["abbas@nematinternational.com"] })).toBe(true);
        expect(
            hasExecutiveHubAccess({}, {
                emailAddresses: ["ceo@bestbottles.com"],
                allowedEmails: ["ceo@bestbottles.com"],
            }),
        ).toBe(true);
    });

    it("does not allow missing metadata or team-only roles", () => {
        expect(hasExecutiveHubAccess(undefined)).toBe(false);
        expect(hasExecutiveHubAccess({})).toBe(false);
        expect(hasExecutiveHubAccess({ role: "customer" })).toBe(false);
        expect(hasExecutiveHubAccess({ role: "team" })).toBe(false);
        expect(hasExecutiveHubAccess({ roles: ["team"] })).toBe(false);
        expect(hasExecutiveHubAccess({}, { emailAddresses: ["team@bestbottles.com"] })).toBe(false);
    });
});

describe("Clerk user email extraction", () => {
    it("uses primary and secondary Clerk email addresses", () => {
        expect(
            getUserEmailAddresses({
                primaryEmailAddress: { emailAddress: "jordan@asala.ai", verification: { status: "verified" } },
                emailAddresses: [
                    { emailAddress: "ops@bestbottles.com", verification: { status: "verified" } },
                    { emailAddress: null, verification: { status: "verified" } },
                ],
            }),
        ).toEqual(["jordan@asala.ai", "ops@bestbottles.com"]);
    });

    it("never authorizes an unverified secondary Clerk email", () => {
        const emails = getUserEmailAddresses({
            primaryEmailAddress: {
                emailAddress: "customer@example.com",
                verification: { status: "verified" },
            },
            emailAddresses: [
                { emailAddress: "jordan@asala.ai", verification: { status: "unverified" } },
            ],
        });

        expect(emails).toEqual(["customer@example.com"]);
        expect(hasTeamHubAccess({}, { emailAddresses: emails })).toBe(false);
        expect(hasExecutiveHubAccess({}, { emailAddresses: emails })).toBe(false);
    });
});
