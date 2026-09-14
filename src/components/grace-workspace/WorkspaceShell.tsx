"use client";

import { reportError } from "@/lib/observability/report";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useUser, useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useCart } from "@/components/CartProvider";
import { useGrace } from "@/components/useGrace";
import { CLERK_ENABLED } from "@/lib/clerk";
import { ArrowLeft, Plus } from "./icons";
import type { RailFamily, RailSession } from "@/lib/grace/workspaceRailTypes";

/**
 * Error boundary scoped to one rail section. Used for the Popular Families
 * strip — a Convex sync failure (function not yet deployed, schema mismatch)
 * should NOT crash the entire workspace shell. We swallow the error, log it
 * for telemetry, and render a minimal "Nothing yet." fallback in its place.
 */
class RailSectionErrorBoundary extends Component<
    { children: ReactNode; fallback: ReactNode },
    { hasError: boolean }
> {
    constructor(props: { children: ReactNode; fallback: ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(err: Error, info: ErrorInfo) {
        reportError(err, {
            area: "grace-workspace-rail",
            level: "warning",
            extra: { componentStack: info.componentStack ?? null },
        });
    }
    render() {
        return this.state.hasError ? this.props.fallback : this.props.children;
    }
}

const SIDEBAR_W = 256;
const TOPBAR_H = 60;

interface ProjectItem {
    name: string;
    sub: string;
}

interface WorkspaceShellProps {
    children: ReactNode;
    onNewConversation: () => void;
    /** Bottle families with approved Sanity artwork, resolved on the server. */
    families?: RailFamily[];
    /** This viewer's recent Grace conversations. Empty when signed out. */
    sessions?: RailSession[];
}

type WorkspaceUser = {
    firstName?: string | null;
    lastName?: string | null;
    imageUrl?: string | null;
    primaryEmailAddress?: { emailAddress?: string | null } | null;
} | null | undefined;

type WorkspaceOrganization = {
    id?: string | null;
    name?: string | null;
} | null | undefined;

function relativeTime(updatedAt: number): string {
    const ms = Date.now() - updatedAt;
    const day = 86400000;
    if (ms < day) return "today";
    if (ms < 2 * day) return "yesterday";
    if (ms < 7 * day) return `${Math.round(ms / day)} days ago`;
    if (ms < 30 * day) return `${Math.round(ms / (7 * day))} weeks ago`;
    return `${Math.round(ms / 30 / day)} months ago`;
}

export default function WorkspaceShell(props: WorkspaceShellProps) {
    if (CLERK_ENABLED) return <WorkspaceShellWithClerk {...props} />;
    return <WorkspaceShellView {...props} user={null} organization={null} />;
}

function WorkspaceShellWithClerk(props: WorkspaceShellProps) {
    const { user } = useUser();
    const { organization } = useOrganization();
    return <WorkspaceShellView {...props} user={user} organization={organization} />;
}

function WorkspaceShellView({
    children,
    onNewConversation,
    families = [],
    sessions = [],
    user,
    organization,
}: WorkspaceShellProps & {
    user: WorkspaceUser;
    organization: WorkspaceOrganization;
}) {
    const router = useRouter();
    const { itemCount } = useCart();
    const { conversationActive } = useGrace();

    const clerkOrgId = organization?.id ?? null;
    const account = useQuery(
        api.portal.getAccountByOrg,
        clerkOrgId ? { clerkOrgId } : "skip",
    );
    const projects = useQuery(
        api.portal.listGraceProjectsByOrg,
        clerkOrgId ? { clerkOrgId } : "skip",
    );

    // The rail shows the newest project only. A list of older ones repeated
    // what /portal/grace already does better, and crowded out the two things
    // a returning customer actually looks for: their last conversation and
    // what they saved. The count is the useful part, not the age.
    const sortedProjects = projects ?? [];
    const newest = sortedProjects[0];
    const activeProject: ProjectItem | null = newest
        ? {
            name: newest.name,
            sub: newest.savedBottleCount > 0
                ? `${newest.savedBottleCount} saved · ${relativeTime(newest.updatedAt)}`
                : relativeTime(newest.updatedAt),
        }
        : null;

    // Identity — fall back gracefully when org/account aren't yet wired.
    const orgName = account?.companyName ?? organization?.name ?? null;
    const tierLabel = account?.tier ?? (clerkOrgId ? "Authenticated" : user ? "Signed in" : "Sessions not saved");
    const userFullName = user
        ? [user.firstName, user.lastName].filter(Boolean).join(" ") || (user.primaryEmailAddress?.emailAddress ?? "You")
        : "Guest";
    const userInitial = (user?.firstName?.[0] ?? user?.primaryEmailAddress?.emailAddress?.[0] ?? "·").toUpperCase();

    return (
        <div
            className="flex h-dvh w-screen overflow-hidden bg-bone text-obsidian font-sans"
        >
            {/* ── Left rail ─────────────────────────────────────────
                Obsidian against a light canvas. The dark frames the
                conversation and reads as a tool rather than a page; product
                artwork never sits on it except small matted thumbnails, so
                the approved bone-ground imagery is untouched. */}
            <aside
                className="hidden md:flex flex-col shrink-0 px-3.5 py-[18px]"
                style={{
                    width: SIDEBAR_W,
                    background: "var(--color-obsidian)",
                    borderRight: "1px solid rgba(255, 255, 255, 0.08)",
                }}
            >
                {/* Brand — clicks back to the home site */}
                <Link
                    href="/"
                    className="flex items-center gap-[9px] rounded-[2px] px-1.5 pb-3.5 pt-1 -mx-1.5 -mt-1 hover:bg-white/[0.06] transition-colors"
                    title="Back to bestbottles.company"
                    aria-label="Back to Best Bottles home"
                >
                    <GraceMark />
                    <div className="leading-none">
                        <div className="font-serif text-[18px] font-medium tracking-[0.04em] text-white/[0.92]">Grace</div>
                        <div className="mt-[3px] text-[9.5px] font-semibold uppercase tracking-[0.18em] text-white/40">
                            Best Bottles
                        </div>
                    </div>
                </Link>

                {/* New conversation */}
                <button
                    onClick={onNewConversation}
                    className="flex items-center justify-center gap-1.5 rounded-[2px] px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] cursor-pointer transition-colors hover:bg-white/[0.10]"
                    style={{
                        background: "rgba(255, 255, 255, 0.06)",
                        border: "1px solid rgba(255, 255, 255, 0.14)",
                        borderBottom: "2px solid var(--color-muted-gold)",
                        color: "rgba(255, 255, 255, 0.92)",
                    }}
                >
                    <Plus size={11} weight="bold" />
                    New conversation
                </button>

                <div className="mt-5 min-h-0 flex-1 overflow-y-auto -mx-1 px-1">
                    {/* Where was I? — the first thing a returning customer wants. */}
                    {sessions.length > 0 && (
                        <div className="mb-5">
                            <Eyebrow>Recent</Eyebrow>
                            <div className="mt-1.5">
                                {sessions.map((session) => (
                                    <Link
                                        key={session.id}
                                        href={`/portal/sessions/${session.id}`}
                                        className="block rounded-[2px] px-1.5 py-[7px] hover:bg-white/[0.06] transition-colors"
                                    >
                                        <span className="block truncate text-[12.5px] text-white/[0.85]">
                                            {session.title}
                                        </span>
                                        <span className="mt-0.5 block text-[10px] text-white/35">
                                            {relativeTime(session.lastMessageAt)}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* What did I keep? */}
                    {activeProject && (
                        <div className="mb-5">
                            <Eyebrow>Saved</Eyebrow>
                            <Link
                                href="/portal/grace"
                                className="mt-1.5 flex items-center gap-2 rounded-[2px] px-1.5 py-[7px] hover:bg-white/[0.06] transition-colors"
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[12.5px] text-white/[0.85]">
                                        {activeProject.name}
                                    </span>
                                    <span className="mt-0.5 block text-[10px] text-white/35">
                                        {activeProject.sub}
                                    </span>
                                </span>
                                {conversationActive && (
                                    <span
                                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-gold"
                                        style={{ boxShadow: "0 0 0 3px rgba(197, 160, 101, 0.22)" }}
                                        aria-label="Conversation active"
                                    />
                                )}
                            </Link>
                        </div>
                    )}

                    {/* Ways in, for someone who has never done this before. */}
                    <RailSectionErrorBoundary fallback={null}>
                        <RailFamilies families={families} />
                    </RailSectionErrorBoundary>
                </div>

                {/* Identity — real Clerk user + portal account when available.
                    The workspace is public, so a guest sees a sign-in link
                    here instead of a locked screen: signing in only adds
                    account-linked history, it never gates the surface. */}
                <div
                    className="mt-auto pt-3.5"
                    style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}
                >
                    {!user && CLERK_ENABLED ? (
                        <Link
                            href="/sign-in?redirect_url=/grace-workspace"
                            className="flex items-center gap-[9px] rounded-[2px] px-1.5 py-1 hover:bg-white/[0.06] transition-colors"
                        >
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted-gold font-serif text-[13px] font-semibold text-obsidian">
                                ·
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-[12px] font-medium truncate text-white/[0.88]">Sign in</div>
                                <div className="text-[10px] text-white/35 truncate">
                                    Save sessions and projects
                                </div>
                            </div>
                        </Link>
                    ) : (
                    <div className="flex items-center gap-[9px] px-1.5 py-1">
                        {user?.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- Clerk-hosted avatar URL changes per user; Next/Image needs whitelisted domain config
                            <img
                                src={user.imageUrl}
                                alt={userFullName}
                                className="h-7 w-7 rounded-full object-cover"
                                style={{ border: "1px solid rgba(255,255,255,0.18)" }}
                            />
                        ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted-gold font-serif text-[13px] font-semibold text-obsidian">
                                {userInitial}
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <div className="text-[12px] font-medium truncate text-white/[0.88]">{userFullName}</div>
                            <div className="text-[10px] text-white/35 truncate">
                                {orgName ? `${orgName} · ${tierLabel}` : tierLabel}
                            </div>
                        </div>
                    </div>
                    )}
                </div>
            </aside>

            {/* ── Main column ──────────────────────────────────── */}
            <div className="relative flex min-w-0 flex-1 flex-col">
                {/* Top bar */}
                <div
                    className="flex shrink-0 items-center gap-3.5 px-6"
                    style={{
                        height: TOPBAR_H,
                        borderBottom: "1px solid rgba(212, 197, 169, 0.55)",
                    }}
                >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
                        {activeProject ? (
                            <>
                                <span className="shrink-0 whitespace-nowrap font-serif text-[18px] font-medium tracking-[0.03em]">
                                    {activeProject.name}
                                </span>
                                <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] tracking-[0.04em] text-slate">
                                    · {activeProject.sub}
                                </span>
                            </>
                        ) : (
                            <span className="shrink-0 whitespace-nowrap font-serif text-[18px] font-medium tracking-[0.03em]">
                                {orgName ? `${orgName}'s workspace` : "Workspace"}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3.5">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-1.5 rounded-[2px] px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-obsidian cursor-pointer hover:bg-obsidian/[0.04] transition-colors"
                            style={{ border: "1px solid rgba(99, 117, 136, 0.3)" }}
                            title="Back to bestbottles.company"
                        >
                            <ArrowLeft size={12} weight="bold" />
                            Back to site
                        </Link>
                        {/* Share link only makes sense once a project / shortlist exists.
                            Hidden until that pattern lands; preserves space for future wiring. */}
                        {activeProject && (
                            <button
                                type="button"
                                disabled
                                title="Shortlist sharing — coming with the next deploy"
                                className="rounded-[2px] px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-obsidian cursor-not-allowed opacity-50"
                                style={{ border: "1px solid rgba(99, 117, 136, 0.3)" }}
                            >
                                Generate share link
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                // Cart is a Navbar-owned drawer, not a route. Navigate home,
                                // then dispatch the global open event the Navbar listens for.
                                router.push("/");
                                setTimeout(() => {
                                    window.dispatchEvent(new CustomEvent("open-cart-drawer"));
                                }, 200);
                            }}
                            className="rounded-[2px] bg-obsidian px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white cursor-pointer hover:bg-black transition-colors"
                            style={{ borderBottom: "2px solid var(--color-muted-gold)" }}
                        >
                            Cart · {itemCount}
                        </button>
                    </div>
                </div>

                {/* Main content area. Deliberately flat: the champagne grid
                    that used to sit here read as decoration, and the composer's
                    own shadow gives the canvas all the depth it needs. */}
                <div className="flex min-h-0 flex-1 flex-col">
                    {children}
                </div>
            </div>
        </div>
    );
}

function Eyebrow({ children }: { children: ReactNode }) {
    return (
        <div className="px-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/[0.38]">
            {children}
        </div>
    );
}

/**
 * Bottle families as a compact list, not a tile grid.
 *
 * The grid showed six large images and filled half the rail; worse, it read
 * `productGroups.heroImageUrl`, whose Shopify URLs now 404, so every tile
 * rendered broken. Rows show twice as many families in a third of the space,
 * take the approved Sanity artwork the rest of the site uses, and degrade to
 * a lettered chip when a family has no card yet.
 */
function RailFamilies({ families }: { families: RailFamily[] }) {
    if (families.length === 0) return null;
    return (
        <>
            <Eyebrow>Browse by family</Eyebrow>
            <div className="mt-1.5">
                {families.map((f) => (
                    <Link
                        key={f.family}
                        href={`/catalog?family=${encodeURIComponent(f.family)}`}
                        className="flex items-center gap-3 rounded-[2px] px-1.5 py-[7px] hover:bg-white/[0.06] transition-colors"
                        title={`Browse ${f.family}`}
                    >
                        <span
                            className="flex h-[64px] w-[64px] shrink-0 items-center justify-center overflow-hidden rounded-[2px]"
                            style={{
                                border: "1px solid rgba(255, 255, 255, 0.12)",
                                background: "rgba(255, 255, 255, 0.06)",
                            }}
                        >
                            {f.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element -- Sanity CDN URL; Next/Image needs whitelisted domain config
                                <img
                                    src={f.imageUrl}
                                    alt=""
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <span className="font-cormorant text-[26px] leading-none text-white/40">
                                    {f.family[0]}
                                </span>
                            )}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] text-white/[0.88]">
                                {f.family}
                            </span>
                            <span className="mt-0.5 block text-[10.5px] tabular-nums text-white/35">
                                {f.variantCount} variants
                            </span>
                        </span>
                    </Link>
                ))}
                <Link
                    href="/catalog"
                    className="mt-1 block rounded-[2px] px-1.5 py-2 text-[11px] font-medium tracking-[0.04em] text-white/45 hover:bg-white/[0.06] hover:text-white/70 transition-colors"
                >
                    All families →
                </Link>
            </div>
        </>
    );
}

function GraceMark() {
    return (
        <div
            className="relative flex h-[26px] w-[26px] items-center justify-center rounded-[2px]"
            style={{
                border: "1px solid rgba(255, 255, 255, 0.20)",
                background: "rgba(255, 255, 255, 0.08)",
            }}
        >
            <span
                className="font-cormorant font-semibold leading-none text-white/[0.92]"
                style={{ fontSize: 14, letterSpacing: "-0.02em" }}
            >
                G
            </span>
            <span
                className="absolute -right-[2px] -top-[2px] h-[5px] w-[5px] rounded-full bg-muted-gold"
                aria-hidden
            />
        </div>
    );
}
