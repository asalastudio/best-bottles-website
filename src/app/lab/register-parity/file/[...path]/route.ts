/**
 * Serves the Phase 4 gate's local artifacts to the lab page: the renders under
 * output/register-phase4/renders/ and the pilot cut-outs under
 * output/register-phase3/pilot/. Development only; both directories are
 * gitignored and never exist on a deployment.
 */
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { NextResponse } from "next/server";

const ROOTS: Record<string, string> = {
    renders: resolve(process.cwd(), "output", "register-phase4", "renders"),
    pilot: resolve(process.cwd(), "output", "register-phase3", "pilot"),
    legacy: resolve(process.cwd(), "output", "register-phase4", "legacy"),
};
const TYPES: Record<string, string> = { png: "image/png", webp: "image/webp", json: "application/json" };

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
    if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
    const { path } = await context.params;
    const [rootKey, ...rest] = path;
    const root = ROOTS[rootKey];
    const file = root && rest.length ? resolve(root, ...rest) : null;
    if (!root || !file || !file.startsWith(root + sep) || rest.some((part) => part === "..")) return new NextResponse(null, { status: 404 });
    const type = TYPES[file.split(".").pop() ?? ""];
    if (!type) return new NextResponse(null, { status: 404 });
    try {
        const bytes = await readFile(file);
        return new NextResponse(new Uint8Array(bytes), { headers: { "content-type": type, "cache-control": "no-store" } });
    } catch {
        return new NextResponse(null, { status: 404 });
    }
}
