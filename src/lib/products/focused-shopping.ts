import {
    APPLICATOR_NAV,
    CATALOG_FAMILIES,
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
    const family = familyForRoute(route);
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
        ...(context.family ? { families: [context.family] } : {}),
        ...(application ? { applicators: [...application.buckets] } : {}),
        ...(context.capacities?.length ? { capacities: context.capacities.map(normalizeCapacityFilterValue) } : {}),
        ...(context.rollerMaterials?.length ? { rollerMaterials: context.rollerMaterials } : {}),
        ...(context.glassColors?.length ? { colors: context.glassColors } : {}),
        ...(context.neckThreads?.length ? { neckThreadSizes: context.neckThreads } : {}),
    };
}

export function applicationFinderHref(application: ApplicatorNavValue): string {
    const slug = Object.entries(APPLICATION_ROUTE_SLUGS).find(([, value]) => value === application)?.[0];
    return slug ? `/catalog/application/${slug}` : "/catalog";
}

export function familyFinderHref(family: string, context: Partial<BrowseContext> = {}): string {
    const filters = browseContextToFilters({ ...context, entryMode: "family", family });
    const hasLanding = isFamilyLandingFamily(family);
    if (hasLanding) delete filters.families;
    const query = filtersToParams({
        category: null,
        collection: null,
        applicators: [],
        rollerMaterials: [],
        families: [],
        colors: [],
        capacities: [],
        neckThreadSizes: [],
        componentType: null,
        priceMin: null,
        priceMax: null,
        search: "",
        ...filters,
    }, context.sort ?? "featured").toString();
    const pathname = hasLanding ? familyFinderPath(family) : "/catalog";
    return `${pathname}${query ? `?${query}` : ""}`;
}
