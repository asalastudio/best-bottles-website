import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

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
            await ctx.db
                .query("portalDrafts")
                .withIndex("by_orgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
                .collect()
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
                availableCredit: account ? Math.max(100_000 - ytdSpend, 0) : null,
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
            await ctx.db
                .query("portalDrafts")
                .withIndex("by_orgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
                .collect()
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
        clerkOrgId: v.string(),
        name: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
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

const lineItemValidator = v.object({
    sku: v.string(),
    description: v.string(),
    quantity: v.number(),
    unitPrice: v.optional(v.number()),
});

/** Create a draft with pre-filled line items (e.g. from Price List builder) */
export const createDraftWithLineItems = mutation({
    args: {
        clerkOrgId: v.string(),
        name: v.optional(v.string()),
        lineItems: v.array(lineItemValidator),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        let totalAmount = 0;
        for (const item of args.lineItems) {
            totalAmount += (item.unitPrice ?? 0) * item.quantity;
        }
        const draftId = await ctx.db.insert("portalDrafts", {
            clerkOrgId: args.clerkOrgId,
            name: args.name?.trim() || `Price List ${new Date(now).toLocaleDateString("en-US")}`,
            status: "draft",
            lineItems: args.lineItems,
            totalAmount,
            createdAt: now,
            updatedAt: now,
        });
        return { draftId };
    },
});

export const createDraftFromOrder = mutation({
    args: {
        clerkOrgId: v.string(),
        orderId: v.string(),
    },
    handler: async (ctx, args) => {
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

        const messages =
            activeProject?.convexConversationId
                ? await ctx.db
                    .query("messages")
                    .withIndex("by_conversation", (q) =>
                        q.eq("conversationId", activeProject.convexConversationId as Id<"conversations">)
                    )
                    .collect()
                : [];

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
            messages: sortByNewest(messages.map((message) => ({ ...message, updatedAt: message.createdAt })))
                .reverse()
                .map((message) => ({
                    _id: message._id,
                    role: message.role,
                    content: message.content,
                    createdAt: message.createdAt,
                })),
        };
    },
});

export const createGraceProject = mutation({
    args: {
        clerkOrgId: v.string(),
        name: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
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

/** Seed demo data for portal. Run: npx convex run portal:seedPortalDemoData '{"clerkOrgId": "org_YOUR_ORG_ID"}' */
export const seedPortalDemoData = mutation({
    args: { clerkOrgId: v.string() },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("portalAccounts")
            .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
            .unique();

        if (existing) {
            return { message: "Account already exists for this org. Skipping seed.", accountId: existing._id };
        }

        const now = Date.now();
        const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
        const sixMonthsAgo = now - 180 * 24 * 60 * 60 * 1000;
        const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;

        const accountId = await ctx.db.insert("portalAccounts", {
            clerkOrgId: args.clerkOrgId,
            accountNumber: "BB-2021-0847",
            companyName: "Lumière Atelier",
            tier: "The Scaler",
            accountManager: "Sarah Chen",
            netTerms: "Net 30",
            taxExempt: true,
            memberSince: "March 2021",
            businessLicenseNumber: "CA-12345678",
            businessLicenseExpiry: "2026-12-31",
            resaleCertificateExpiry: "2026-06-30",
            complianceStatus: "current",
        });

        await ctx.db.insert("portalOrders", {
            clerkOrgId: args.clerkOrgId,
            orderId: "BB-2026-0047",
            status: "in_transit",
            orderDate: twoWeeksAgo,
            estimatedDelivery: "Mar 18, 2026",
            trackingNumber: "1Z999AA10123456784",
            carrier: "UPS",
            shipTo: "Los Angeles, CA",
            totalAmount: 2847,
            lineItems: [
                { sku: "GB-ELE-FRS-30ML-RDC-WHT", description: "18-415 Frosted Elegant 30ml Reducer White", quantity: 500, unitPrice: 0.89 },
                { sku: "GB-ELE-FRS-30ML-CAP-GLD", description: "18-415 Frosted Elegant 30ml Cap Gold", quantity: 500, unitPrice: 0.42 },
            ],
        });

        await ctx.db.insert("portalOrders", {
            clerkOrgId: args.clerkOrgId,
            orderId: "BB-2026-0038",
            status: "delivered",
            orderDate: sixMonthsAgo,
            totalAmount: 1240,
            lineItems: [
                { sku: "GB-CYL-CLR-10ML-MRL-GLD", description: "Cylinder 10ml Clear Metal Roller Gold", quantity: 1000, unitPrice: 0.68 },
            ],
        });

        await ctx.db.insert("portalOrders", {
            clerkOrgId: args.clerkOrgId,
            orderId: "BB-2026-0029",
            status: "delivered",
            orderDate: oneYearAgo,
            totalAmount: 892,
            lineItems: [
                { sku: "GB-BOS-AMB-30ML-RDC-BLK", description: "Boston Round 30ml Amber Reducer Black", quantity: 250, unitPrice: 0.72 },
            ],
        });

        const draftId = await ctx.db.insert("portalDrafts", {
            clerkOrgId: args.clerkOrgId,
            name: "Q2 Roll-On Restock",
            status: "draft",
            lineItems: [
                { sku: "GB-CYL-CLR-10ML-MRL-GLD", description: "Cylinder 10ml Clear Metal Roller Gold", quantity: 500, unitPrice: 0.65 },
                { sku: "GB-CYL-FRS-10ML-MRL-SLV", description: "Cylinder 10ml Frosted Metal Roller Silver", quantity: 300, unitPrice: 0.68 },
            ],
            totalAmount: 454,
            createdAt: now,
            updatedAt: now,
        });

        return {
            message: "Demo data seeded successfully.",
            accountId,
            orderCount: 3,
            draftId,
        };
    },
});

export const saveGraceChatTurn = mutation({
    args: {
        clerkOrgId: v.string(),
        clerkUserId: v.string(),
        projectId: v.id("graceProjects"),
        userMessage: v.string(),
        assistantMessage: v.string(),
    },
    handler: async (ctx, args) => {
        const project = await ctx.db.get(args.projectId);
        if (!project || project.clerkOrgId !== args.clerkOrgId) {
            throw new Error("Project not found for this organization.");
        }

        const now = Date.now();
        let conversationId = project.convexConversationId ?? null;

        if (!conversationId) {
            conversationId = await ctx.db.insert("conversations", {
                sessionId: `portal:${args.clerkOrgId}:${args.projectId}`,
                userId: args.clerkUserId,
                startedAt: now,
                lastMessageAt: now,
            });
            await ctx.db.patch(project._id, {
                convexConversationId: conversationId,
                updatedAt: now,
            });
        }

        await ctx.db.insert("messages", {
            conversationId,
            role: "user",
            content: args.userMessage,
            createdAt: now,
        });
        await ctx.db.insert("messages", {
            conversationId,
            role: "assistant",
            content: args.assistantMessage,
            createdAt: now + 1,
        });

        await ctx.db.patch(conversationId, { lastMessageAt: now + 1 });
        await ctx.db.patch(project._id, { updatedAt: now + 1 });

        return { conversationId };
    },
});
