import { redirect } from "next/navigation";

/**
 * The preview browser was resolving Create Products to `/team/new?preview=1`.
 * Keep that path as a first-class alias so the desk is reachable either way.
 */
export default async function TeamNewProductAliasPage({
    searchParams,
}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
    const resolved = searchParams ? await searchParams : undefined;
    const preview = resolved?.preview;
    const previewValues = Array.isArray(preview) ? preview : [preview];
    const previewMode = previewValues.some((value) => value === "1" || value === "true");
    redirect(previewMode ? "/team/products/new?preview=1" : "/team/products/new");
}
