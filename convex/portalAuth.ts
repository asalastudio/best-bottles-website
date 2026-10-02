import { customQuery } from "convex-helpers/server/customFunctions";
import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Shared guard for portal reads and mutations invoked from the Next.js server.
 *
 * Portal functions are not called by browsers — they come from server actions and
 * route handlers holding `BEST_BOTTLES_CONVEX_WRITE_TOKEN`. Keeping the check in
 * one place means a change to it cannot land in one module and miss another.
 */
export function verifyWriteToken(writeToken: string) {
    const expected = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    if (!expected) throw new Error("convex_write_token_not_configured");
    if (writeToken !== expected) throw new Error("unauthorized_convex_write");
}

/**
 * Private portal data is read through the trusted Next.js server. Every query
 * requires its existing credential before the handler can access the database.
 * Customer scope comes from Clerk; staff-wide reads require the server's staff
 * gate. Never pass this credential to a browser or accept scope from a request.
 */
export const serverQuery = customQuery(query, {
    args: { writeToken: v.string() },
    input: async (_ctx, args) => {
        verifyWriteToken(args.writeToken);
        return { ctx: {}, args: {} };
    },
});
