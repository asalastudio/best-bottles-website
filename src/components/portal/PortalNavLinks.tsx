"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isPortalNavActive, PORTAL_NAV } from "./nav";
import PortalNavIcon from "./PortalNavIcon";

export default function PortalNavLinks({
    onNavigate,
    compact = false,
    pathname: pathnameOverride,
}: {
    onNavigate?: () => void;
    compact?: boolean;
    pathname?: string;
}) {
    const livePathname = usePathname();
    const pathname = pathnameOverride ?? livePathname;

    return (
        <nav aria-label="Portal">
            {PORTAL_NAV.map((section, index) => (
                <div key={section.label ?? `primary-${index}`}>
                    {index > 0 && <div className="mx-4 my-1.5 h-px bg-[color:var(--color-rule)]" />}
                    {section.label && (
                        <p className="px-5 pb-1 pt-1.5 font-sans text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
                            {section.label}
                        </p>
                    )}
                    {section.items.map((item) => {
                        const active = isPortalNavActive(pathname, item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-label={item.label}
                                aria-current={active ? "page" : undefined}
                                onClick={onNavigate}
                                className="mx-2 flex items-center gap-2.5 rounded-md px-3 font-sans text-[13px] transition-colors duration-100"
                                style={{
                                    minHeight: compact ? 44 : 34,
                                    background: active ? "var(--color-surface-selected)" : "transparent",
                                    color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                                    fontWeight: active ? 500 : 400,
                                }}
                            >
                                <span style={{ color: "currentColor", opacity: active ? 1 : 0.75 }}>
                                    <PortalNavIcon id={item.id} />
                                </span>
                                {item.label}
                                {active && (
                                    <span
                                        aria-hidden
                                        className="ml-auto h-4 w-[2px] rounded-full"
                                        style={{ background: "var(--color-muted-gold)" }}
                                    />
                                )}
                            </Link>
                        );
                    })}
                </div>
            ))}
        </nav>
    );
}
