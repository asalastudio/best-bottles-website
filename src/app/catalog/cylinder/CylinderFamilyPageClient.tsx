"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Breadcrumbs from "@/components/Breadcrumbs";
import FinderNavigationMemory from "@/components/catalog/FinderNavigationMemory";
import FocusedApplicationCards from "@/components/catalog/FocusedApplicationCards";
import FocusedFinderControls, { type FocusedFinderOption } from "@/components/catalog/FocusedFinderControls";
import FocusedFinderResults from "@/components/catalog/FocusedFinderResults";
import {
    APPLICATOR_NAV,
    ROLLER_MATERIALS,
    filtersToParams,
    paramsToFilters,
    type ApplicatorNavValue,
    type CatalogFilters,
    type RollerMaterial,
    type SortValue,
} from "@/lib/catalogFilters";
import { buildCatalogSearchArgs, fetchCatalogSearch } from "@/lib/catalogSearchClient";
import type { CatalogSearchResultShape } from "@/lib/catalogSearchFallback";
import { applyCatalogSurface, CYLINDER_CATALOG_SURFACE } from "@/lib/catalogSurface";
import { analytics } from "@/lib/analytics";
import { useGrace } from "@/components/useGrace";
import { buildGuidedFinderFamilies, conflictingRefinement } from "@/lib/products/guided-finder";
import { buildCylinderApplicationOptions } from "@/lib/products/cylinder-family-page";
import { parseBrowseContext } from "@/lib/products/focused-shopping";
import type { ProductFamilyPageContent } from "@/sanity/lib/queries";

type Props = {
    baseCatalog: CatalogSearchResultShape;
    initialResult: CatalogSearchResultShape;
    search: string;
    editorial: ProductFamilyPageContent | null;
};

const PATHNAME = "/catalog/cylinder";

function applicationFromFilters(filters: CatalogFilters): ApplicatorNavValue | null {
    return APPLICATOR_NAV.find((application) => (
        application.buckets.length === filters.applicators.length
        && application.buckets.every((bucket) => filters.applicators.includes(bucket))
    ))?.value ?? null;
}

function urlBackedState(search: string): { filters: CatalogFilters; sort: SortValue } {
    const params = new URLSearchParams(search);
    const parsed = paramsToFilters(params);
    const filters = applyCatalogSurface(parsed.filters, CYLINDER_CATALOG_SURFACE);
    const application = applicationFromFilters(filters);
    return {
        filters: {
            ...filters,
            rollerMaterials: application && application !== "rollon" ? [] : filters.rollerMaterials,
        },
        sort: params.has("sort") ? parsed.sort : CYLINDER_CATALOG_SURFACE.defaultSort,
    };
}

function finderUrl(search: string): string {
    if (!search) return PATHNAME;
    return `${PATHNAME}${search.startsWith("?") ? search : `?${search}`}`;
}

function serializeFinderSearch(filters: CatalogFilters, sort: SortValue): string {
    const scoped = applyCatalogSurface(filters, CYLINDER_CATALOG_SURFACE);
    const application = applicationFromFilters(scoped);
    const params = filtersToParams({
        ...scoped,
        rollerMaterials: application === "rollon" ? scoped.rollerMaterials : [],
    }, sort, "visual");
    params.delete("families");
    if (application !== "rollon") params.delete("roller");
    if (sort === CYLINDER_CATALOG_SURFACE.defaultSort) params.delete("sort");
    const query = params.toString();
    return query ? `?${query}` : "";
}

function refinementSummary(filters: CatalogFilters): string {
    const application = applicationFromFilters(filters);
    const applicationLabel = APPLICATOR_NAV.find((option) => option.value === application)?.label;
    return [
        "Cylinder",
        applicationLabel ?? "All applications",
        ...filters.capacities,
        ...filters.rollerMaterials.map((material) => `${material === "metal" ? "Metal" : "Plastic"} roller`),
    ].join(" / ");
}

function recoveryLabel(conflict: ReturnType<typeof conflictingRefinement>, filters: CatalogFilters): string | null {
    if (conflict === "application") {
        const application = applicationFromFilters(filters);
        return APPLICATOR_NAV.find((option) => option.value === application)?.label ?? "application";
    }
    if (conflict === "capacities") return `${filters.capacities.join(", ")} capacity`;
    if (conflict === "rollerMaterials") return `${filters.rollerMaterials.map((value) => `${value} roller`).join(", ")}`;
    if (conflict === "glassColors") return `${filters.colors.join(", ")} glass`;
    if (conflict === "neckThreads") return `${filters.neckThreadSizes.join(", ")} neck`;
    return null;
}

function removeConflictingFilter(
    conflict: ReturnType<typeof conflictingRefinement>,
    filters: CatalogFilters,
): CatalogFilters {
    if (conflict === "application") return { ...filters, applicators: [], rollerMaterials: [] };
    if (conflict === "capacities") return { ...filters, capacities: [] };
    if (conflict === "rollerMaterials") return { ...filters, rollerMaterials: [] };
    if (conflict === "glassColors") return { ...filters, colors: [] };
    if (conflict === "neckThreads") return { ...filters, neckThreadSizes: [] };
    return filters;
}

export default function CylinderFamilyPageClient({ baseCatalog, initialResult, search, editorial }: Props) {
    const router = useRouter();
    const incomingState = useMemo(() => urlBackedState(search), [search]);
    const [activeSearch, setActiveSearch] = useState(search);
    const [filters, setFilters] = useState(incomingState.filters);
    const [sort, setSort] = useState(incomingState.sort);
    const [activeResult, setActiveResult] = useState(initialResult);
    const [expandedFamily, setExpandedFamily] = useState<string | null>("Cylinder");
    const [isUpdating, setIsUpdating] = useState(false);
    const [requestError, setRequestError] = useState<string | null>(null);
    const requestController = useRef<AbortController | null>(null);
    const focusResultsAfterUpdate = useRef(false);
    const pendingFocusRoute = useRef<string | null>(null);
    const lastIncomingRoute = useRef(finderUrl(search));
    const trackedEntryRoutes = useRef(new Set<string>());
    const { openPanel: openGracePanel } = useGrace();

    const activeApplication = applicationFromFilters(filters);
    const applicationOptions = useMemo(
        () => buildCylinderApplicationOptions(baseCatalog.facets.applicators),
        [baseCatalog.facets.applicators],
    );
    const families = useMemo(() => buildGuidedFinderFamilies(activeResult), [activeResult]);
    const exactFinderUrl = finderUrl(activeSearch);

    useEffect(() => {
        if (!focusResultsAfterUpdate.current) return;
        focusResultsAfterUpdate.current = false;
        document.getElementById("focused-finder-results-heading")?.focus({ preventScroll: true });
    }, [activeResult]);

    useEffect(() => () => requestController.current?.abort(), []);

    useEffect(() => {
        if (isUpdating) return;
        const route = finderUrl(activeSearch);
        if (trackedEntryRoutes.current.has(route)) return;
        trackedEntryRoutes.current.add(route);
        analytics.finderEntered({
            entryMode: "family",
            family: "Cylinder",
            ...(activeApplication ? { application: activeApplication } : {}),
            resultCount: activeResult.totalCount,
        });
    }, [activeApplication, activeResult.totalCount, activeSearch, isUpdating]);

    useEffect(() => {
        const incomingRoute = finderUrl(search);
        if (incomingRoute === lastIncomingRoute.current) return;
        lastIncomingRoute.current = incomingRoute;
        requestController.current?.abort();
        if (pendingFocusRoute.current === incomingRoute) {
            focusResultsAfterUpdate.current = true;
            pendingFocusRoute.current = null;
        }
        setActiveSearch(search);
        setFilters(incomingState.filters);
        setSort(incomingState.sort);
        setActiveResult(initialResult);
        setIsUpdating(false);
        setRequestError(null);
    }, [incomingState, initialResult, search]);

    const runSearch = useCallback(async (input: {
        filters: CatalogFilters;
        sort: SortValue;
        search: string;
        focusResults: boolean;
        tracking?: {
            refinement?: {
                dimension: "application" | "capacity" | "rollerMaterial";
                action: "selected" | "removed";
                value: string;
            };
            recoveredDimension?: "application" | "capacity" | "rollerMaterial" | "family" | "glassColor" | "neckThread";
        };
    }) => {
        requestController.current?.abort();
        const controller = new AbortController();
        requestController.current = controller;
        const args = buildCatalogSearchArgs({
            surface: CYLINDER_CATALOG_SURFACE,
            filters: input.filters,
            sort: input.sort,
            view: "visual",
            limit: 240,
        });

        setIsUpdating(true);
        setRequestError(null);
        setActiveSearch(input.search);
        setFilters(input.filters);
        setSort(input.sort);
        const nextRoute = finderUrl(input.search);
        if (input.focusResults) pendingFocusRoute.current = nextRoute;
        router.replace(nextRoute, { scroll: false });

        try {
            const nextResult = await fetchCatalogSearch(args, controller.signal);
            if (controller.signal.aborted) return;
            if (input.focusResults) {
                pendingFocusRoute.current = null;
                focusResultsAfterUpdate.current = true;
            }
            setActiveResult(nextResult);
            if (input.tracking?.refinement) {
                analytics.finderRefined({
                    entryMode: "family",
                    ...input.tracking.refinement,
                    resultCount: nextResult.totalCount,
                });
            }
            if (input.tracking?.recoveredDimension) {
                analytics.finderZeroResultRecovered({
                    entryMode: "family",
                    removedDimension: input.tracking.recoveredDimension,
                });
            }
            setExpandedFamily("Cylinder");
        } catch (error) {
            if (controller.signal.aborted) return;
            setRequestError("Unable to update these results. Try the selection again.");
            if (input.focusResults) {
                pendingFocusRoute.current = null;
                document.getElementById("focused-finder-results-heading")?.focus({ preventScroll: true });
            }
            console.error("[Cylinder Finder] Search failed", error);
        } finally {
            if (!controller.signal.aborted) setIsUpdating(false);
        }
    }, [router]);

    const navigateWithFilters = useCallback((nextFilters: CatalogFilters, focusResults = false, tracking?: {
        refinement?: {
            dimension: "application" | "capacity" | "rollerMaterial";
            action: "selected" | "removed";
            value: string;
        };
        recoveredDimension?: "application" | "capacity" | "rollerMaterial" | "family" | "glassColor" | "neckThread";
    }) => {
        const nextSearch = serializeFinderSearch(nextFilters, sort);
        void runSearch({ filters: nextFilters, sort, search: nextSearch, focusResults, tracking });
    }, [runSearch, sort]);

    const handleApplicationChange = useCallback((nextApplication: ApplicatorNavValue) => {
        if (nextApplication === activeApplication) return;
        const application = APPLICATOR_NAV.find((option) => option.value === nextApplication);
        if (!application) return;
        navigateWithFilters(applyCatalogSurface({
            applicators: [...application.buckets],
            capacities: filters.capacities,
            rollerMaterials: nextApplication === "rollon" ? filters.rollerMaterials : [],
        }, CYLINDER_CATALOG_SURFACE), true, {
            refinement: { dimension: "application", action: "selected", value: nextApplication },
        });
    }, [activeApplication, filters, navigateWithFilters]);

    const toggleCapacity = useCallback((capacity: string) => {
        const action = filters.capacities.includes(capacity) ? "removed" : "selected";
        navigateWithFilters({
            ...filters,
            capacities: filters.capacities.includes(capacity)
                ? filters.capacities.filter((value) => value !== capacity)
                : [...filters.capacities, capacity],
        }, false, { refinement: { dimension: "capacity", action, value: capacity } });
    }, [filters, navigateWithFilters]);

    const toggleRollerMaterial = useCallback((material: RollerMaterial) => {
        const action = filters.rollerMaterials.includes(material) ? "removed" : "selected";
        navigateWithFilters({
            ...filters,
            rollerMaterials: filters.rollerMaterials.includes(material)
                ? filters.rollerMaterials.filter((value) => value !== material)
                : [...filters.rollerMaterials, material],
        }, false, { refinement: { dimension: "rollerMaterial", action, value: material } });
    }, [filters, navigateWithFilters]);

    const capacityOptions = useMemo<FocusedFinderOption[]>(() => {
        const sourceValues = Object.values(baseCatalog.facets.capacities);
        const known = new Set(sourceValues.map((option) => option.label));
        return [
            ...sourceValues,
            ...filters.capacities.filter((value) => !known.has(value)).map((label) => ({
                label,
                ml: Number.parseFloat(label) || null,
                count: 0,
            })),
        ]
            .sort((a, b) => (a.ml ?? Number.POSITIVE_INFINITY) - (b.ml ?? Number.POSITIVE_INFINITY))
            .map((option) => ({
                value: option.label,
                label: option.label,
                count: activeResult.facets.capacities[option.label]?.count ?? 0,
            }));
    }, [activeResult.facets.capacities, baseCatalog.facets.capacities, filters.capacities]);

    const rollerMaterialOptions = useMemo<FocusedFinderOption<RollerMaterial>[]>(() => (
        activeApplication === "rollon"
            ? ROLLER_MATERIALS.map((material) => ({
                value: material,
                label: material === "metal" ? "Metal" : "Plastic",
                count: activeResult.facets.rollerMaterials[material] ?? 0,
            }))
            : []
    ), [activeApplication, activeResult.facets.rollerMaterials]);

    const browseContext = useMemo(
        () => parseBrowseContext(PATHNAME, new URLSearchParams(activeSearch)),
        [activeSearch],
    );
    const conflict = activeResult.totalCount === 0
        ? conflictingRefinement(browseContext, activeResult.facets)
        : null;
    const conflictLabel = recoveryLabel(conflict, filters);
    const removeConflict = useCallback(() => {
        const recoveredDimension = conflict === "application" ? "application"
            : conflict === "capacities" ? "capacity"
                : conflict === "rollerMaterials" ? "rollerMaterial"
                    : conflict === "glassColors" ? "glassColor"
                        : conflict === "neckThreads" ? "neckThread"
                            : undefined;
        navigateWithFilters(removeConflictingFilter(conflict, filters), false, recoveredDimension ? { recoveredDimension } : undefined);
    }, [conflict, filters, navigateWithFilters]);
    const openGraceFromFinder = useCallback(() => {
        analytics.graceOpenedFromShopping({
            source: "finder",
            family: "Cylinder",
            ...(activeApplication ? { application: activeApplication } : {}),
        });
        openGracePanel();
    }, [activeApplication, openGracePanel]);
    const openFinderResult = useCallback((product: { family: string; href: string }) => {
        const slug = product.href.match(/^\/products\/([a-z0-9-]+)(?:[/?#]|$)/i)?.[1];
        if (!slug) return;
        analytics.finderResultOpened({
            entryMode: "family",
            family: product.family,
            ...(activeApplication ? { application: activeApplication } : {}),
            slug,
        });
    }, [activeApplication]);
    const restoreExpandedFamily = useCallback((family: string | null) => {
        setExpandedFamily(family);
    }, []);

    const heroImageUrl = editorial?.familyHeroImageUrl || "/assets/Cylinder-BB.png";
    const heroAlt = editorial?.familyHeroAlt || "Cylinder bottle and compatible closure displayed on warm natural stone";
    const story = editorial?.familyStory || "A clean glass profile offered across dispensing systems and capacities. Start with the application your formula needs, then compare exact wholesale products.";

    return (
        <>
            <Navbar variant="catalog" />
            <main className="min-h-screen bg-warm-white pb-20 pt-[112px] text-obsidian xl:pt-[120px]">
                <Breadcrumbs steps={[{ label: "Catalog", href: "/catalog" }, { label: "Cylinder" }]} />
                <section className="mx-auto max-w-[1440px] px-5 pb-10 sm:px-6 lg:px-10 lg:pb-14">
                    <div className="grid border-y border-champagne/70 bg-bone lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                        <div className="flex flex-col justify-center px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
                            <p className="text-xs font-medium text-muted-gold">{editorial?.familyPageEyebrow || "Bottle family"}</p>
                            <h1 className="mt-2 font-serif text-5xl font-medium leading-none sm:text-6xl">Cylinder</h1>
                            <p className="mt-5 max-w-xl text-sm leading-7 text-slate">{story}</p>
                            <p className="mt-5 border-l-2 border-muted-gold pl-4 text-sm text-obsidian">
                                Cylinder is fixed here. Application and capacity are optional refinements.
                            </p>
                            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                                <a
                                    href="#cylinder-finder"
                                    className="inline-flex min-h-11 items-center justify-center bg-obsidian px-5 text-sm font-semibold text-bone focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-muted-gold"
                                >
                                    Find Cylinder products
                                </a>
                                <Link
                                    href="/matrix?family=Cylinder&from=finder"
                                    className="inline-flex min-h-11 items-center justify-center border border-obsidian px-5 text-sm font-semibold text-obsidian focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-muted-gold"
                                >
                                    Build a Bottle
                                </Link>
                            </div>
                        </div>
                        <div className="relative min-h-[340px] overflow-hidden bg-travertine sm:min-h-[460px]">
                            <Image
                                src={heroImageUrl}
                                alt={heroAlt}
                                fill
                                priority
                                unoptimized={heroImageUrl.startsWith("http")}
                                className="object-cover"
                                sizes="(max-width: 1024px) 100vw, 55vw"
                            />
                        </div>
                    </div>
                </section>

                <section id="cylinder-finder" className="scroll-mt-28 border-y border-champagne/70 bg-linen">
                    <div className="mx-auto max-w-[1440px] px-5 py-10 sm:px-6 lg:px-10 lg:py-14">
                        <div className="max-w-3xl">
                            <h2 className="font-serif text-4xl font-medium leading-none sm:text-5xl">Find your Cylinder bottle</h2>
                            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate">
                                Choose a dispensing application or browse every exact Cylinder product. Capacity and roller construction remain optional.
                            </p>
                        </div>
                        <FocusedApplicationCards
                            applications={applicationOptions}
                            activeApplication={activeApplication}
                            onSelect={handleApplicationChange}
                            className="mt-8"
                        />
                        <p className="mt-5 border-l-2 border-muted-gold pl-4 text-sm font-medium text-obsidian" aria-label="Current bottle specification">
                            {refinementSummary(filters)}
                        </p>
                        {requestError ? <p className="mt-3 text-sm text-red-800" role="status">{requestError}</p> : null}
                        <button type="button" onClick={openGraceFromFinder} className="mt-4 text-sm font-semibold text-obsidian underline underline-offset-4">
                            Ask Grace for help choosing
                        </button>
                    </div>
                </section>

                <div className="mx-auto max-w-[1440px] px-5 pt-10 sm:px-6 lg:px-10 lg:pt-14">
                    <FocusedFinderResults
                        families={families}
                        finderUrl={exactFinderUrl}
                        resultCount={activeResult.totalCount}
                        expandedFamily={expandedFamily}
                        onExpandedFamilyChange={setExpandedFamily}
                        isUpdating={isUpdating}
                        onProductOpen={openFinderResult}
                        recovery={conflict && conflictLabel ? {
                            filterLabel: conflictLabel,
                            onRemove: removeConflict,
                        } : undefined}
                        refinementControls={(
                            <FocusedFinderControls
                                capacityOptions={capacityOptions}
                                rollerMaterialOptions={rollerMaterialOptions}
                                selectedCapacities={filters.capacities}
                                selectedRollerMaterials={filters.rollerMaterials}
                                onToggleCapacity={toggleCapacity}
                                onToggleRollerMaterial={toggleRollerMaterial}
                            />
                        )}
                    />
                </div>
            </main>
            <FinderNavigationMemory
                pathname={PATHNAME}
                search={activeSearch}
                expandedFamily={expandedFamily}
                onRestoreExpandedFamily={restoreExpandedFamily}
            />
        </>
    );
}
