/**
 * Provider-agnostic analytics layer for Best Bottles.
 *
 * All tracking flows through this module. The underlying provider (Mixpanel
 * today, Gemini/GA4/Amplitude tomorrow) is swappable by changing the adapter.
 * Application code never imports mixpanel-browser directly — only this file.
 */

import mixpanel from "mixpanel-browser";
import { APPLICATOR_NAV, CATALOG_FAMILIES, type ApplicatorNavValue } from "@/lib/catalogFilters";

// ─── Adapter interface ───────────────────────────────────────────────────────
// Swap `activeAdapter` to change providers without touching call sites.

type Props = Record<string, string | number | boolean | null | undefined>;

interface AnalyticsAdapter {
  init(token: string, options?: Record<string, unknown>): void;
  identify(userId: string, traits?: Props): void;
  reset(): void;
  track(event: string, properties?: Props): void;
  setUserProperties(properties: Props): void;
  registerSuperProperties(properties: Props): void;
  group(groupKey: string, groupId: string, traits?: Props): void;
  timeEvent(event: string): void;
}

// ─── Mixpanel adapter ────────────────────────────────────────────────────────

const mixpanelAdapter: AnalyticsAdapter = {
  init(token, options) {
    mixpanel.init(token, {
      autocapture: true,
      track_pageview: "full-url",
      record_sessions_percent: 0,
      ...options,
    });
  },
  identify(userId, traits) {
    mixpanel.identify(userId);
    if (traits) mixpanel.people.set(traits);
  },
  reset() {
    mixpanel.reset();
  },
  track(event, properties) {
    mixpanel.track(event, properties ?? {});
  },
  setUserProperties(properties) {
    mixpanel.people.set(properties);
  },
  registerSuperProperties(properties) {
    mixpanel.register(properties);
  },
  group(groupKey, groupId, traits) {
    mixpanel.set_group(groupKey, groupId);
    if (traits) mixpanel.get_group(groupKey, groupId).set(traits);
  },
  timeEvent(event) {
    mixpanel.time_event(event);
  },
};

// ─── Active adapter (swap this line to change providers) ─────────────────────

const adapter: AnalyticsAdapter = mixpanelAdapter;

// ─── Initialization guard ────────────────────────────────────────────────────

let _initialized = false;
const pendingFocusedShoppingEvents: Array<{ event: string; properties: Props }> = [];

function trackFocusedShopping(event: string, properties: Props) {
  try {
    adapter.track(event, properties);
  } catch (error) {
    if (_initialized) throw error;
    pendingFocusedShoppingEvents.push({ event, properties });
  }
}

// ─── Focused shopping privacy boundary ──────────────────────────────────────

type FinderEntryMode = "application" | "family";
type FinderRefinementDimension = "application" | "capacity" | "rollerMaterial";
type FinderRecoveryDimension = FinderRefinementDimension | "family" | "glassColor" | "neckThread";
type PdpResolutionDimension = "application" | "capFinish" | "capStyle" | "trimColor" | "rollerMaterial";
type MatrixSource = "finder" | "pdp" | "nav" | "grace";
type ShoppingGraceSource = "finder" | "pdp";

const ANALYTICS_APPLICATIONS = new Set<string>(APPLICATOR_NAV.map(({ value }) => value));
const ANALYTICS_FAMILIES = new Set<string>(CATALOG_FAMILIES);

function safeApplication(value: unknown): ApplicatorNavValue | undefined {
  return typeof value === "string" && ANALYTICS_APPLICATIONS.has(value)
    ? value as ApplicatorNavValue
    : undefined;
}

function safeFamily(value: unknown): string | undefined {
  return typeof value === "string" && ANALYTICS_FAMILIES.has(value) ? value : undefined;
}

function safeResultCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 10_000
    ? value
    : undefined;
}

function safeIdentifier(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)
    ? value
    : undefined;
}

function safeCapacity(value: unknown): string | undefined {
  return typeof value === "string" && /^\d{1,4}(?:\.\d{1,2})? ml$/.test(value) ? value : undefined;
}

function safeEntryMode(value: unknown): FinderEntryMode | undefined {
  return value === "application" || value === "family" ? value : undefined;
}

function safeRefinementDimension(value: unknown): FinderRefinementDimension | undefined {
  return value === "application" || value === "capacity" || value === "rollerMaterial" ? value : undefined;
}

function safeRecoveryDimension(value: unknown): FinderRecoveryDimension | undefined {
  return safeRefinementDimension(value)
    ?? (value === "family" || value === "glassColor" || value === "neckThread" ? value : undefined);
}

function safePdpResolutionDimension(value: unknown): PdpResolutionDimension | undefined {
  return value === "application" || value === "capFinish" || value === "capStyle"
    || value === "trimColor" || value === "rollerMaterial"
    ? value
    : undefined;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const analytics = {
  // ── Setup ────────────────────────────────────────────────────────────────

  init(token: string, options?: Record<string, unknown>) {
    if (_initialized) return;
    _initialized = true;
    adapter.init(token, options);
    for (const pending of pendingFocusedShoppingEvents.splice(0)) {
      adapter.track(pending.event, pending.properties);
    }
  },

  identify(userId: string, traits?: Props) {
    adapter.identify(userId, traits);
  },

  reset() {
    adapter.reset();
  },

  group(groupKey: string, groupId: string, traits?: Props) {
    adapter.group(groupKey, groupId, traits);
  },

  setSuperProperties(properties: Props) {
    adapter.registerSuperProperties(properties);
  },

  setUserProperties(properties: Props) {
    adapter.setUserProperties(properties);
  },

  // ── Grace AI ─────────────────────────────────────────────────────────────

  graceConversationStarted(properties: {
    pageType: string;
    pathname: string;
    productName?: string;
    productFamily?: string;
    cartItemCount: number;
  }) {
    adapter.timeEvent("Grace Conversation Ended");
    adapter.track("Grace Conversation Started", properties);
  },

  graceToolCalled(properties: {
    toolName: string;
    searchTerm?: string;
    family?: string;
    success: boolean;
    status?: string;
    durationMs?: number;
    errorCode?: string;
  }) {
    adapter.track("Grace Tool Called", properties);
  },

  graceNoMatch(properties: {
    searchTerm: string;
    family?: string;
    suggestedQueries?: string;
  }) {
    adapter.track("Grace No Match", properties);
  },

  graceConnectionFailed(properties: {
    mode: "voice" | "text";
    error: string;
  }) {
    adapter.track("Grace Connection Failed", properties);
  },

  graceMicFallback(properties: {
    reason: string;
  }) {
    adapter.track("Grace Mic Fallback", properties);
  },

  graceCartProposalShown(properties: {
    itemCount: number;
    skus: string;
    estimatedValue: number;
  }) {
    adapter.track("Grace Cart Proposal Shown", properties);
  },

  graceCartProposalConfirmed(properties: {
    itemCount: number;
    skus: string;
    cartValueDelta: number;
  }) {
    adapter.track("Grace Cart Proposal Confirmed", properties);
  },

  graceMobilePdpOpened(properties: {
    pathname: string;
    productName?: string;
    productFamily?: string;
  }) {
    adapter.track("Grace Mobile PDP Opened", properties);
  },

  graceMultiActionRendered(properties: {
    messageId: string;
    actionCount: number;
    actionTypes: string;
  }) {
    adapter.track("Grace Multi-Action Rendered", properties);
  },

  graceConversationEnded(properties: {
    pageType: string;
    pathname: string;
    toolsCalledCount: number;
    toolsUsed: string;
    cartItemsAdded: number;
    navigationsTriggered: number;
    durationCategory?: string;
  }) {
    adapter.track("Grace Conversation Ended", properties);
  },

  graceCartConversion(properties: {
    itemCount: number;
    itemNames: string;
    cartValueDelta: number;
  }) {
    adapter.track("Grace Cart Conversion", properties);
  },

  graceNavigation(properties: {
    destination: string;
    triggeredBy: string;
    query?: string;
  }) {
    adapter.track("Grace Navigation", properties);
  },

  // ── Products ─────────────────────────────────────────────────────────────

  finderEntered(properties: {
    entryMode: FinderEntryMode;
    application?: ApplicatorNavValue;
    family?: string;
    resultCount: number;
  }) {
    const entryMode = safeEntryMode(properties.entryMode);
    const resultCount = safeResultCount(properties.resultCount);
    if (!entryMode || resultCount === undefined) return;
    const application = safeApplication(properties.application);
    const family = safeFamily(properties.family);
    trackFocusedShopping("Finder Entered", {
      entryMode,
      ...(application ? { application } : {}),
      ...(family ? { family } : {}),
      resultCount,
    });
  },

  finderRefined(properties: {
    entryMode: FinderEntryMode;
    dimension: FinderRefinementDimension;
    action: "selected" | "removed";
    value: string;
    resultCount: number;
  }) {
    const entryMode = safeEntryMode(properties.entryMode);
    const dimension = safeRefinementDimension(properties.dimension);
    const resultCount = safeResultCount(properties.resultCount);
    const value = dimension === "application"
      ? safeApplication(properties.value)
      : dimension === "capacity"
        ? safeCapacity(properties.value)
        : properties.value === "metal" || properties.value === "plastic"
          ? properties.value
          : undefined;
    if (!entryMode || !dimension || !value || resultCount === undefined
      || (properties.action !== "selected" && properties.action !== "removed")) return;
    trackFocusedShopping("Finder Refined", {
      entryMode,
      dimension,
      action: properties.action,
      value,
      resultCount,
    });
  },

  finderZeroResultRecovered(properties: {
    entryMode: FinderEntryMode;
    removedDimension: FinderRecoveryDimension;
  }) {
    const entryMode = safeEntryMode(properties.entryMode);
    const removedDimension = safeRecoveryDimension(properties.removedDimension);
    if (!entryMode || !removedDimension) return;
    trackFocusedShopping("Finder Zero Result Recovered", { entryMode, removedDimension });
  },

  finderResultOpened(properties: {
    entryMode: FinderEntryMode;
    family: string;
    application?: ApplicatorNavValue;
    slug: string;
  }) {
    const entryMode = safeEntryMode(properties.entryMode);
    const family = safeFamily(properties.family);
    const application = safeApplication(properties.application);
    const slug = safeIdentifier(properties.slug);
    if (!entryMode || !family || !slug) return;
    trackFocusedShopping("Finder Result Opened", {
      entryMode,
      family,
      ...(application ? { application } : {}),
      slug,
    });
  },

  matrixOpened(properties: { source: MatrixSource; family?: string }) {
    const source = properties.source === "finder" || properties.source === "pdp"
      || properties.source === "nav" || properties.source === "grace"
      ? properties.source
      : undefined;
    const family = safeFamily(properties.family);
    if (!source) return;
    trackFocusedShopping("Matrix Opened", { source, ...(family ? { family } : {}) });
  },

  graceOpenedFromShopping(properties: {
    source: ShoppingGraceSource;
    family?: string;
    application?: ApplicatorNavValue;
  }) {
    const source = properties.source === "finder" || properties.source === "pdp" ? properties.source : undefined;
    const family = safeFamily(properties.family);
    const application = safeApplication(properties.application);
    if (!source) return;
    trackFocusedShopping("Grace Opened From Shopping", {
      source,
      ...(family ? { family } : {}),
      ...(application ? { application } : {}),
    });
  },

  pdpVariantResolved(properties: {
    slug: string;
    sku: string;
    application: ApplicatorNavValue;
    dimension?: PdpResolutionDimension;
  }) {
    const slug = safeIdentifier(properties.slug);
    const sku = safeIdentifier(properties.sku);
    const application = safeApplication(properties.application);
    const dimension = properties.dimension === undefined ? undefined : safePdpResolutionDimension(properties.dimension);
    if (!slug || !sku || !application || (properties.dimension !== undefined && !dimension)) return;
    trackFocusedShopping("PDP Variant Resolved", {
      slug,
      sku,
      application,
      ...(dimension ? { dimension } : {}),
    });
  },

  productViewed(properties: {
    name: string;
    family: string;
    capacity: string;
    color: string;
    applicator?: string;
    neckThreadSize?: string;
    price?: number;
    slug: string;
  }) {
    adapter.track("Product Viewed", properties);
  },

  catalogFiltered(properties: {
    families?: string;
    applicators?: string;
    searchTerm?: string;
    resultCount: number;
  }) {
    adapter.track("Catalog Filtered", properties);
  },

  catalogRefineIncident(properties: {
    surface: "master" | "cylinder";
    status: "query_failure" | "count_mismatch" | "constraint_mismatch";
    expectedCount?: number;
    renderedCount?: number;
    capacityCount: number;
    applicatorCount: number;
    threadCount: number;
  }) {
    adapter.track("Catalog Refine Incident", properties);
  },

  paperDollViewOpened(properties: {
    familyKey: string;
    capacityMl: number;
    neckThreadSize: string;
    sku: string;
  }) {
    adapter.track("paper_doll_view_opened", properties);
  },

  paperDollOptionSelected(properties: {
    familyKey: string;
    capacityMl: number;
    neckThreadSize: string;
    sku: string;
    dimension: string;
    value: string;
  }) {
    adapter.track("paper_doll_option_selected", properties);
  },

  paperDollConfigurationResolved(properties: {
    familyKey: string;
    capacityMl: number;
    neckThreadSize: string;
    sku: string;
  }) {
    adapter.track("paper_doll_configuration_resolved", properties);
  },

  // ── Cart & Checkout ──────────────────────────────────────────────────────

  cartItemAdded(properties: {
    sku: string;
    name: string;
    quantity: number;
    unitPrice?: number | null;
    family?: string;
    capacity?: string;
    source: "grace" | "pdp" | "catalog" | "reorder";
  }) {
    adapter.track("Cart Item Added", properties);
  },

  cartItemRemoved(properties: {
    sku: string;
    name: string;
  }) {
    adapter.track("Cart Item Removed", properties);
  },

  checkoutStarted(properties: {
    itemCount: number;
    cartTotal: number;
    skus: string;
  }) {
    adapter.track("Checkout Started", properties);
  },

  checkoutRedirected(properties: {
    itemCount: number;
    cartTotal: number;
    skus: string;
    matchedItemCount: number;
    unmatchedCount: number;
    checkoutProvider: "shopify";
    checkoutHost?: string;
  }) {
    adapter.track("Checkout Redirected", properties);
  },

  orderCompleted(properties: {
    orderId?: string;
    itemCount: number;
    cartTotal: number;
    checkoutProvider?: "shopify";
    unmatchedCount?: number;
  }) {
    adapter.track("Order Completed", properties);
  },

  checkoutFailed(properties: {
    error: string;
    itemCount: number;
  }) {
    adapter.track("Checkout Failed", properties);
  },

  // ── Forms ────────────────────────────────────────────────────────────────

  formSubmitted(properties: {
    formType: "quote" | "sample" | "contact" | "newsletter";
    productCount?: number;
    source: "grace" | "manual";
  }) {
    adapter.track("Form Submitted", properties);
  },

  // ── Context update (super properties) ────────────────────────────────────

  updateContext(properties: Props) {
    adapter.registerSuperProperties(properties);
  },
};
