import {
    APPLICATOR_NAV,
    CATALOG_FAMILIES,
    EMPTY_FILTERS,
    filtersToParams,
    normalizeCapacityFilterValue,
    paramsToFilters,
    type ApplicatorNavValue,
    type CatalogFilters,
    type RollerMaterial,
    type SortValue,
} from "@/lib/catalogFilters";

export const APPLICATION_ROUTE_SLUGS = {
    "roll-on": "rollon",
    spray: "spray",
    dropper: "dropper",
    "lotion-pump": "lotionpump",
    reducer: "reducer",
} as const satisfies Record<string, ApplicatorNavValue>;

export type BrowseEntryMode = "family" | "application" | "search" | "grace" | "matrix";

export type BrowseContext = {
    shopCollection?: string;
    entryMode: BrowseEntryMode;
    family?: string;
    application?: ApplicatorNavValue;
    capacities?: string[];
    rollerMaterials?: RollerMaterial[];
    glassColors?: string[];
    neckThreads?: string[];
    sort?: SortValue;
};

function applicationForBuckets(buckets: readonly string[]): ApplicatorNavValue | undefined {
    return APPLICATOR_NAV.find((candidate) => (
        candidate.buckets.length === buckets.length
        && candidate.buckets.every((bucket) => buckets.includes(bucket))
    ))?.value;
}

function applicationForRoute(pathname: string): ApplicatorNavValue | undefined {
    const route = pathname.replace(/\/+$/, "");
    const match = route.match(/^\/catalog\/application\/([^/]+)$/);
    if (!match) return undefined;
    return APPLICATION_ROUTE_SLUGS[match[1] as keyof typeof APPLICATION_ROUTE_SLUGS];
}

function isApplicationRoute(pathname: string): boolean {
    return /^\/catalog\/application\/[^/]+$/.test(pathname);
}

export function familyToSlug(family: string): string {
    return family.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const FAMILY_BY_SLUG = new Map(
    CATALOG_FAMILIES.map((family) => [familyToSlug(family), family] as const),
);

export function familyFromSlug(slug: string): string | undefined {
    return FAMILY_BY_SLUG.get(slug.trim().toLowerCase());
}

export function isFamilyLandingFamily(family: string): boolean {
    return familyFromSlug(familyToSlug(family)) === family;
}

export function familyFinderPath(family: string): string {
    return `/catalog/${familyToSlug(family)}`;
}

function familyForRoute(pathname: string): string | undefined {
    const route = pathname.replace(/\/+$/, "");
    const match = route.match(/^\/catalog\/([^/]+)$/);
    if (!match || match[1] === "application") return undefined;
    return familyFromSlug(match[1]);
}

export function parseBrowseContext(pathname: string, params: URLSearchParams): BrowseContext {
    const route = pathname.replace(/\/+$/, "");
    const { filters, sort } = paramsToFilters(params);
    const routeApplication = applicationForRoute(route);
    const family = familyForRoute(route) ?? (filters.families.length === 1 && CATALOG_FAMILIES.includes(filters.families[0]) ? filters.families[0] : undefined);
    const application = routeApplication ?? (isApplicationRoute(route) ? undefined : applicationForBuckets(filters.applicators));
    const entryMode: BrowseEntryMode = routeApplication
        ? "application"
        : family
            ? "family"
            : route === "/matrix"
                ? "matrix"
                : "search";

    return {
        entryMode,
        ...(family ? { family } : {}),
        ...(application ? { application } : {}),
        ...(filters.shopCollection ? { shopCollection: filters.shopCollection } : {}),
        ...(filters.capacities.length ? { capacities: filters.capacities } : {}),
        ...(filters.rollerMaterials.length ? { rollerMaterials: filters.rollerMaterials } : {}),
        ...(filters.colors.length ? { glassColors: filters.colors } : {}),
        ...(filters.neckThreadSizes.length ? { neckThreads: filters.neckThreadSizes } : {}),
        ...(sort !== "featured" ? { sort } : {}),
    };
}

export function browseContextToFilters(context: BrowseContext): Partial<CatalogFilters> {
    const application = context.application
        ? APPLICATOR_NAV.find((candidate) => candidate.value === context.application)
        : undefined;
    return {
        ...(context.shopCollection ? { shopCollection: context.shopCollection } : {}),
        ...(context.family ? { families: [context.family] } : {}),
        ...(application ? { applicators: [...application.buckets] } : {}),
        ...(context.capacities?.length ? { capacities: context.capacities.map(normalizeCapacityFilterValue) } : {}),
        ...(context.rollerMaterials?.length ? { rollerMaterials: context.rollerMaterials } : {}),
        ...(context.glassColors?.length ? { colors: context.glassColors } : {}),
        ...(context.neckThreads?.length ? { neckThreadSizes: context.neckThreads } : {}),
    };
}

export function applicationGuidePath(application: ApplicatorNavValue): string {
    const slug = Object.entries(APPLICATION_ROUTE_SLUGS).find(([, value]) => value === application)?.[0];
    return slug ? `/catalog/application/${slug}` : "/catalog";
}

export function applicationFinderHref(application: ApplicatorNavValue): string {
    const nav = APPLICATOR_NAV.find((candidate) => candidate.value === application);
    if (!nav) return "/catalog";
    const query = filtersToParams({
        ...EMPTY_FILTERS,
        applicators: [...nav.buckets],
    }, "capacity-asc").toString();
    return `/catalog?${query}`;
}

export function familyGuideHref(family: string): string {
    return `${familyFinderPath(family)}?guide=1`;
}

export function familyFinderHref(family: string, context: Partial<BrowseContext> = {}): string {
    const filters = browseContextToFilters({ ...context, entryMode: "family", family });
    const query = filtersToParams({
        ...EMPTY_FILTERS,
        ...filters,
        category: "Glass Bottle",
        families: [family],
    }, context.sort ?? "capacity-asc").toString();
    return `/catalog?${query}`;
}

export function familyLandingRedirect(family: string, sp: URLSearchParams): string | null {
    if (sp.get("guide") === "1") return null;
    const parsed = paramsToFilters(sp);
    const context = parseBrowseContext(familyFinderPath(family), sp);
    const href = familyFinderHref(family, {
        ...context,
        sort: sp.has("sort") ? parsed.sort : (parsed.filters.search ? "best-match" : "capacity-asc"),
    });
    if (!parsed.filters.search) return href;
    const params = new URLSearchParams(href.split("?")[1] ?? "");
    params.set("search", parsed.filters.search);
    return `/catalog?${params.toString()}`;
}

export function applicationLandingRedirect(pathname: string, sp: URLSearchParams): string | null {
    if (sp.get("guide") === "1") return null;
    const context = parseBrowseContext(pathname, sp);
    if (context.entryMode !== "application" || !context.application) return null;
    const parsed = paramsToFilters(sp);
    const query = filtersToParams({
        ...parsed.filters,
        ...browseContextToFilters(context),
    }, sp.has("sort") ? parsed.sort : (parsed.filters.search ? "best-match" : "capacity-asc")).toString();
    return `/catalog?${query}`;
}
