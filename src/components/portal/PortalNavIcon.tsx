import type { ReactNode } from "react";

export default function PortalNavIcon({ id }: { id: string }) {
    const icons: Record<string, ReactNode> = {
        dashboard: (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="5" height="5" rx="1" />
                <rect x="9" y="2" width="5" height="5" rx="1" />
                <rect x="2" y="9" width="5" height="5" rx="1" />
                <rect x="9" y="9" width="5" height="5" rx="1" />
            </svg>
        ),
        catalog: (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 5.5 8 2.5l5.5 3v5L8 13.5l-5.5-3v-5Z" />
                <path d="M2.5 5.5 8 8.5l5.5-3M8 8.5v5" />
            </svg>
        ),
        orders: (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 4h12M2 8h12M2 12h8" />
            </svg>
        ),
        drafts: (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 2h6l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
                <path d="M10 2v3h3" />
            </svg>
        ),
        grace: (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 9.5a2 2 0 0 1-2 2H6.5L3 14v-2.5a2 2 0 0 1-1-1.74V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5.5Z" />
                <path d="M5.5 6h5M5.5 8.5h3" />
            </svg>
        ),
        "grace-projects": (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 2h8a1 1 0 0 1 1 1v11l-5-3-5 3V3a1 1 0 0 1 1-1Z" />
            </svg>
        ),
        "grace-open": (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 2h5v5" />
                <path d="M14 2 7.5 8.5" />
                <path d="M12 10v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3" />
            </svg>
        ),
        account: (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="8" cy="5.5" r="2.5" />
                <path d="M2.5 14c0-2.76 2.46-4.5 5.5-4.5s5.5 1.74 5.5 4.5" />
            </svg>
        ),
        "tax-exemption": (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 2h7l3 3v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
                <path d="M10 2v3h3" />
                <path d="M5 9.5 6.5 11 10 7.5" />
            </svg>
        ),
        settings: (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 4.5h5M10.5 4.5H14M2 11.5h3.5M9 11.5H14" />
                <circle cx="8.75" cy="4.5" r="1.75" />
                <circle cx="7.25" cy="11.5" r="1.75" />
            </svg>
        ),
    };

    return (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
            {icons[id] ?? null}
        </span>
    );
}
