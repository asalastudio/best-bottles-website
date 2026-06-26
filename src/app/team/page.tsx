import type { Metadata } from "next";
import { auth, currentUser } from "@clerk/nextjs/server";
import { hasTeamHubAccess } from "@/lib/teamAccess";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: { absolute: "Team Hub | Best Bottles" },
    robots: { index: false, follow: false },
};

type TeamPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function isLocalPreview(searchParams: Record<string, string | string[] | undefined> | undefined) {
    if (process.env.NODE_ENV === "production") return false;

    const preview = searchParams?.preview;
    const previewValues = Array.isArray(preview) ? preview : [preview];

    return previewValues.some((value) => value === "1" || value === "true");
}

function getShopifyAdminHref() {
    const domain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN
        ?.trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "");

    if (!domain) return "https://admin.shopify.com";

    const storeHandle = domain.replace(/\.myshopify\.com$/i, "").split(".")[0];
    return storeHandle ? `https://admin.shopify.com/store/${storeHandle}` : "https://admin.shopify.com";
}

function getMadisonStudioHref() {
    return process.env.NEXT_PUBLIC_MADISON_STUDIO_URL?.trim() || "https://madison-studio-cursor.vercel.app";
}

const tools = [
    {
        name: "Sanity Studio",
        href: "/studio",
        description: "Edit homepage, journal articles, and product copy. Click any text in Presentation to edit it live.",
        badge: "CMS",
    },
    {
        name: "B2B Portal Admin",
        href: "/portal",
        description: "Customer accounts, draft quotes, and order tracking.",
        badge: "B2B",
    },
    {
        name: "Shopify Admin",
        href: getShopifyAdminHref(),
        description: "Orders, inventory, and product publishing.",
        badge: "Storefront",
    },
    {
        name: "Madison Studio",
        href: getMadisonStudioHref(),
        description: "Generate and refine Best Bottles product photography.",
        badge: "Image Studio",
    },
    {
        name: "Best Bottles Packaging Studio",
        href: "https://best-bottles-packaging-studio.vercel.app/",
        description: "Create and review Best Bottles packaging layouts and studio assets.",
        badge: "Packaging",
    },
    {
        name: "Vercel",
        href: "https://vercel.com/asala/best-bottles-website",
        description: "Deploys, environment variables, and analytics.",
        badge: "Infrastructure",
    },
];

export default async function TeamPage({ searchParams }: TeamPageProps) {
    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    const previewMode = isLocalPreview(resolvedSearchParams);

    if (!previewMode) {
        const { userId, redirectToSignIn } = await auth();

        if (!userId) {
            return redirectToSignIn({ returnBackUrl: "/team" });
        }

        const user = await currentUser();
        if (!hasTeamHubAccess(user?.publicMetadata)) {
            return <TeamAccessPending />;
        }
    }

    return (
        <main className="min-h-screen bg-bone px-6 py-20 sm:py-24">
            <div className="mx-auto max-w-5xl">
                <header className="mb-10 max-w-2xl">
                    <p className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-muted-gold">
                        Best Bottles
                    </p>
                    <h1 className="font-serif text-5xl leading-tight text-obsidian sm:text-6xl">
                        Team Hub
                    </h1>
                    <p className="mt-5 text-lg leading-relaxed text-slate">
                        Everything the team needs, one click away.
                    </p>
                    {previewMode ? (
                        <p className="mt-4 inline-flex rounded-full border border-muted-gold/30 bg-linen px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-gold-dim">
                            Local preview mode
                        </p>
                    ) : null}
                </header>

                <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {tools.map((tool) => (
                        <a
                            key={tool.name}
                            href={tool.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative min-h-48 border border-champagne/50 bg-linen px-6 py-6 shadow-[0_18px_45px_rgba(29,29,31,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-muted-gold/50 hover:shadow-[0_22px_60px_rgba(29,29,31,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-muted-gold"
                        >
                            <span className="absolute right-5 top-5 rounded-full border border-champagne/50 bg-bone px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-dim">
                                {tool.badge}
                            </span>
                            <div className="flex h-full flex-col pr-20">
                                <h2 className="font-serif text-2xl font-semibold leading-tight text-obsidian">
                                    {tool.name}
                                </h2>
                                <p className="mt-4 max-w-md text-sm leading-6 text-slate">
                                    {tool.description}
                                </p>
                                <span className="mt-auto pt-8 text-sm font-semibold text-obsidian transition-colors group-hover:text-muted-gold">
                                    Open →
                                </span>
                            </div>
                        </a>
                    ))}
                </section>

                <p className="mt-10 text-sm leading-6 text-slate">
                    Need access to a tool? Contact Jordan{" "}
                    <a
                        href="mailto:jordan@asala.ai"
                        className="font-medium text-obsidian underline decoration-champagne underline-offset-4 hover:text-muted-gold"
                    >
                        (jordan@asala.ai)
                    </a>
                    .
                </p>
            </div>
        </main>
    );
}

function TeamAccessPending() {
    return (
        <main className="min-h-screen bg-bone px-6 py-20 sm:py-24">
            <div className="mx-auto max-w-2xl border border-champagne/60 bg-linen p-8 shadow-[0_18px_45px_rgba(29,29,31,0.04)]">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-muted-gold">
                    Best Bottles
                </p>
                <h1 className="font-serif text-4xl leading-tight text-obsidian sm:text-5xl">
                    Team Hub access pending
                </h1>
                <p className="mt-5 text-base leading-7 text-slate">
                    You are signed in, but this account is not enabled for the Team Hub yet.
                    Ask Jordan or a Best Bottles admin to turn on team access in Clerk.
                </p>
                <a
                    href="mailto:jordan@asala.ai"
                    className="mt-8 inline-flex border border-obsidian bg-obsidian px-5 py-3 text-sm font-semibold text-linen transition hover:border-muted-gold hover:bg-muted-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-muted-gold"
                >
                    Contact Jordan
                </a>
            </div>
        </main>
    );
}
