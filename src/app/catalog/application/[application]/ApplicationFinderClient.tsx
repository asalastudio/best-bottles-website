"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import FinderNavigationMemory from "@/components/catalog/FinderNavigationMemory";
import FocusedApplicationCards from "@/components/catalog/FocusedApplicationCards";
import FocusedFinderControls, { type FocusedFinderOption } from "@/components/catalog/FocusedFinderControls";
import FocusedFinderResults from "@/components/catalog/FocusedFinderResults";
import {
    APPLICATOR_NAV,
    EMPTY_FILTERS,
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
import { applicationCatalogSurface } from "@/lib/catalogSurface";
import { analytics } from "@/lib/analytics";
import { useGrace } from "@/components/useGrace";
import {
    buildGuidedFinderFamilies,
    conflictingRefinement,
} from "@/lib/products/guided-finder";
import {
    applicationFinderHref,
    parseBrowseContext,
} from "@/lib/products/focused-shopping";

type ApplicationFinderClientProps = {
    application: ApplicatorNavValue;
    pathname: string;
    search: string;
    unrefinedFacetSource: CatalogSearchResultShape;
    initialResult: CatalogSearchResultShape;
};

function urlBackedFilters(application: ApplicatorNavValue, search: string): CatalogFilters {
    const parsed = paramsToFilters(new URLSearchParams(search));
    return {
        ...parsed.filters,
        applicators: [],
        rollerMaterials: application === "rollon" ? parsed.filters.rollerMaterials : [],
    };
}

function urlBackedSort(application: ApplicatorNavValue, search: string): SortValue {
    const params = new URLSearchParams(search);
    return params.has("sort")
        ? paramsToFilters(params).sort
        : applicationCatalogSurface(application).defaultSort;
}

function finderUrl(pathname: string, search: string): string {
    if (!search) return pathname;
    return `${pathname}${search.startsWith("?") ? search : `?${search}`}`;
}

function serializeFinderSearch(
    application: ApplicatorNavValue,
    filters: CatalogFilters,
    sort: SortValue,
): string {
    const surface = applicationCatalogSurface(application);
    const params = filtersToParams({
        ...filters,
        applicators: [],
        rollerMaterials: application === "rollon" ? filters.rollerMaterials : [],
    }, sort, "visual");
    params.delete("applicators");
    if (application !== "rollon") params.delete("roller");
    if (sort === surface.defaultSort) params.delete("sort");
    const query = params.toString();
    return query ? `?${query}` : "";
}

function refinementSummary(application: ApplicatorNavValue, filters: CatalogFilters): string {
    const applicationLabel = APPLICATOR_NAV.find((option) => option.value === application)?.label ?? application;
    return [
        applicationLabel,
        ...filters.capacities,
        ...filters.rollerMaterials.map((material) => `${material === "metal" ? "Metal" : "Plastic"} roller`),
        ...filters.colors,
        ...filters.neckThreadSizes.map((thread) => `${thread} neck`),
        ...filters.families,
    ].join(" / ");
}

function recoveryLabel(conflict: ReturnType<typeof conflictingRefinement>, filters: CatalogFilters): string | null {
    if (conflict === "capacities") return `${filters.capacities.join(", ")} capacity`;
    if (conflict === "rollerMaterials") return `${filters.rollerMaterials.map((value) => `${value} roller`).join(", ")}`;
    if (conflict === "glassColors") return `${filters.colors.join(", ")} glass`;
    if (conflict === "neckThreads") return `${filters.neckThreadSizes.join(", ")} neck`;
    if (conflict === "family") return filters.families.join(", ");
    return null;
}

function removeConflictingFilter(
    conflict: ReturnType<typeof conflictingRefinement>,
    filters: CatalogFilters,
): CatalogFilters {
    if (conflict === "capacities") return { ...filters, capacities: [] };
    if (conflict === "rollerMaterials") return { ...filters, rollerMaterials: [] };
    if (conflict === "glassColors") return { ...filters, colors: [] };
    if (conflict === "neckThreads") return { ...filters, neckThreadSizes: [] };
    if (conflict === "family") return { ...filters, families: [] };
    return filters;
}

export default function ApplicationFinderClient({
    application,
    pathname,
    search,
    unrefinedFacetSource,
    initialResult,
}: ApplicationFinderClientProps) {
    const router = useRouter();
    const [activeApplication, setActiveApplication] = useState(application);
    const [activePathname, setActivePathname] = useState(pathname);
    const [activeSearch, setActiveSearch] = useState(search);
    const [filters, setFilters] = useState<CatalogFilters>(() => urlBackedFilters(application, search));
    const [sort, setSort] = useState<SortValue>(() => urlBackedSort(application, search));
    const [facetSource, setFacetSource] = useState(unrefinedFacetSource);
    const [activeResult, setActiveResult] = useState(initialResult);
    const initialFamilies = useMemo(() => buildGuidedFinderFamilies(initialResult), [initialResult]);
    const [expandedFamily, setExpandedFamily] = useState<string | null>(initialFamilies[0]?.family ?? null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [requestError, setRequestError] = useState<string | null>(null);
    const requestController = useRef<AbortController | null>(null);
    const focusResultsAfterUpdate = useRef(false);
    const pendingFocusRoute = useRef<string | null>(null);
    const lastIncomingRoute = useRef(finderUrl(pathname, search));
    const trackedEntryRoutes = useRef(new Set<string>());
    const { openPanel: openGracePanel } = useGrace();

    const families = useMemo(() => buildGuidedFinderFamilies(activeResult), [activeResult]);
    const exactFinderUrl = finderUrl(activePathname, activeSearch);

    useEffect(() => {
        if (!focusResultsAfterUpdate.current) return;
        focusResultsAfterUpdate.current = false;
        document.getElementById("focused-finder-results-heading")?.focus({ preventScroll: true });
    }, [activeResult]);

    useEffect(() => () => requestController.current?.abort(), []);

    useEffect(() => {
        if (isUpdating) return;
        const route = finderUrl(activePathname, activeSearch);
        if (trackedEntryRoutes.current.has(route)) return;
        trackedEntryRoutes.current.add(route);
        analytics.finderEntered({
            entryMode: "application",
            application: activeApplication,
            resultCount: activeResult.totalCount,
        });
    }, [activeApplication, activePathname, activeResult.totalCount, activeSearch, isUpdating]);

    useEffect(() => {
        const incomingRoute = finderUrl(pathname, search);
        if (incomingRoute === lastIncomingRoute.current) return;
        lastIncomingRoute.current = incomingRoute;
        requestController.current?.abort();
        if (pendingFocusRoute.current === incomingRoute) {
            focusResultsAfterUpdate.current = true;
            pendingFocusRoute.current = null;
        }
        setActiveApplication(application);
        setActivePathname(pathname);
        setActiveSearch(search);
        setFilters(urlBackedFilters(application, search));
        setSort(urlBackedSort(application, search));
        setFacetSource(unrefinedFacetSource);
        setActiveResult(initialResult);
        setIsUpdating(false);
        setRequestError(null);
        const nextFamilies = buildGuidedFinderFamilies(initialResult);
        setExpandedFamily((current) => (
            current === null || nextFamilies.some((family) => family.family === current)
                ? current
                : nextFamilies[0]?.family ?? null
        ));
    }, [
        application,
        initialResult,
        pathname,
        search,
        unrefinedFacetSource,
    ]);

    const runSearch = useCallback(async (input: {
        application: ApplicatorNavValue;
        filters: CatalogFilters;
        sort: SortValue;
        pathname: string;
        search: string;
        refreshFacetSource: boolean;
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
        const surface = applicationCatalogSurface(input.application);
        const activeArgs = buildCatalogSearchArgs({
            surface,
            filters: input.filters,
            sort: input.sort,
            view: "visual",
            limit: 240,
        });
        const unrefinedArgs = buildCatalogSearchArgs({
            surface,
            filters: EMPTY_FILTERS,
            sort: surface.defaultSort,
            view: "visual",
            limit: 240,
        });

        setIsUpdating(true);
        setRequestError(null);
        setActiveApplication(input.application);
        setActivePathname(input.pathname);
        setActiveSearch(input.search);
        setFilters(input.filters);
        setSort(input.sort);
        const nextRoute = finderUrl(input.pathname, input.search);
        if (input.focusResults) pendingFocusRoute.current = nextRoute;
        router.replace(nextRoute, { scroll: false });

        try {
            const activePromise = fetchCatalogSearch(activeArgs, controller.signal);
            const facetPromise = input.refreshFacetSource
                ? (JSON.stringify(activeArgs) === JSON.stringify(unrefinedArgs)
                    ? activePromise
                    : fetchCatalogSearch(unrefinedArgs, controller.signal))
                : Promise.resolve(null);
            const [nextResult, nextFacetSource] = await Promise.all([activePromise, facetPromise]);
            if (controller.signal.aborted) return;
            if (nextFacetSource) setFacetSource(nextFacetSource);
            if (input.focusResults) {
                pendingFocusRoute.current = null;
                focusResultsAfterUpdate.current = true;
            }
            setActiveResult(nextResult);
            if (input.tracking?.refinement) {
                analytics.finderRefined({
                    entryMode: "application",
                    ...input.tracking.refinement,
                    resultCount: nextResult.totalCount,
                });
            }
            if (input.tracking?.recoveredDimension) {
                analytics.finderZeroResultRecovered({
                    entryMode: "application",
                    removedDimension: input.tracking.recoveredDimension,
                });
            }
            const nextFamilies = buildGuidedFinderFamilies(nextResult);
            setExpandedFamily((current) => (
                current === null || nextFamilies.some((family) => family.family === current)
                    ? current
                    : nextFamilies[0]?.family ?? null
            ));
        } catch (error) {
            if (controller.signal.aborted) return;
            setRequestError("Unable to update these results. Try the selection again.");
            if (input.focusResults) {
                pendingFocusRoute.current = null;
                document.getElementById("focused-finder-results-heading")?.focus({ preventScroll: true });
            }
            console.error("[Application Finder] Search failed", error);
        } finally {
            if (!controller.signal.aborted) setIsUpdating(false);
        }
    }, [router]);

    const navigateWithFilters = useCallback((nextFilters: CatalogFilters, tracking?: {
        refinement?: {
            dimension: "application" | "capacity" | "rollerMaterial";
            action: "selected" | "removed";
            value: string;
        };
        recoveredDimension?: "application" | "capacity" | "rollerMaterial" | "family" | "glassColor" | "neckThread";
    }) => {
        const nextSearch = serializeFinderSearch(activeApplication, nextFilters, sort);
        void runSearch({
            application: activeApplication,
            filters: nextFilters,
            sort,
            pathname: activePathname,
            search: nextSearch,
            refreshFacetSource: false,
            focusResults: false,
            tracking,
        });
    }, [activeApplication, activePathname, runSearch, sort]);

    const handleApplicationChange = useCallback((nextApplication: ApplicatorNavValue) => {
        if (nextApplication === activeApplication) return;
        const nextFilters = {
            ...filters,
            applicators: [],
            rollerMaterials: nextApplication === "rollon" ? filters.rollerMaterials : [],
        };
        const nextPathname = applicationFinderHref(nextApplication);
        const nextSort = applicationCatalogSurface(nextApplication).defaultSort;
        const nextSearch = serializeFinderSearch(nextApplication, nextFilters, nextSort);
        void runSearch({
            application: nextApplication,
            filters: nextFilters,
            sort: nextSort,
            pathname: nextPathname,
            search: nextSearch,
            refreshFacetSource: true,
            focusResults: true,
            tracking: {
                refinement: { dimension: "application", action: "selected", value: nextApplication },
            },
        });
    }, [activeApplication, filters, runSearch]);

    const toggleCapacity = useCallback((capacity: string) => {
        const action = filters.capacities.includes(capacity) ? "removed" : "selected";
        navigateWithFilters({
            ...filters,
            capacities: filters.capacities.includes(capacity)
                ? filters.capacities.filter((value) => value !== capacity)
                : [...filters.capacities, capacity],
        }, { refinement: { dimension: "capacity", action, value: capacity } });
    }, [filters, navigateWithFilters]);

    const toggleRollerMaterial = useCallback((material: RollerMaterial) => {
        const action = filters.rollerMaterials.includes(material) ? "removed" : "selected";
        navigateWithFilters({
            ...filters,
            rollerMaterials: filters.rollerMaterials.includes(material)
                ? filters.rollerMaterials.filter((value) => value !== material)
                : [...filters.rollerMaterials, material],
        }, { refinement: { dimension: "rollerMaterial", action, value: material } });
    }, [filters, navigateWithFilters]);

    const capacityOptions = useMemo<FocusedFinderOption[]>(() => {
        const sourceValues = Object.values(facetSource.facets.capacities);
        const known = new Set(sourceValues.map((option) => option.label));
        const values = [
            ...sourceValues,
            ...filters.capacities.filter((value) => !known.has(value)).map((label) => ({
                label,
                ml: Number.parseFloat(label) || null,
                count: 0,
            })),
        ];
        return values
            .sort((a, b) => (a.ml ?? Number.POSITIVE_INFINITY) - (b.ml ?? Number.POSITIVE_INFINITY))
            .map((option) => ({
                value: option.label,
                label: option.label,
                count: activeResult.facets.capacities[option.label]?.count ?? 0,
            }));
    }, [activeResult.facets.capacities, facetSource.facets.capacities, filters.capacities]);

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
        () => parseBrowseContext(activePathname, new URLSearchParams(activeSearch)),
        [activePathname, activeSearch],
    );
    const conflict = activeResult.totalCount === 0
        ? conflictingRefinement(browseContext, activeResult.facets)
        : null;
    const conflictLabel = recoveryLabel(conflict, filters);
    const removeConflict = useCallback(() => {
        const recoveredDimension = conflict === "capacities" ? "capacity"
            : conflict === "rollerMaterials" ? "rollerMaterial"
                : conflict === "glassColors" ? "glassColor"
                    : conflict === "neckThreads" ? "neckThread"
                        : conflict === "family" ? "family"
                            : undefined;
        navigateWithFilters(removeConflictingFilter(conflict, filters), recoveredDimension ? { recoveredDimension } : undefined);
    }, [conflict, filters, navigateWithFilters]);
    const openGraceFromFinder = useCallback(() => {
        analytics.graceOpenedFromShopping({ source: "finder", application: activeApplication });
        openGracePanel();
    }, [activeApplication, openGracePanel]);
    const openFinderResult = useCallback((product: { family: string; href: string }) => {
        const slug = product.href.match(/^\/products\/([a-z0-9-]+)(?:[/?#]|$)/i)?.[1];
        if (!slug) return;
        analytics.finderResultOpened({
            entryMode: "application",
            family: product.family,
            application: activeApplication,
            slug,
        });
    }, [activeApplication]);
    const restoreExpandedFamily = useCallback((family: string | null) => {
        setExpandedFamily(family);
    }, []);

    const applicationOptions = APPLICATOR_NAV.map((option) => ({
        value: option.value,
        label: option.label,
        description: option.subtitle,
    }));

    return (
        <>
            <Navbar variant="catalog" />
            <main className="min-h-screen bg-warm-white pb-20 pt-[112px] text-obsidian xl:pt-[120px]">
                <section className="border-b border-champagne/70 bg-linen">
                    <div className="mx-auto max-w-[1440px] px-5 py-10 sm:px-6 lg:px-10 lg:py-14">
                        <div className="max-w-3xl">
                            <h1 className="font-serif text-4xl font-medium leading-none sm:text-5xl">Find bottles by application</h1>
                            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate">
                                Start with the dispensing system your formula needs. Capacity and construction remain optional refinements.
                            </p>
                        </div>
                        <FocusedApplicationCards
                            applications={applicationOptions}
                            activeApplication={activeApplication}
                            onSelect={handleApplicationChange}
                            className="mt-8"
                        />
                        <p className="mt-5 border-l-2 border-muted-gold pl-4 text-sm font-medium text-obsidian" aria-label="Current bottle specification">
                            {refinementSummary(activeApplication, filters)}
                        </p>
                        <button type="button" onClick={openGraceFromFinder} className="mt-4 text-sm font-semibold text-obsidian underline underline-offset-4">
                            Ask Grace for help choosing
                        </button>
                        {requestError ? (
                            <p className="mt-3 text-sm text-red-800" role="status">{requestError}</p>
                        ) : null}
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
                pathname={activePathname}
                search={activeSearch}
                expandedFamily={expandedFamily}
                onRestoreExpandedFamily={restoreExpandedFamily}
            />
        </>
    );
}
