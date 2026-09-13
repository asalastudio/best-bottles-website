import type { Metadata } from "next";
import { auth, currentUser } from "@clerk/nextjs/server";
import CreateProductForm from "@/components/team/CreateProductForm";
import { getUserEmailAddresses, hasTeamHubAccess } from "@/lib/teamAccess";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: { absolute: "Create Products | Team Hub" },
    robots: { index: false, follow: false },
};

function isLocalPreview(searchParams: Record<string, string | string[] | undefined> | undefined) {
    if (process.env.NODE_ENV === "production") return false;
    const preview = searchParams?.preview;
    const values = Array.isArray(preview) ? preview : [preview];
    return values.some((value) => value === "1" || value === "true");
}

export default async function CreateProductPage({
    searchParams,
}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
    const resolved = searchParams ? await searchParams : undefined;
    const previewMode = isLocalPreview(resolved);

    if (!previewMode) {
        const { userId, redirectToSignIn } = await auth();
        if (!userId) return redirectToSignIn({ returnBackUrl: "/team/products/new" });
        const user = await currentUser();
        const emailAddresses = getUserEmailAddresses(user);
        if (!hasTeamHubAccess(user?.publicMetadata, { emailAddresses })) {
            return (
                <main className="min-h-screen bg-bone px-6 py-20">
                    <div className="mx-auto max-w-xl border border-champagne/60 bg-linen p-8">
                        <h1 className="font-serif text-4xl text-obsidian">Team Hub access pending</h1>
                        <p className="mt-4 text-slate">This create-product desk is limited to Best Bottles staff.</p>
                    </div>
                </main>
            );
        }
    }

    return (
        <main data-team-hub className="min-h-screen bg-bone px-5 py-8 sm:px-8 sm:py-10">
            <div className="mx-auto max-w-6xl">
                <header className="mb-8 max-w-2xl">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-gold">
                        Team Hub
                    </p>
                    <h1 className="font-serif text-4xl leading-tight text-obsidian sm:text-5xl">
                        Create Products
                    </h1>
                    <p className="mt-3 text-sm leading-6 text-slate">
                        Enter the same fields the product page already shows. This writes Convex catalog truth,
                        stays quote-only until Shopify sync, and can join an existing paper-doll family when one applies.
                    </p>
                    {previewMode ? (
                        <p className="mt-4 inline-flex rounded-full border border-muted-gold/30 bg-linen px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-dim">
                            Local preview mode
                        </p>
                    ) : null}
                </header>
                <CreateProductForm previewMode={previewMode} />
            </div>
        </main>
    );
}
