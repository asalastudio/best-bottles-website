"use client";
/* Editorial images here are collection navigation, never SKU plates. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { HomepageData } from "@/sanity/lib/queries";
import { editorialImageUrl } from "@/sanity/lib/image";
import { FAMILY_ART, familyCardSources } from "@/lib/homepageFamilyArt";
import { CATALOG_FAMILIES } from "@/lib/catalogFilters";
import { familyFinderHref } from "@/lib/products/focused-shopping";
import { featuredCollectionCards, shopCollectionHref } from "@/lib/shopCollections";
import LocaleLink from "@/components/LocaleLink";
import { localizeCollectionName, localizeFamilyName } from "@/i18n/catalogCopy";
import { useAppLocale, useCopy } from "@/i18n/useCopy";
import { collectionCardImage } from "./collectionCardImage";
import styles from "./ShopThreeWays.module.css";

/**
 * Homepage "Shop three ways" (design handoff 2a, restacked per Jordan 2026-09-25):
 * the three-way bar is a table of contents, and each way is its own section
 * down the page — bottle families, collections, then the builder — so no
 * shopper has to discover content hidden behind a tab.
 */
export type ShopSection = "families" | "collections" | "build";
const SECTIONS: readonly ShopSection[] = ["families", "collections", "build"];
export const shopSectionId = (section: ShopSection) => `shop-${section}`;

// GPT Image 2.5 Sunburst (2026-09-25; Higgsfield, fitments re-laid via OpenAI) from the approved Cylinder
// photographs: the builder's five steps as five groups, centred on the fifths
// of the width so each step label sits under its group.
const BUILD_STEPS_IMAGE = "/assets/homepage/build-your-bottle-journey-v2.webp";
const BUILD_STEPS = ["shopStepBottle", "shopStepGlass", "shopStepFitment", "shopStepFinish", "shopStepReview"] as const;

type Props = {
    data: HomepageData | null;
    /** Glass-bottle groups per family (live Convex data); counts are hidden when absent. */
    familyCounts?: Record<string, number> | null;
};

export default function ShopThreeWays({ data, familyCounts }: Props) {
    const t = useCopy("home");
    const locale = useAppLocale();
    const [current, setCurrent] = useState<ShopSection>("families");

    // The bar marks the section the shopper is reading.
    useEffect(() => {
        const nodes = SECTIONS.map((section) => document.getElementById(shopSectionId(section))).filter((node): node is HTMLElement => Boolean(node));
        if (!nodes.length || typeof IntersectionObserver === "undefined") return;
        const observer = new IntersectionObserver((entries) => {
            const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
            const section = visible && SECTIONS.find((candidate) => shopSectionId(candidate) === visible.target.id);
            if (section) setCurrent(section);
        }, { rootMargin: "-35% 0px -55% 0px" });
        nodes.forEach((node) => observer.observe(node));
        return () => observer.disconnect();
    }, []);

    const jump = (event: MouseEvent<HTMLAnchorElement>, section: ShopSection) => {
        const target = document.getElementById(shopSectionId(section));
        if (!target) return;
        event.preventDefault();
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        window.history.replaceState(null, "", `#${shopSectionId(section)}`);
        setCurrent(section);
    };

    const build = data?.buildYourBottle;
    const buildHref = build?.destination === "/collections" ? "/collections" : "/matrix";
    const ways: Record<ShopSection, { title: string; sub: string }> = {
        families: { title: t("shopTabFamilies"), sub: t("shopTabFamiliesSub") },
        collections: { title: t("shopTabCollections"), sub: t("shopTabCollectionsSub") },
        build: { title: t("shopTabBuild"), sub: t("shopTabBuildSub") },
    };
    const number = (section: ShopSection) => String(SECTIONS.indexOf(section) + 1).padStart(2, "0");

    return (
        <div className={styles.wrap} id="shop-three-ways">
            <section className={styles.intro} aria-labelledby="shop-three-ways-heading">
                <div className={styles.inner}>
                    <div className={styles.introCopy}>
                        <p className={styles.eyebrow}>{t("shopEyebrow")}</p>
                        <h2 id="shop-three-ways-heading" className={styles.headline}>{t("shopHeadline")}</h2>
                    </div>
                    <nav aria-label={t("shopTabsLabel")}>
                        <ol className={styles.tabs}>
                            {SECTIONS.map((section) => (
                                <li key={section}>
                                    <a
                                        href={`#${shopSectionId(section)}`}
                                        className={styles.tab}
                                        aria-current={current === section ? "true" : undefined}
                                        onClick={(event) => jump(event, section)}
                                    >
                                        <span className={styles.tabTitle}>{number(section)}{"  "}{ways[section].title}</span>
                                        <span className={styles.tabSub}>{ways[section].sub}</span>
                                    </a>
                                </li>
                            ))}
                        </ol>
                    </nav>
                </div>
            </section>

            <section id={shopSectionId("families")} className={styles.block} aria-labelledby="shop-families-heading">
                <div className={styles.inner}>
                    <SectionHeading number={number("families")} way={ways.families.title} id="shop-families-heading" title={t("bottleFamilies")} href="/bottle-families" linkLabel={t("shopViewAllFamilies")} />
                    <FamiliesRail cards={data?.useEditorialArtwork ? data.designFamilyCards : undefined} familyCounts={familyCounts} />
                </div>
            </section>

            <section id={shopSectionId("collections")} className={styles.block} aria-labelledby="shop-collections-heading">
                <div className={styles.inner}>
                    <SectionHeading number={number("collections")} way={ways.collections.title} id="shop-collections-heading" title={t("collections")} href="/collections" linkLabel={t("shopViewAllCollections")} />
                    <div className={styles.collectionGrid}>
                        {featuredCollectionCards(data?.collectionCards).map((c) => {
                            const title = localizeCollectionName(locale, c.key, c.title);
                            return (
                                <LocaleLink key={c.key} href={shopCollectionHref(c.key)} className={styles.card}>
                                    <img className={styles.collectionImage} src={collectionCardImage(c)} alt={title} width={800} height={600} loading="lazy" />
                                    <span className={styles.collectionTitle}>{title}</span>
                                </LocaleLink>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section id={shopSectionId("build")} className={`${styles.block} ${styles.lastBlock}`} aria-labelledby="shop-build-heading">
                {/* The anchor the old stacked Build section used. */}
                <span id="build-your-bottle" className={styles.anchor} aria-hidden="true" />
                <div className={styles.inner}>
                    <SectionHeading number={number("build")} way={ways.build.title} href={buildHref} linkLabel={t("shopOpenBuilder")} />
                    <div className={styles.build}>
                        <div className={styles.buildCopy}>
                            <div>
                                <h3 id="shop-build-heading" className={styles.buildHeading}>{build?.heading || t("buildHeading")}</h3>
                                <p className={styles.buildText}>{build?.description || t("buildDescription")}</p>
                            </div>
                            <LocaleLink href={buildHref} className={styles.buildButton}>{build?.buttonLabel || t("buildYourBottle")}</LocaleLink>
                        </div>
                        {/* The builder's journey in one scene; the step bar mirrors the builder's. */}
                        <figure className={styles.steps}>
                            <img className={styles.stepsImage} src={BUILD_STEPS_IMAGE} alt={t("shopStepsImageAlt")} width={2000} height={755} loading="lazy" />
                            <ol className={styles.stepLabels} aria-label={t("shopStepsLabel")}>
                                {BUILD_STEPS.map((step, index) => (
                                    <li key={step}><span className={styles.stepNumber}>{index + 1}</span>{t(step)}</li>
                                ))}
                            </ol>
                        </figure>
                    </div>
                </div>
            </section>
        </div>
    );
}

function SectionHeading({ number, way, id, title, href, linkLabel }: { number: string; way: string; id?: string; title?: string; href: string; linkLabel: string }) {
    return (
        <div className={styles.blockHeading}>
            <div>
                <p className={styles.blockEyebrow}>{number} · {way}</p>
                {title && <h3 id={id} className={styles.blockTitle}>{title}</h3>}
            </div>
            <LocaleLink href={href} className={styles.viewAll}>{linkLabel}<span aria-hidden="true"> →</span></LocaleLink>
        </div>
    );
}

function FamiliesRail({ cards, familyCounts }: { cards?: HomepageData["designFamilyCards"]; familyCounts?: Record<string, number> | null }) {
    const t = useCopy("home");
    const locale = useAppLocale();
    const rail = useRef<HTMLDivElement>(null);
    const entries = cards?.length
        ? [...cards].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).filter((c) => CATALOG_FAMILIES.includes(c.family))
        : Object.keys(FAMILY_ART).map((family) => ({ family, title: family, image: undefined }));
    const [position, setPosition] = useState({ start: true, end: entries.length <= 4, index: 1 });

    const step = () => {
        const el = rail.current;
        const first = el?.firstElementChild as HTMLElement | null;
        return el && first ? first.getBoundingClientRect().width + parseFloat(getComputedStyle(el).columnGap || "0") : 0;
    };
    const update = () => {
        const el = rail.current;
        const size = step();
        if (!el || !size) return;
        setPosition({ start: el.scrollLeft < 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2, index: Math.min(entries.length, Math.round(el.scrollLeft / size) + 1) });
    };
    useEffect(() => {
        const el = rail.current;
        if (!el) return;
        const observer = new ResizeObserver(update);
        observer.observe(el);
        return () => observer.disconnect();
    }, [entries.length]); // eslint-disable-line react-hooks/exhaustive-deps
    const move = (direction: number) => rail.current?.scrollBy({
        left: direction * step(),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });

    return (
        <>
            <div ref={rail} id="shop-family-rail" className={styles.familyRail} onScroll={update} aria-label={t("familyRail")}>
                {entries.map((c) => {
                    const art = familyCardSources(c.family, editorialImageUrl(c.image, 800));
                    const label = c.title ? localizeFamilyName(locale, c.title) : localizeFamilyName(locale, c.family);
                    const count = familyCounts?.[c.family];
                    return (
                        <LocaleLink key={c.family} href={familyFinderHref(c.family)} className={`${styles.card} ${styles.familyCard}`}>
                            {/* The near-square card art suits the 1:1 frame at every width. */}
                            {art && <img className={styles.familyImage} src={art.mobile} alt={`${localizeFamilyName(locale, c.family)} bottle family`} width={800} height={800} loading="lazy" />}
                            <span className={styles.familyFooter}>
                                <span className={styles.familyName}>{label}</span>
                                {count ? <span className={styles.familyCount}>{t("shopFamilyItems", { count })}</span> : null}
                            </span>
                        </LocaleLink>
                    );
                })}
            </div>
            {entries.length > 4 && (
                <div className={styles.railControls}>
                    <span aria-live="polite">{position.index} / {entries.length}</span>
                    <span className={styles.railButtons}>
                        <button type="button" aria-label={t("previousFamily")} aria-controls="shop-family-rail" disabled={position.start} onClick={() => move(-1)}>
                            <svg viewBox="0 0 20 28" aria-hidden="true"><path d="M14 4 4 14l10 10" /></svg>
                        </button>
                        <button type="button" aria-label={t("nextFamily")} aria-controls="shop-family-rail" disabled={position.end} onClick={() => move(1)}>
                            <svg viewBox="0 0 20 28" aria-hidden="true"><path d="m6 4 10 10L6 24" /></svg>
                        </button>
                    </span>
                </div>
            )}
        </>
    );
}
