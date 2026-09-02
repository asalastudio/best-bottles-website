/**
 * Shared guard for portal mutations invoked from the Next.js server.
 *
 * Portal writes are not called by browsers — they come from server actions and
 * route handlers holding `BEST_BOTTLES_CONVEX_WRITE_TOKEN`. Keeping the check in
 * one place means a change to it cannot land in one module and miss another.
 */
export function verifyWriteToken(writeToken: string) {
    const expected = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    if (!expected) throw new Error("convex_write_token_not_configured");
    if (writeToken !== expected) throw new Error("unauthorized_convex_write");
}
