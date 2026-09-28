"use client";

import { reportError } from "@/lib/observability/report";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Component, useCallback, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { useUser, useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useGrace } from "@/components/useGrace";
import { CLERK_ENABLED } from "@/lib/clerk";
import { Plus, X } from "./icons";
import { List } from "@phosphor-icons/react";
import WorkspaceFamilies from "./WorkspaceFamilies";
import WorkspaceCart from "./WorkspaceCart";
import styles from "./WorkspaceShell.module.css";
import type { RailFamily, RailSession } from "@/lib/grace/workspaceRailTypes";

/**
 * Error boundary scoped to one rail section. Used for the complete family
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

interface ProjectItem {
    name: string;
    sub: string;
}

interface WorkspaceShellProps {
    children: ReactNode;
    onNewConversation: () => void;
    /** Every listed family, with editorial and catalog imagery resolved on the server. */
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
    const { conversationActive, endConversation, closePanel } = useGrace();
    const [familyMenuOpen, setFamilyMenuOpen] = useState(false);
    const [cartOpen, setCartOpen] = useState(false);
    const familyMenuRef = useRef<HTMLElement>(null);
    const browseRef = useRef<HTMLButtonElement>(null);
    const closeFamilyMenu = useCallback(() => { setFamilyMenuOpen(false); browseRef.current?.focus(); }, []);
    const closeGrace = useCallback(() => {
        // Stop microphone/audio and automatic reconnect without clearing the chat.
        void endConversation();
        closePanel();
        router.push("/");
    }, [endConversation, closePanel, router]);
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape" || event.defaultPrevented || cartOpen) return;
            event.preventDefault();
            if (familyMenuOpen) closeFamilyMenu(); else closeGrace();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [familyMenuOpen, cartOpen, closeFamilyMenu, closeGrace]);
    useEffect(() => {
        if (familyMenuOpen) familyMenuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }, [familyMenuOpen]);

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
            <button type="button" className={styles.scrim} data-open={familyMenuOpen} aria-label="Close family menu" tabIndex={-1} onClick={closeFamilyMenu} />
            <aside ref={familyMenuRef} id="workspace-family-sidebar" className={styles.sidebar} data-open={familyMenuOpen} role={familyMenuOpen ? "dialog" : undefined} aria-modal={familyMenuOpen || undefined} aria-label="Product families"
                onKeyDown={event => {
                    if (!familyMenuOpen || event.key !== "Tab") return;
                    const nodes = familyMenuRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]');
                    if (!nodes?.length) return;
                    const first = nodes[0]; const last = nodes[nodes.length - 1];
                    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
                }}>
                <button type="button" className={styles.mobileMenuClose} onClick={closeFamilyMenu}>Close menu ×</button>
                {/* Brand — clicks back to the home site */}
                <Link
                    href="/"
                    className="flex items-center gap-[9px] rounded-[2px] px-1.5 pb-3.5 pt-1 -mx-1.5 -mt-1 hover:bg-white/[0.06] transition-colors"
                    title="Back to Best Bottles"
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
                        <WorkspaceFamilies families={families} />
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
                <div className={styles.topbar}>
                    <button ref={browseRef} type="button" className={styles.mobileBrowse} aria-label="Browse by family" aria-expanded={familyMenuOpen} aria-controls="workspace-family-sidebar" onClick={() => familyMenuOpen ? closeFamilyMenu() : setFamilyMenuOpen(true)}><List size={18} /> Families</button>
                    <div className={`${styles.workspaceName} flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden`}>
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

                    <div className="ml-auto flex shrink-0 items-center gap-2">
                        {/* Share link only makes sense once a project / shortlist exists.
                            Hidden until that pattern lands; preserves space for future wiring. */}
                        {activeProject && (
                            <button
                                type="button"
                                disabled
                                title="Shortlist sharing — coming with the next deploy"
                                className="hidden xl:block rounded-[2px] px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-obsidian cursor-not-allowed opacity-50"
                                style={{ border: "1px solid rgba(99, 117, 136, 0.3)" }}
                            >
                                Generate share link
                            </button>
                        )}
                        <WorkspaceCart open={cartOpen} onOpenChange={open => { if (open) setFamilyMenuOpen(false); setCartOpen(open); }} />
                        <button type="button" className={styles.closeGrace} onClick={closeGrace} title="Close Grace and return to the shop (Esc)"><X size={18} weight="bold" /> Close Grace</button>
                    </div>
                </div>

                {/* Main content area. Deliberately flat: the champagne grid
                    that used to sit here read as decoration, and the composer's
                    own shadow gives the canvas all the depth it needs. */}
                <div className="flex min-h-0 flex-1 flex-col" inert={familyMenuOpen}>
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
