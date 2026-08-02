"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Breadcrumbs from "@/components/Breadcrumbs";
import ProductCardImagePreview from "@/components/products/ProductCardImagePreview";
import {
    ArrowRight,
    CaretDown,
    CaretRight,
    Check,
    Package,
} from "@/components/icons";
import type { CatalogSearchResultShape } from "@/lib/catalogSearchFallback";
import {
    CYLINDER_9ML_BUILDER_OPTIONS,
    buildCylinderBuilderHref,
    type CylinderApplicatorSystem,
    type CylinderFamilyPageModel,
} from "@/lib/products/cylinder-family-page";
import { getCustomerFacingProductName } from "@/lib/products/customer-facing-names";
import { getProductCardVariantPreviews } from "@/lib/products/product-card-variant-previews";
import type { ProductFamilyPageContent } from "@/sanity/lib/queries";

type Props = {
    catalog: CatalogSearchResultShape;
    model: CylinderFamilyPageModel;
    editorial: ProductFamilyPageContent | null;
};

const FINISH_COLORS: Record<string, string> = {
    "Black Dotted": "radial-gradient(circle at 30% 30%, #d7d7d2 0 6%, transparent 7%), #191919",
    "Matte Copper": "linear-gradient(135deg, #7e3f25, #c47b52 52%, #7c3c23)",
    "Matte Gold": "linear-gradient(135deg, #8d6723, #d7b662 52%, #8e6722)",
    "Matte Silver": "linear-gradient(135deg, #85898c, #dedfdd 52%, #8f9293)",
    "Pink Dotted": "radial-gradient(circle at 30% 30%, #fff 0 6%, transparent 7%), #dba4b7",
    "Shiny Black": "linear-gradient(120deg, #080808, #5a5a5a 48%, #030303 60%)",
    "Shiny Gold": "linear-gradient(120deg, #795000, #fff0a2 48%, #7a4c00 60%)",
    "Shiny Silver": "linear-gradient(120deg, #555, #fff 48%, #6f7272 60%)",
    "Silver Dotted": "radial-gradient(circle at 30% 30%, #555 0 6%, transparent 7%), #d7d8d6",
    White: "#f7f5ef",
    Black: "#191919",
    Gold: "linear-gradient(135deg, #8d6723, #e2c775 52%, #8e6722)",
    Red: "linear-gradient(135deg, #761b20, #d65455 52%, #7d1d22)",
    Turquoise: "linear-gradient(135deg, #047b86, #53cfcd 52%, #08727c)",
};

const GLASS_SWATCHES: Record<string, string> = {
    Clear: "linear-gradient(135deg, #fff 15%, #d9e0df 48%, #fff 82%)",
    Amber: "linear-gradient(135deg, #5f2605, #b55a12 52%, #4d1e05)",
    Frosted: "linear-gradient(135deg, #fff, #dce0de)",
    "Cobalt Blue": "linear-gradient(135deg, #061658, #143ec7 52%, #061249)",
    Swirl: "repeating-linear-gradient(135deg, #fff 0 6px, #d9e0df 6px 11px)",
};

function safeVariantImage(value: string | null | undefined): string | null {
    const url = value?.trim();
    if (!url || url.includes("www.bestbottles.com/images/store/") || url.includes("cdn.sanity.io/")) return null;
    return url;
}

function formatPrice(value: number | null): string {
    return value && value > 0 ? `$${value.toFixed(2)}` : "Contact us";
}

function finishOptions(system: CylinderApplicatorSystem): readonly string[] {
    if (system === "Fine Mist Spray") return CYLINDER_9ML_BUILDER_OPTIONS.sprayFinishes;
    if (system === "Lotion Pump") return CYLINDER_9ML_BUILDER_OPTIONS.lotionFinishes;
    return CYLINDER_9ML_BUILDER_OPTIONS.rollonFinishes;
}

function BuilderPreview({ catalog }: { catalog: CatalogSearchResultShape }) {
    const [glass, setGlass] = useState("Clear");
    const [applicator, setApplicator] = useState<CylinderApplicatorSystem>("Roll-On");
    const [rollerMaterial, setRollerMaterial] = useState("Metal");
    const [finish, setFinish] = useState("Matte Gold");
    const [mobileStep, setMobileStep] = useState<"glass" | "applicator" | "finish" | null>(null);

    const images = useMemo(() => {
        const groupById = new Map(catalog.items.map((group) => [group._id, group]));
        const byGlass = new Map<string, string>();
        const byApplicator = new Map<CylinderApplicatorSystem, string>();
        for (const row of catalog.variantPreviewRows) {
            const group = groupById.get(row.groupId);
            if (!group || group.capacityMl !== 9 || group.neckThreadSize !== "17-415" || group.paperDollFamilyKey !== "CYL-9ML") continue;
            for (const variant of row.variants) {
                const image = safeVariantImage(variant.imageUrl) ?? safeVariantImage(variant.imageUrlCapOff);
                if (!image) continue;
                if (group.color && !byGlass.has(group.color)) byGlass.set(group.color, image);
                const raw = variant.applicator?.toLowerCase() ?? "";
                const system: CylinderApplicatorSystem | null = raw.includes("roller")
                    ? "Roll-On"
                    : raw.includes("spray") || raw.includes("mist")
                        ? "Fine Mist Spray"
                        : raw.includes("lotion") || raw.includes("pump")
                            ? "Lotion Pump"
                            : null;
                if (system && !byApplicator.has(system)) byApplicator.set(system, image);
            }
        }
        return { byGlass, byApplicator };
    }, [catalog]);

    const finishes = finishOptions(applicator);
    const selectedFinish = finishes.includes(finish) ? finish : finishes[0];
    const builderHref = buildCylinderBuilderHref({
        glass,
        applicator,
        rollerMaterial,
        finish: selectedFinish,
    });

    function selectApplicator(value: CylinderApplicatorSystem) {
        setApplicator(value);
        setFinish(finishOptions(value)[0]);
    }

    const glassOptions = (
        <div className="grid grid-cols-5 gap-2">
            {CYLINDER_9ML_BUILDER_OPTIONS.glassColors.map((label) => {
                const selected = glass === label;
                const imageUrl = images.byGlass.get(label);
                return (
                    <button
                        key={label}
                        type="button"
                        onClick={() => setGlass(label)}
                        aria-pressed={selected}
                        className={`group min-w-0 border bg-white p-1.5 text-center transition-colors ${selected ? "border-obsidian ring-1 ring-obsidian" : "border-champagne hover:border-muted-gold"}`}
                    >
                        <span className="relative mx-auto block h-12 w-full overflow-hidden bg-bone md:h-9">
                            {imageUrl ? (
                                <Image src={imageUrl} alt="" fill unoptimized className="object-contain" sizes="80px" />
                            ) : (
                                <span className="absolute inset-2 border border-champagne" style={{ background: GLASS_SWATCHES[label] }} />
                            )}
                        </span>
                        <span className="mt-1 block truncate text-[9px] font-semibold text-obsidian">{label.replace("Cobalt ", "")}</span>
                    </button>
                );
            })}
        </div>
    );

    const applicatorOptions = (
        <div className="grid grid-cols-3 gap-2">
            {CYLINDER_9ML_BUILDER_OPTIONS.applicatorSystems.map((label) => {
                const selected = applicator === label;
                const imageUrl = images.byApplicator.get(label);
                return (
                    <button
                        key={label}
                        type="button"
                        onClick={() => selectApplicator(label)}
                        aria-pressed={selected}
                        className={`border bg-white px-2 py-2 text-center transition-colors md:py-1 ${selected ? "border-obsidian ring-1 ring-obsidian" : "border-champagne hover:border-muted-gold"}`}
                    >
                        <span className="relative mx-auto block h-14 w-full bg-bone md:h-10">
                            {imageUrl ? <Image src={imageUrl} alt="" fill unoptimized className="object-contain" sizes="100px" /> : <Package className="absolute inset-0 m-auto h-7 w-7 text-champagne" />}
                        </span>
                        <span className="mt-1 block text-[10px] font-semibold leading-tight text-obsidian">{label}</span>
                        {label === "Roll-On" && <span className="block text-[8px] text-slate">metal or plastic</span>}
                    </button>
                );
            })}
        </div>
    );

    const finishOptionsView = (
        <div className="grid grid-cols-2 gap-2">
            {finishes.slice(0, 4).map((label) => {
                const selected = selectedFinish === label;
                return (
                    <button
                        key={label}
                        type="button"
                        onClick={() => setFinish(label)}
                        aria-pressed={selected}
                        className={`flex min-h-11 items-center gap-2 border bg-white px-2 py-1.5 text-left text-[10px] font-semibold transition-colors md:min-h-9 md:py-1 ${selected ? "border-obsidian ring-1 ring-obsidian" : "border-champagne hover:border-muted-gold"}`}
                    >
                    <span className="h-7 w-7 shrink-0 rounded-full border border-black/10 md:h-6 md:w-6" style={{ background: FINISH_COLORS[label] ?? "#d5d2ca" }} />
                        <span className="leading-tight">{label}</span>
                    </button>
                );
            })}
            {finishes.length > 4 && (
                <div className="flex min-h-11 items-center justify-center border border-champagne bg-bone px-2 text-[10px] font-semibold text-slate md:min-h-9">
                    +{finishes.length - 4} more in builder
                </div>
            )}
        </div>
    );

    const stepRows = [
        { key: "glass" as const, number: 1, title: "Choose glass", detail: `${CYLINDER_9ML_BUILDER_OPTIONS.glassColors.length} colors`, content: glassOptions },
        { key: "applicator" as const, number: 2, title: "Choose delivery system", detail: "Roll-on, spray, or lotion", content: applicatorOptions },
        { key: "finish" as const, number: 3, title: "Choose finish", detail: `${finishes.length} for ${applicator.toLowerCase()}`, content: finishOptionsView },
    ];

    return (
        <section className="h-full border border-champagne bg-bone/95 p-4 sm:p-5 lg:p-4" aria-labelledby="builder-preview-title">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-gold">9 mL · 17-415</p>
            <h2 id="builder-preview-title" className="mt-1 font-serif text-xl font-medium text-obsidian">Build this Cylinder bottle</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate">Start with the bottle, then choose compatible components.</p>

            <div className="mt-3 hidden space-y-3 md:block">
                <div>
                    <p className="mb-1.5 text-xs font-semibold text-obsidian"><span className="mr-2 text-muted-gold">1</span>Glass</p>
                    {glassOptions}
                </div>
                <div>
                    <p className="mb-1.5 text-xs font-semibold text-obsidian"><span className="mr-2 text-muted-gold">2</span>Delivery system</p>
                    {applicatorOptions}
                </div>
                {applicator === "Roll-On" && (
                    <div className="flex items-center justify-between border-y border-champagne/60 py-2">
                        <span className="text-[10px] font-semibold text-slate">Roller material</span>
                        <div className="flex gap-1">
                            {CYLINDER_9ML_BUILDER_OPTIONS.rollerMaterials.map((material) => (
                                <button key={material} onClick={() => setRollerMaterial(material)} className={`min-h-9 border px-3 text-[10px] font-semibold ${rollerMaterial === material ? "border-obsidian bg-obsidian text-white" : "border-champagne bg-white text-obsidian"}`}>{material}</button>
                            ))}
                        </div>
                    </div>
                )}
                <div>
                    <p className="mb-1.5 text-xs font-semibold text-obsidian"><span className="mr-2 text-muted-gold">3</span>Finish</p>
                    {finishOptionsView}
                </div>
            </div>

            <div className="mt-4 divide-y divide-champagne border border-champagne bg-white md:hidden">
                {stepRows.map((step) => (
                    <div key={step.key}>
                        <button
                            type="button"
                            onClick={() => setMobileStep(mobileStep === step.key ? null : step.key)}
                            aria-expanded={mobileStep === step.key}
                            className="flex min-h-16 w-full items-center gap-3 px-3 text-left"
                        >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-muted-gold text-[11px] font-bold text-muted-gold">{step.number}</span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-obsidian">{step.title}</span>
                                <span className="block text-[10px] text-slate">{step.detail}</span>
                            </span>
                            <CaretDown className={`h-4 w-4 text-slate transition-transform ${mobileStep === step.key ? "rotate-180" : ""}`} />
                        </button>
                        {mobileStep === step.key && <div className="border-t border-champagne bg-bone/50 p-3">{step.content}</div>}
                    </div>
                ))}
            </div>

            <div className="mt-4 border-t border-champagne pt-3 md:mt-3 md:pt-2">
                <p className="mb-3 text-[10px] leading-relaxed text-slate md:mb-2">
                    Starting with <strong className="text-obsidian">{glass}</strong> · {applicator}{applicator === "Roll-On" ? ` · ${rollerMaterial} roller` : ""} · {selectedFinish}
                </p>
                <Link href={builderHref} className="flex min-h-12 w-full items-center justify-center gap-2 bg-obsidian px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-muted-gold hover:text-obsidian md:min-h-10">
                    Build a 9 mL 17-415 Cylinder <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#ready-made" className="mt-2 flex min-h-12 w-full items-center justify-center border border-obsidian px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-obsidian md:hidden">
                    Browse ready-made options
                </a>
            </div>
        </section>
    );
}

function FilterCheckbox({ label, checked, onChange, count }: { label: string; checked: boolean; onChange: () => void; count?: number }) {
    return (
        <label className="flex min-h-10 cursor-pointer items-center gap-2 text-xs text-obsidian/75">
            <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 border-champagne accent-obsidian" />
            <span className="flex-1">{label}</span>
            {count != null && <span className="text-[10px] text-slate">{count}</span>}
        </label>
    );
}

function ReadyMadeCard({ group, catalog }: { group: CylinderFamilyPageModel["cards"][number]; catalog: CatalogSearchResultShape }) {
    const row = catalog.variantPreviewRows.find((candidate) => candidate.groupId === group._id);
    const representativeVariant = row?.variants[0] ?? null;
    const productTitle = getCustomerFacingProductName({ group, variant: representativeVariant, fallbackName: group.displayName }).displayName;
    const productHref = `/products/${group.slug}`;
    const previews = getProductCardVariantPreviews(row?.variants ?? [], {
        productTitle,
        defaultImageUrl: group.heroImageUrl,
        groupColor: group.color,
        productHref,
    });

    return (
        <article className="group/catalog-card flex h-full flex-col overflow-hidden border border-champagne/60 bg-white transition hover:border-muted-gold hover:shadow-md">
            <ProductCardImagePreview
                productTitle={productTitle}
                defaultImage={{ url: safeVariantImage(group.heroImageUrl), alt: productTitle }}
                placeholderLabel="Product media in preparation"
                variantPreviews={previews}
                productHref={productHref}
                maxVisibleSwatches={5}
                auditMeta={{ surface: "family-page-card", family: "Cylinder", productGroupSlug: group.slug }}
            />
            <Link href={productHref} className="flex flex-1 flex-col p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-gold">{group.capacity} · {group.neckThreadSize}</p>
                <h3 className="mt-2 font-serif text-lg font-medium leading-snug text-obsidian">{productTitle}</h3>
                <p className="mt-2 text-[11px] leading-relaxed text-slate">{group.applicatorSystems.join(" · ")} · {group.variantCount} finish{group.variantCount === 1 ? "" : "es"}</p>
                <p className="mt-auto pt-4 text-sm font-semibold text-obsidian">From {formatPrice(group.priceRangeMin)}/ea</p>
            </Link>
        </article>
    );
}

export default function CylinderFamilyPageClient({ catalog, model, editorial }: Props) {
    const [capacity, setCapacity] = useState<string[]>([]);
    const [colors, setColors] = useState<string[]>([]);
    const [applicators, setApplicators] = useState<CylinderApplicatorSystem[]>([]);
    const [neckFinishes, setNeckFinishes] = useState<string[]>([]);
    const [sort, setSort] = useState("capacity");

    const filterOptions = useMemo(() => ({
        capacities: [...new Set(model.cards.map((card) => card.capacity).filter((value): value is string => Boolean(value)))],
        colors: [...new Set(model.cards.map((card) => card.color).filter((value): value is string => Boolean(value)))],
        applicators: [...new Set(model.cards.flatMap((card) => card.applicatorSystems))],
        neckFinishes: [...new Set(model.cards.map((card) => card.neckThreadSize).filter((value): value is string => Boolean(value)))],
    }), [model.cards]);

    const visibleCards = useMemo(() => {
        const rows = model.cards.filter((card) =>
            (capacity.length === 0 || Boolean(card.capacity && capacity.includes(card.capacity)))
            && (colors.length === 0 || Boolean(card.color && colors.includes(card.color)))
            && (applicators.length === 0 || applicators.some((value) => card.applicatorSystems.includes(value)))
            && (neckFinishes.length === 0 || Boolean(card.neckThreadSize && neckFinishes.includes(card.neckThreadSize))),
        );
        return rows.sort((a, b) => {
            if (sort === "price") return (a.priceRangeMin ?? Infinity) - (b.priceRangeMin ?? Infinity);
            if (sort === "name") return a.displayName.localeCompare(b.displayName);
            if (sort === "variants") return b.variantCount - a.variantCount;
            return (a.capacityMl ?? Infinity) - (b.capacityMl ?? Infinity) || (a.color ?? "").localeCompare(b.color ?? "");
        });
    }, [model.cards, capacity, colors, applicators, neckFinishes, sort]);

    const activeFilterCount = capacity.length + colors.length + applicators.length + neckFinishes.length;
    const heroImageUrl = editorial?.familyHeroImageUrl || "/assets/Cylinder-BB.png";
    const heroAlt = editorial?.familyHeroAlt || "Cylinder roll-on bottle with a compatible cap displayed on warm natural stone";
    const story = editorial?.familyStory || "One clean bottle profile, built around how your product is dispensed. Choose the size first, then compare glass, fitment, and finish without losing compatibility context.";

    function toggle<T extends string>(value: T, selected: T[], setSelected: (next: T[]) => void) {
        setSelected(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
    }

    function clearFilters() {
        setCapacity([]);
        setColors([]);
        setApplicators([]);
        setNeckFinishes([]);
    }

    return (
        <main className="min-h-screen bg-warm-white pt-[92px] lg:pt-[120px]">
            <Navbar variant="catalog" hideMobileSearch />
            <Breadcrumbs steps={[{ label: "Catalog", href: "/catalog" }, { label: "Cylinder" }]} />

            <section className="mx-auto max-w-[1720px] px-0 sm:px-6 sm:pt-6 lg:px-8">
                <div className="grid border-b border-champagne bg-bone lg:min-h-[500px] lg:grid-cols-12">
                    <div className="flex flex-col justify-start px-5 py-5 sm:px-8 sm:py-8 lg:col-span-4 lg:px-10 lg:py-10 xl:px-12">
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-gold">{editorial?.familyPageEyebrow || "Buildable Bottle Family"}</p>
                        <h1 className="mt-2 font-serif text-5xl font-medium leading-none text-obsidian sm:text-6xl xl:text-7xl">Cylinder</h1>
                        <p className="mt-3 text-sm leading-6 text-slate lg:hidden">One profile. Choose the glass, delivery system, and finish for your product.</p>
                        <p className="mt-5 hidden max-w-lg text-sm leading-7 text-slate lg:block">{story}</p>

                        <div className="mt-7 hidden grid-cols-3 gap-3 lg:grid">
                            <div className="border border-champagne bg-white p-3">
                                <div className="mb-2 flex gap-1">{CYLINDER_9ML_BUILDER_OPTIONS.glassColors.slice(0, 4).map((label) => <span key={label} className="h-6 w-3 border border-black/10" style={{ background: GLASS_SWATCHES[label] }} />)}</div>
                                <p className="text-xs font-semibold text-obsidian">5 glass colors</p>
                            </div>
                            <div className="border border-champagne bg-white p-3">
                                <Package className="mb-2 h-6 w-6 text-muted-gold" />
                                <p className="text-xs font-semibold text-obsidian">3 delivery systems</p>
                            </div>
                            <div className="border border-champagne bg-white p-3">
                                <div className="mb-2 flex gap-1">{["Shiny Black", "Matte Gold", "Matte Silver", "White"].map((label) => <span key={label} className="h-6 w-3 border border-black/10" style={{ background: FINISH_COLORS[label] }} />)}</div>
                                <p className="text-xs font-semibold text-obsidian">10 roll-on finishes</p>
                            </div>
                        </div>
                        <p className="mt-4 hidden items-center gap-2 text-[11px] text-slate lg:flex"><Check className="h-4 w-4 text-muted-gold" /> Every builder combination is 9 mL · 17-415 compatible.</p>

                        <div className="mt-7 hidden flex-col gap-3 sm:flex-row lg:mt-8 lg:flex">
                            <Link href={buildCylinderBuilderHref()} className="flex min-h-12 items-center justify-center bg-obsidian px-5 text-[10px] font-bold uppercase tracking-[0.16em] text-white hover:bg-muted-gold hover:text-obsidian">Build a 9 mL Cylinder</Link>
                            <a href="#ready-made" className="flex min-h-12 items-center justify-center border border-obsidian px-5 text-[10px] font-bold uppercase tracking-[0.16em] text-obsidian hover:bg-obsidian hover:text-white">Browse ready-made</a>
                        </div>
                    </div>

                    <div className="relative min-h-[350px] overflow-hidden bg-travertine sm:min-h-[500px] lg:col-span-4">
                        <Image src={heroImageUrl} alt={heroAlt} fill priority unoptimized={heroImageUrl.startsWith("http")} className="object-cover" sizes="(max-width: 1024px) 100vw, 34vw" />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/35 to-transparent px-5 pb-5 pt-14 text-white lg:hidden">
                            <p className="text-xs font-semibold">One family, many compatible outcomes.</p>
                            <p className="mt-1 text-[10px] text-white/80">Beauty view above. Product choices begin below.</p>
                        </div>
                    </div>

                    <div className="p-4 sm:p-6 lg:col-span-4 lg:p-0">
                        <BuilderPreview catalog={catalog} />
                    </div>
                </div>
            </section>

            <section id="ready-made" className="scroll-mt-32 border-b border-champagne bg-warm-white">
                <div className="mx-auto max-w-[1720px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
                    <div className="mb-7 flex flex-col gap-4 border-b border-champagne pb-6 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-gold">Shop by bottle first</p>
                            <h2 className="mt-1 font-serif text-3xl font-medium text-obsidian sm:text-4xl">Ready-made Cylinder options</h2>
                            <p className="mt-2 text-xs text-slate">{model.totalVariants} configurations across {model.totalReadyMadeGroups} bottle and delivery-system groups.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate">{visibleCards.length} groups</span>
                            <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort Cylinder products" className="min-h-11 border border-champagne bg-white px-3 text-xs text-obsidian outline-none focus:border-muted-gold">
                                <option value="capacity">Sort: Capacity</option>
                                <option value="price">Sort: Price</option>
                                <option value="name">Sort: Name</option>
                                <option value="variants">Sort: Most finishes</option>
                            </select>
                        </div>
                    </div>

                    <div className="mb-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">
                        {[...filterOptions.applicators].map((label) => (
                            <button key={label} onClick={() => toggle(label, applicators, setApplicators)} className={`min-h-11 shrink-0 border px-4 text-[10px] font-bold uppercase tracking-wider ${applicators.includes(label) ? "border-obsidian bg-obsidian text-white" : "border-champagne bg-white text-obsidian"}`}>{label}</button>
                        ))}
                        {activeFilterCount > 0 && <button onClick={clearFilters} className="min-h-11 shrink-0 px-3 text-[10px] font-bold uppercase text-muted-gold">Clear {activeFilterCount}</button>}
                    </div>

                    <div className="flex items-start gap-7">
                        <aside className="sticky top-[112px] hidden w-60 shrink-0 border border-champagne bg-bone p-4 lg:block">
                            <div className="flex items-center justify-between border-b border-champagne pb-3">
                                <p className="text-xs font-bold uppercase tracking-[0.15em] text-obsidian">Refine</p>
                                {activeFilterCount > 0 && <button onClick={clearFilters} className="text-[10px] font-semibold text-muted-gold">Clear {activeFilterCount}</button>}
                            </div>
                            <div className="border-b border-champagne py-4">
                                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate">Capacity</p>
                                {filterOptions.capacities.map((label) => <FilterCheckbox key={label} label={label} checked={capacity.includes(label)} onChange={() => toggle(label, capacity, setCapacity)} />)}
                            </div>
                            <div className="border-b border-champagne py-4">
                                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate">Glass color</p>
                                {filterOptions.colors.map((label) => <FilterCheckbox key={label} label={label} checked={colors.includes(label)} onChange={() => toggle(label, colors, setColors)} />)}
                            </div>
                            <div className="border-b border-champagne py-4">
                                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate">Delivery system</p>
                                {filterOptions.applicators.map((label) => <FilterCheckbox key={label} label={label} checked={applicators.includes(label)} onChange={() => toggle(label, applicators, setApplicators)} />)}
                            </div>
                            <div className="pt-4">
                                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate">Neck finish</p>
                                {filterOptions.neckFinishes.map((label) => <FilterCheckbox key={label} label={label} checked={neckFinishes.includes(label)} onChange={() => toggle(label, neckFinishes, setNeckFinishes)} />)}
                            </div>
                        </aside>

                        <div className="min-w-0 flex-1">
                            {visibleCards.length > 0 ? (
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                                    {visibleCards.map((group) => <ReadyMadeCard key={group._id} group={group} catalog={catalog} />)}
                                </div>
                            ) : (
                                <div className="flex min-h-80 flex-col items-center justify-center border border-champagne bg-bone p-8 text-center">
                                    <Package className="h-10 w-10 text-champagne" />
                                    <h3 className="mt-4 font-serif text-2xl text-obsidian">No Cylinder groups match</h3>
                                    <p className="mt-2 text-sm text-slate">Remove one or more filters to see compatible bottle groups.</p>
                                    <button onClick={clearFilters} className="mt-5 min-h-11 bg-obsidian px-5 text-[10px] font-bold uppercase tracking-wider text-white">Clear filters</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <section className="bg-bone px-5 py-12 text-center sm:px-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-gold">Need compatibility help?</p>
                <h2 className="mt-2 font-serif text-3xl text-obsidian">Start with the product you are packaging.</h2>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate">The builder narrows choices to the exact 9 mL 17-415 Cylinder. For another capacity or neck finish, choose a ready-made group first so the available components stay accurate.</p>
                <Link href="/catalog" className="mt-6 inline-flex min-h-11 items-center gap-2 border border-obsidian px-5 text-[10px] font-bold uppercase tracking-wider text-obsidian hover:bg-obsidian hover:text-white">Browse all bottle families <CaretRight className="h-4 w-4" /></Link>
            </section>
        </main>
    );
}
