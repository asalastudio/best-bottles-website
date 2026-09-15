// @vitest-environment edge-runtime
/// <reference types="vite/client" />
/**
 * Grace session transcripts.
 *
 * Two properties matter: a session is replaced in place on every sync (no
 * duplicate rows per session id), and a transcript is never visible to, or
 * overwritable by, a different customer or organization.
 */

import { convexTest } from "convex-test";
import { describe, expect, it, beforeEach } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const modules = import.meta.glob("../convex/**/*.ts");

const WRITE_TOKEN = "test-write-token";
const ORG_A = "org_lumiere";
const ORG_B = "org_maison";
const USER_A = "user_a";
const USER_B = "user_b";

beforeEach(() => {
    process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN = WRITE_TOKEN;
});

function upsert(t: ReturnType<typeof convexTest>, overrides: Record<string, unknown> = {}) {
    return t.mutation(api.graceSessions.upsert, {
        writeToken: WRITE_TOKEN,
        clerkUserId: USER_A,
        clerkOrgId: ORG_A,
        ownerKey: `user:${USER_A}`,
        sessionId: "sess-1",
        surface: "workspace",
        companionMode: "assist",
        startedAt: 1_000,
        messages: [
            { role: "user", text: "What neck size is the 30ml Cylinder?" },
            { role: "grace", text: "The 30ml Cylinder uses an 18-415 neck finish." },
        ],
        ...overrides,
    });
}

describe("upsert", () => {
    it("refuses a mutation without the shared token", async () => {
        const t = convexTest(schema, modules);
        await expect(upsert(t, { writeToken: "wrong" })).rejects.toThrow(/unauthorized_convex_write/);
    });

    it("replaces the transcript in place instead of adding rows", async () => {
        const t = convexTest(schema, modules);
        const first = await upsert(t);
        const second = await upsert(t, {
            messages: [
                { role: "user", text: "What neck size is the 30ml Cylinder?" },
                { role: "grace", text: "The 30ml Cylinder uses an 18-415 neck finish." },
                { role: "user", text: "And the 50ml?" },
                { role: "grace", text: "Also 18-415." },
            ],
        });
        expect(second).toBe(first);

        const list = await t.query(api.graceSessions.listByOrg, { clerkOrgId: ORG_A });
        expect(list).toHaveLength(1);
        expect(list[0].messageCount).toBe(4);
        expect(list[0].title).toBe("What neck size is the 30ml Cylinder?");
        expect(list[0].preview).toBe("Also 18-415.");
    });

    it("rejects a transcript with no user turn", async () => {
        const t = convexTest(schema, modules);
        await expect(
            upsert(t, { messages: [{ role: "grace", text: "Hello there." }] }),
        ).rejects.toThrow(/session_has_no_user_message/);
    });

    it("refuses to let another user overwrite a session id they do not own", async () => {
        const t = convexTest(schema, modules);
        await upsert(t);
        await expect(
            upsert(t, { clerkUserId: USER_B, clerkOrgId: ORG_B, ownerKey: `user:${USER_B}` }),
        ).rejects.toThrow(/session_owned_by_other_user/);
    });

    it("marks the session ended only when told to", async () => {
        const t = convexTest(schema, modules);
        await upsert(t);
        let list = await t.query(api.graceSessions.listByOrg, { clerkOrgId: ORG_A });
        expect(list[0].endedAt).toBeNull();

        await upsert(t, { ended: true });
        list = await t.query(api.graceSessions.listByOrg, { clerkOrgId: ORG_A });
        expect(typeof list[0].endedAt).toBe("number");
    });
});

describe("organization isolation", () => {
    it("lists only the organization's own sessions, newest first", async () => {
        const t = convexTest(schema, modules);
        await upsert(t, { sessionId: "a-1" });
        await upsert(t, { sessionId: "a-2" });
        await upsert(t, { sessionId: "b-1", clerkUserId: USER_B, clerkOrgId: ORG_B, ownerKey: `user:${USER_B}` });

        const a = await t.query(api.graceSessions.listByOrg, { clerkOrgId: ORG_A });
        const b = await t.query(api.graceSessions.listByOrg, { clerkOrgId: ORG_B });
        expect(a.map((s) => s.sessionId)).toEqual(["a-2", "a-1"]);
        expect(b.map((s) => s.sessionId)).toEqual(["b-1"]);
    });

    it("returns null for a transcript that belongs to another organization", async () => {
        const t = convexTest(schema, modules);
        const id = await upsert(t);
        const mine = await t.query(api.graceSessions.getForViewer, {
            clerkOrgId: ORG_A, clerkUserId: USER_A, sessionId: id,
        });
        const theirs = await t.query(api.graceSessions.getForViewer, {
            clerkOrgId: ORG_B, clerkUserId: USER_B, sessionId: id,
        });
        expect(mine?.messages).toHaveLength(2);
        expect(theirs).toBeNull();
    });
});

describe("sessions recorded before an organization was active", () => {
    it("still reach the viewer who recorded them", async () => {
        const t = convexTest(schema, modules);
        await upsert(t, { sessionId: "orphan", clerkOrgId: undefined });
        await upsert(t, { sessionId: "with-org" });

        const list = await t.query(api.graceSessions.listForViewer, {
            clerkOrgId: ORG_A, clerkUserId: USER_A,
        });
        expect(list.map((s) => s.sessionId).sort()).toEqual(["orphan", "with-org"]);
    });

    it("stay hidden from a different person in the same organization", async () => {
        const t = convexTest(schema, modules);
        const id = await upsert(t, { sessionId: "orphan", clerkOrgId: undefined });

        const other = await t.query(api.graceSessions.getForViewer, {
            clerkOrgId: ORG_A, clerkUserId: USER_B, sessionId: id,
        });
        expect(other).toBeNull();
    });
});
