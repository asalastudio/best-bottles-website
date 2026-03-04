import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MinimalCard } from "@/components/ui/minimal-card";
import { AnimatedNumber } from "@/components/ui/animated-number";

// ─── GoldRule ──────────────────────────────────────────────────────────────────

export function GoldRule({ className = "" }: { className?: string }) {
    return (
        <div
            className={cn(
                "h-px bg-gradient-to-r from-transparent via-muted-gold to-transparent opacity-30",
                className
            )}
        />
    );
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────
// PRD: Notion-style eyebrow above every section block

export function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="font-sans text-[11px] tracking-[0.16em] uppercase text-muted-gold mb-2">
            {children}
        </p>
    );
}

// ─── PageHeader ───────────────────────────────────────────────────────────────
// PRD: "Page Header (eyebrow + title + subtitle + action buttons)"

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
        <div className="flex items-end justify-between mb-10">
            <div>
                {eyebrow && <SectionLabel>{eyebrow}</SectionLabel>}
                <h1 className="font-serif text-[34px] font-normal text-obsidian tracking-[0.01em] leading-[1.08] mb-2">
                    {title}
                </h1>
                {subtitle && (
                    <p className="font-sans text-sm text-slate leading-relaxed">
                        {subtitle}
                    </p>
                )}
            </div>
            {children && <div className="shrink-0 pb-1">{children}</div>}
        </div>
    );
}

// ─── PortalTag ────────────────────────────────────────────────────────────────
// shadcn Badge base + brand color overrides
// PRD: "Status badges use Badge with brand colors (green/gold/muted)"

type TagVariant = "gold" | "green" | "muted";

const tagConfig: Record<TagVariant, { wrap: string; dot: string }> = {
    gold: {
        wrap: "border-muted-gold/50 bg-muted-gold/[0.07] text-muted-gold hover:bg-muted-gold/[0.07]",
        dot: "bg-muted-gold",
    },
    green: {
        wrap: "border-[#5a9e5d]/40 bg-[#5a9e5d]/[0.07] text-[#5a9e5d] hover:bg-[#5a9e5d]/[0.07]",
        dot: "bg-[#5a9e5d]",
    },
    muted: {
        wrap: "border-ash/30 bg-ash/[0.05] text-ash hover:bg-ash/[0.05]",
        dot: "bg-ash",
    },
};

export function PortalTag({
    children,
    variant = "gold",
}: {
    children: React.ReactNode;
    variant?: TagVariant;
}) {
    const { wrap, dot } = tagConfig[variant];
    return (
        <Badge
            variant="outline"
            className={cn(
                "gap-1.5 font-sans text-[11px] tracking-[0.1em] rounded-sm py-1 px-2.5 font-normal whitespace-nowrap",
                wrap
            )}
        >
            <span className={cn("w-[5px] h-[5px] rounded-full shrink-0", dot)} />
            {children}
        </Badge>
    );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
// PRD: "KPI cards: Card with animated-number for live metrics"
// numericValue → cult-ui AnimatedNumber (spring count-up on mount)
// value (string) → rendered as-is for non-numeric cases

export function StatCard({
    label,
    value,
    numericValue,
    sub,
    highlight = false,
    format,
}: {
    label: string;
    value?: string;
    numericValue?: number;
    sub?: string;
    highlight?: boolean;
    format?: (n: number) => string;
}) {
    return (
        <MinimalCard
            className={cn(
                "rounded-lg px-6 py-5 bg-linen hover:bg-linen",
                highlight && "border-t-2 border-t-muted-gold"
            )}
        >
            <SectionLabel>{label}</SectionLabel>
            <p className="font-serif text-[32px] text-obsidian font-normal leading-none mt-1 mb-3">
                {numericValue !== undefined ? (
                    <AnimatedNumber
                        value={numericValue}
                        format={format ?? ((n) => n.toLocaleString())}
                        stiffness={60}
                        damping={18}
                    />
                ) : (
                    value
                )}
            </p>
            {sub && (
                <p className="font-sans text-xs text-slate">{sub}</p>
            )}
        </MinimalCard>
    );
}

// ─── PortalCard ───────────────────────────────────────────────────────────────
// PRD: "minimal-card for content cards"
// Light: cult-ui MinimalCard (beautiful layered shadow, brand bg)
// Dark: obsidian card with gold border (Grace sections, tier display)

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
                    "rounded-lg px-7 py-6 bg-obsidian border border-muted-gold/20",
                    "shadow-[0_2px_8px_rgba(0,0,0,0.14)]",
                    className
                )}
            >
                {children}
            </div>
        );
    }

    return (
        <MinimalCard className={cn("rounded-lg px-7 py-6 bg-linen hover:bg-linen", className)}>
            {children}
        </MinimalCard>
    );
}

// ─── PortalButton ─────────────────────────────────────────────────────────────
// shadcn Button as base, fully overridden with brand classes via className.
// PRD: "texture-button for primary CTAs" → use TextureButton directly for
//      hero-level actions. PortalButton handles all secondary/supporting actions.

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
    asChild,
}: {
    children: React.ReactNode;
    variant?: BtnVariant;
    size?: BtnSize;
    onClick?: () => void;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    className?: string;
    asChild?: boolean;
}) {
    const variantClass: Record<BtnVariant, string> = {
        solid: "bg-muted-gold border-muted-gold text-obsidian hover:bg-muted-gold/90 active:scale-[0.97]",
        outline: "bg-transparent border-muted-gold/50 text-muted-gold hover:bg-muted-gold/[0.08] hover:border-muted-gold active:scale-[0.97]",
        ghost: "bg-transparent border-transparent text-ash hover:text-muted-gold hover:bg-muted-gold/[0.06]",
    };

    const sizeClass: Record<BtnSize, string> = {
        sm: "h-8 px-4 text-[11px] tracking-[0.12em]",
        md: "h-9 px-5 text-xs tracking-[0.12em]",
    };

    return (
        <Button
            variant="outline"
            onClick={onClick}
            type={type}
            disabled={disabled}
            asChild={asChild}
            className={cn(
                "font-sans uppercase rounded-sm font-normal transition-all duration-150",
                variantClass[variant],
                sizeClass[size],
                className
            )}
        >
            {children}
        </Button>
    );
}
