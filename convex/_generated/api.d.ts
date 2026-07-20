/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as applyCaseWeightCorrections from "../applyCaseWeightCorrections.js";
import type * as backfillEmpireSprayerTrimColor from "../backfillEmpireSprayerTrimColor.js";
import type * as backfillPhysicalSpecs from "../backfillPhysicalSpecs.js";
import type * as backfillShopifyIds from "../backfillShopifyIds.js";
import type * as backfillTrimColor from "../backfillTrimColor.js";
import type * as backfillTrimColorFromDescription from "../backfillTrimColorFromDescription.js";
import type * as catalogSync from "../catalogSync.js";
import type * as componentUtils from "../componentUtils.js";
import type * as debug5ml from "../debug5ml.js";
import type * as exportEnrichedCatalog from "../exportEnrichedCatalog.js";
import type * as fitments from "../fitments.js";
import type * as fix5mlCapColors from "../fix5mlCapColors.js";
import type * as fixEmpireDiameters from "../fixEmpireDiameters.js";
import type * as fixOrphanProducts from "../fixOrphanProducts.js";
import type * as forms from "../forms.js";
import type * as grace from "../grace.js";
import type * as gracePrompt from "../gracePrompt.js";
import type * as graceRateLimits from "../graceRateLimits.js";
import type * as graceSearchUtils from "../graceSearchUtils.js";
import type * as graceShortlists from "../graceShortlists.js";
import type * as graceToolDefs from "../graceToolDefs.js";
import type * as graceUploads from "../graceUploads.js";
import type * as imageCleanup from "../imageCleanup.js";
import type * as imageReconciliation from "../imageReconciliation.js";
import type * as importMissingLiveProducts from "../importMissingLiveProducts.js";
import type * as knowledge from "../knowledge.js";
import type * as measurements from "../measurements.js";
import type * as migrations from "../migrations.js";
import type * as paperDoll from "../paperDoll.js";
import type * as patchFromMasterV83 from "../patchFromMasterV83.js";
import type * as portal from "../portal.js";
import type * as pricing from "../pricing.js";
import type * as productGroups from "../productGroups.js";
import type * as productGroupsRebuild from "../productGroupsRebuild.js";
import type * as products from "../products.js";
import type * as seedProducts from "../seedProducts.js";
import type * as shopifySync from "../shopifySync.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  applyCaseWeightCorrections: typeof applyCaseWeightCorrections;
  backfillEmpireSprayerTrimColor: typeof backfillEmpireSprayerTrimColor;
  backfillPhysicalSpecs: typeof backfillPhysicalSpecs;
  backfillShopifyIds: typeof backfillShopifyIds;
  backfillTrimColor: typeof backfillTrimColor;
  backfillTrimColorFromDescription: typeof backfillTrimColorFromDescription;
  catalogSync: typeof catalogSync;
  componentUtils: typeof componentUtils;
  debug5ml: typeof debug5ml;
  exportEnrichedCatalog: typeof exportEnrichedCatalog;
  fitments: typeof fitments;
  fix5mlCapColors: typeof fix5mlCapColors;
  fixEmpireDiameters: typeof fixEmpireDiameters;
  fixOrphanProducts: typeof fixOrphanProducts;
  forms: typeof forms;
  grace: typeof grace;
  gracePrompt: typeof gracePrompt;
  graceRateLimits: typeof graceRateLimits;
  graceSearchUtils: typeof graceSearchUtils;
  graceShortlists: typeof graceShortlists;
  graceToolDefs: typeof graceToolDefs;
  graceUploads: typeof graceUploads;
  imageCleanup: typeof imageCleanup;
  imageReconciliation: typeof imageReconciliation;
  importMissingLiveProducts: typeof importMissingLiveProducts;
  knowledge: typeof knowledge;
  measurements: typeof measurements;
  migrations: typeof migrations;
  paperDoll: typeof paperDoll;
  patchFromMasterV83: typeof patchFromMasterV83;
  portal: typeof portal;
  pricing: typeof pricing;
  productGroups: typeof productGroups;
  productGroupsRebuild: typeof productGroupsRebuild;
  products: typeof products;
  seedProducts: typeof seedProducts;
  shopifySync: typeof shopifySync;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
};
