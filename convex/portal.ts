import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { verifyWriteToken } from "./portalAuth";

function orderTotal(order: Doc<"portalOrders">): number | null {
    if (typeof order.totalAmount === "number") return order.totalAmount;

    let total = 0;
    let hasPrices = false;
    for (const item of order.lineItems) {
        if (typeof item.unitPrice === "number") {
            total += item.unitPrice * item.quantity;
            hasPrices = true;
        }
    }

    return hasPrices ? total : null;
}

function orderItemCount(order: Doc<"portalOrders">): number {
    return order.lineItems.reduce((sum, item) => sum + item.quantity, 0);
}

function draftTotal(draft: Doc<"portalDrafts">): number | null {
    if (typeof draft.totalAmount === "number") return draft.totalAmount;

    let total = 0;
    let hasPrices = false;
    for (const item of draft.lineItems) {
        if (typeof item.unitPrice === "number") {
            total += item.unitPrice * item.quantity;
            hasPrices = true;
        }
    }

    return hasPrices ? total : null;
}

function sortByNewest<T extends { updatedAt?: number; orderDate?: number; createdAt?: number }>(items: T[]): T[] {
    return [...items].sort((a, b) => {
        const aTime = a.updatedAt ?? a.orderDate ?? a.createdAt ?? 0;
        const bTime = b.updatedAt ?? b.orderDate ?? b.createdAt ?? 0;
        return bTime - aTime;
    });
}

export const getShellData = query({
    args: { clerkOrgId: v.string() },
    handler: async (ctx, args) => {
        const account = await ctx.db
            .query("portalAccounts")
            .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
            .unique();

        const orders = await ctx.db
            .query("portalOrders")
            .withIndex("by_orgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
            .collect();

        const drafts = await ctx.db
            .query("portalDrafts")
            .withIndex("by_orgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
            .collect();

        return {
            account,
            inTransitCount: orders.filter((order) => order.status === "in_transit").length,
            draftCount: drafts.filter((draft) => draft.status !== "submitted").length,
        };
    },
});

export const getAccountByOrg = query({
    args: { clerkOrgId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("portalAccounts")
            .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
            .unique();
    },
});

/** Every wholesale account. Staff-only — the caller must gate before using it. */
export const listPortalAccounts = query({
    args: {},
    handler: async (ctx) => {
        const accounts = await ctx.db.query("portalAccounts").collect();
        return accounts.sort((a, b) => a.companyName.localeCompare(b.companyName));
    },
});

// ─── Account provisioning ───────────────────────────────────────────────────

/**
 * Create or update the wholesale account behind a Clerk organization.
 *
 * Accounts were previously inserted by hand into the Convex dashboard, which
 * left no way to onboard one from code and no record of the shape a valid
 * account takes. Upsert rather than insert so re-running with the same org is
 * safe, and so `shopifyCustomerId` — once linked — is never clobbered by a
 * later detail edit.
 */
export const upsertPortalAccount = mutation({
    args: {
        writeToken: v.string(),
        clerkOrgId: v.string(),
        accountNumber: v.string(),
        companyName: v.string(),
        tier: v.string(),
        accountManager: v.string(),
        netTerms: v.string(),
        memberSince: v.string(),
        taxExempt: v.optional(v.boolean()),
        billingEmail: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);

        const existing = await ctx.db
            .query("portalAccounts")
            .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
            .unique();

        const fields = {
            accountNumber: args.accountNumber,
            companyName: args.companyName,
            tier: args.tier,
            accountManager: args.accountManager,
            netTerms: args.netTerms,
            memberSince: args.memberSince,
            billingEmail: args.billingEmail,
        };

        if (existing) {
            // taxExempt is owned by the certificate flow once an account exists —
            // an admin edit must not silently grant or revoke an exemption.
            await ctx.db.patch(existing._id, fields);
            return { accountId: existing._id, created: false };
        }

        const accountId = await ctx.db.insert("portalAccounts", {
            clerkOrgId: args.clerkOrgId,
            taxExempt: args.taxExempt ?? false,
            ...fields,
        });

        return { accountId, created: true };
    },
});

// ─── Identity bridge (Clerk org ↔ Shopify customer) ─────────────────────────

// Reverse lookup for Shopify webhooks, which arrive carrying a customer ID and
// no notion of a Clerk organization.
export const getAccountByShopifyCustomerId = query({
    args: { shopifyCustomerId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("portalAccounts")
            .withIndex("by_shopifyCustomerId", (q) =>
                q.eq("shopifyCustomerId", args.shopifyCustomerId),
            )
            .unique();
    },
});

/**
 * Bind a wholesale account to the Shopify customer record that will carry its
 * tax exemption.
 *
 * Re-linking to a DIFFERENT customer is refused: an approved resale certificate
 * is written onto the Shopify customer, so silently repointing the account would
 * strand the exemption on the old record and leave the new one taxable — or, in
 * the other direction, hand exemption to a record nobody approved. Unlinking is a
 * deliberate, separate act.
 */
export const linkShopifyCustomer = mutation({
    args: {
        writeToken: v.string(),
        clerkOrgId: v.string(),
        shopifyCustomerId: v.string(),
        billingEmail: v.string(),
        clerkUserId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);

        const account = await ctx.db
            .query("portalAccounts")
            .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
            .unique();

        if (!account) throw new Error("portal_account_not_found");

        if (
            account.shopifyCustomerId &&
            account.shopifyCustomerId !== args.shopifyCustomerId
        ) {
            throw new Error("shopify_customer_already_linked");
        }

        // Another org holding this customer would mean two accounts sharing one
        // exemption; the reverse index makes that cheap to rule out.
        const conflicting = await ctx.db
            .query("portalAccounts")
            .withIndex("by_shopifyCustomerId", (q) =>
                q.eq("shopifyCustomerId", args.shopifyCustomerId),
            )
            .unique();

        if (conflicting && conflicting.clerkOrgId !== args.clerkOrgId) {
            throw new Error("shopify_customer_claimed_by_another_account");
        }

        await ctx.db.patch(account._id, {
            shopifyCustomerId: args.shopifyCustomerId,
            billingEmail: args.billingEmail,
            shopifyCustomerLinkedAt: account.shopifyCustomerLinkedAt ?? Date.now(),
            shopifyCustomerLinkedBy: account.shopifyCustomerLinkedBy ?? args.clerkUserId,
        });

        return {
            accountId: account._id,
            shopifyCustomerId: args.shopifyCustomerId,
            alreadyLinked: account.shopifyCustomerId === args.shopifyCustomerId,
        };
    },
});

export const getDashboardData = query({
    args: { clerkOrgId: v.string() },
    handler: async (ctx, args) => {
        const account = await ctx.db
            .query("portalAccounts")
            .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
            .unique();

        const orders = sortByNewest(
            await ctx.db
                .query("portalOrders")
                .withIndex("by_orgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
                .collect()
        );

        const drafts = sortByNewest(
            (await ctx.db
                .query("portalDrafts")
                .withIndex("by_orgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
                .collect())
                // Archived drafts are kept for the record, not for the customer.
                .filter((draft) => !draft.archivedAt)
        );

        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

        const activeOrders = orders.filter(
            (order) => order.status === "processing" || order.status === "in_transit"
        );
        const deliveredOrders = orders.filter((order) => order.status === "delivered");
        const ytdSpend = deliveredOrders.reduce(
            (sum, order) => sum + (order.orderDate >= startOfYear ? orderTotal(order) ?? 0 : 0),
            0
        );
        const unitsInFlight = activeOrders.reduce((sum, order) => sum + orderItemCount(order), 0);

        const recentOrders = deliveredOrders.slice(0, 3).map((order) => ({
            _id: order._id,
            orderId: order.orderId,
            orderDate: order.orderDate,
            totalAmount: orderTotal(order),
            itemCount: orderItemCount(order),
            primaryLineItem: order.lineItems[0] ?? null,
        }));

        const seenSkus = new Set<string>();
        const quickReorder = deliveredOrders
            .flatMap((order) =>
                order.lineItems.map((lineItem) => ({
                    sku: lineItem.sku,
                    description: lineItem.description,
                    quantity: lineItem.quantity,
                    orderDate: order.orderDate,
                }))
            )
            .filter((lineItem) => {
                if (seenSkus.has(lineItem.sku)) return false;
                seenSkus.add(lineItem.sku);
                return true;
            })
            .slice(0, 3);

        return {
            account,
            stats: {
                ytdSpend,
                activeOrderCount: activeOrders.length,
                inTransitCount: orders.filter((order) => order.status === "in_transit").length,
                unitsInFlight,
                // `availableCredit` used to be `100_000 - ytdSpend`. There is no
                // credit facility and no net terms at Best Bottles, so that
                // number was invented in code and shown to customers as though
                // it were their line of credit. Count what is actually true
                // instead: work they have in progress.
                openDraftCount: drafts.filter((draft) => draft.status !== "submitted").length,
            },
            activeOrders: activeOrders.slice(0, 4).map((order) => ({
                _id: order._id,
                orderId: order.orderId,
                status: order.status,
                estimatedDelivery: order.estimatedDelivery ?? null,
                totalAmount: orderTotal(order),
                itemCount: orderItemCount(order),
                primaryLineItem: order.lineItems[0] ?? null,
            })),
            recentOrders,
            drafts: drafts.slice(0, 3).map((draft) => ({
                _id: draft._id,
                name: draft.name,
                status: draft.status,
                updatedAt: draft.updatedAt,
                lineItemCount: draft.lineItems.length,
                totalAmount: draftTotal(draft),
            })),
            quickReorder,
        };
    },
});

export const listOrdersByOrg = query({
    args: { clerkOrgId: v.string() },
    handler: async (ctx, args) => {
        const orders = sortByNewest(
            await ctx.db
                .query("portalOrders")
                .withIndex("by_orgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
                .collect()
        );

        return orders.map((order) => ({
            _id: order._id,
            orderId: order.orderId,
            status: order.status,
            orderDate: order.orderDate,
            estimatedDelivery: order.estimatedDelivery ?? null,
            carrier: order.carrier ?? null,
            trackingNumber: order.trackingNumber ?? null,
            totalAmount: orderTotal(order),
            itemCount: orderItemCount(order),
            primaryLineItem: order.lineItems[0] ?? null,
            lineItems: order.lineItems,
        }));
    },
});

export const listDraftsByOrg = query({
    args: { clerkOrgId: v.string() },
    handler: async (ctx, args) => {
        const drafts = sortByNewest(
            (await ctx.db
                .query("portalDrafts")
                .withIndex("by_orgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
                .collect())
                // Archived drafts are kept for the record, not for the customer.
                .filter((draft) => !draft.archivedAt)
        );

        return drafts.map((draft) => ({
            _id: draft._id,
            name: draft.name,
            status: draft.status,
            createdAt: draft.createdAt,
            updatedAt: draft.updatedAt,
            totalAmount: draftTotal(draft),
            lineItems: draft.lineItems,
            lineItemCount: draft.lineItems.length,
        }));
    },
});

export const createDraft = mutation({
    args: {
        writeToken: v.string(),
        clerkOrgId: v.string(),
        name: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);

        const now = Date.now();
        const draftId = await ctx.db.insert("portalDrafts", {
            clerkOrgId: args.clerkOrgId,
            name: args.name?.trim() || `Draft ${new Date(now).toLocaleDateString("en-US")}`,
            status: "draft",
            lineItems: [],
            totalAmount: 0,
            createdAt: now,
            updatedAt: now,
        });

        return { draftId };
    },
});

export const createDraftFromOrder = mutation({
    args: {
        writeToken: v.string(),
        clerkOrgId: v.string(),
        orderId: v.string(),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);

        const sourceOrder = await ctx.db
            .query("portalOrders")
            .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
            .unique();

        if (!sourceOrder || sourceOrder.clerkOrgId !== args.clerkOrgId) {
            throw new Error("Order not found for this organization.");
        }

        const now = Date.now();
        const draftId = await ctx.db.insert("portalDrafts", {
            clerkOrgId: args.clerkOrgId,
            name: `Reorder ${sourceOrder.orderId}`,
            status: "draft",
            lineItems: sourceOrder.lineItems,
            totalAmount: orderTotal(sourceOrder) ?? 0,
            createdAt: now,
            updatedAt: now,
        });

        return { draftId };
    },
});

export const listGraceProjectsByOrg = query({
    args: { clerkOrgId: v.string() },
    handler: async (ctx, args) => {
        const projects = sortByNewest(
            await ctx.db
                .query("graceProjects")
                .withIndex("by_orgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
                .collect()
        );

        return projects.map((project) => ({
            _id: project._id,
            name: project.name,
            updatedAt: project.updatedAt,
            createdAt: project.createdAt,
            savedBottleCount: project.savedBottles.length,
            savedBottles: project.savedBottles,
            convexConversationId: project.convexConversationId ?? null,
        }));
    },
});

export const getGraceWorkspaceByOrg = query({
    args: {
        clerkOrgId: v.string(),
        projectId: v.optional(v.id("graceProjects")),
    },
    handler: async (ctx, args) => {
        const projects = sortByNewest(
            await ctx.db
                .query("graceProjects")
                .withIndex("by_orgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
                .collect()
        );

        const activeProject =
            (args.projectId
                ? projects.find((project) => project._id === args.projectId)
                : projects[0]) ?? null;

        return {
            projects: projects.map((project) => ({
                _id: project._id,
                name: project.name,
                updatedAt: project.updatedAt,
                createdAt: project.createdAt,
                savedBottleCount: project.savedBottles.length,
                savedBottles: project.savedBottles,
                convexConversationId: project.convexConversationId ?? null,
            })),
            activeProject: activeProject
                ? {
                    _id: activeProject._id,
                    name: activeProject.name,
                    updatedAt: activeProject.updatedAt,
                    createdAt: activeProject.createdAt,
                    savedBottleCount: activeProject.savedBottles.length,
                    savedBottles: activeProject.savedBottles,
                    convexConversationId: activeProject.convexConversationId ?? null,
                }
                : null,
        };
    },
});

export const createGraceProject = mutation({
    args: {
        writeToken: v.string(),
        clerkOrgId: v.string(),
        name: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);

        const now = Date.now();
        const projectId = await ctx.db.insert("graceProjects", {
            clerkOrgId: args.clerkOrgId,
            name: args.name?.trim() || `Packaging Project ${new Date(now).toLocaleDateString("en-US")}`,
            savedBottles: [],
            createdAt: now,
            updatedAt: now,
        });

        return { projectId };
    },
});

export const saveBottleToGraceProject = mutation({
    args: {
        writeToken: v.string(),
        clerkOrgId: v.string(),
        projectId: v.id("graceProjects"),
        bottle: v.object({
            description: v.string(),
            sku: v.optional(v.string()),
            notes: v.optional(v.string()),
        }),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        const project = await ctx.db.get(args.projectId);
        if (!project || project.clerkOrgId !== args.clerkOrgId) {
            throw new Error("Project not found for this organization.");
        }

        const savedBottles = project.savedBottles.filter((bottle) =>
            !args.bottle.sku || bottle.sku !== args.bottle.sku,
        );
        savedBottles.push(args.bottle);
        await ctx.db.patch(project._id, { savedBottles, updatedAt: Date.now() });
        return { projectId: project._id, savedBottleCount: savedBottles.length };
    },
});

export const renameGraceProject = mutation({
    args: {
        writeToken: v.string(),
        clerkOrgId: v.string(),
        projectId: v.id("graceProjects"),
        name: v.string(),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);

        const name = args.name.trim();
        if (!name) throw new Error("project_name_required");

        const project = await ctx.db.get(args.projectId);
        if (!project || project.clerkOrgId !== args.clerkOrgId) {
            throw new Error("Project not found for this organization.");
        }

        await ctx.db.patch(project._id, { name: name.slice(0, 120), updatedAt: Date.now() });
        return { projectId: project._id, name };
    },
});

// ─── Shopify order sync ─────────────────────────────────────────────────────

/**
 * Mirror one Shopify order into `portalOrders`.
 *
 * Called by the Shopify webhook route after it verifies the HMAC. Three rules
 * shape this:
 *
 *  1. **Orders are matched to an account, never to an email.** The owning org
 *     is resolved through `portalAccounts.by_shopifyCustomerId`, the bridge
 *     that already exists for exactly this purpose. An order from a retail
 *     buyer with no portal account is not an error — it is simply not a portal
 *     order, and is skipped.
 *  2. **Idempotent.** Shopify redelivers webhooks and sends several updates per
 *     order. Keyed on the numeric Shopify id, a repeat patches the existing row
 *     rather than adding a second copy of the same order.
 *  3. **Never overwrites QuickBooks history.** A row sourced from the
 *     historical book is left alone; the two sources share a table but not a
 *     record.
 */
export const upsertOrderFromShopify = mutation({
    args: {
        writeToken: v.string(),
        shopifyOrderId: v.string(),
        shopifyCustomerId: v.optional(v.string()),
        orderName: v.string(),
        orderDate: v.number(),
        status: v.union(
            v.literal("processing"),
            v.literal("in_transit"),
            v.literal("delivered"),
            v.literal("cancelled"),
        ),
        lineItems: v.array(v.object({
            sku: v.string(),
            description: v.string(),
            quantity: v.number(),
            unitPrice: v.optional(v.number()),
        })),
        totalAmount: v.optional(v.number()),
        trackingNumber: v.optional(v.string()),
        carrier: v.optional(v.string()),
        estimatedDelivery: v.optional(v.string()),
        shipTo: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);

        if (!args.shopifyCustomerId) {
            return { skipped: "no_customer" as const };
        }

        const account = await ctx.db
            .query("portalAccounts")
            .withIndex("by_shopifyCustomerId", (q) =>
                q.eq("shopifyCustomerId", args.shopifyCustomerId),
            )
            .first();

        if (!account) {
            // A retail purchase, or a wholesale customer whose Shopify record
            // has not been linked to an org yet. Not a failure.
            return { skipped: "no_portal_account" as const };
        }

        const now = Date.now();
        const fields = {
            clerkOrgId: account.clerkOrgId,
            orderId: args.orderName,
            lineItems: args.lineItems,
            status: args.status,
            orderDate: args.orderDate,
            estimatedDelivery: args.estimatedDelivery,
            trackingNumber: args.trackingNumber,
            carrier: args.carrier,
            shipTo: args.shipTo,
            totalAmount: args.totalAmount,
            source: "shopify" as const,
            shopifyOrderId: args.shopifyOrderId,
            updatedAt: now,
        };

        const existing = await ctx.db
            .query("portalOrders")
            .withIndex("by_shopifyOrderId", (q) => q.eq("shopifyOrderId", args.shopifyOrderId))
            .first();

        if (existing) {
            if (existing.source === "quickbooks") {
                return { skipped: "owned_by_quickbooks" as const, orderId: existing._id };
            }
            await ctx.db.patch(existing._id, fields);
            return { updated: true as const, orderId: existing._id };
        }

        const orderId = await ctx.db.insert("portalOrders", fields);
        return { created: true as const, orderId };
    },
});

// ─── Draft editing ──────────────────────────────────────────────────────────

export const getDraftById = query({
    args: { clerkOrgId: v.string(), draftId: v.id("portalDrafts") },
    handler: async (ctx, args) => {
        const draft = await ctx.db.get(args.draftId);
        // Scoped read: a draft id from another organization must read as absent
        // rather than as a permission error, which would confirm it exists.
        if (!draft || draft.clerkOrgId !== args.clerkOrgId) return null;
        return draft;
    },
});

/**
 * Replace a draft's lines wholesale.
 *
 * Prices arrive already resolved because they must come from Convex on the
 * server, never from the browser — `unitPrice` becomes the Shopify price
 * override, so a client-supplied value is a way to buy at any price.
 *
 * A submitted draft is frozen: it records what was sent to Shopify, and
 * editing it after the fact would make the portal disagree with the order.
 */
export const setDraftLineItems = mutation({
    args: {
        writeToken: v.string(),
        clerkOrgId: v.string(),
        draftId: v.id("portalDrafts"),
        lineItems: v.array(v.object({
            sku: v.string(),
            description: v.string(),
            quantity: v.number(),
            unitPrice: v.optional(v.number()),
            shopifyVariantId: v.optional(v.string()),
        })),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);

        const draft = await ctx.db.get(args.draftId);
        if (!draft || draft.clerkOrgId !== args.clerkOrgId) {
            throw new Error("draft_not_found");
        }
        if (draft.status === "submitted") throw new Error("draft_already_submitted");

        for (const line of args.lineItems) {
            if (!Number.isFinite(line.quantity) || line.quantity < 1) {
                throw new Error("quantity_must_be_at_least_one");
            }
        }

        const totalAmount = args.lineItems.reduce(
            (sum, line) => sum + (line.unitPrice ?? 0) * line.quantity,
            0,
        );

        await ctx.db.patch(draft._id, {
            lineItems: args.lineItems,
            totalAmount,
            updatedAt: Date.now(),
        });

        return { lineCount: args.lineItems.length, totalAmount };
    },
});

/**
 * Record that a draft reached Shopify.
 *
 * Called only after `draftOrderCreate` succeeds, so the stored ids never claim
 * more than actually happened — the same rule the resale certificates follow
 * about Convex approval versus a real Shopify exemption.
 */
export const markDraftSubmitted = mutation({
    args: {
        writeToken: v.string(),
        clerkOrgId: v.string(),
        draftId: v.id("portalDrafts"),
        shopifyDraftOrderId: v.string(),
        shopifyDraftOrderName: v.string(),
        clerkUserId: v.string(),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);

        const draft = await ctx.db.get(args.draftId);
        if (!draft || draft.clerkOrgId !== args.clerkOrgId) {
            throw new Error("draft_not_found");
        }
        if (draft.status === "submitted") throw new Error("draft_already_submitted");

        await ctx.db.patch(draft._id, {
            status: "submitted",
            shopifyDraftOrderId: args.shopifyDraftOrderId,
            shopifyDraftOrderName: args.shopifyDraftOrderName,
            submittedAt: Date.now(),
            submittedBy: args.clerkUserId,
            updatedAt: Date.now(),
        });

        return { draftId: draft._id, shopifyDraftOrderName: args.shopifyDraftOrderName };
    },
});

/**
 * Put a draft away.
 *
 * The two cases are genuinely different and deserve different fates:
 *
 *  - An UNSUBMITTED draft is a scratch document. Nothing downstream points at
 *    it, so it is deleted. A customer who made three reorder drafts by mistake
 *    wants them gone, not filed.
 *  - A SUBMITTED draft is the record of what was sent to Shopify. Deleting it
 *    would leave an order in Shopify with nothing in the portal explaining
 *    where it came from, so it is archived instead and disappears from the
 *    list without ceasing to exist.
 */
export const discardDraft = mutation({
    args: {
        writeToken: v.string(),
        clerkOrgId: v.string(),
        draftId: v.id("portalDrafts"),
        clerkUserId: v.string(),
    },
    returns: v.object({ outcome: v.union(v.literal("deleted"), v.literal("archived")) }),
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);

        const draft = await ctx.db.get(args.draftId);
        if (!draft || draft.clerkOrgId !== args.clerkOrgId) {
            throw new Error("draft_not_found");
        }

        if (draft.status === "submitted") {
            if (draft.archivedAt) return { outcome: "archived" as const };
            await ctx.db.patch(draft._id, {
                archivedAt: Date.now(),
                archivedBy: args.clerkUserId,
                updatedAt: Date.now(),
            });
            return { outcome: "archived" as const };
        }

        await ctx.db.delete(draft._id);
        return { outcome: "deleted" as const };
    },
});
