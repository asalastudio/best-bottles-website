/**
 * Which Convex deployment a register loader writes: dev by default, prod only when asked by name.
 *
 *   ... --deployment prod   (REGISTER_PROD_WRITE_TOKEN in the environment; the prod deployment's own write token)
 *
 * Dev reads NEXT_PUBLIC_CONVEX_URL and BEST_BOTTLES_CONVEX_WRITE_TOKEN from .env.local and refuses a .env.local that
 * points at prod. Both deployments read the same public Vercel Blob store, so promoting to prod writes register rows only.
 */
export const PROD_URL = "https://precise-raccoon-123.convex.cloud";

export function registerTarget(argv: string[]): { deployment: "dev" | "prod"; url: string; token: string } {
    const i = argv.indexOf("--deployment");
    const deployment = i >= 0 ? argv[i + 1] : "dev";
    if (deployment === "prod") {
        const token = process.env.REGISTER_PROD_WRITE_TOKEN;
        if (!token) throw new Error("--deployment prod needs REGISTER_PROD_WRITE_TOKEN in the environment");
        return { deployment, url: PROD_URL, token };
    }
    if (deployment !== "dev") throw new Error(`--deployment must be dev or prod, not ${deployment}`);
    const url = process.env.NEXT_PUBLIC_CONVEX_URL, token = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    if (!url || !token) throw new Error("dev needs NEXT_PUBLIC_CONVEX_URL and BEST_BOTTLES_CONVEX_WRITE_TOKEN in .env.local");
    if (url.includes("precise-raccoon-123")) throw new Error(".env.local points at prod; refusing to treat it as dev");
    return { deployment, url, token };
}
