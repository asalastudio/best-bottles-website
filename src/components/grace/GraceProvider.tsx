"use client";

import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useCart } from "@/components/CartProvider";
import { useAuth } from "@clerk/nextjs";
import {
    useState,
    useRef,
    useCallback,
    useEffect,
    useMemo,
    type ReactNode,
} from "react";
import { analytics } from "@/lib/analytics";
import {
    catalogFamiliesForNav,
    expandCatalogPathFamilies,
    graceCapacityOnlySearchTerm,
    graceCatalogSearchFromQuery,
    inferCatalogCategoryFromSearchTerm,
    normalizeGraceCatalogNavigationPath,
} from "@/lib/graceShapeIntent";
import {
    GraceContext,
    type GraceContextValue,
    type GraceStatus,
    type GraceMessage,
    type GraceAction,
    type PanelMode,
    type PageContext,
    type BrowsingHistoryEntry,
    type ActiveForm,
    type FormType,
    type ProductCard,
    type PendingCartProduct,
} from "@/components/GraceContext";
import { getAnonOwnerKey } from "@/lib/graceAnonOwnerKey";
import { isGraceToolResult } from "@/lib/graceToolResults";
import {
    applyGraceRefinementRequest,
    formatGraceRefineState,
    getGraceRefineState,
    graceRefineDestination,
    type GraceRefinementProposal,
} from "@/lib/grace/refineState";
import {
    createGraceOpenAIRealtimeAdapter,
    GraceRealtimeConnectionCancelledError,
    type GraceOpenAIRealtimeAdapter,
    type GraceRealtimeToolImplementations,
} from "@/lib/grace/openaiRealtimeAdapter";
import { GRACE_REALTIME_INSTRUCTIONS } from "@/lib/grace/realtimeInstructions";
import { normalizeApplicatorBuckets } from "@/lib/catalogFilters";
import { getCanonicalProductSlug } from "@/lib/products/legacy-product-route-overrides";
import {
    GRACE_MINIMUM_CONTENT_WIDTH_PX,
    gracePushEligiblePathname,
    resolveGraceDrawerWidth,
    resolveGraceSurface,
    resolveGraceViewportWidth,
} from "@/lib/grace/pushLayout";
import {
    buildGraceFinderContext,
    mergePdpContextChange,
    PDP_CONTEXT_CHANGE_EVENT,
    resolveGraceRecommendationHref,
    type PdpContextChange,
} from "@/lib/grace/pageContextEvents";

// ─── Core product intelligence injected into the Realtime session ───────────

type GraceConversationController = {
    getId(): string | null;
    sendContextualUpdate(context: string): void;
    sendUserMessage(message: string): void;
    endSession(): Promise<void>;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Distinct cap-related options across PDP variants so Grace does not assume a single cap type. */
function summarizeCapsFromVariants(
    variants: Array<{
        capHeight?: string | null;
        capStyle?: string | null;
        capColor?: string | null;
        applicator?: string | null;
    }> | undefined,
): string {
    if (!variants?.length) return "";
    const heights = [...new Set(variants.map((v) => v.capHeight).filter(Boolean))] as string[];
    const styles = [...new Set(variants.map((v) => v.capStyle).filter(Boolean))] as string[];
    const colors = [...new Set(variants.map((v) => v.capColor).filter(Boolean))] as string[];
    const parts: string[] = [];
    if (heights.length) parts.push(`cap heights: ${heights.join(", ")}`);
    if (styles.length) parts.push(`cap styles: ${styles.slice(0, 14).join(", ")}`);
    if (colors.length) parts.push(`cap colors: ${colors.slice(0, 12).join(", ")}`);
    return parts.join(" | ");
}

function formatPageContextForGrace(ctx: PageContext | null, history?: BrowsingHistoryEntry[]): string {
    if (!ctx) return "";
    const lines: string[] = ["=== CURRENT SESSION CONTEXT ==="];
    if (ctx.pageUrl) lines.push(`URL: ${ctx.pageUrl}`);

    if (ctx.pageType === "pdp" && ctx.currentProduct) {
        const p = ctx.currentProduct;
        lines.push(`Page: Product Detail — ${p.name}`);
        if (p.category) lines.push(`Category: ${p.category}`);
        lines.push(`Family: ${p.family} | Size: ${p.capacity} | Color: ${p.color}`);
        if (p.neckThreadSize) lines.push(`Neck thread: ${p.neckThreadSize}`);
        if (p.applicatorTypes?.length) {
            lines.push(`Applicator types on this line: ${p.applicatorTypes.join(", ")}`);
        } else if (p.applicator) {
            lines.push(`Applicator (representative): ${p.applicator}`);
        }
        if (p.variantCount != null) lines.push(`Variants in this group: ${p.variantCount}`);
        if (p.capsSummary) lines.push(`Cap / closure options (from variants): ${p.capsSummary}`);
        if (p.webPrice1pc) lines.push(`From: $${p.webPrice1pc.toFixed(2)}/pc`);
        lines.push(`Primary SKU for tools: ${p.graceSku}`);
        lines.push(
            "CONTEXT NOTE: Customer is on this PDP. For compatible closures and caps, call getBottleComponents with the relevant variant SKU — COMPONENT DATA lists each type (e.g. Short Cap, Tall Cap, Sprayer, Roll-On Cap). Do not assume only one cap style; list what the tool returns.",
        );
    } else if (ctx.pageType === "catalog") {
        lines.push(`Page: Product Catalog`);
        if (ctx.browseContext) {
            const browse = ctx.browseContext;
            lines.push(`Finder entry: ${browse.entryMode}`);
            if (browse.family) lines.push(`Finder family: ${browse.family}`);
            if (browse.application) lines.push(`Finder application: ${browse.application}`);
            if (browse.capacities?.length) lines.push(`Finder capacity: ${browse.capacities.join(", ")}`);
            if (browse.rollerMaterials?.length) lines.push(`Finder roller material: ${browse.rollerMaterials.join(", ")}`);
            lines.push(`Finder results URL: ${browse.resultUrl}`);
        }
        if (ctx.catalogCategory) lines.push(`Category filter: ${ctx.catalogCategory}`);
        if (ctx.currentCollection) lines.push(`Active Family Filter: ${ctx.currentCollection}`);
        if (ctx.catalogSearch) lines.push(`Active Search: "${ctx.catalogSearch}"`);
        if (ctx.refineState) lines.push(formatGraceRefineState(ctx.refineState));
        lines.push(`CONTEXT NOTE: Customer is browsing the catalog. Wait for them to ask a question before offering help.`);
    } else if (ctx.pageType === "cart") {
        lines.push(`Page: Shopping Cart`);
        lines.push(`CONTEXT NOTE: Customer is reviewing their cart. If they ask, you can help with accessories, quantities, or checkout.`);
    } else if (ctx.pageType === "contact") {
        lines.push(`Page: Contact / Request Form`);
    } else if (ctx.pageType === "home") {
        lines.push(`Page: Homepage`);
        lines.push(`CONTEXT NOTE: Customer is on the homepage. Greet them briefly and wait for their question.`);
    } else {
        lines.push(`Page: ${ctx.pathname}`);
    }

    if (ctx.pdpSelection) {
        const selection = ctx.pdpSelection;
        lines.push(`Selected website SKU: ${selection.websiteSku}`);
        if (selection.application) lines.push(`Selected application: ${selection.application}`);
        if (selection.glass) lines.push(`Selected glass: ${selection.glass}`);
        if (selection.rollerMaterial) lines.push(`Selected roller material: ${selection.rollerMaterial}`);
        if (selection.finish) lines.push(`Selected finish: ${selection.finish}`);
    }


    if (ctx.cartItems.length > 0) {
        lines.push(`Cart (${ctx.cartItems.length} item${ctx.cartItems.length > 1 ? "s" : ""}${ctx.cartTotal ? `, ~$${ctx.cartTotal.toFixed(2)} total` : ""}):`);
        for (const i of ctx.cartItems) {
            const price = i.unitPrice ? ` @ $${i.unitPrice.toFixed(2)}/pc` : "";
            lines.push(`  • ${i.name} ×${i.quantity}${price}`);
        }
    } else {
        lines.push(`Cart: Empty`);
    }

    if (history && history.length > 1) {
        const recent = history.slice(-6, -1).reverse();
        if (recent.length > 0) {
            lines.push(`Recent browsing:`);
            for (const h of recent) {
                if (h.productName) lines.push(`  • Viewed: ${h.productName} (${h.productFamily ?? ""} ${h.productCapacity ?? ""})`);
                else if (h.searchTerm) lines.push(`  • Searched: "${h.searchTerm}"`);
                else lines.push(`  • Visited: ${h.pageType} page`);
            }
        }
    }

    lines.push("=== END CONTEXT ===");
    return lines.join("\n");
}

function sanitizeCatalogQuery(rawQuery: string | undefined): string {
    return (rawQuery ?? "").split(/,|\s+and\s+/i)[0].replace(/\s+/g, " ").trim();
}

/** Normalize for deduping duplicate agent_response + streaming copies of the same line */
function normalizeGraceMessageText(s: string): string {
    return s.replace(/\s+/g, " ").trim();
}

function slugToSearchTerm(rawSlug: string): string {
    return rawSlug
        .replace(/[-_]+/g, " ")
        .replace(/\broll\s*on\b/gi, "roll-on")
        .replace(/\brollon\b/gi, "roll-on")
        .replace(/\bfinemist\b/gi, "fine mist")
        .replace(/\blotionpump\b/gi, "lotion pump")
        .replace(/\s+/g, " ")
        .trim();
}

function buildCatalogPath(products: ProductCard[], query?: string, family?: string): string {
    const qs = new URLSearchParams();
    const sanitizedQuery = sanitizeCatalogQuery(query);
    const productFams = products.map((p) => p.family).filter(Boolean) as string[];
    const queryText = (query ?? "").toLowerCase();
    const capacityOnlyTerm = graceCapacityOnlySearchTerm(sanitizedQuery);
    const capacityOnlySearch = capacityOnlyTerm !== null;

    const category = inferCatalogCategoryFromSearchTerm(query ?? "");
    if (category) {
        qs.set("category", category);
    } else if (capacityOnlyTerm) {
        // Canonical token ("50ml") — the raw query may carry filler words like
        // "bottles" that would fuse into an unmatchable search string.
        qs.set("search", capacityOnlyTerm);
    } else {
        const expanded = catalogFamiliesForNav(query, family, productFams);
        if (expanded) {
            qs.set("families", expanded);
        } else if (family) {
            qs.set("families", family);
        } else {
            const familyCounts = new Map<string, number>();
            for (const p of products) {
                if (p.family) familyCounts.set(p.family, (familyCounts.get(p.family) || 0) + 1);
            }
            const sorted = [...familyCounts.entries()].sort((a, b) => b[1] - a[1]);
            const total = products.length;
            if (sorted.length > 0) {
                const dominant = sorted.filter(([, count]) => count / total >= 0.3).map(([f]) => f);
                const families = dominant.length > 0 ? dominant : [sorted[0][0]];
                const fromDominant = catalogFamiliesForNav(undefined, undefined, families);
                qs.set("families", fromDominant ?? families.join(","));
            } else if (sanitizedQuery) {
                qs.set("search", sanitizedQuery);
            }
        }
    }

    const navSearch = graceCatalogSearchFromQuery(query);
    const capMatch = query?.match(/\b(\d+(?:\.\d+)?)\s*ml\b/i);
    if (navSearch && !capacityOnlySearch) {
        qs.set("search", navSearch);
    } else if (capMatch && !qs.has("search")) {
        qs.set("search", `${capMatch[1]}ml`);
    }
    if (capacityOnlySearch) {
        // A direct Grace request such as "take me to the 50 ml bottle" should
        // land on a clean size search, not inherit exploratory family/applicator
        // facets from search results or the previous PDP context.
    } else if (/roll[\s-]?on|roller/.test(queryText)) {
        qs.set("applicators", "rollon");
    } else if (/(bulb|vintage|antique).*(spray|sprayer)/.test(queryText)) {
        qs.set("applicators", "antiquespray,antiquespray-tassel");
    } else if (/dropper|pipette/.test(queryText)) {
        qs.set("applicators", "dropper");
    } else if (/lotion\s*pump/.test(queryText)) {
        qs.set("applicators", "lotionpump");
    } else if (/fine[\s-]?mist|spray|sprayer|atomizer/.test(queryText)) {
        qs.set("applicators", "finemist,perfumespray");
    }
    if (!qs.has("sort")) qs.set("sort", capMatch ? "best-match" : "capacity-asc");
    qs.set("grace", "1");
    return `/catalog?${qs.toString()}`;
}

function buildBrowsePath(products: ProductCard[], query?: string, family?: string): string {
    return buildCatalogPath(products, query, family);
}

function normalizeSearchText(rawValue: string): string {
    let s = rawValue.toLowerCase();
    // Align spoken/written numbers with catalog copy ("one ml vial" → same tokens as "1 ml")
    s = s
        .replace(/\bzero\b/g, "0")
        .replace(/\bone\b/g, "1")
        .replace(/\btwo\b/g, "2")
        .replace(/\bthree\b/g, "3")
        .replace(/\bfour\b/g, "4")
        .replace(/\bfive\b/g, "5")
        .replace(/\bsix\b/g, "6")
        .replace(/\bseven\b/g, "7")
        .replace(/\beight\b/g, "8")
        .replace(/\bnine\b/g, "9")
        .replace(/\bten\b/g, "10")
        .replace(/\beleven\b/g, "11")
        .replace(/\btwelve\b/g, "12")
        .replace(/\bthirteen\b/g, "13")
        .replace(/\bfourteen\b/g, "14")
        .replace(/\bfifteen\b/g, "15")
        .replace(/\bsixteen\b/g, "16")
        .replace(/\bseventeen\b/g, "17")
        .replace(/\beighteen\b/g, "18")
        .replace(/\bnineteen\b/g, "19")
        .replace(/\btwenty\b/g, "20")
        .replace(/\bthirty\b/g, "30")
        .replace(/\bforty\b/g, "40")
        .replace(/\bfifty\b/g, "50")
        .replace(/\bmilliliters?\b/g, "ml");
    return s
        .replace(/(\d+)\s*ml\b/g, "$1ml")
        .replace(/\broll[\s-]?on\b/g, "roll-on")
        .replace(/[^a-z0-9-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function tokenizeSearchText(rawValue: string): string[] {
    const stopWords = new Set([
        "a", "an", "and", "any", "are", "bottle", "bottles", "browse", "can", "could", "direct", "do", "does",
        "find", "for", "get", "give", "how", "i", "image", "images", "is", "it", "its", "just", "like", "look",
        "looks", "me", "need", "open", "only", "page", "photo", "photos", "picture", "pictures", "please", "see",
        "show", "some", "take", "that", "the", "them", "they", "this", "to", "visual", "want", "was", "what",
        "which", "who", "you", "your",
    ]);
    return normalizeSearchText(rawValue).split(" ").filter((t) => t && !stopWords.has(t));
}

function selectDirectProductMatch(products: ProductCard[], query?: string): ProductCard | null {
    const tokens = tokenizeSearchText(query ?? "");
    if (tokens.length < 2) return null;

    const unique = Array.from(new Map(products.map((p) => [p.slug || p.graceSku, p] as const)).values());
    const scored = unique
        .map((product) => {
            const haystack = normalizeSearchText(
                [product.itemName.split(/[.!?]/)[0], product.family, product.capacity, product.color, product.applicator, product.neckThreadSize, product.graceSku, product.slug].filter(Boolean).join(" ")
            );
            const matches = tokens.filter((t) => haystack.includes(t)).length;
            return { product, matches, coverage: matches / tokens.length };
        })
        .sort((a, b) => b.coverage - a.coverage || b.matches - a.matches);

    const [best, secondBest] = scored;
    if (!best?.product.slug || best.coverage < 0.75) return null;
    if (secondBest && secondBest.coverage >= best.coverage - 0.1 && secondBest.matches >= best.matches - 1) {
        if (secondBest.product.slug !== best.product.slug) return null;
    }
    return best.product;
}

function checkSizeWarning(products: ProductCard[], query?: string): string {
    const capMatch = query?.match(/\b(\d+(?:\.\d+)?)\s*ml\b/i);
    if (!capMatch) return "";
    const requestedMl = parseFloat(capMatch[1]);
    const tolerance = Math.max(1, requestedMl * 0.1);
    const hasSize = products.some((p) => {
        const pMl = parseFloat(p.capacity || "0");
        return pMl > 0 && Math.abs(pMl - requestedMl) <= tolerance;
    });
    if (hasSize) return "";
    const sizes = [...new Set(products.map((p) => p.capacity).filter(Boolean))].slice(0, 6).join(", ");
    const families = [...new Set(products.map((p) => p.family).filter(Boolean))].slice(0, 4).join(", ");
    return `WARNING: We do NOT stock a ${requestedMl}ml in this search (families: ${families}). Available sizes: ${sizes}. Do NOT tell the customer we have ${requestedMl}ml.`;
}

function checkRollOnMinimum(query: string, requestedMl: number | null, products: ProductCard[]): string | null {
    if (!/roll.?on|roller/i.test(query)) return null;
    if (!requestedMl || requestedMl >= 5) return null;
    const rollOnSizes = products
        .filter((p) => /roller|roll/i.test(p.applicator || ""))
        .map((p) => p.capacity)
        .filter(Boolean);
    const uniqueSizes = [...new Set(rollOnSizes)].slice(0, 5).join(", ");
    return `WARNING: We do NOT stock roll-on bottles smaller than 5ml. A ${requestedMl}ml roll-on does NOT exist. Our smallest roll-on is 5ml. Available roll-on sizes: ${uniqueSizes || "5ml, 9ml, 15ml, 28ml, 30ml"}.`;
}

function requestedCapacityMlFromQuery(query?: string): number | null {
    const capMatch = query?.match(/\b(\d+(?:\.\d+)?)\s*ml\b/i);
    return capMatch ? parseFloat(capMatch[1]) : null;
}

function productCapacityMl(product: ProductCard): number | null {
    if (typeof product.capacityMl === "number" && Number.isFinite(product.capacityMl)) {
        return product.capacityMl;
    }
    const capMatch = product.capacity?.match(/\b(\d+(?:\.\d+)?)\s*ml\b/i);
    return capMatch ? parseFloat(capMatch[1]) : null;
}

function productMatchesApplicatorIntent(product: ProductCard, query?: string): boolean {
    const q = (query ?? "").toLowerCase();
    const text = [product.itemName, product.applicator, product.family, product.slug].filter(Boolean).join(" ").toLowerCase();
    if (/roll[\s-]?on|roller/.test(q)) return /roll[\s-]?on|roller/.test(text);
    if (/dropper|pipette/.test(q)) return /dropper|pipette/.test(text);
    if (/lotion\s*pump/.test(q)) return /lotion\s*pump/.test(text);
    if (/reducer|orifice/.test(q)) return /reducer|orifice/.test(text);
    if (/(bulb|vintage|antique).*(spray|sprayer)|spray|sprayer|atomizer|fine[\s-]?mist/.test(q)) {
        return /spray|sprayer|atomizer|fine[\s-]?mist|bulb|vintage|antique/.test(text);
    }
    return true;
}

function selectGraceTileProducts(products: ProductCard[], query?: string, limit = 6): ProductCard[] {
    const requestedMl = requestedCapacityMlFromQuery(query);
    let scoped = [...products];

    if (requestedMl != null) {
        const exactSize = scoped.filter((product) => {
            const ml = productCapacityMl(product);
            return ml != null && Math.abs(ml - requestedMl) <= 0.25;
        });
        if (exactSize.length > 0) scoped = exactSize;
    }

    const matchingApplicator = scoped.filter((product) => productMatchesApplicatorIntent(product, query));
    if (matchingApplicator.length > 0) scoped = matchingApplicator;

    const deduped = Array.from(
        new Map(scoped.map((product) => [product.slug || product.graceSku || product.itemName, product] as const)).values(),
    );

    return deduped
        .sort((a, b) => {
            const capDelta = (productCapacityMl(a) ?? Infinity) - (productCapacityMl(b) ?? Infinity);
            if (capDelta !== 0) return capDelta;
            const familyDelta = (a.family ?? "").localeCompare(b.family ?? "");
            if (familyDelta !== 0) return familyDelta;
            return a.itemName.localeCompare(b.itemName);
        })
        .slice(0, limit);
}

function shouldAutoDisplayCatalogTiles(query?: string): boolean {
    if (!query?.trim()) return false;
    const q = query.toLowerCase();
    const asksForVisualOptions = /\b(tile|tiles|card|cards|grid|show|display|see|options?|various|recommend|compare)\b/.test(q);
    const hasSizeApplicatorIntent = requestedCapacityMlFromQuery(query) != null && /(roll[\s-]?on|roller|spray|sprayer|dropper|applicator|bottle)/i.test(query);
    return asksForVisualOptions || hasSizeApplicatorIntent;
}

function graceTileHeadline(query?: string): string {
    const q = query?.trim();
    return q ? `Product options for “${q}”` : "Product options";
}

let msgCounter = 0;
function nextMsgId(): string {
    return `grace-msg-${Date.now()}-${++msgCounter}`;
}

function graceMessageActions(message: GraceMessage): GraceAction[] {
    return message.actions ?? (message.action ? [message.action] : []);
}

function mergeGraceActions(message: GraceMessage, actions: GraceAction[]): GraceMessage {
    if (actions.length === 0) return message;
    const mergedActions = [...graceMessageActions(message), ...actions];
    return { ...message, action: mergedActions[0], actions: mergedActions };
}

function pendingCartProposals(message: GraceMessage): Array<Extract<GraceAction, { type: "proposeCartAdd" }>> {
    return graceMessageActions(message).filter(
        (action): action is Extract<GraceAction, { type: "proposeCartAdd" }> =>
            action.type === "proposeCartAdd" && action.awaitingConfirmation,
    );
}

function updateCartProposalAction(
    message: GraceMessage,
    updater: (action: Extract<GraceAction, { type: "proposeCartAdd" }>) => GraceAction | null,
): GraceMessage {
    const updatedActions = graceMessageActions(message)
        .map((action) => action.type === "proposeCartAdd" ? updater(action) : action)
        .filter((action): action is GraceAction => Boolean(action));
    return { ...message, action: updatedActions[0], actions: updatedActions.length ? updatedActions : undefined };
}

const GRACE_TOOL_TIMEOUT_MS = 12000;

async function fetchJsonWithTimeout<T>(
    url: string,
    init: RequestInit,
    timeoutMs = GRACE_TOOL_TIMEOUT_MS,
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        const data = await response.json().catch(() => null) as T | null;
        const error = data && typeof data === "object" && "error" in data
            ? String((data as { error?: unknown }).error ?? "")
            : undefined;
        return { ok: response.ok, status: response.status, data, error };
    } catch (error) {
        return {
            ok: false,
            status: 0,
            data: null,
            error: error instanceof DOMException && error.name === "AbortError"
                ? "Grace timed out while checking the catalog."
                : error instanceof Error ? error.message : "Grace could not reach the catalog.",
        };
    } finally {
        clearTimeout(timeout);
    }
}

async function callGraceServerTool<T>(
    toolName: string,
    parameters: Record<string, unknown>,
): Promise<{ result: T | null; error?: string; status: number }> {
    const response = await fetchJsonWithTimeout<{ result?: T; error?: string }>("/api/grace/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-grace-owner-key": getAnonOwnerKey() },
        body: JSON.stringify({ tool_name: toolName, parameters }),
    });
    return {
        result: response.ok ? response.data?.result ?? null : null,
        error: response.error || (!response.ok ? `Catalog tool failed with HTTP ${response.status}.` : undefined),
        status: response.status,
    };
}

// ─── Provider ────────────────────────────────────────────────────────────────

function GraceProviderBase({
    children,
    userId,
}: {
    children: ReactNode;
    userId: string | null;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { addItems: addToCart, items: cartItems } = useCart();
    const cartItemsRef = useRef(cartItems);
    useEffect(() => { cartItemsRef.current = cartItems; }, [cartItems]);

    const submitFormMutation = useMutation(api.forms.submit);
    const createShortlistMutation = useMutation(api.graceShortlists.create);
    const mintShortlistShareTokenMutation = useMutation(api.graceShortlists.mintShareToken);
    const submitFormRef = useRef(submitFormMutation);
    useEffect(() => { submitFormRef.current = submitFormMutation; }, [submitFormMutation]);
    const createShortlistRef = useRef(createShortlistMutation);
    const mintShortlistShareTokenRef = useRef(mintShortlistShareTokenMutation);
    useEffect(() => { createShortlistRef.current = createShortlistMutation; }, [createShortlistMutation]);
    useEffect(() => { mintShortlistShareTokenRef.current = mintShortlistShareTokenMutation; }, [mintShortlistShareTokenMutation]);

    // ── Panel state ──────────────────────────────────────────────────────────
    const [panelMode, setPanelMode] = useState<PanelMode>("closed");
    const isOpen = panelMode === "open";
    const [viewportWidth, setViewportWidth] = useState(0);
    useEffect(() => {
        const update = () => setViewportWidth(resolveGraceViewportWidth({
            innerWidth: window.innerWidth,
            clientWidth: document.documentElement.clientWidth,
        }));
        update();
        window.addEventListener("resize", update, { passive: true });
        const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
        observer?.observe(document.documentElement);
        return () => {
            window.removeEventListener("resize", update);
            observer?.disconnect();
        };
    }, []);
    const surface = useMemo(() => resolveGraceSurface({
        isOpen,
        viewportWidth,
        drawerWidth: resolveGraceDrawerWidth(viewportWidth),
        minimumContentWidth: GRACE_MINIMUM_CONTENT_WIDTH_PX,
        ownsViewport: pathname.startsWith("/grace-workspace") || pathname.startsWith("/executive"),
        pushEligible: gracePushEligiblePathname(pathname),
    }), [isOpen, pathname, viewportWidth]);

    const openPanel = useCallback(() => {
        setPanelMode("open");
    }, []);

    const closePanel = useCallback(() => {
        setPanelMode("closed");
    }, []);

    const minimizeToStrip = useCallback(() => {
        setPanelMode("strip");
    }, []);

    // ── Launcher tooltip — shown beside the floating disc when Grace
    // auto-minimizes during navigation (e.g. "I narrowed the catalog for you").
    // Auto-clears after `expiresAt`.
    const [launcherTooltip, setLauncherTooltip] = useState<{ message: string; expiresAt: number } | null>(null);

    const minimizeWithTooltip = useCallback((message: string) => {
        setPanelMode("closed");
        setLauncherTooltip({ message, expiresAt: Date.now() + 3500 });
    }, []);

    useEffect(() => {
        if (!launcherTooltip) return;
        const remaining = Math.max(0, launcherTooltip.expiresAt - Date.now());
        const t = setTimeout(() => setLauncherTooltip(null), remaining);
        return () => clearTimeout(t);
    }, [launcherTooltip]);

    // Direct message injection (bypass the Realtime session) — used by client-side flows
    // like the image-upload vision analysis that don't need agent narration.
    const appendInlineMessage = useCallback((msg: { role: "user" | "grace"; content: string; action?: import("@/components/GraceContext").GraceAction; actions?: import("@/components/GraceContext").GraceAction[]; attachments?: import("@/components/GraceContext").GraceAttachment[] }) => {
        const actions = msg.actions ?? (msg.action ? [msg.action] : undefined);
        setMessages((prev) => [
            ...prev,
            {
                role: msg.role,
                content: msg.content,
                id: nextMsgId(),
                action: actions?.[0],
                actions,
                attachments: msg.attachments,
            },
        ]);
    }, []);

    useEffect(() => {
        if (process.env.NODE_ENV === "production" || typeof window === "undefined") return;
        const testWindow = window as typeof window & {
            __GRACE_TEST_APPEND_MESSAGE__?: typeof appendInlineMessage;
            __GRACE_TEST_OPEN_PANEL__?: typeof openPanel;
            __GRACE_TEST_RENDER_ACTIONS__?: typeof appendInlineMessage;
        };
        testWindow.__GRACE_TEST_APPEND_MESSAGE__ = appendInlineMessage;
        testWindow.__GRACE_TEST_OPEN_PANEL__ = openPanel;
        testWindow.__GRACE_TEST_RENDER_ACTIONS__ = (msg) => {
            setPanelMode("open");
            appendInlineMessage(msg);
        };
        return () => {
            delete testWindow.__GRACE_TEST_APPEND_MESSAGE__;
            delete testWindow.__GRACE_TEST_OPEN_PANEL__;
            delete testWindow.__GRACE_TEST_RENDER_ACTIONS__;
        };
    }, [appendInlineMessage, openPanel]);

    // ── Connection state ─────────────────────────────────────────────────────
    const [graceStatus, setGraceStatus] = useState<GraceStatus>("idle");
    const [conversationActive, setConversationActive] = useState(false);
    const connectingRef = useRef(false);
    const conversationRef = useRef<GraceConversationController | null>(null);

    // ── Messages & streaming ─────────────────────────────────────────────────
    const [messages, setMessages] = useState<GraceMessage[]>([]);
    const messagesRef = useRef<GraceMessage[]>([]);
    useEffect(() => { messagesRef.current = messages; }, [messages]);
    const [streamingText, setStreamingText] = useState("");
    const [isAwaitingReply, setIsAwaitingReply] = useState(false);
    const [input, setInput] = useState("");
    const [voiceEnabled, setVoiceEnabled] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [voiceFailed, setVoiceFailed] = useState(false);
    const [graceQuery] = useState("");

    const toggleVoiceRef = useRef<(() => void) | null>(null);

    /**
     * FIFO queue of GraceActions emitted by `display*` clientTools. Each tool
     * call PUSHES; each finalized assistant message SHIFTS the oldest action
     * off and attaches it to that message. Critical for parallel tool calls
     * (e.g. Grace shows two product cards in one turn) — earlier code used a
     * single slot, which caused later tool calls to overwrite earlier ones
     * and dropped one of the cards. Cleared on `endConversation`.
     */
    const pendingActionsRef = useRef<import("@/components/GraceContext").GraceAction[]>([]);

    // ── Page context ─────────────────────────────────────────────────────────
    const pageType = useMemo((): PageContext["pageType"] => {
        if (pathname === "/") return "home";
        if (pathname.startsWith("/catalog")) return "catalog";
        if (pathname.startsWith("/products/")) return "pdp";
        if (pathname.startsWith("/cart")) return "cart";
        if (pathname.startsWith("/contact") || pathname.startsWith("/request")) return "contact";
        if (pathname.startsWith("/about")) return "about";
        return "other";
    }, [pathname]);

    const productSlug = pageType === "pdp" ? (pathname.split("/products/")[1] ?? null) : null;
    const productGroupResult = useQuery(api.products.getProductGroup, productSlug ? { slug: productSlug } : "skip");

    const pageUrl = useMemo(() => {
        const q = searchParams.toString();
        return q ? `${pathname}?${q}` : pathname;
    }, [pathname, searchParams]);
    const pageUrlRef = useRef(pageUrl);
    pageUrlRef.current = pageUrl;
    const [pdpContextChange, setPdpContextChange] = useState<PdpContextChange | null>(null);

    useEffect(() => {
        const receive = (event: Event) => {
            const change = (event as CustomEvent<PdpContextChange>).detail;
            if (!change?.websiteSku || change.pageUrl !== pageUrlRef.current) return;
            setPdpContextChange(change);
        };
        window.addEventListener(PDP_CONTEXT_CHANGE_EVENT, receive);
        return () => window.removeEventListener(PDP_CONTEXT_CHANGE_EVENT, receive);
    }, []);

    useEffect(() => {
        setPdpContextChange((current) => current?.pageUrl === pageUrl ? current : null);
    }, [pageUrl]);

    const pageContext = useMemo((): PageContext => {
        const cartSummary = cartItems.map((i) => ({
            graceSku: i.graceSku,
            name: i.itemName,
            quantity: i.quantity,
            unitPrice: i.unitPrice ?? null,
        }));
        const cartTotal = cartItems.reduce((sum, i) => sum + (i.unitPrice ?? 0) * i.quantity, 0);

        if (pageType === "pdp" && productGroupResult?.group) {
            const g = productGroupResult.group;
            const variants = productGroupResult.variants ?? [];
            const fromGroup = (g.applicatorTypes as string[] | undefined)?.filter(Boolean) ?? [];
            const fromVariants = [...new Set(variants.map((v) => v.applicator).filter(Boolean))] as string[];
            const applicatorTypes = fromGroup.length > 0 ? fromGroup : fromVariants;
            const capsSummary = summarizeCapsFromVariants(variants);
            const baseContext: PageContext = {
                pageType,
                pathname,
                pageUrl,
                cartItems: cartSummary,
                cartTotal,
                currentProduct: {
                    name: g.displayName,
                    family: g.family ?? "",
                    capacity: g.capacity ?? "",
                    color: g.color ?? "",
                    neckThreadSize: g.neckThreadSize ?? null,
                    graceSku: g.primaryGraceSku ?? "",
                    webPrice1pc: g.priceRangeMin ?? null,
                    applicator: applicatorTypes[0] ?? fromVariants[0],
                    applicatorTypes: applicatorTypes.length > 0 ? applicatorTypes : undefined,
                    category: g.category,
                    variantCount: g.variantCount ?? variants.length,
                    capsSummary: capsSummary || undefined,
                    slug: productSlug ?? undefined,
                },
            };
            return pdpContextChange
                ? mergePdpContextChange(baseContext, pdpContextChange)
                : baseContext;
        }
        if (pageType === "catalog") {
            const familiesParam = searchParams.get("families") ?? searchParams.get("family");
            return {
                pageType,
                pathname,
                pageUrl,
                cartItems: cartSummary,
                cartTotal,
                catalogCategory: searchParams.get("category") ?? undefined,
                currentCollection: familiesParam ?? searchParams.get("collection") ?? undefined,
                catalogSearch: searchParams.get("search") ?? undefined,
                refineState: getGraceRefineState(new URLSearchParams(searchParams.toString())),
                browseContext: buildGraceFinderContext(pathname, new URLSearchParams(searchParams.toString())),
            };
        }
        return { pageType, pathname, pageUrl, cartItems: cartSummary, cartTotal };
    }, [pageType, pathname, pageUrl, productGroupResult, productSlug, searchParams, cartItems, pdpContextChange]);

    const pageContextRef = useRef<PageContext>(pageContext);
    useEffect(() => { pageContextRef.current = pageContext; }, [pageContext]);

    const [browsingHistory, setBrowsingHistory] = useState<BrowsingHistoryEntry[]>([]);
    const browsingHistoryRef = useRef<BrowsingHistoryEntry[]>([]);
    useEffect(() => { browsingHistoryRef.current = browsingHistory; }, [browsingHistory]);

    /** Push full page intelligence to the Realtime session (retries until session id exists). */
    const sendPageContextToAgent = useCallback(() => {
        const contextBlock = formatPageContextForGrace(pageContextRef.current, browsingHistoryRef.current);
        if (!contextBlock) return;
        let attempts = 0;
        const trySend = () => {
            const conv = conversationRef.current;
            if (conv?.getId?.()) {
                conv.sendContextualUpdate(contextBlock);
                return;
            }
            if (attempts < 35) {
                attempts++;
                setTimeout(trySend, 100);
            }
        };
        trySend();
    }, []);

    const pageContextSignature = useMemo(
        () =>
            JSON.stringify({
                pageUrl: pageContext.pageUrl,
                pdpSku: pageContext.currentProduct?.graceSku,
                pdpSelection: pageContext.pdpSelection,
                applicators: pageContext.currentProduct?.applicatorTypes,
                caps: pageContext.currentProduct?.capsSummary,
                catalogCategory: pageContext.catalogCategory,
                catalogSearch: pageContext.catalogSearch,
                collection: pageContext.currentCollection,
                refine: pageContext.refineState,
                cart: pageContext.cartItems.map((i) => `${i.graceSku}:${i.quantity}`).join(","),
                hist: browsingHistory.slice(-6).map((h) => h.pathname).join("|"),
            }),
        [pageContext, browsingHistory],
    );

    const lastPushedContextSig = useRef<string | null>(null);
    useEffect(() => {
        if (!conversationActive) {
            lastPushedContextSig.current = null;
            return;
        }
        if (lastPushedContextSig.current === pageContextSignature) return;
        lastPushedContextSig.current = pageContextSignature;
        sendPageContextToAgent();
    }, [conversationActive, pageContextSignature, sendPageContextToAgent]);

    useEffect(() => {
        if (!pageContext) return;
        const last = browsingHistoryRef.current[browsingHistoryRef.current.length - 1];
        if (last?.pathname === pageContext.pathname) return;
        const entry: BrowsingHistoryEntry = { pathname: pageContext.pathname, pageType: pageContext.pageType, visitedAt: new Date().toISOString() };
        if (pageContext.pageType === "pdp" && pageContext.currentProduct) {
            entry.productName = pageContext.currentProduct.name;
            entry.productFamily = pageContext.currentProduct.family;
            entry.productCapacity = pageContext.currentProduct.capacity;
        }
        if (pageContext.pageType === "catalog" && pageContext.catalogSearch) entry.searchTerm = pageContext.catalogSearch;
        setBrowsingHistory((prev) => [...prev.slice(-49), entry]);
    }, [pageContext]);

    // ── Form state ───────────────────────────────────────────────────────────
    const [activeForm, setActiveForm] = useState<ActiveForm | null>(null);
    const activeFormRef = useRef<{ formType: string; fields: Record<string, string> } | null>(null);

    const updateFormField = useCallback((formType: FormType, fieldName: string, value: string) => {
        if (!activeFormRef.current) activeFormRef.current = { formType, fields: {} };
        activeFormRef.current.fields[fieldName] = value;
        setActiveForm((prev) => {
            const fields = { ...(prev?.fields ?? {}), [fieldName]: value };
            const filledOrder = prev?.filledOrder ? [...prev.filledOrder] : [];
            if (!filledOrder.includes(fieldName)) filledOrder.push(fieldName);
            return { formType, fields, filledOrder, submitting: false, submitted: false, error: "" };
        });
    }, []);

    const submitActiveForm = useCallback(async () => {
        const form = activeFormRef.current;
        if (!form || !form.fields.email) return;
        try {
            setActiveForm((prev) => prev ? { ...prev, submitting: true } : null);
            await submitFormRef.current({
                formType: form.formType as "sample" | "quote" | "contact" | "newsletter",
                name: form.fields.name || undefined,
                email: form.fields.email,
                company: form.fields.company || undefined,
                phone: form.fields.phone || undefined,
                message: form.fields.message || undefined,
                products: form.fields.products || undefined,
                quantities: form.fields.quantities || undefined,
                source: "grace",
            });
            setActiveForm((prev) => prev ? { ...prev, submitting: false, submitted: true } : null);
            activeFormRef.current = null;
        } catch (err) {
            setActiveForm((prev) => prev ? { ...prev, submitting: false, error: err instanceof Error ? err.message : "Unknown error" } : null);
        }
    }, []);

    const dismissActiveForm = useCallback(() => {
        activeFormRef.current = null;
        setActiveForm(null);
    }, []);

    // ── Session metrics ──────────────────────────────────────────────────────
    const sessionMetricsRef = useRef({ toolsCalled: 0, toolsUsed: new Set<string>(), cartItemsAdded: 0, navigations: 0 });

    // ── Stable refs ──────────────────────────────────────────────────────────
    const routerRef = useRef(router);
    useEffect(() => { routerRef.current = router; }, [router]);

    const pathnameRef = useRef(pathname);
    useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

    const userIdRef = useRef(userId);
    useEffect(() => { userIdRef.current = userId; }, [userId]);

    const closePanelRef = useRef(closePanel);
    useEffect(() => { closePanelRef.current = closePanel; }, [closePanel]);

    const completeGraceNavigation = useCallback((message: string) => {
        // Keep the companion visible while Grace navigates. The route-aware
        // shell changes from an overlay on editorial pages to a pushed
        // workspace on catalog, family, and PDP routes without remounting the
        // provider or losing conversation state.
        void message;
        setPanelMode("open");
        setLauncherTooltip(null);
    }, []);
    const completeGraceNavigationRef = useRef(completeGraceNavigation);
    useEffect(() => { completeGraceNavigationRef.current = completeGraceNavigation; }, [completeGraceNavigation]);

    // ── Client tools ─────────────────────────────────────────────────────────
    const clientTools = useMemo(() => ({

        searchCatalog: async (params: { searchTerm: string; categoryLimit?: string; familyLimit?: string; applicatorFilter?: string }) => {
            try {
                const currentRefine = pageContextRef.current?.refineState ?? getGraceRefineState(new URLSearchParams());
                const searchProposal: GraceRefinementProposal = { search: params.searchTerm ?? "" };
                if (params.categoryLimit) searchProposal.category = params.categoryLimit;
                if (params.familyLimit) searchProposal.families = [params.familyLimit];
                if (params.applicatorFilter) {
                    searchProposal.applicators = normalizeApplicatorBuckets(
                        params.applicatorFilter.split(","),
                    );
                }
                const inheritedRefine = applyGraceRefinementRequest(currentRefine, searchProposal, params.searchTerm ?? "");
                const data = await callGraceServerTool<ProductCard[] | string>("searchCatalog", {
                    searchTerm: params.searchTerm ?? "",
                    categoryLimit: params.categoryLimit,
                    familyLimit: params.familyLimit,
                    applicatorFilter: params.applicatorFilter,
                    refineState: inheritedRefine,
                });
                if (data.error) {
                    console.error("[Grace] searchCatalog HTTP", data.status, data.error);
                    return `${data.error} Try a broader search term or ask Grace again.`;
                }
                if (isGraceToolResult(data.result)) {
                    sessionMetricsRef.current.toolsCalled++;
                    sessionMetricsRef.current.toolsUsed.add("searchCatalog");
                    analytics.graceToolCalled({
                        toolName: "searchCatalog",
                        searchTerm: params.searchTerm,
                        family: params.familyLimit,
                        success: data.result.status === "ok",
                        status: data.result.status,
                    });
                    if (data.result.status === "no_match") {
                        analytics.graceNoMatch({
                            searchTerm: params.searchTerm,
                            family: params.familyLimit,
                            suggestedQueries: data.result.suggestedQueries?.join(", "),
                        });
                    }
                    return data.result.message;
                }
                if (typeof data.result === "string") {
                    sessionMetricsRef.current.toolsCalled++;
                    sessionMetricsRef.current.toolsUsed.add("searchCatalog");
                    analytics.graceToolCalled({
                        toolName: "searchCatalog",
                        searchTerm: params.searchTerm,
                        family: params.familyLimit,
                        success: !data.result.startsWith("No products found"),
                    });
                    return data.result;
                }
                const products: ProductCard[] = Array.isArray(data.result) ? data.result : [];
                sessionMetricsRef.current.toolsCalled++;
                sessionMetricsRef.current.toolsUsed.add("searchCatalog");
                analytics.graceToolCalled({ toolName: "searchCatalog", searchTerm: params.searchTerm, family: params.familyLimit, success: products.length > 0 });
                if (products.length === 0) return "No products found matching that description. Try a different search term.";

                const sizeNote = checkSizeWarning(products, params.searchTerm);
                const unique = new Map<string, ProductCard>();
                for (const p of products) {
                    const color = p.canonicalColor ?? p.color;
                    const key = `${p.family}-${p.capacity}-${color}`;
                    if (!unique.has(key)) unique.set(key, p);
                }
                const summary = [...unique.values()].slice(0, 8).map((p) => {
                    const color = p.canonicalColor ?? p.color;
                    return `${p.family} ${p.capacity || ""} ${color || ""} (${p.applicator || "N/A"}, thread: ${p.neckThreadSize || "N/A"})`;
                }).join("; ");
                const tileProducts = selectGraceTileProducts(products, params.searchTerm);
                if (tileProducts.length > 0 && shouldAutoDisplayCatalogTiles(params.searchTerm)) {
                    pendingActionsRef.current.push({
                        type: "showProductPresentation",
                        products: tileProducts,
                        headline: graceTileHeadline(params.searchTerm),
                    });
                }
                return `Found ${products.length} products.${sizeNote ? ` ${sizeNote}` : ""} Top matches: ${summary}`;
            } catch (e) { console.error("[Grace] searchCatalog:", e); return "Search failed. Please try again."; }
        },

        getFamilyOverview: async (params: { family: string }) => {
            try {
                const data = await callGraceServerTool<Record<string, unknown>>("getFamilyOverview", { family: params.family });
                if (data.error) return `${data.error} I could not load the ${params.family} family details.`;
                if (!data.result) return `No data found for the ${params.family} family.`;
                const v = data.result as { sizes?: Array<{ label: string }>; colors?: string[]; applicatorTypes?: string[]; threadSizes?: string[] };
                return `${params.family} family — Sizes: ${(v.sizes || []).map((s) => s.label).join(", ")}. Colors: ${(v.colors || []).join(", ")}. Applicators: ${(v.applicatorTypes || []).join(", ")}. Thread sizes: ${(v.threadSizes || []).join(", ")}.`;
            } catch (e) { console.error("[Grace] getFamilyOverview:", e); return "Lookup failed."; }
        },

        getBottleComponents: async (params: { bottleSku: string }) => {
            try {
                const data = await callGraceServerTool<Record<string, unknown> | null>("getBottleComponents", { bottleSku: params.bottleSku });
                if (data.error) return `${data.error} I could not check components for SKU "${params.bottleSku}".`;
                if (!data.result) return `No compatible components found for SKU "${params.bottleSku}".`;
                const result = data.result as { bottle?: { itemName?: string; neckThreadSize?: string; family?: string; capacity?: string }; components?: Record<string, Array<{ graceSku?: string; itemName?: string; webPrice1pc?: number; capColor?: string; stockStatus?: string }>> };
                const lines: string[] = [];
                if (result.bottle) { lines.push(`Bottle: ${result.bottle.itemName ?? params.bottleSku}`, `Thread: ${result.bottle.neckThreadSize ?? "unknown"} | Family: ${result.bottle.family ?? "unknown"} | Size: ${result.bottle.capacity ?? "unknown"}`); }
                if (result.components) {
                    for (const [type, items] of Object.entries(result.components)) {
                        if (!Array.isArray(items) || items.length === 0) continue;
                        lines.push(`\n${type.replace(/([A-Z])/g, " $1").trim()} (${items.length} options):`);
                        for (const item of items.slice(0, 6)) { lines.push(`  • ${item.itemName ?? item.graceSku}${item.capColor ? `, ${item.capColor}` : ""} — ${item.webPrice1pc ? `$${item.webPrice1pc.toFixed(2)}/pc` : "price TBD"}${item.stockStatus ? ` [${item.stockStatus}]` : ""}`); }
                        if (items.length > 6) lines.push(`  ... and ${items.length - 6} more`);
                    }
                }
                return lines.length > 0 ? lines.join("\n") : JSON.stringify(data.result).slice(0, 800);
            } catch (e) { console.error("[Grace] getBottleComponents:", e); return "Component lookup failed."; }
        },

        checkCompatibility: async (params: { threadSize: string }) => {
            try {
                const data = await callGraceServerTool<Array<Record<string, unknown>>>("checkCompatibility", { threadSize: params.threadSize });
                if (data.error) return `${data.error} I could not check thread compatibility for "${params.threadSize}".`;
                const fitments = Array.isArray(data.result) ? data.result : [];
                if (fitments.length === 0) return `No bottles found with thread size "${params.threadSize}". Common sizes: 13-415, 15-415, 18-415, 20-410, 24-410, 28-410.`;
                const lines = [`Bottles compatible with ${params.threadSize} thread (${fitments.length} found):`];
                for (const f of fitments.slice(0, 10)) lines.push(`  • ${f.bottleName ?? f.bottleCode} — ${f.capacityMl ?? "?"}ml (${f.familyHint ?? "unknown family"})`);
                if (fitments.length > 10) lines.push(`  ... and ${fitments.length - 10} more`);
                return lines.join("\n");
            } catch (e) { console.error("[Grace] checkCompatibility:", e); return "Compatibility check failed."; }
        },

        getCatalogStats: async () => {
            try {
                const data = await callGraceServerTool<Record<string, unknown>>("getCatalogStats", {});
                if (data.error) return `${data.error} I could not retrieve catalog statistics.`;
                if (!data.result) return "Could not retrieve catalog statistics.";
                const stats = data.result as { totalVariants?: number; totalGroups?: number; familyCounts?: Record<string, number>; categoryCounts?: Record<string, number> };
                const lines = [`Best Bottles Catalog: ${stats.totalVariants ?? "unknown"} individual SKUs across ${stats.totalGroups ?? "unknown"} product groups.`];
                if (stats.familyCounts) lines.push(`Families: ${Object.entries(stats.familyCounts).sort(([, a], [, b]) => b - a).map(([n, c]) => `${n} (${c})`).join(", ")}`);
                return lines.join("\n");
            } catch (e) { console.error("[Grace] getCatalogStats:", e); return "Stats lookup failed."; }
        },

        getProductBySku: async (params: { sku?: string | null }) => {
            const sku = (params?.sku ?? "").trim();
            if (!sku) return "No SKU provided. Ask the customer for the exact code.";
            try {
                const data = await callGraceServerTool<Record<string, unknown>>("getProductBySku", { sku });
                if (data.error) return `${data.error} I could not look up that SKU.`;
                if (!data.result) return `No catalog record matches "${sku}" as written. Do not say we don't carry it — offer to search by description or have the team verify the code.`;
                return JSON.stringify(data.result);
            } catch (e) { console.error("[Grace] getProductBySku:", e); return "SKU lookup failed."; }
        },

        getPolicy: async (params: { question?: string | null }) => {
            try {
                const data = await callGraceServerTool<Record<string, unknown>>("getPolicy", {
                    question: params?.question ?? "",
                });
                if (data.error) return `${data.error} I could not retrieve the policy text.`;
                if (!data.result) return "No published policy found for that question. Do not invent terms — offer to connect the customer with the team.";
                return JSON.stringify(data.result);
            } catch (e) { console.error("[Grace] getPolicy:", e); return "Policy lookup failed."; }
        },

        getPriceStats: async (params: { family?: string | null }) => {
            try {
                const data = await callGraceServerTool<Record<string, unknown>>("getPriceStats", {
                    family: params?.family ?? null,
                });
                if (data.error) return `${data.error} I could not retrieve price statistics.`;
                if (!data.result) return "No priced products found for that scope.";
                return JSON.stringify(data.result);
            } catch (e) { console.error("[Grace] getPriceStats:", e); return "Price lookup failed."; }
        },

        getCurrentPageContext: () => {
            const ctx = pageContextRef.current;
            if (!ctx) return "No page context available.";
            const lines: string[] = [`Page type: ${ctx.pageType}`, `Path: ${ctx.pathname}`];
            if (ctx.pageUrl) lines.push(`Full URL: ${ctx.pageUrl}`);
            if (ctx.pageType === "pdp" && ctx.currentProduct) {
                const p = ctx.currentProduct;
                lines.push(`\nCustomer is viewing:`, `  Product: ${p.name}`, `  Family: ${p.family}`, `  Size: ${p.capacity}`, `  Color: ${p.color}`);
                if (p.category) lines.push(`  Category: ${p.category}`);
                if (p.neckThreadSize) lines.push(`  Neck thread: ${p.neckThreadSize}`);
                if (p.applicatorTypes?.length) lines.push(`  Applicator types on this line: ${p.applicatorTypes.join(", ")}`);
                else if (p.applicator) lines.push(`  Applicator (representative): ${p.applicator}`);
                if (p.capsSummary) lines.push(`  Cap / closure options (variants): ${p.capsSummary}`);
                if (p.variantCount != null) lines.push(`  Variant count: ${p.variantCount}`);
                if (p.graceSku) lines.push(`  Primary SKU for tools: ${p.graceSku}`);
                if (p.webPrice1pc) lines.push(`  From: $${p.webPrice1pc.toFixed(2)}/pc`);
            } else if (ctx.pageType === "catalog") {
                lines.push(`\nCustomer is browsing the catalog.`);
                if (ctx.catalogCategory) lines.push(`  Category filter: ${ctx.catalogCategory}`);
                if (ctx.currentCollection) lines.push(`  Family filter: ${ctx.currentCollection}`);
                if (ctx.catalogSearch) lines.push(`  Search: "${ctx.catalogSearch}"`);
                if (ctx.refineState) lines.push(formatGraceRefineState(ctx.refineState));
            }
            if (ctx.cartItems.length > 0) {
                lines.push(`\nCart (${ctx.cartItems.length} items):`);
                for (const item of ctx.cartItems) lines.push(`  • ${item.name} ×${item.quantity}${item.unitPrice ? ` @ $${item.unitPrice.toFixed(2)}/pc` : ""}`);
                if (ctx.cartTotal) lines.push(`  Total: ~$${ctx.cartTotal.toFixed(2)}`);
            } else lines.push(`\nCart: Empty`);
            return lines.join("\n");
        },

        getCartContents: () => {
            const ctx = pageContextRef.current;
            if (!ctx || ctx.cartItems.length === 0) return "The customer's cart is empty.";
            const lines = [`Cart contains ${ctx.cartItems.length} item${ctx.cartItems.length > 1 ? "s" : ""}:`];
            for (const item of ctx.cartItems) {
                const price = item.unitPrice ? `$${item.unitPrice.toFixed(2)}/pc` : "price TBD";
                const subtotal = item.unitPrice ? ` (subtotal: $${(item.unitPrice * item.quantity).toFixed(2)})` : "";
                lines.push(`  • ${item.name} — SKU: ${item.graceSku} — Qty: ${item.quantity} — ${price}${subtotal}`);
            }
            if (ctx.cartTotal) lines.push(`\nCart total: $${ctx.cartTotal.toFixed(2)}`);
            return lines.join("\n");
        },

        getBrowsingHistory: () => {
            const history = browsingHistoryRef.current;
            if (!history || history.length === 0) return "No browsing history yet.";
            const lines = [`Customer visited ${history.length} page${history.length > 1 ? "s" : ""} this session:`];
            const recent = [...history].reverse().slice(0, 15);
            for (const e of recent) {
                const time = new Date(e.visitedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                if (e.productName) lines.push(`  • [${time}] Viewed: ${e.productName} (${e.productFamily ?? ""} ${e.productCapacity ?? ""})`);
                else if (e.searchTerm) lines.push(`  • [${time}] Searched: "${e.searchTerm}"`);
                else lines.push(`  • [${time}] ${e.pageType} page`);
            }
            const productViews = history.filter((h) => h.productName);
            if (productViews.length >= 2) {
                const families = [...new Set(productViews.map((h) => h.productFamily).filter(Boolean))];
                if (families.length === 1) lines.push(`\nInsight: Customer viewed ${productViews.length} products all in the ${families[0]} family.`);
                else if (families.length > 1) lines.push(`\nInsight: Comparing across families: ${families.join(", ")}.`);
            }
            return lines.join("\n");
        },

        showProducts: async (params: { query: string; family?: string }) => {
            try {
                const data = await callGraceServerTool<ProductCard[]>("searchCatalog", {
                    searchTerm: params.query ?? "",
                    familyLimit: params.family,
                    returnRaw: true,
                });
                if (data.error) return `${data.error} I could not search the catalog right now.`;
                const products: ProductCard[] = Array.isArray(data.result) ? data.result : [];
                if (products.length === 0) return "No products found. Try a different description.";

                const capMatch = params.query?.match(/\b(\d+(?:\.\d+)?)\s*ml\b/i);
                const requestedMl = capMatch ? parseFloat(capMatch[1]) : null;
                const rollOnWarning = checkRollOnMinimum(params.query || "", requestedMl, products);
                if (rollOnWarning) return rollOnWarning;

                const sizeWarning = checkSizeWarning(products, params.query);
                const exactSizeFound = !sizeWarning;
                const directProduct = selectDirectProductMatch(products, params.query);
                const displayProducts = directProduct ? [directProduct] : products;
                const tileProducts = selectGraceTileProducts(displayProducts, params.query);
                const summary = displayProducts.slice(0, 3).map((p) => [p.itemName, p.capacity, p.color].filter(Boolean).join(" ")).join(", ");

                sessionMetricsRef.current.toolsCalled++;
                sessionMetricsRef.current.toolsUsed.add("showProducts");
                analytics.graceToolCalled({ toolName: "showProducts", searchTerm: params.query, family: params.family, success: products.length > 0 });
                if (tileProducts.length > 0) {
                    pendingActionsRef.current.push({
                        type: "showProducts",
                        products: tileProducts,
                    });
                }
                if (!exactSizeFound) {
                    analytics.graceNoMatch({
                        searchTerm: params.query,
                        family: params.family,
                        suggestedQueries: summary,
                    });
                    return `${sizeWarning} I found confirmed nearby alternatives: ${summary}. Ask whether the customer wants to open those results.`;
                }

                const redirectUrl = resolveGraceRecommendationHref({
                    finderHref: buildCatalogPath(displayProducts, params.query, params.family),
                    exactProduct: directProduct,
                });
                sessionMetricsRef.current.navigations++;
                analytics.graceNavigation({ destination: redirectUrl, triggeredBy: "showProducts", query: params.query });
                setTimeout(() => {
                    routerRef.current.push(redirectUrl);
                    completeGraceNavigationRef.current("I narrowed the catalog for you");
                }, 500);
                if (exactSizeFound) {
                    return `Found ${products.length} options — top matches: ${summary}. Navigating the customer there now.`;
                }
                return `${sizeWarning} Opening the catalog with the closest matches: ${summary}.`;
            } catch (e) { console.error("[Grace] showProducts:", e); return "Catalog search failed."; }
        },

        compareProducts: async (params: { query: string; family?: string }) => {
            try {
                const data = await callGraceServerTool<ProductCard[]>("searchCatalog", {
                    searchTerm: params.query ?? "",
                    familyLimit: params.family,
                    returnRaw: true,
                });
                if (data.error) return `${data.error} I could not load products to compare.`;
                const products: ProductCard[] = Array.isArray(data.result) ? data.result : [];
                if (products.length === 0) return "No products found to compare.";

                const top = products.slice(0, 4);
                const lines = [`Comparing ${top.length} products:`];
                for (const p of top) {
                    lines.push(`\n• ${p.itemName}`);
                    lines.push(`  Family: ${p.family || "N/A"} | Size: ${p.capacity || "N/A"} | Color: ${p.color || "N/A"}`);
                    lines.push(`  Applicator: ${p.applicator || "N/A"} | Thread: ${p.neckThreadSize || "N/A"}`);
                    if (p.webPrice1pc) lines.push(`  Price: $${p.webPrice1pc.toFixed(2)}/pc`);
                }
                return lines.join("\n");
            } catch (e) { console.error("[Grace] compareProducts:", e); return "Comparison failed."; }
        },

        proposeCartAdd: (params: { products: Array<{
            itemName: string;
            graceSku: string;
            websiteSku?: string | null;
            shopifyVariantId?: string | null;
            checkoutEligible?: boolean;
            quantity?: number;
            webPrice1pc?: number;
            webPrice10pc?: number | null;
            webPrice12pc?: number | null;
            unitPrice?: number | null;
            family?: string;
            capacity?: string;
            color?: string;
            applicator?: string;
            capColor?: string | null;
            stockStatus?: string | null;
        }> | string }) => {
            let rawProducts: Array<{
                itemName: string;
                graceSku: string;
                websiteSku?: string | null;
                shopifyVariantId?: string | null;
                checkoutEligible?: boolean;
                quantity?: number;
                webPrice1pc?: number;
                webPrice10pc?: number | null;
                webPrice12pc?: number | null;
                unitPrice?: number | null;
                family?: string;
                capacity?: string;
                color?: string;
                applicator?: string;
                capColor?: string | null;
                stockStatus?: string | null;
            }>;
            if (typeof params.products === "string") {
                try { rawProducts = JSON.parse(params.products); } catch { rawProducts = []; }
            } else {
                rawProducts = params.products ?? [];
            }
            const products: PendingCartProduct[] = rawProducts.map((p) => ({
                graceSku: p.graceSku,
                websiteSku: p.websiteSku ?? null,
                itemName: p.itemName,
                shopifyVariantId: p.shopifyVariantId ?? null,
                checkoutEligible: p.checkoutEligible ?? Boolean(p.shopifyVariantId),
                quantity: Math.max(1, Math.floor(Number(p.quantity) || 1)),
                unitPrice: p.unitPrice ?? p.webPrice1pc ?? null,
                webPrice1pc: p.webPrice1pc,
                webPrice10pc: p.webPrice10pc,
                webPrice12pc: p.webPrice12pc,
                family: p.family,
                capacity: p.capacity,
                color: p.color,
                applicator: p.applicator,
                capColor: p.capColor,
                stockStatus: p.stockStatus,
            }));
            if (products.length === 0) return "No products specified to add.";
            try {
                const confirmationId = `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                pendingActionsRef.current.push({
                    type: "proposeCartAdd",
                    confirmationId,
                    products,
                    awaitingConfirmation: true,
                });
                sessionMetricsRef.current.toolsCalled++;
                sessionMetricsRef.current.toolsUsed.add("proposeCartAdd");
                const valueDelta = products.reduce((sum, p) => sum + (p.unitPrice ?? p.webPrice1pc ?? 0) * p.quantity, 0);
                analytics.graceToolCalled({ toolName: "proposeCartAdd", success: true });
                analytics.graceCartProposalShown({ itemCount: products.length, skus: products.map((p) => p.graceSku).join(", "), estimatedValue: valueDelta });
                const names = products.map((p) => `${p.itemName} ×${p.quantity}`).join(", ");
                return `Showing a cart confirmation card for: ${names}. Tell the customer to review and tap Add to cart.`;
            } catch (e) { console.error("[Grace] proposeCartAdd:", e); return "Failed to add items to cart."; }
        },

        proceedToCheckout: async () => {
            if (cartItemsRef.current.length === 0) {
                analytics.graceToolCalled({ toolName: "proceedToCheckout", success: false, status: "empty_cart" });
                return "The cart is empty. Ask which verified product they want to add before checkout.";
            }
            // This tool is proposal-only. Opening the cart is reversible; the
            // customer must confirm checkout from the visible cart UI.
            sessionMetricsRef.current.toolsCalled++;
            sessionMetricsRef.current.toolsUsed.add("proceedToCheckout");
            analytics.graceToolCalled({ toolName: "proceedToCheckout", success: true });
            analytics.graceNavigation({ destination: "/cart#drawer", triggeredBy: "proceedToCheckout" });
            window.dispatchEvent(new Event("open-cart-drawer"));
            return "The cart review is open. The customer must confirm checkout from the cart.";
        },

        navigateToPage: async (params: { path: string; title: string; description?: string; autoNavigate?: boolean | string; prefillFields?: Record<string, string> | string }) => {
            let navPath = (params.path ?? "").trim();
            let prefill: Record<string, string> | undefined;
            if (typeof params.prefillFields === "string") {
                try { prefill = JSON.parse(params.prefillFields); } catch { prefill = undefined; }
            } else {
                prefill = params.prefillFields;
            }

            // Cart is a drawer (Navbar-owned), not a route — dispatch the global open event instead of routing.
            if (navPath === "/cart" || navPath.startsWith("/cart?") || navPath.startsWith("/cart/")) {
                sessionMetricsRef.current.toolsCalled++;
                sessionMetricsRef.current.toolsUsed.add("navigateToPage");
                analytics.graceToolCalled({ toolName: "navigateToPage", success: true });
                analytics.graceNavigation({ destination: "/cart#drawer", triggeredBy: "navigateToPage" });
                setTimeout(() => {
                    window.dispatchEvent(new Event("open-cart-drawer"));
                    if (window.matchMedia("(max-width: 768px)").matches) {
                        closePanelRef.current();
                    }
                }, 500);
                return "Opened the cart drawer for the customer.";
            }

            // LLMs often omit path — infer from title/description via catalog search instead of sending users home.
            if (!navPath || navPath === "/") {
                const hint = `${params.title ?? ""} ${params.description ?? ""}`.trim();
                if (hint.length >= 3) {
                    try {
                        const inferData = await callGraceServerTool<ProductCard[]>("searchCatalog", {
                            searchTerm: hint.slice(0, 160),
                            returnRaw: true,
                        });
                        const hits: ProductCard[] = Array.isArray(inferData.result) ? inferData.result : [];
                        navPath = hits.length > 0 ? buildBrowsePath(hits, hint, undefined) : buildCatalogPath([], hint);
                    } catch {
                        navPath = `/catalog?search=${encodeURIComponent(hint.slice(0, 80))}&grace=1`;
                    }
                } else {
                    navPath = "/";
                }
            }

            if (prefill && Object.keys(prefill).length > 0) {
                const qs = new URLSearchParams(prefill).toString();
                navPath = `${navPath}${navPath.includes("?") ? "&" : "?"}${qs}`;
            }

            if (navPath.startsWith("/products/")) {
                const rawSlug = navPath.replace(/^\/products\//, "").split("?")[0];
                const canonicalSlug = getCanonicalProductSlug(rawSlug);
                if (canonicalSlug !== rawSlug) {
                    const query = navPath.includes("?") ? navPath.slice(navPath.indexOf("?")) : "";
                    navPath = `/products/${canonicalSlug}${query}`;
                }
                try {
                    const checkData = await callGraceServerTool<{ group?: unknown } | null>("getProductGroup", { slug: canonicalSlug });
                    if (!checkData.result || !(checkData.result as { group?: unknown }).group) {
                        const searchTerm = params.title && params.title.length > 3 ? params.title : slugToSearchTerm(rawSlug);
                        const searchData = await callGraceServerTool<ProductCard[]>("searchCatalog", {
                            searchTerm,
                            returnRaw: true,
                        });
                        const hits: ProductCard[] = Array.isArray(searchData.result) ? searchData.result : [];
                        if (hits.length > 0) {
                            const directHit = selectDirectProductMatch(hits, searchTerm);
                            navPath = resolveGraceRecommendationHref({
                                finderHref: buildBrowsePath(hits, searchTerm),
                                exactProduct: directHit,
                            });
                        } else {
                            navPath = buildCatalogPath([], searchTerm);
                        }
                    }
                } catch (e) { console.error("[Grace] slug validation:", e); }
            }

            if (navPath.startsWith("/catalog")) {
                navPath = expandCatalogPathFamilies(navPath);
                const titleBlock = `${params.title ?? ""} ${params.description ?? ""}`.trim();
                const categoryHint = inferCatalogCategoryFromSearchTerm(titleBlock);
                if (categoryHint) {
                    const qIdx = navPath.indexOf("?");
                    const base = qIdx === -1 ? navPath : navPath.slice(0, qIdx);
                    const sp = qIdx === -1 ? new URLSearchParams() : new URLSearchParams(navPath.slice(qIdx + 1));
                    if (!sp.get("category")) sp.set("category", categoryHint);
                    navPath = `${base}?${sp.toString()}`;
                }
                const searchHint = graceCatalogSearchFromQuery(titleBlock);
                if (searchHint) {
                    const qIdx = navPath.indexOf("?");
                    const base = qIdx === -1 ? navPath : navPath.slice(0, qIdx);
                    const sp = qIdx === -1 ? new URLSearchParams() : new URLSearchParams(navPath.slice(qIdx + 1));
                    if (!sp.get("search")) sp.set("search", searchHint);
                    navPath = `${base}?${sp.toString()}`;
                }
                // Strip stale facets only when the agent's own wording was purely a
                // size request — a "Cylinder 9ml" title keeps its families filter.
                navPath = normalizeGraceCatalogNavigationPath(navPath, titleBlock);
                if (!navPath.includes("grace=")) {
                    navPath = `${navPath}${navPath.includes("?") ? "&" : "?"}grace=1`;
                }
            }

            sessionMetricsRef.current.toolsCalled++;
            sessionMetricsRef.current.toolsUsed.add("navigateToPage");
            sessionMetricsRef.current.navigations++;
            analytics.graceToolCalled({ toolName: "navigateToPage", success: true });
            analytics.graceNavigation({ destination: navPath, triggeredBy: "navigateToPage" });
            const navTitle = params.title?.trim() || "where you asked";
            setTimeout(() => {
                routerRef.current.push(navPath);
                completeGraceNavigationRef.current(`Took you to ${navTitle}`);
            }, 500);
            return `Navigating the customer to ${params.title ?? "the page"} now.`;
        },

        showProductPresentation: async (params: { searchTerm: string; headline?: string; familyLimit?: string }) => {
            try {
                const data = await callGraceServerTool<ProductCard[]>("searchCatalog", {
                    searchTerm: params.searchTerm ?? "",
                    familyLimit: params.familyLimit,
                    returnRaw: true,
                });
                if (data.error) return `${data.error} Product presentation failed.`;
                const products: ProductCard[] = Array.isArray(data.result) ? data.result : [];
                if (products.length === 0) return "No products found to present.";

                const presented = selectGraceTileProducts(products, params.searchTerm);
                pendingActionsRef.current.push({
                    type: "showProductPresentation",
                    products: presented,
                    headline: params.headline ?? graceTileHeadline(params.searchTerm),
                });
                sessionMetricsRef.current.toolsCalled++;
                sessionMetricsRef.current.toolsUsed.add("showProductPresentation");
                analytics.graceToolCalled({ toolName: "showProductPresentation", searchTerm: params.searchTerm, family: params.familyLimit, success: true });
                const summary = presented.map((p) => `${p.itemName} (${p.capacity ?? ""} ${p.color ?? ""}, ${p.applicator ?? "N/A"}, $${p.webPrice1pc?.toFixed(2) ?? "TBD"}/pc)`).join("; ");
                return `Presenting ${presented.length} products: ${summary}. Describe these options to the customer and ask which interests them.`;
            } catch (e) { console.error("[Grace] showProductPresentation:", e); return "Product presentation failed."; }
        },

        prefillForm: (params: { formType: string; fields: Record<string, string> | string }) => {
            let fields: Record<string, string>;
            if (typeof params.fields === "string") {
                try { fields = JSON.parse(params.fields); } catch { fields = {}; }
            } else {
                fields = params.fields;
            }
            window.dispatchEvent(new CustomEvent("grace:prefillForm", { detail: { formType: params.formType, fields } }));
            return "Form pre-filled. The customer can review and submit.";
        },

        updateFormField: (params: { formType: string; fieldName: string; value: string }) => {
            const { formType, fieldName, value } = params;
            if (!activeFormRef.current) activeFormRef.current = { formType, fields: {} };
            activeFormRef.current.fields[fieldName] = value;
            return `Field "${fieldName}" set to "${value}".`;
        },

        submitForm: async () => {
            const form = activeFormRef.current;
            if (!form) return "No form data collected. Use updateFormField first.";
            if (!form.fields.email) return "Email address is required. Please ask for it.";
            // This tool never performs the mutation. It moves the exact draft
            // into a visible first-party form where the customer must review
            // and submit it themselves.
            const formDestinations: Record<string, { path: string; formType: FormType }> = {
                sample: { path: "/request-sample", formType: "sample" },
                quote: { path: "/request-quote", formType: "quote" },
                contact: { path: "/contact", formType: "contact" },
                newsletter: { path: "/contact", formType: "contact" },
            };
            const formDestination = formDestinations[form.formType];
            if (!formDestination) return "That form type is not supported.";
            const safeFields = Object.fromEntries(
                Object.entries(form.fields).slice(0, 20).map(([key, value]) => [key, value.slice(0, 2_000)]),
            );
            sessionStorage.setItem("bb-grace-form-draft", JSON.stringify({
                formType: formDestination.formType,
                fields: safeFields,
            }));
            sessionMetricsRef.current.toolsCalled++;
            sessionMetricsRef.current.toolsUsed.add("submitForm");
            analytics.graceToolCalled({ toolName: "submitForm", success: true, status: "review_required" });
            routerRef.current.push(formDestination.path);
            return "The completed draft is open in a visible form. The customer must review and submit it.";
        },

        // ─── v3 inline display tools (PRD Patterns A–L) ──────────────────────
        // Each `display*` tool fetches its data, parks a GraceAction on
        // `pendingActionsRef` queue, and returns brief text the LLM can narrate
        // alongside the rendered card. The action is attached to the next
        // assistant message in `handleMessage` / `handleAgentChatResponsePart`.
        // The remaining display tools (B, C, D, E, F, G, H, I, J, L) are added
        // alongside their pattern components in later phases.

        displayProductCard: async (params: { graceSku: string }) => {
            try {
                const data = await callGraceServerTool<ProductCard | null>("getProductBySku", { graceSku: params.graceSku });
                if (data.error) return `${data.error} Could not render the product card.`;
                const product = data.result;
                if (!product) return `No product found for SKU "${params.graceSku}". Try searchCatalog first.`;

                pendingActionsRef.current.push({ type: "displayProductCard", product });
                sessionMetricsRef.current.toolsCalled++;
                sessionMetricsRef.current.toolsUsed.add("displayProductCard");
                analytics.graceToolCalled({ toolName: "displayProductCard", success: true });
                return `Showing ${product.itemName}${product.capacity ? ` (${product.capacity})` : ""} inline. Add a one-line narration above the card.`;
            } catch (e) {
                console.error("[Grace] displayProductCard:", e);
                return "Could not render the product card.";
            }
        },

        displayFamilyCard: async (params: { family: string; capacityMl?: number }) => {
            try {
                const data = await callGraceServerTool<import("@/components/GraceContext").FamilyCardPayload | null>("getFamilyForCard", {
                    family: params.family,
                    capacityMl: params.capacityMl,
                });
                if (data.error) return `${data.error} Could not render the family card.`;
                if (!data.result) return `No data for the ${params.family} family.`;
                const payload = data.result;
                if (params.capacityMl != null) {
                    const match = payload.variants.find((v) => v.capacityMl === params.capacityMl);
                    if (match) payload.defaultGraceSku = match.graceSku;
                }
                pendingActionsRef.current.push({ type: "displayFamilyCard", payload });
                sessionMetricsRef.current.toolsCalled++;
                sessionMetricsRef.current.toolsUsed.add("displayFamilyCard");
                analytics.graceToolCalled({ toolName: "displayFamilyCard", success: true });
                return `Showing the ${params.family} family with ${payload.variants.length} variants inline.`;
            } catch (e) { console.error("[Grace] displayFamilyCard:", e); return "Could not render the family card."; }
        },

        displayCompatibility: async (params: { bottleSku: string }) => {
            try {
                const data = await callGraceServerTool<{ bottle: ProductCard & { neckThreadSize?: string }; components?: Record<string, Array<ProductCard & { capColor?: string; imageUrl?: string }>> } | null>("getBottleComponents", { bottleSku: params.bottleSku });
                if (data.error) return `${data.error} Could not render compatibility tray.`;
                if (!data.result) return `No compatible components found for "${params.bottleSku}".`;
                const { bottle, components } = data.result;
                const flatComponents: Array<ProductCard & { componentType?: string; heroImageUrl?: string | null; fitmentVerified?: boolean }> = [];
                for (const [type, items] of Object.entries(components ?? {})) {
                    if (!Array.isArray(items)) continue;
                    for (const item of items.slice(0, 8)) {
                        flatComponents.push({
                            ...item,
                            componentType: type.replace(/([A-Z])/g, " $1").trim(),
                            heroImageUrl: item.imageUrl ?? null,
                            fitmentVerified: true,
                        });
                    }
                }
                pendingActionsRef.current.push({
                    type: "displayCompatibility",
                    payload: {
                        bottle,
                        threadSize: bottle.neckThreadSize ?? "unknown",
                        components: flatComponents,
                    },
                });
                sessionMetricsRef.current.toolsCalled++;
                sessionMetricsRef.current.toolsUsed.add("displayCompatibility");
                analytics.graceToolCalled({ toolName: "displayCompatibility", success: true });
                return `Compatibility tray is open with ${flatComponents.length} verified components for ${bottle.itemName}. Do not ask whether to open it; ask which option or finish the customer wants.`;
            } catch (e) { console.error("[Grace] displayCompatibility:", e); return "Could not render compatibility tray."; }
        },

        displayBuildKit: async (params: { bottleSku: string; closureSku?: string; applicatorSku?: string }) => {
            try {
                const fetchOne = async (sku: string | undefined) => {
                    if (!sku) return null;
                    const data = await callGraceServerTool<ProductCard | null>("getProductBySku", { graceSku: sku });
                    return data.result ?? null;
                };
                const componentData = await callGraceServerTool<{ bottle: ProductCard; components?: Record<string, ProductCard[]> } | null>("getBottleComponents", { bottleSku: params.bottleSku });
                if (componentData.error) return `${componentData.error} Could not verify kit compatibility.`;
                if (!componentData.result?.bottle) return `Could not verify compatible kit components for "${params.bottleSku}". Run searchCatalog to get a current bottle SKU, then try displayBuildKit again.`;

                const compatibleComponents: Array<ProductCard & { componentType?: string }> = [];
                for (const [type, items] of Object.entries(componentData.result.components ?? {})) {
                    if (!Array.isArray(items)) continue;
                    for (const item of items) compatibleComponents.push({ ...item, componentType: type });
                }
                const compatibleBySku = new Map(compatibleComponents.map((p) => [p.graceSku, p]));
                const requestedComponentSkus = [params.closureSku, params.applicatorSku].filter(Boolean) as string[];
                const incompatible = requestedComponentSkus.filter((sku) => !compatibleBySku.has(sku));
                if (incompatible.length > 0) {
                    analytics.graceToolCalled({ toolName: "displayBuildKit", success: false, status: "incompatible_component" });
                    return `I could not verify ${incompatible.join(", ")} as compatible with ${componentData.result.bottle.itemName}. Run getBottleComponents and choose only returned component SKUs before building the kit.`;
                }

                const bottle = await fetchOne(params.bottleSku) ?? componentData.result.bottle;
                const closure = params.closureSku ? compatibleBySku.get(params.closureSku) ?? null : null;
                const bottleAlreadyConfigured = Boolean(bottle.applicator || bottle.capColor)
                    || /\bwith\b.+\b(sprayer|pump|roller|dropper|cap|closure|overcap)\b/i.test(bottle.itemName)
                    || /\bfine mist sprayer\b/i.test(bottle.itemName);
                const applicator = params.applicatorSku
                    ? compatibleBySku.get(params.applicatorSku) ?? null
                    : bottleAlreadyConfigured
                        ? null
                        : compatibleComponents.find((p) => /sprayer|pump|dropper|roller/i.test(`${p.componentType ?? ""} ${p.itemName ?? ""}`)) ?? null;
                pendingActionsRef.current.push({
                    type: "displayBuildKit",
                    payload: {
                        bottle,
                        closure: closure ?? undefined,
                        applicator: applicator ?? undefined,
                        alternatives: {
                            closure: compatibleComponents.filter((p) => /cap|closure/i.test(`${p.componentType ?? ""} ${p.itemName ?? ""}`)).slice(0, 8),
                            applicator: compatibleComponents.filter((p) => /sprayer|pump|dropper|roller/i.test(`${p.componentType ?? ""} ${p.itemName ?? ""}`)).slice(0, 8),
                        },
                    },
                });
                sessionMetricsRef.current.toolsCalled++;
                sessionMetricsRef.current.toolsUsed.add("displayBuildKit");
                analytics.graceToolCalled({ toolName: "displayBuildKit", success: true });
                const parts = [bottle.itemName, closure?.itemName, applicator?.itemName].filter(Boolean).join(" + ");
                return `Fitment-verified kit workspace is open: ${parts}. Do not say unverified components fit. If the bottle already includes an applicator or cap, explain that additional components are optional swaps, not required add-ons.`;
            } catch (e) { console.error("[Grace] displayBuildKit:", e); return "Could not assemble the kit."; }
        },

        displayComparison: async (params: { graceSkus: string[] | string; dimensions?: string[] | string }) => {
            try {
                // Realtime tool calls sometimes JSON-stringify array params — defensive parse,
                // matches the pattern proposeCartAdd already uses.
                const skus: string[] = (() => {
                    if (Array.isArray(params.graceSkus)) return params.graceSkus;
                    if (typeof params.graceSkus === "string") {
                        try { const parsed = JSON.parse(params.graceSkus); return Array.isArray(parsed) ? parsed : []; }
                        catch { return params.graceSkus.split(",").map((s) => s.trim()).filter(Boolean); }
                    }
                    return [];
                })();
                const dimensions: string[] | undefined = (() => {
                    if (Array.isArray(params.dimensions)) return params.dimensions;
                    if (typeof params.dimensions === "string") {
                        try { const parsed = JSON.parse(params.dimensions); return Array.isArray(parsed) ? parsed : undefined; }
                        catch { return [params.dimensions]; }
                    }
                    return undefined;
                })();
                console.log("[Grace] displayComparison called", { skus, dimensions });
                if (skus.length < 2) return "Need at least 2 SKUs to compare. Run searchCatalog first to get the SKUs, then call displayComparison again.";

                const data = await callGraceServerTool<ProductCard[]>("getProductsForComparison", { graceSkus: skus });
                if (data.error) return `${data.error} Could not render comparison.`;
                const products = Array.isArray(data.result) ? data.result : [];
                console.log("[Grace] displayComparison fetched", products.length, "products");
                if (products.length === 0) return "No products found for those SKUs. Re-run searchCatalog to get fresh SKUs.";

                pendingActionsRef.current.push({
                    type: "displayComparison",
                    payload: {
                        products,
                        dimensions: dimensions as ("trueScale" | "spec")[] | undefined,
                    },
                });
                console.log("[Grace] pendingAction queued: displayComparison");
                sessionMetricsRef.current.toolsCalled++;
                sessionMetricsRef.current.toolsUsed.add("displayComparison");
                analytics.graceToolCalled({ toolName: "displayComparison", success: true });
                const hasScaleData = products.some((p) => typeof (p as ProductCard & { heightMm?: unknown }).heightMm === "number");
                return `Comparison rendered with ${products.length} products${dimensions?.includes("trueScale") && hasScaleData ? " at true scale" : ""}. Tell the customer to look at the table.`;
            } catch (e) { console.error("[Grace] displayComparison:", e); return "Could not render comparison."; }
        },

        displayCatalogStrip: async (params: { category?: string }) => {
            try {
                const data = await callGraceServerTool<import("@/components/GraceContext").CatalogStripPayload | null>("getCatalogStrip", { category: params.category ?? null });
                if (data.error) return `${data.error} Could not load catalog strip.`;
                if (!data.result) return "Could not load catalog families.";
                pendingActionsRef.current.push({ type: "displayCatalogStrip", payload: data.result });
                sessionMetricsRef.current.toolsCalled++;
                sessionMetricsRef.current.toolsUsed.add("displayCatalogStrip");
                analytics.graceToolCalled({ toolName: "displayCatalogStrip", success: true });
                return `Showing ${data.result.families.length} bottle families. Tell the customer to tap a tile.`;
            } catch (e) { console.error("[Grace] displayCatalogStrip:", e); return "Could not load catalog strip."; }
        },

        displayShortlist: async (params?: { includeShareLink?: boolean | string }) => {
            try {
                const recentProducts: ProductCard[] = [];
                const addUnique = (p: ProductCard | undefined | null) => {
                    if (!p?.graceSku || recentProducts.some((x) => x.graceSku === p.graceSku)) return;
                    recentProducts.push(p);
                };

                for (const msg of [...messagesRef.current].reverse()) {
                    for (const action of graceMessageActions(msg)) {
                        if (action.type === "displayProductCard") addUnique(action.product);
                        if (action.type === "showProducts" || action.type === "compareProducts" || action.type === "showProductPresentation") {
                            action.products.forEach(addUnique);
                        }
                        if (action.type === "displayComparison") action.payload.products.forEach(addUnique);
                        if (action.type === "displayBuildKit") {
                            addUnique(action.payload.bottle);
                            addUnique(action.payload.closure);
                            addUnique(action.payload.applicator);
                        }
                    }
                    if (recentProducts.length >= 6) break;
                }

                if (recentProducts.length === 0) {
                    for (const item of cartItemsRef.current) {
                        addUnique({
                            graceSku: item.graceSku,
                            itemName: item.itemName,
                            capacity: item.capacity,
                            family: item.family,
                            color: item.color,
                            applicator: item.applicator ?? undefined,
                            capColor: item.capColor ?? undefined,
                            webPrice1pc: item.unitPrice ?? undefined,
                        });
                    }
                }

                if (recentProducts.length === 0) {
                    return "There are no verified products to shortlist yet. Run searchCatalog first, then call displayShortlist again.";
                }

                const ownerKey = getAnonOwnerKey();
                const created = await createShortlistRef.current({
                    ownerKey,
                    name: "Grace shortlist",
                    items: recentProducts.slice(0, 6).map((p) => ({
                        graceSku: p.graceSku,
                        addedAt: Date.now(),
                    })),
                });
                const includeShare = params?.includeShareLink === true || params?.includeShareLink === "true";
                const share = includeShare
                    ? await mintShortlistShareTokenRef.current({ shortlistId: created.id })
                    : null;
                const shareUrl = share?.shareToken && typeof window !== "undefined"
                    ? `${window.location.origin}/grace-workspace?shortlist=${share.shareToken}`
                    : undefined;

                pendingActionsRef.current.push({
                    type: "displayShortlist",
                    payload: {
                        shortlistId: String(created.id),
                        items: recentProducts.slice(0, 6),
                        shareUrl,
                        expiresAt: shareUrl ? Date.now() + 90 * 86400000 : undefined,
                    },
                });
                sessionMetricsRef.current.toolsCalled++;
                sessionMetricsRef.current.toolsUsed.add("displayShortlist");
                analytics.graceToolCalled({ toolName: "displayShortlist", success: true });
                return `Shortlist created with ${recentProducts.slice(0, 6).length} verified products${shareUrl ? " and a share link" : ""}.`;
            } catch (e) {
                console.error("[Grace] displayShortlist:", e);
                analytics.graceToolCalled({ toolName: "displayShortlist", success: false, status: "error" });
                return "Could not create the shortlist right now.";
            }
        },

        setCatalogRefinements: async (params: {
            customerRequest: string;
            search?: string | null;
            category?: string | null;
            collection?: string | null;
            applicators?: string[] | string | null;
            families?: string[] | string | null;
            colors?: string[] | string | null;
            capacities?: string[] | string | null;
            neckThreadSizes?: string[] | string | null;
            componentType?: string | null;
            priceMin?: number | null;
            priceMax?: number | null;
        }) => {
            const asArray = (value: string[] | string | null | undefined): string[] | undefined => {
                if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
                if (typeof value !== "string") return undefined;
                try {
                    const parsed = JSON.parse(value);
                    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
                } catch { /* comma-delimited legacy param compatibility */ }
                return value.split(",").map((item) => item.trim()).filter(Boolean);
            };
            const proposal: GraceRefinementProposal = {};
            if (typeof params.search === "string") proposal.search = params.search;
            if (typeof params.category === "string") proposal.category = params.category;
            if (typeof params.collection === "string") proposal.collection = params.collection;
            if (typeof params.componentType === "string") proposal.componentType = params.componentType;
            if (typeof params.priceMin === "number") proposal.priceMin = params.priceMin;
            if (typeof params.priceMax === "number") proposal.priceMax = params.priceMax;
            const applicators = asArray(params.applicators);
            const families = asArray(params.families);
            const colors = asArray(params.colors);
            const capacities = asArray(params.capacities);
            const neckThreadSizes = asArray(params.neckThreadSizes);
            if (applicators) proposal.applicators = normalizeApplicatorBuckets(applicators);
            if (families) proposal.families = families;
            if (colors) proposal.colors = colors;
            if (capacities) proposal.capacities = capacities;
            if (neckThreadSizes) proposal.neckThreadSizes = neckThreadSizes;

            const current = pageContextRef.current?.refineState ?? getGraceRefineState(new URLSearchParams());
            const next = applyGraceRefinementRequest(current, proposal, params.customerRequest ?? "");
            const refinementVerification = await callGraceServerTool<{
                totalCount?: number;
                items?: unknown[];
            }>("searchCatalog", {
                searchTerm: next.filters.search || params.customerRequest || "catalog refinement",
                categoryLimit: null,
                familyLimit: null,
                applicatorFilter: null,
                refineState: next,
                returnRaw: true,
            });
            if (refinementVerification.error) {
                analytics.graceToolCalled({ toolName: "setCatalogRefinements", success: false, status: "verification_failed" });
                return `I could not verify that Refine change, so I did not claim it succeeded. ${refinementVerification.error}`;
            }
            const verifiedCount = refinementVerification.result?.totalCount
                ?? refinementVerification.result?.items?.length
                ?? 0;
            // A zero-match refinement means the FILTER combination is wrong, not
            // that the product is missing. Do not apply it to the visible catalog
            // (an empty grid reads as "we don't carry it") — steer the model to
            // recover instead. Found live 2026-08-06: "black plug" became
            // colors:["Black"], but the colors facet filters GLASS color, so a
            // black-closure vial verified 0 and Grace declared it nonexistent.
            if (verifiedCount === 0) {
                analytics.graceToolCalled({ toolName: "setCatalogRefinements", success: false, status: "zero_matches" });
                return `Refine NOT applied: that filter combination matches 0 product groups, so the change was rejected to avoid showing an empty catalog. This is NOT evidence the product doesn't exist — one dimension is wrong (most often a cap/closure color placed in the glass-color facet). Drop the suspect dimension and call searchCatalog with a plain description instead; answer availability ONLY from those rows. Current state remains: ${formatGraceRefineState(current)}`;
            }
            routerRef.current.replace(graceRefineDestination(next));
            sessionMetricsRef.current.toolsCalled++;
            sessionMetricsRef.current.toolsUsed.add("setCatalogRefinements");
            analytics.graceToolCalled({ toolName: "setCatalogRefinements", success: true });
            return `Verified ${verifiedCount} matching product group${verifiedCount === 1 ? "" : "s"} and updated the visible Refine state. ${formatGraceRefineState(next)}`;
        },

        prepareQuoteRequest: async (params: {
            products: PendingCartProduct[] | string;
            name?: string | null;
            email?: string | null;
            company?: string | null;
            phone?: string | null;
            message?: string | null;
        }) => {
            const requested: PendingCartProduct[] = (() => {
                if (Array.isArray(params.products)) return params.products;
                try {
                    const parsed = JSON.parse(params.products);
                    return Array.isArray(parsed) ? parsed : [];
                } catch { return []; }
            })();
            if (requested.length === 0) return "No quote line items were supplied. Search the catalog first.";

            const lineItems = [];
            for (const item of requested.slice(0, 12)) {
                const data = await callGraceServerTool<ProductCard | null>("getProductBySku", { graceSku: item.graceSku });
                if (!data.result) return `I could not verify SKU ${item.graceSku}, so I did not prepare the quote.`;
                const product = data.result;
                lineItems.push({
                    sku: product.graceSku,
                    websiteSku: product.websiteSku ?? undefined,
                    name: product.itemName,
                    quantity: Math.max(1, Number(item.quantity) || 1),
                    unitPrice: product.webPrice1pc ?? null,
                    family: product.family,
                    capacity: product.capacity,
                    color: product.color,
                    applicator: product.applicator ?? null,
                    capColor: product.capColor ?? null,
                    neckThreadSize: product.neckThreadSize ?? null,
                });
            }
            sessionStorage.setItem("bb-rfq-line-items", JSON.stringify(lineItems));
            const next = new URLSearchParams();
            const fields = ["name", "email", "company", "phone", "message"] as const;
            for (const field of fields) {
                const value = params[field];
                if (typeof value === "string" && value.trim()) next.set(field, value.trim());
            }
            next.set("products", lineItems.map((item) => `${item.name} (SKU: ${item.websiteSku ?? item.sku})`).join("\n"));
            next.set("quantities", lineItems.map((item) => `${item.websiteSku ?? item.sku}: ${item.quantity}`).join("\n"));
            routerRef.current.push(`/request-quote?${next.toString()}`);
            completeGraceNavigationRef.current("Your verified quote draft is ready to review.");
            sessionMetricsRef.current.toolsCalled++;
            sessionMetricsRef.current.toolsUsed.add("prepareQuoteRequest");
            analytics.graceToolCalled({ toolName: "prepareQuoteRequest", success: true });
            return `Prepared a structured quote draft with ${lineItems.length} verified line item${lineItems.length === 1 ? "" : "s"}. The customer must review and submit the form.`;
        },

        listGraceProjects: async () => {
            if (!userIdRef.current) return "Project saving is available after sign-in. Guests can use a shareable shortlist in the meantime.";
            const response = await fetchJsonWithTimeout<{ projects?: Array<{ _id: string; name: string; savedBottleCount: number }>; error?: string }>(
                "/api/portal/grace/projects",
                { method: "GET" },
            );
            if (!response.ok) return response.error ?? "Could not load Grace projects.";
            const projects = response.data?.projects ?? [];
            if (projects.length === 0) return "The customer has no Grace projects yet. Offer to create one with proposeProjectSave.";
            return projects.map((project) => `${project.name} — ID ${project._id} — ${project.savedBottleCount} saved bottle${project.savedBottleCount === 1 ? "" : "s"}`).join("\n");
        },

        proposeProjectSave: async (params: { graceSku: string; projectId?: string | null; projectName?: string | null; notes?: string | null }) => {
            const data = await callGraceServerTool<ProductCard | null>("getProductBySku", { graceSku: params.graceSku });
            if (!data.result) return `I could not verify SKU ${params.graceSku}, so I did not prepare a project save.`;
            pendingActionsRef.current.push({
                type: "proposeProjectSave",
                confirmationId: `project-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                product: data.result,
                projectId: params.projectId ?? undefined,
                projectName: params.projectName ?? undefined,
                notes: params.notes ?? undefined,
                requiresSignIn: !userIdRef.current,
                awaitingConfirmation: true,
            });
            sessionMetricsRef.current.toolsCalled++;
            sessionMetricsRef.current.toolsUsed.add("proposeProjectSave");
            analytics.graceToolCalled({ toolName: "proposeProjectSave", success: true });
            return userIdRef.current
                ? "Project save prepared. Ask the customer to confirm the visible save card. Do not claim it is saved yet."
                : "Project save prepared, but the customer must sign in before confirming. Their guest shortlist remains available.";
        },

        displayAnatomy: async (params: { graceSku: string }) => {
            try {
                const data = await callGraceServerTool<ProductCard & { heroImageUrl?: string | null; capColor?: string | null } | null>("getProductBySku", { graceSku: params.graceSku });
                if (data.error) return `${data.error} Could not render anatomy view.`;
                const product = data.result;
                if (!product) return `No product found for SKU "${params.graceSku}".`;

                // v1 stub: four fixed-percentage pins; per-family anchors are
                // intentionally deferred until verified product data is available.
                const pins = [
                    { x: 0.5, y: 0.08, label: "Cap", value: product.capColor ?? undefined },
                    { x: 0.5, y: 0.22, label: "Neck", value: product.neckThreadSize ?? undefined },
                    { x: 0.5, y: 0.38, label: "Shoulder" },
                    { x: 0.5, y: 0.90, label: "Capacity", value: product.capacity ?? undefined },
                ].filter((p) => p.value || p.label === "Shoulder");

                pendingActionsRef.current.push({ type: "displayAnatomy", payload: { product, pins } });
                sessionMetricsRef.current.toolsCalled++;
                sessionMetricsRef.current.toolsUsed.add("displayAnatomy");
                analytics.graceToolCalled({ toolName: "displayAnatomy", success: true });
                return `Showing the anatomy of ${product.itemName} with ${pins.length} callouts.`;
            } catch (e) { console.error("[Grace] displayAnatomy:", e); return "Could not render anatomy view."; }
        },

        // ── End provider-neutral client tools ───────────────────────────────
    }), []);

    // ── Realtime session callbacks ───────────────────────────────────────────

    const handleConnect = useCallback(() => {
        connectingRef.current = false;
        setGraceStatus("listening");
        setConversationActive(true);
        sessionMetricsRef.current = { toolsCalled: 0, toolsUsed: new Set(), cartItemsAdded: 0, navigations: 0 };
        const ctx = pageContextRef.current;
        analytics.graceConversationStarted({
            pageType: ctx?.pageType ?? "unknown",
            pathname: ctx?.pathname ?? "/",
            productName: ctx?.currentProduct?.name,
            productFamily: ctx?.currentProduct?.family,
            cartItemCount: ctx?.cartItems.length ?? 0,
        });

        if (pendingMessageRef.current) {
            const pending = pendingMessageRef.current;
            pendingMessageRef.current = null;
            setTimeout(() => {
                if (conversationRef.current?.getId?.()) {
                    conversationRef.current.sendUserMessage(pending);
                }
            }, 500);
        }
    }, []);

    // Track auto-reconnect attempts so a persistently failing server doesn't loop forever.
    const reconnectAttemptsRef = useRef(0);
    const MAX_RECONNECTS = 2;
    // True while a teardown the user asked for (end button, voice toggle, new
    // chat) is in flight, so handleDisconnect can tell intentional ends apart
    // from server-side cutoffs (e.g. provider max call duration).
    const intentionalEndRef = useRef(false);

    const handleDisconnect = useCallback((details: { reason: string; message?: string; closeCode?: number; closeReason?: string }) => {
        // Verbose telemetry on every disconnect — voice cutouts are hard to
        // diagnose without close code visibility.
        console.warn(
            "[Grace] Voice disconnected — reason:",
            details.reason,
            "closeCode:",
            details.closeCode,
            "closeReason:",
            details.closeReason,
            "msg:",
            details.message,
        );

        connectingRef.current = false;
        const m = sessionMetricsRef.current;
        const ctx = pageContextRef.current;
        analytics.graceConversationEnded({
            pageType: ctx?.pageType ?? "unknown",
            pathname: ctx?.pathname ?? "/",
            toolsCalledCount: m.toolsCalled,
            toolsUsed: [...m.toolsUsed].join(", "),
            cartItemsAdded: m.cartItemsAdded,
            navigationsTriggered: m.navigations,
        });
        setConversationActive(false);
        setStreamingText("");
        setIsAwaitingReply(false);

        // Auto-reconnect on transient failure ONLY when voice is still enabled
        // (user hasn't toggled it off) and we haven't exhausted attempts.
        // Close codes treated as transient: 1006 (abnormal close — usually
        // network), 1011 (server error), 1012/1013 (server restart / try later).
        const transientCodes = new Set([1006, 1011, 1012, 1013, 1001]);
        const shouldReconnect =
            details.reason === "error"
            && voiceEnabledRef.current
            && reconnectAttemptsRef.current < MAX_RECONNECTS
            && (details.closeCode == null || transientCodes.has(details.closeCode));

        if (shouldReconnect) {
            reconnectAttemptsRef.current += 1;
            const attempt = reconnectAttemptsRef.current;
            console.log(`[Grace] Auto-reconnect attempt ${attempt}/${MAX_RECONNECTS}…`);
            setGraceStatus("connecting");
            // Exponential backoff: 800ms, then 2s
            const delay = 800 * Math.pow(2.5, attempt - 1);
            setTimeout(() => {
                if (voiceEnabledRef.current && !conversationRef.current?.getId?.()) {
                    startConversationRef.current(false).catch((err: unknown) => {
                        console.error("[Grace] Auto-reconnect failed:", err);
                    });
                }
            }, delay);
        } else {
            setGraceStatus("idle");
            // Reset the counter so the next user-initiated session starts fresh.
            reconnectAttemptsRef.current = 0;

            // Surface unexpected session ends (e.g. provider max call
            // duration, closeCode 1000 from the agent) — otherwise the chat
            // just goes quiet and voice users keep talking into a dead
            // connection. send() restarts the session on the next message.
            if (!intentionalEndRef.current) {
                const wasVoice = voiceEnabledRef.current;
                if (wasVoice) {
                    voiceEnabledRef.current = false;
                    setVoiceEnabled(false);
                }
                const note = wasVoice
                    ? "Our voice session reached its time limit. Tap the mic to reconnect, or keep typing — I remember where we left off."
                    : "Our live session ended. Send a message and I'll pick up right where we left off.";
                setMessages((prev) => prev.length > 0
                    ? [...prev, { role: "grace", content: note, id: nextMsgId() }]
                    : prev);
            }
        }
        intentionalEndRef.current = false;
    }, []);

    // Forward ref to startConversation so handleDisconnect (declared earlier)
    // can call it without violating callback dependency rules.
    const startConversationRef = useRef<(forceTextOnly?: boolean) => Promise<boolean>>(async () => false);

    const handleModeChange = useCallback((mode: { mode: string }) => {
        if (mode.mode === "speaking") setGraceStatus("speaking");
        else if (mode.mode === "listening") setGraceStatus("listening");
    }, []);

    const handleError = useCallback((error: unknown) => {
        console.error("[Grace] Error:", error);
        connectingRef.current = false;
        setGraceStatus("error");
        setErrorMessage(typeof error === "string" ? error : "Connection error");
        setVoiceFailed(true);
        analytics.graceConnectionFailed({
            mode: voiceEnabledRef.current ? "voice" : "text",
            error: typeof error === "string" ? error : "Connection error",
        });
        setIsAwaitingReply(false);
        setTimeout(() => {
            setGraceStatus((prev) => prev === "error" ? "idle" : prev);
        }, 5000);
    }, []);

    // Track whether onMessage fires after streaming completes
    const streamingFinalizedRef = useRef(false);

    const handleMessage = useCallback((payload: { message: string; source?: string; role?: string }) => {
        const role = payload.role === "user" ? "user" as const : "grace" as const;
        const text = payload.message;
        const norm = normalizeGraceMessageText(text);

        if (role === "user") {
            // Append voice transcripts; skip if send() already inserted an identical line
            setMessages((prev) => {
                const lastUser = [...prev].reverse().find((m) => m.role === "user");
                if (lastUser && normalizeGraceMessageText(lastUser.content) === norm) {
                    return prev;
                }
                return [...prev, { role: "user", content: text, id: nextMsgId() }];
            });
            setIsAwaitingReply(true);
            return;
        }

        // Assistant message finalization — attach every queued GraceAction for
        // this turn. The model can call several display tools before emitting
        // one final assistant message, so a single-action slot strands later UI.
        streamingFinalizedRef.current = true;
        setIsAwaitingReply(false);
        setStreamingText("");
        const actions = pendingActionsRef.current.splice(0);
        if (actions.length) {
            console.log(
                "[Grace] handleMessage attaching actions:",
                actions.map((action) => action.type).join(", "),
                "to message:",
                text.slice(0, 60),
            );
        }
        setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (
                last?.role === "grace"
                && normalizeGraceMessageText(last.content) === norm
            ) {
                // Same content already finalized — but actions might be new.
                if (actions.length) {
                    return prev.map((m, i) => i === prev.length - 1 ? mergeGraceActions(m, actions) : m);
                }
                return prev;
            }
            return [
                ...prev,
                { role, content: text, id: nextMsgId(), action: actions[0], actions: actions.length ? actions : undefined },
            ];
        });
    }, []);

    const handleAgentChatResponsePart = useCallback((payload: { text: string; type?: string }) => {
        if (payload.type === "stop") {
            // Do not clear streamingFinalizedRef here — onMessage may have already set it to true.
            // Clearing it caused the 600ms fallback to duplicate the same assistant bubble.
            const stopText = payload.text ?? "";
            setTimeout(() => {
                if (!streamingFinalizedRef.current) {
                    // onMessage didn't fire — finalize from streaming text + attach any pending action.
                    // CRITICAL: only consume an action from the queue when we actually have a
                    // message to attach it to. Otherwise this path silently drops the action
                    // and handleMessage (running later via `message` event) never gets it.
                    setStreamingText((prev) => {
                        const final = (prev + stopText).trim();
                        if (final) {
                            const n = normalizeGraceMessageText(final);
                            const actions = pendingActionsRef.current.splice(0);
                            if (actions.length) {
                                console.log(
                                    "[Grace] handleAgentChatResponsePart(stop) attaching actions:",
                                    actions.map((action) => action.type).join(", "),
                                    "to:",
                                    final.slice(0, 60),
                                );
                            }
                            setMessages((msgs) => {
                                const last = msgs[msgs.length - 1];
                                if (last?.role === "grace" && normalizeGraceMessageText(last.content) === n) {
                                    if (actions.length) {
                                        return msgs.map((m, i) => i === msgs.length - 1 ? mergeGraceActions(m, actions) : m);
                                    }
                                    return msgs;
                                }
                                return [
                                    ...msgs,
                                    { role: "grace" as const, content: final, id: nextMsgId(), action: actions[0], actions: actions.length ? actions : undefined },
                                ];
                            });
                        }
                        // If `final` was empty: don't shift the queue — let handleMessage
                        // pick it up on the actual `message` event.
                        return "";
                    });
                }
                streamingFinalizedRef.current = false;
            }, 600);
            return;
        }
        setIsAwaitingReply(false);
        setStreamingText((prev) => {
            if (prev === "") {
                streamingFinalizedRef.current = false;
            }
            return prev + payload.text;
        });
    }, []);

    const openAIAdapter = useMemo<GraceOpenAIRealtimeAdapter>(() =>
        createGraceOpenAIRealtimeAdapter({
            baseInstructions: GRACE_REALTIME_INSTRUCTIONS,
            toolImplementations: clientTools as unknown as GraceRealtimeToolImplementations,
            knowledgeContext: {
                surface: "storefront",
                role: userId ? "customer" : "public",
                actorId: userId,
                organizationId: null,
                conversationId: "grace-realtime",
                projectId: null,
                refineState: null,
                requestId: "grace-realtime-config",
            },
            callbacks: {
                onConnect: handleConnect,
                onDisconnect: () => handleDisconnect({ reason: "disconnected" }),
                onModeChange: (mode) => handleModeChange({ mode }),
                onError: handleError,
                onTranscriptDelta: (text) => handleAgentChatResponsePart({ text, type: "delta" }),
                onMessage: ({ role, text }) => handleMessage({
                    message: text,
                    role: role === "assistant" ? "assistant" : "user",
                    source: "openai-realtime",
                }),
            },
        }),
    [clientTools, handleAgentChatResponsePart, handleConnect, handleDisconnect, handleError, handleMessage, handleModeChange, userId]);

    // Close the exact adapter created for the previous Clerk identity. Without
    // adapter-scoped cleanup, a guest-to-customer transition can orphan an
    // active WebRTC connection and microphone stream.
    useEffect(() => {
        return () => {
            if (!openAIAdapter.hasSession()) return;
            if (openAIAdapter.isConnected()) intentionalEndRef.current = true;
            openAIAdapter.disconnect();
        };
    }, [openAIAdapter]);

    const openAIConversation = useMemo<GraceConversationController>(() => ({
        getId: () => openAIAdapter.isConnected() ? "openai-realtime" : null,
        sendContextualUpdate: (context) => { void openAIAdapter.sendContext(context); },
        sendUserMessage: (message) => openAIAdapter.sendText(message),
        endSession: async () => { openAIAdapter.disconnect(); },
    }), [openAIAdapter]);

    useEffect(() => {
        conversationRef.current = openAIConversation;
    }, [openAIConversation]);

    // ── Start / stop ─────────────────────────────────────────────────────────

    const voiceEnabledRef = useRef(voiceEnabled);
    useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);

    const startConversation = useCallback(async (forceTextOnly?: boolean): Promise<boolean> => {
        const useTextOnly = forceTextOnly ?? !voiceEnabledRef.current;
        if (connectingRef.current || conversationRef.current?.getId?.()) return false;
        connectingRef.current = true;
        setGraceStatus("connecting");
        // A successful (re)connect resets the auto-reconnect counter so the
        // next disconnect gets the full 2-attempt budget.
        reconnectAttemptsRef.current = 0;

        try {
            const page = pageContextRef.current;

            console.log(`[Grace] Starting ${useTextOnly ? "text" : "voice"} session with OpenAI Realtime...`);
            const res = await fetchJsonWithTimeout<{ clientSecret?: string; error?: string }>(
                "/api/openai/realtime-token",
                { method: "GET" },
            );
            if (!res.ok) throw new Error(res.error ?? "Failed to initialize OpenAI Realtime.");
            const clientSecret = res.data?.clientSecret;
            if (!clientSecret) throw new Error("OpenAI did not return a valid Realtime client secret.");
            await openAIAdapter.sendContext(formatPageContextForGrace(page, browsingHistoryRef.current));
            await openAIAdapter.connect({ clientSecret, mode: useTextOnly ? "text" : "voice" });
            console.log("[Grace] Session started successfully.");
            setConversationActive(true);
            if (useTextOnly) {
                setErrorMessage("");
                setVoiceFailed(false);
            }
            return true;
        } catch (err) {
            if (err instanceof GraceRealtimeConnectionCancelledError) return false;
            console.error("[Grace] Connection failed:", err);
            connectingRef.current = false;
            setGraceStatus("error");
            setVoiceFailed(true);
            const rawErrorMessage = err instanceof Error ? err.message : "Connection failed";
            const publicErrorMessage = /notallowed|permission/i.test(rawErrorMessage)
                ? "Microphone access is blocked. Grace is still available in text mode."
                : rawErrorMessage;
            setErrorMessage(publicErrorMessage);
            analytics.graceConnectionFailed({
                mode: useTextOnly ? "text" : "voice",
                error: rawErrorMessage,
            });
            return false;
        } finally {
            connectingRef.current = false;
        }
    }, [openAIAdapter]);

    // Sync startConversation into the ref so handleDisconnect can invoke it
    // for auto-reconnect on transient WebSocket failures.
    useEffect(() => {
        startConversationRef.current = startConversation;
    }, [startConversation]);

    const endConversation = useCallback(async () => {
        // User-initiated end — disable voice + zero out reconnect budget so
        // handleDisconnect doesn't try to bring the session back.
        voiceEnabledRef.current = false;
        setVoiceEnabled(false);
        reconnectAttemptsRef.current = MAX_RECONNECTS;
        intentionalEndRef.current = true;
        try { await conversationRef.current?.endSession(); } catch { /* ignore */ }
        setConversationActive(false);
        setGraceStatus("idle");
        setStreamingText("");
        // Drop any buffered display action so a fresh thread doesn't inherit it.
        pendingActionsRef.current = [];
    }, []);

    const resetConversation = useCallback(async () => {
        await endConversation();
        setMessages([]);
        messagesRef.current = [];
        setInput("");
        setErrorMessage("");
        setBrowsingHistory([]);
        browsingHistoryRef.current = [];
    }, [endConversation]);

    useEffect(() => {
        return () => {
            try { conversationRef.current?.endSession(); } catch { /* ignore */ }
        };
    }, []);

    // ── Toggle voice: must be called from a click handler (user gesture) ───
    // Browsers require a user gesture to grant microphone access.
    const toggleVoice = useCallback(async () => {
        const nextVoice = !voiceEnabled;
        setVoiceEnabled(nextVoice);
        voiceEnabledRef.current = nextVoice;

        // Tear down existing session so we can restart with different mode
        intentionalEndRef.current = true;
        try { await conversationRef.current?.endSession(); } catch { /* ignore */ }
        setConversationActive(false);
        setGraceStatus("idle");
        setErrorMessage("");
        setVoiceFailed(false);
        connectingRef.current = false;

        // Do not call getUserMedia here — the @openai/agents RealtimeSession WebRTC
        // transport acquires the mic itself on connect. Priming + stopping tracks
        // here can break the SDK's capture on Safari/Chrome.

        await new Promise((r) => setTimeout(r, 400));

        const success = await startConversation(!nextVoice);

        // If voice failed (mic denied, timeout), fall back to text mode
        if (!success && nextVoice) {
            console.warn("[Grace] Voice failed, falling back to text mode.");
            analytics.graceMicFallback({ reason: "voice_session_failed" });
            setVoiceEnabled(false);
            setVoiceFailed(true);
            setErrorMessage("Microphone access is blocked. Grace is still available in text mode.");
            setGraceStatus("idle");
            connectingRef.current = false;
            // Clear duplicate greeting from the failed voice attempt
            setMessages([]);
            setStreamingText("");
            await new Promise((r) => setTimeout(r, 300));
            await startConversation(true);
        }
    }, [voiceEnabled, startConversation]);

    toggleVoiceRef.current = toggleVoice;

    // ── Send text message ────────────────────────────────────────────────────

    const pendingMessageRef = useRef<string | null>(null);

    const sendWithOpenAITextFallback = useCallback(async (message: string): Promise<boolean> => {
        const history = messagesRef.current.map((entry) => ({
            role: entry.role === "grace" ? "assistant" as const : "user" as const,
            content: entry.content,
        }));
        const last = history[history.length - 1];
        if (!last || last.role !== "user" || normalizeGraceMessageText(last.content) !== normalizeGraceMessageText(message)) {
            history.push({ role: "user", content: message });
        }
        const response = await fetchJsonWithTimeout<{ message?: string; error?: string }>(
            "/api/grace/chat",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: history,
                    pageContextBlock: formatPageContextForGrace(pageContextRef.current, browsingHistoryRef.current),
                }),
            },
            30_000,
        );
        if (!response.ok || !response.data?.message) return false;
        handleMessage({ message: response.data.message, role: "assistant", source: "openai-text-fallback" });
        setErrorMessage("");
        setVoiceFailed(false);
        setGraceStatus("idle");
        return true;
    }, [handleMessage]);

    const send = useCallback(async (text?: string) => {
        const msg = (text ?? input).trim();
        if (!msg) return;
        setInput("");

        setMessages((prev) => [
            ...prev,
            { role: "user", content: msg, id: nextMsgId() },
        ]);
        setIsAwaitingReply(true);

        if (conversationRef.current?.getId?.()) {
            conversationRef.current.sendUserMessage(msg);
        } else {
            // Clear stale error state so the retry can proceed
            setErrorMessage("");
            setGraceStatus("idle");
            setVoiceFailed(false);
            pendingMessageRef.current = msg;
            const connected = await startConversation(true);
            if (!connected) {
                pendingMessageRef.current = null;
                const recovered = await sendWithOpenAITextFallback(msg);
                if (!recovered) {
                    setIsAwaitingReply(false);
                    setErrorMessage("Grace is temporarily unavailable. Please try again.");
                }
            }
        }
    }, [input, sendWithOpenAITextFallback, startConversation]);

    // ── Navigation handling ──────────────────────────────────────────────────
    const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
    const onNavigate = useCallback((path: string) => {
        router.push(path);
        setPendingNavigation(null);
    }, [router]);
    const clearPendingNavigation = useCallback(() => setPendingNavigation(null), []);

    const confirmProjectSave = useCallback(async (
        messageId: string,
        action: Extract<GraceAction, { type: "proposeProjectSave" }>,
    ) => {
        if (action.requiresSignIn) {
            router.push(`/sign-in?redirect_url=${encodeURIComponent(pageContextRef.current?.pageUrl ?? "/grace-workspace")}`);
            return;
        }
        const response = await fetchJsonWithTimeout<{ projectId?: string; error?: string }>(
            "/api/portal/grace/projects",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId: action.projectId,
                    projectName: action.projectName,
                    bottle: {
                        description: action.product.itemName,
                        sku: action.product.graceSku,
                        notes: action.notes,
                    },
                }),
            },
        );
        setMessages((previous) => previous.map((message) => {
            if (message.id !== messageId) return message;
            const actions = graceMessageActions(message).map((candidate): GraceAction =>
                candidate.type === "proposeProjectSave"
                    ? {
                        ...candidate,
                        projectId: response.data?.projectId ?? candidate.projectId,
                        awaitingConfirmation: !response.ok,
                        saved: response.ok,
                        error: response.ok ? undefined : response.error ?? "Unable to save this project.",
                    }
                    : candidate,
            );
            return { ...message, action: actions[0], actions };
        }));
    }, [router]);

    const confirmAction = useCallback((messageId: string) => {
        const message = messagesRef.current.find((m) => m.id === messageId);
        if (!message) return;
        const projectProposal = graceMessageActions(message).find((action) => action.type === "proposeProjectSave");
        if (projectProposal?.type === "proposeProjectSave") {
            void confirmProjectSave(messageId, projectProposal);
            return;
        }
        // Confirm is per-message: add every pending proposal so the UI never
        // shows "Added to cart" for products that were silently skipped.
        const proposals = pendingCartProposals(message);
        if (proposals.length === 0) return;
        const products = proposals.flatMap((proposal) => proposal.products);
        addToCart(products.map((p) => ({
            graceSku: p.graceSku,
            websiteSku: p.websiteSku ?? null,
            itemName: p.itemName,
            quantity: p.quantity,
            unitPrice: p.unitPrice ?? p.webPrice1pc ?? null,
            checkoutEligible: p.checkoutEligible ?? Boolean(p.shopifyVariantId),
            shopifyVariantId: p.shopifyVariantId ?? null,
            family: p.family,
            capacity: p.capacity,
            color: p.color,
            applicator: p.applicator,
            capColor: p.capColor,
            webPrice1pc: p.webPrice1pc ?? null,
            webPrice10pc: p.webPrice10pc ?? null,
            webPrice12pc: p.webPrice12pc ?? null,
        })));
        const valueDelta = products.reduce((sum, p) => sum + (p.unitPrice ?? p.webPrice1pc ?? 0) * p.quantity, 0);
        sessionMetricsRef.current.cartItemsAdded += products.length;
        analytics.graceCartProposalConfirmed({
            itemCount: products.length,
            skus: products.map((p) => p.graceSku).join(", "),
            cartValueDelta: valueDelta,
        });
        analytics.graceCartConversion({
            itemCount: products.length,
            itemNames: products.map((p) => p.itemName).join(", "),
            cartValueDelta: valueDelta,
        });
        for (const p of products) {
            analytics.cartItemAdded({
                sku: p.graceSku,
                name: p.itemName,
                quantity: p.quantity,
                unitPrice: p.unitPrice ?? p.webPrice1pc,
                source: "grace",
            });
        }
        setMessages((prev) => prev.map((m) => {
            if (m.id !== messageId) return m;
            return {
                ...updateCartProposalAction(m, (action) => ({ ...action, awaitingConfirmation: false })),
                content: `${m.content}\n\nAdded to cart.`,
            };
        }));
    }, [addToCart, confirmProjectSave]);

    const dismissAction = useCallback((messageId: string) => {
        setMessages((prev) => prev.map((m) => {
            if (m.id !== messageId) return m;
            const existingActions = graceMessageActions(m);
            const hasDismissable = pendingCartProposals(m).length > 0
                || existingActions.some((action) => action.type === "proposeProjectSave" && action.awaitingConfirmation);
            if (!hasDismissable) return m;
            const cartUpdated = updateCartProposalAction(m, (action) => action.awaitingConfirmation ? null : action);
            const actions = graceMessageActions(cartUpdated)
                .map((action) => action?.type === "proposeProjectSave" && action.awaitingConfirmation ? null : action)
                .filter((action): action is GraceAction => Boolean(action));
            return {
                ...m,
                action: actions[0],
                actions: actions.length ? actions : undefined,
                content: `${m.content}\n\nAction dismissed.`,
            };
        }));
    }, []);

    const stopSpeaking = useCallback(() => {
        openAIAdapter.interrupt();
    }, [openAIAdapter]);

    // ── Compose context value ────────────────────────────────────────────────

    const contextValue = useMemo((): GraceContextValue => ({
        panelMode,
        surface,
        openPanel,
        closePanel,
        minimizeToStrip,
        launcherTooltip,
        minimizeWithTooltip,
        appendInlineMessage,
        isOpen,
        open: openPanel,
        close: closePanel,
        status: graceStatus,
        messages,
        streamingText,
        isAwaitingReply,
        input,
        setInput,
        voiceEnabled,
        toggleVoice: toggleVoiceRef.current ?? (async () => { }),
        send,
        startDictation: async () => { },
        stopDictation: () => { },
        stopSpeaking,
        errorMessage,
        conversationActive,
        startConversation,
        endConversation,
        resetConversation,
        confirmAction,
        dismissAction,
        onNavigate,
        pendingNavigation,
        clearPendingNavigation,
        activeForm,
        updateFormField,
        submitActiveForm,
        dismissActiveForm,
        voiceFailed,
        graceQuery,
        pageContext,
        browsingHistory,
    }), [
        panelMode, surface, openPanel, closePanel, minimizeToStrip, isOpen,
        launcherTooltip, minimizeWithTooltip, appendInlineMessage,
        graceStatus, messages, streamingText, isAwaitingReply, input, voiceEnabled,
        send, errorMessage, conversationActive, startConversation, endConversation, resetConversation,
        onNavigate, pendingNavigation, clearPendingNavigation, confirmAction, dismissAction,
        activeForm, updateFormField, submitActiveForm, dismissActiveForm,
        voiceFailed, graceQuery, pageContext, browsingHistory, stopSpeaking,
    ]);

    return (
        <GraceContext.Provider value={contextValue}>
            {children}
        </GraceContext.Provider>
    );
}

function GraceProviderWithClerk({ children }: { children: ReactNode }) {
    const { userId } = useAuth();
    return <GraceProviderBase userId={userId ?? null}>{children}</GraceProviderBase>;
}

export default function GraceProvider({
    children,
    withClerk = false,
}: {
    children: ReactNode;
    withClerk?: boolean;
}) {
    if (withClerk) {
        return <GraceProviderWithClerk>{children}</GraceProviderWithClerk>;
    }

    return <GraceProviderBase userId={null}>{children}</GraceProviderBase>;
}
