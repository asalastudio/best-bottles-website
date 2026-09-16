import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ─── Divider ──────────────────────────────────────────────────────────────────

export function GoldRule({ className = "" }: { className?: string }) {
    return <div className={cn("h-px bg-neutral-200", className)} />;
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="font-sans text-[11px] font-medium tracking-wide uppercase text-neutral-400 mb-1.5">
            {children}
        </p>
    );
}

// ─── PageHeader ───────────────────────────────────────────────────────────────

export function PageHeader({
    eyebrow,
    title,
    subtitle,
    children,
}: {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    children?: React.ReactNode;
}) {
    return (
        <div className="mb-5 flex flex-col gap-3 lg:mb-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
                {eyebrow && <SectionLabel>{eyebrow}</SectionLabel>}
                <h1 className="font-sans text-[20px] font-semibold leading-tight text-neutral-900 lg:text-[22px]">
                    {title}
                </h1>
                {subtitle && (
                    <p className="mt-1 font-sans text-sm text-neutral-500">
                        {subtitle}
                    </p>
                )}
            </div>
            {children && <div className="shrink-0">{children}</div>}
        </div>
    );
}

// ─── PortalTag ────────────────────────────────────────────────────────────────

type TagVariant = "gold" | "green" | "muted" | "blue";

const tagStyles: Record<TagVariant, string> = {
    gold: "bg-amber-50 text-amber-700 border-amber-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    muted: "bg-neutral-100 text-neutral-600 border-neutral-200",
    blue: "bg-champagne/20 text-muted-gold border-champagne",
};

export function PortalTag({
    children,
    variant = "gold",
}: {
    children: React.ReactNode;
    variant?: TagVariant;
}) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 font-sans text-[11px] font-medium px-2 py-0.5 rounded-md border whitespace-nowrap",
                tagStyles[variant]
            )}
        >
            {children}
        </span>
    );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

export function StatCard({
    label,
    value,
    numericValue,
    sub,
    highlight = false,
    format,
    href,
}: {
    label: string;
    value?: string;
    numericValue?: number;
    sub?: string;
    highlight?: boolean;
    format?: (n: number) => string;
    href?: string;
}) {
    const displayValue = numericValue !== undefined
        ? (format ?? ((n: number) => n.toLocaleString()))(numericValue)
        : value;

    const card = (
        <div
            className={cn(
                "rounded-lg border border-neutral-200 bg-white px-4 py-3.5 lg:px-5 lg:py-4",
                highlight && "border-l-2 border-l-amber-500",
                href && "transition-colors hover:bg-neutral-50"
            )}
        >
            <p className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-1">
                {label}
            </p>
            <p className="font-sans text-xl font-semibold leading-tight text-neutral-900 lg:text-2xl">
                {displayValue}
            </p>
            {sub && (
                <p className="font-sans text-xs text-neutral-500 mt-1">{sub}</p>
            )}
        </div>
    );

    if (href) {
        return (
            <Link href={href} className="block min-w-0">
                {card}
            </Link>
        );
    }
    return card;
}

// ─── PortalCard ───────────────────────────────────────────────────────────────

export function PortalCard({
    children,
    dark = false,
    className = "",
}: {
    children: React.ReactNode;
    dark?: boolean;
    className?: string;
}) {
    if (dark) {
        return (
            <div
                className={cn(
                    "rounded-lg px-6 py-5 bg-neutral-900 text-white border border-neutral-800",
                    className
                )}
            >
                {children}
            </div>
        );
    }

    return (
        <div className={cn("rounded-lg px-6 py-5 bg-white border border-neutral-200", className)}>
            {children}
        </div>
    );
}

// ─── PortalButton ─────────────────────────────────────────────────────────────

type BtnVariant = "solid" | "outline" | "ghost";
type BtnSize = "sm" | "md";

export function PortalButton({
    children,
    variant = "solid",
    size = "md",
    onClick,
    type,
    disabled,
    className,
}: {
    children: React.ReactNode;
    variant?: BtnVariant;
    size?: BtnSize;
    onClick?: () => void;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    className?: string;
}) {
    const variantClass: Record<BtnVariant, string> = {
        solid: "bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-800",
        outline: "bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50 hover:border-neutral-400",
        ghost: "bg-transparent text-neutral-500 border-transparent hover:bg-neutral-100 hover:text-neutral-700",
    };

    const sizeClass: Record<BtnSize, string> = {
        sm: "h-11 min-h-11 px-3 text-[13px] lg:h-8 lg:min-h-8",
        md: "h-11 min-h-11 px-4 text-sm lg:h-9 lg:min-h-9",
    };

    return (
        <button
            onClick={onClick}
            type={type ?? "button"}
            disabled={disabled}
            className={cn(
                "inline-flex items-center justify-center gap-2 font-sans font-medium rounded-md border transition-colors duration-100 whitespace-nowrap disabled:opacity-50",
                variantClass[variant],
                sizeClass[size],
                className
            )}
        >
            {children}
        </button>
    );
}
