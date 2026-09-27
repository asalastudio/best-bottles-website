/**
 * Shapes shared between the server-side rail loader and the client shell.
 *
 * Kept apart from `workspaceRail.ts` because that module is `server-only` —
 * a client component importing types from it would break the build.
 */

export type RailFamily = {
    family: string;
    variantCount: number;
    images: Array<{ url: string; kind: "editorial" | "product" }>;
};

export type RailSession = {
    id: string;
    title: string;
    lastMessageAt: number;
};
