"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useOrganization } from "@clerk/nextjs";

// ─── Nav icons ────────────────────────────────────────────────────────────────

function NavIcon({ id }: { id: string }) {
    const icons: Record<string, React.ReactNode> = {
        dashboard: (
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1.5" y="1.5" width="4.5" height="4.5" rx="0.5" />
                <rect x="8" y="1.5" width="4.5" height="4.5" rx="0.5" />
                <rect x="1.5" y="8" width="4.5" height="4.5" rx="0.5" />
                <rect x="8" y="8" width="4.5" height="4.5" rx="0.5" />
            </svg>
        ),
        orders: (
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                <line x1="1.5" y1="4" x2="12.5" y2="4" />
                <line x1="1.5" y1="7" x2="12.5" y2="7" />
                <line x1="1.5" y1="10" x2="8.5" y2="10" />
            </svg>
        ),
        tracking: (
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 12.5S2.5 8.5 2.5 5.5a4.5 4.5 0 0 1 9 0C11.5 8.5 7 12.5 7 12.5Z" />
                <circle cx="7" cy="5.5" r="1.4" />
            </svg>
        ),
        drafts: (
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3.5 1.5H9L12 4.5v8a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5Z" />
                <path d="M9 1.5V4.5h3" />
                <line x1="5" y1="7" x2="9.5" y2="7" />
                <line x1="5" y1="9.5" x2="7.5" y2="9.5" />
            </svg>
        ),
        tools: (
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                <line x1="1.5" y1="4" x2="4" y2="4" />
                <circle cx="5.5" cy="4" r="1.5" />
                <line x1="7" y1="4" x2="12.5" y2="4" />
                <line x1="1.5" y1="10" x2="7.5" y2="10" />
                <circle cx="9" cy="10" r="1.5" />
                <line x1="10.5" y1="10" x2="12.5" y2="10" />
            </svg>
        ),
        grace: (
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 1.5L8.5 5.5H12.8L9.4 8L10.8 12L7 9.5L3.2 12L4.6 8L1.2 5.5H5.5L7 1.5Z" />
            </svg>
        ),
        documents: (
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 2.5H8.5L11.5 5.5V12A.5.5 0 0 1 11 12.5H3A.5.5 0 0 1 2.5 12V3A.5.5 0 0 1 2.5 2.5Z" />
                <path d="M8.5 2.5V5.5H11.5" />
                <line x1="4.5" y1="7.5" x2="9.5" y2="7.5" />
                <line x1="4.5" y1="10" x2="7.5" y2="10" />
            </svg>
        ),
        account: (
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                <circle cx="7" cy="5" r="2.5" />
                <path d="M1.5 13c0-2.76 2.46-4.5 5.5-4.5s5.5 1.74 5.5 4.5" />
            </svg>
        ),
    };

    return (
        <span className="w-[16px] h-[16px] flex items-center justify-center shrink-0">
            {icons[id]}
        </span>
    );
}

// ─── Nav config ───────────────────────────────────────────────────────────────

const navItems = [
    { href: "/portal", label: "Dashboard", id: "dashboard" },
    { href: "/portal/orders", label: "Order History", id: "orders" },
    { href: "/portal/tracking", label: "Tracking", id: "tracking" },
    { href: "/portal/drafts", label: "Saved Drafts", id: "drafts" },
    { href: "/portal/tools", label: "Tools", id: "tools" },
    { href: "/portal/grace", label: "Grace Workspace", id: "grace" },
    { href: "/portal/documents", label: "Documents", id: "documents" },
    { href: "/portal/account", label: "Account", id: "account" },
] as const;

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export default function PortalSidebar() {
    const pathname = usePathname();
    const { organization } = useOrganization();

    const isActive = (href: string) => {
        if (href === "/portal") return pathname === "/portal";
        return pathname.startsWith(href);
    };

    const orgName = organization?.name ?? "Lumière Atelier";
    const initials = orgName
        .split(" ")
        .slice(0, 2)
        .map((w: string) => w[0])
        .join("")
        .toUpperCase();

    return (
        <div className="w-[248px] min-w-[248px] bg-obsidian flex flex-col h-full">

            {/* Logo */}
            <div className="px-6 pt-7 pb-5 border-b border-white/[0.07]">
                <p className="font-sans text-[10px] tracking-[0.22em] uppercase text-muted-gold/70 mb-1.5">
                    Client Portal
                </p>
                <p className="font-serif text-[22px] text-bone font-normal tracking-[0.02em]">
                    Best Bottles
                </p>
            </div>

            {/* Account */}
            <div className="px-6 py-5 border-b border-white/[0.06]">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-md bg-gradient-to-br from-gold-dim to-muted-gold flex items-center justify-center shrink-0">
                        <span className="font-sans text-[12px] text-obsidian font-semibold leading-none">
                            {initials}
                        </span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="font-serif text-[15px] text-bone leading-[1.2] truncate">
                            {orgName}
                        </p>
                        <span className="inline-block mt-1 font-sans text-[10px] tracking-[0.14em] uppercase text-muted-gold/80 border border-muted-gold/25 px-1.5 py-[2px] rounded-sm">
                            The Scaler
                        </span>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <span className="font-sans text-[12px] text-bone/65">
                        Net 30 · Tax Exempt
                    </span>
                    <UserButton appearance={{ elements: { avatarBox: "w-6 h-6" } }} />
                </div>
            </div>

            {/* Navigation */}
            <nav className="py-2 flex-1 overflow-y-auto">
                {navItems.map((item) => {
                    const active = isActive(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-6 py-[11px] border-l-2 transition-all duration-150 ${
                                active
                                    ? "bg-muted-gold/[0.10] border-muted-gold"
                                    : "border-transparent hover:bg-white/[0.04] hover:border-white/[0.12]"
                            }`}
                        >
                            <span className={`transition-colors duration-150 ${active ? "text-muted-gold" : "text-bone/55"}`}>
                                <NavIcon id={item.id} />
                            </span>
                            <span className={`font-sans text-[13px] transition-colors duration-150 ${active ? "text-bone" : "text-bone/75"}`}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#4CAF50] shadow-[0_0_5px_rgba(76,175,80,0.6)]" />
                    <span className="font-sans text-[12px] text-bone/65">Grace online</span>
                </div>
            </div>
        </div>
    );
}
