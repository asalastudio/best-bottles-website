import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/** One stored image: an absolute, public, permanent URL plus what the importer verified about it. */
const plateAssetV = v.object({
    url: v.string(),
    key: v.string(),
    sha256: v.string(),
    bytes: v.number(),
    width: v.number(),
    height: v.number(),
});

const kitSlotV = v.union(
    v.literal("body"), v.literal("fitment"), v.literal("roller"), v.literal("cap"), v.literal("overcap"),
    v.literal("sprayer"), v.literal("pump"), v.literal("diptube"), v.literal("collar"), v.literal("bulb"),
    v.literal("tassel"), v.literal("reducer"), v.literal("pipette"),
);

export default defineSchema({
    // ── Product Groups (Phase 1) ─────────────────────────────────────────────
    // ~230 parent groups. Each group = unique (family + capacityMl + color).
    // All 2,354 individual SKU variants link back to their parent group.
    productGroups: defineTable({
        slug: v.string(),                                    // e.g. "cylinder-9ml-clear" — stable URL key
        displayName: v.string(),                             // e.g. "Cylinder 9ml Clear" — for search
        family: v.string(),
        capacity: v.union(v.string(), v.null()),             // human-readable e.g. "9 ml"
        capacityMl: v.union(v.number(), v.null()),
        color: v.union(v.string(), v.null()),
        category: v.string(),
        bottleCollection: v.union(v.string(), v.null()),
        neckThreadSize: v.union(v.string(), v.null()),       // representative thread size for fitment
        variantCount: v.number(),
        priceRangeMin: v.union(v.number(), v.null()),        // lowest webPrice1pc in group
        priceRangeMax: v.union(v.number(), v.null()),        // highest webPrice1pc in group
        // ── Shopify sync fields ──────────────────────────────────
        shopifyProductId: v.optional(v.union(v.string(), v.null())),  // Shopify product GID
        shopifyUpdatedAt: v.optional(v.number()),                      // Last webhook sync timestamp
        sanitySlug: v.optional(v.union(v.string(), v.null())),
        heroImageUrl: v.optional(v.union(v.string(), v.null())),
        // Option A: applicator-first — unique applicator types in this group (e.g. ["Metal Roller", "Fine Mist Sprayer"])
        applicatorTypes: v.optional(v.array(v.string())),
        // Cached primary SKU — populated by backfill migration to eliminate N+1 on catalog page.
        // Until populated, getCatalogGroupPrimarySkus falls back to batched DB lookups.
        primaryGraceSku: v.optional(v.union(v.string(), v.null())),
        primaryWebsiteSku: v.optional(v.union(v.string(), v.null())),
        groupDescription: v.optional(v.union(v.string(), v.null())),
        /** Sanity paperDollFamily.familyKey — e.g. CYL-9ML = Cylinder 9 ml, neck 17-415 */
        paperDollFamilyKey: v.optional(v.union(v.string(), v.null())),
        // ── CSV reconciliation fields (added by rebuildProductGroupsFromCsv) ──
        // Timestamp of the last successful rebuild from the canonical CSV.
        // When this is null, the group was hand-created and hasn't been
        // reconciled. Used by the reconciliation script to detect stale groups.
        lastSyncedAt: v.optional(v.number()),
        // Number of CSV rows that map to this group at the time of last sync.
        // When variantCount differs from csvRowCount, the group has drifted
        // from the CSV (a SKU was added/removed in CSV without rebuilding).
        csvRowCount: v.optional(v.number()),
    })
        .index("by_slug", ["slug"])
        .index("by_family", ["family"])
        .index("by_category", ["category"])
        .index("by_collection", ["bottleCollection"])
        .searchIndex("search_displayName", {
            searchField: "displayName",
            filterFields: ["category", "family"],
        })
        .searchIndex("search_groupDescription", {
            searchField: "groupDescription",
            filterFields: ["category", "family"],
        }),

    products: defineTable({
        // ── Identity — 3-identifier system ─────────────────────────
        // productId: Immutable anchor. Assigned once in master sheet.
        // Format: BB-{PREFIX}-000-{NNNN}  e.g. BB-GB-000-0001
        // Never changes — use this to trace any record back to source.
        // Optional so existing Convex docs without it still validate.
        productId: v.optional(v.union(v.string(), v.null())),
        websiteSku: v.string(),
        graceSku: v.string(),

        // ── Classification ──────────────────────────────────────────
        category: v.string(),
        family: v.union(v.string(), v.null()),
        shape: v.union(v.string(), v.null()),
        color: v.union(v.string(), v.null()),
        capacity: v.union(v.string(), v.null()),
        capacityMl: v.union(v.number(), v.null()),
        capacityOz: v.union(v.number(), v.null()),

        // ── Applicator & Cap ────────────────────────────────────────
        applicator: v.union(
            v.literal("Metal Roller Ball"),          // metal rollerball plug
            v.literal("Plastic Roller Ball"),        // plastic rollerball plug
            v.literal("Fine Mist Sprayer"),
            v.literal("Perfume Spray Pump"),
            v.literal("Atomizer"),
            v.literal("Vintage Bulb Sprayer"),
            v.literal("Vintage Bulb Sprayer with Tassel"),
            // Legacy values kept during migration window — remove after all records patched
            v.literal("Antique Bulb Sprayer"),
            v.literal("Antique Bulb Sprayer with Tassel"),
            v.literal("Lotion Pump"),
            v.literal("Dropper"),
            v.literal("Reducer"),
            v.literal("Glass Stopper"),
            v.literal("Glass Rod"),
            v.literal("Cap/Closure"),
            v.literal("Applicator Cap"),
            v.literal("Metal Atomizer"),
            v.literal("N/A"),
            v.null()
        ),
        capColor: v.union(v.string(), v.null()),
        trimColor: v.union(v.string(), v.null()),
        capStyle: v.union(v.string(), v.null()),
        capHeight: v.optional(v.union(
            v.literal("Short"),
            v.literal("Tall"),
            v.literal("Leather"),
            v.null()
        )),
        ballMaterial: v.optional(v.union(v.string(), v.null())),

        // ── Physical dimensions ─────────────────────────────────────
        neckThreadSize: v.union(v.string(), v.null()),
        heightWithCap: v.union(v.string(), v.null()),
        heightWithoutCap: v.union(v.string(), v.null()),
        diameter: v.union(v.string(), v.null()),
        // Numeric mm dimensions populated by some products (atomizers etc).
        // Kept optional + nullable to preserve back-compat with rows that lack them.
        depthMm: v.optional(v.union(v.number(), v.null())),
        widthMm: v.optional(v.union(v.number(), v.null())),
        bottleWeightG: v.union(v.number(), v.null()),
        caseQuantity: v.union(v.number(), v.null()),
        caseWeightG: v.optional(v.union(v.number(), v.null())),

        // ── Pricing ─────────────────────────────────────────────────
        qbPrice: v.union(v.number(), v.null()),
        webPrice1pc: v.union(v.number(), v.null()),
        webPrice10pc: v.union(v.number(), v.null()),
        webPrice12pc: v.union(v.number(), v.null()),
        // Full quantity-tier ladder scraped from legacy bestbottles.com PDPs
        // (2026-07-20). Loaded ONLY for SKUs whose tier-1 unit price matched
        // the existing webPrice1pc (accuracy cross-reference gate); break
        // points vary per product (e.g. 1/12/144/690/3450 vs 1/12/144/300/1500).
        //
        // 2026-07-29 audit: present on 2,305 of 2,330 prod products. Note that
        // webPrice10pc is largely vestigial against this — only 53 SKUs have a
        // real 10-unit break while 2,252 break at 12, so any UI reading
        // webPrice10pc understates the ladder. See docs/LAUNCH-READINESS-AUDIT-2026-07-29.md.
        priceTiers: v.optional(v.array(v.object({
            minQty: v.number(),
            totalPrice: v.number(),
            unitPrice: v.number(),
        }))),
        priceTiersSyncedAt: v.optional(v.number()),

        // ── Content & Status ────────────────────────────────────────
        stockStatus: v.union(v.string(), v.null()),
        itemName: v.string(),
        itemDescription: v.union(v.string(), v.null()),
        imageUrl: v.optional(v.union(v.string(), v.null())),
        // Secondary gallery view (cap removed, applicator/dropper/sprayer exposed).
        // Optional and orthogonal to imageUrl — any combination is valid:
        //   both set                → PDP gallery shows two thumbnails (primary + cap-off)
        //   imageUrl only           → single-image PDP, catalog card uses imageUrl
        //   imageUrlCapOff only     → primary stays null; PDP uses cap-off as the only view
        //   neither                 → "Photography coming soon" placeholder
        // Populated by Madison's push-bestbottles-grid-hero (mode=cap-off) and the
        // bulk PSD push pipeline. Superseded by paperDollFamily layered configurator
        // when group.paperDollFamilyKey is set, but kept as a static gallery
        // alongside paper-doll for editorial/lifestyle views (Phase 2).
        imageUrlCapOff: v.optional(v.union(v.string(), v.null())),
        productUrl: v.union(v.string(), v.null()),
        dataGrade: v.union(v.string(), v.null()),
        bottleCollection: v.union(v.string(), v.null()),
        useCaseDescription: v.optional(v.union(v.string(), v.null())),

        // ── Fitment ─────────────────────────────────────────────────
        fitmentStatus: v.union(v.string(), v.null()),
        components: v.any(), // Array of compatible component SKUs by type
        graceDescription: v.union(v.string(), v.null()),
        assemblyType: v.optional(v.union(
            v.literal("2-part"),
            v.literal("3-part"),
            v.literal("complete-set"),
            v.literal("component"),
            v.literal("accessory"),
            v.null()
        )),
        componentGroup: v.optional(v.union(
            v.literal("Fine Mist Sprayer"),
            v.literal("Perfume Spray Pump"),
            v.literal("Antique Sprayer"),
            v.literal("Screw Cap"),
            v.literal("Short Cap"),
            v.literal("Tall Cap"),
            v.literal("Leather Cap"),
            v.literal("Applicator Cap"),
            v.literal("Roll-On Cap"),
            v.literal("Roll-On Fitment"),
            v.literal("Lotion Pump"),
            v.literal("Reducer"),
            v.literal("Dropper Assembly"),
            v.literal("Glass Stopper"),
            v.null()
        )),

        // ── Meta ────────────────────────────────────────────────────
        verified: v.boolean(),
        importSource: v.optional(v.string()), // e.g. "master_sheet_v1.4_component_tab"

        // ── Phase 1: Product Grouping ────────────────────────────────
        productGroupId: v.optional(v.id("productGroups")), // FK → productGroups

        // ── Shopify sync fields ──────────────────────────────────────
        shopifyVariantId: v.optional(v.union(v.string(), v.null())),        // Shopify variant GID
        shopifyInventoryItemId: v.optional(v.union(v.string(), v.null())),  // Shopify inventory item GID
        shopifyUpdatedAt: v.optional(v.number()),                           // Last webhook sync timestamp
        /**
         * Whether Shopify will actually SELL this variant right now.
         *
         * Having a shopifyVariantId is NOT sufficient: if the parent Shopify
         * product is DRAFT or unpublished, the /cart/<id>:<qty> permalink
         * returns HTTP 410 and the customer lands on a dead checkout. Audited
         * 2026-07-29: 377 of 2,313 variants with an ID were in that state.
         *
         * Populated by scripts/sync_shopify_sellability.mjs and refreshed by
         * the products/update webhook. Treat `false` as quote-only; treat
         * `undefined` as "not yet synced" (falls back to shopifyVariantId).
         */
        shopifySellable: v.optional(v.union(v.boolean(), v.null())),
        /** Why a variant is not sellable — e.g. "STATUS_DRAFT+NOT_PUBLISHED". */
        shopifySellableReason: v.optional(v.union(v.string(), v.null())),
        shopifySellableCheckedAt: v.optional(v.number()),

        // ── Paper Doll (Sanity layer assets + compositor) ───────────
        paperDollBodyUrl: v.optional(v.union(v.string(), v.null())),
        paperDollFitmentUrl: v.optional(v.union(v.string(), v.null())),
        paperDollCapUrl: v.optional(v.union(v.string(), v.null())),
        paperDollRollerUrl: v.optional(v.union(v.string(), v.null())),
        paperDollLayerOrder: v.optional(v.array(v.string())),
        paperDollReady: v.optional(v.boolean()),
        paperDollProcessedAt: v.optional(v.number()),
    })
        .index("by_productId", ["productId"])         // Primary stable anchor
        .index("by_websiteSku", ["websiteSku"])       // BestBottles.com lookup
        .index("by_graceSku", ["graceSku"])           // Grace internal lookup
        .index("by_category", ["category"])
        .index("by_family", ["family"])
        .index("by_neckThreadSize", ["neckThreadSize"])
        .index("by_productGroupId", ["productGroupId"]) // Used by getProductGroup to avoid full table scan
        .index("by_shopifyVariantId", ["shopifyVariantId"]) // Webhook sync: inventory updates
        // Launch gate reads only the blocked rows instead of the full table,
        // which otherwise exceeds Convex's per-function byte limit at 2,330 docs.
        .index("by_shopifySellable", ["shopifySellable"])
        .searchIndex("search_itemName", {
            searchField: "itemName",
            filterFields: ["category", "family"],
        }),

    fitments: defineTable({
        threadSize: v.string(),
        bottleName: v.string(),
        bottleCode: v.union(v.string(), v.null()),
        familyHint: v.union(v.string(), v.null()),
        capacityMl: v.union(v.number(), v.null()),
        components: v.any(),
    })
        .index("by_threadSize", ["threadSize"])
        .index("by_bottleName", ["bottleName"]),

    // -------------------------------------------------------------------------
    // GRACE AI KNOWLEDGE BASE
    // -------------------------------------------------------------------------

    graceKnowledge: defineTable({
        category: v.string(),
        title: v.string(),
        content: v.string(),
        tags: v.array(v.string()),
        relatedSkus: v.optional(v.array(v.string())),
        priority: v.union(v.number(), v.string()),
        source: v.optional(v.string()),
        // Legacy fields from previous schema version (will be cleared after re-seed)
        createdAt: v.optional(v.number()),
        updatedAt: v.optional(v.number()),
        summary: v.optional(v.string()),
        relevantSegments: v.optional(v.array(v.string())),
    })
        .index("by_category", ["category"])
        .index("by_priority", ["priority"])
        .searchIndex("search_content", {
            searchField: "content",
            filterFields: ["category", "priority"],
        }),

    gracePersonas: defineTable({
        segment: v.string(),
        displayName: v.string(),
        description: v.string(),
        typicalOrderSize: v.string(),
        pricePoint: v.string(),
        preferredFamilies: v.array(v.string()),
        keyMotivations: v.array(v.string()),
        commonQuestions: v.array(v.string()),
        toneGuidance: v.string(),
    })
        .index("by_segment", ["segment"]),

    graceObjections: defineTable({
        category: v.string(),
        objection: v.string(),
        response: v.string(),
        followUpQuestion: v.optional(v.string()),
        relatedPersonas: v.optional(v.array(v.string())),
    })
        .index("by_category", ["category"])
        .searchIndex("search_objections", {
            searchField: "objection",
            filterFields: ["category"],
        }),

    graceTrends: defineTable({
        category: v.string(),
        trendStage: v.string(),
        title: v.string(),
        summary: v.string(),
        relevantFamilies: v.array(v.string()),
        relevantCapacities: v.optional(v.array(v.string())),
        customerImplication: v.string(),
        graceTalkingPoint: v.string(),
    })
        .index("by_category", ["category"])
        .index("by_stage", ["trendStage"]),

    graceStatistics: defineTable({
        category: v.string(),
        stat: v.string(),
        context: v.string(),
        description: v.string(),
        verified: v.boolean(),
        citationNote: v.optional(v.string()),
    })
        .index("by_category", ["category"])
        .searchIndex("search_stats", {
            searchField: "description",
            filterFields: ["category"],
        }),

    // -------------------------------------------------------------------------
    // GRACE AI CONVERSATION ENGINE
    // -------------------------------------------------------------------------

    conversations: defineTable({
        sessionId: v.string(),
        userId: v.optional(v.string()),
        detectedPersona: v.optional(v.string()),
        startedAt: v.number(),
        lastMessageAt: v.number(),
    })
        .index("by_session", ["sessionId"])
        .index("by_user", ["userId"]),

    messages: defineTable({
        conversationId: v.id("conversations"),
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
        toolCallsUsed: v.optional(v.array(v.string())),
        createdAt: v.number(),
    })
        .index("by_conversation", ["conversationId"]),

    // -------------------------------------------------------------------------
    // FORM SUBMISSIONS (sample requests, quotes, contact)
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    // PORTAL — B2B CLIENT ACCOUNTS
    // -------------------------------------------------------------------------

    // One record per wholesale account (Clerk Organization).
    // Seeded manually from QuickBooks; shopifyCustomerId nullable until Shopify goes live.
    portalAccounts: defineTable({
        clerkOrgId: v.string(),
        accountNumber: v.string(),
        companyName: v.string(),
        tier: v.string(),                           // e.g. "The Scaler"
        accountManager: v.string(),
        netTerms: v.string(),                       // e.g. "Net 30"
        taxExempt: v.boolean(),
        memberSince: v.string(),                    // e.g. "March 2021"
        shopifyCustomerId: v.optional(v.string()),  // nullable until Shopify sync

        // ─── Identity bridge (Clerk org ↔ Shopify customer) ───────────────
        // Tax exemption is a property of a Shopify CUSTOMER RECORD, so an
        // anonymous cart can never be exempt. These fields record which record
        // this account owns and how it was chosen.
        billingEmail: v.optional(v.string()),           // email the Shopify customer is keyed on
        shopifyCustomerLinkedAt: v.optional(v.number()),
        shopifyCustomerLinkedBy: v.optional(v.string()), // Clerk user ID that triggered the link
    })
        .index("by_clerkOrgId", ["clerkOrgId"])
        .index("by_accountNumber", ["accountNumber"])
        // Reverse lookup: Shopify order/customer webhooks arrive with a customer
        // ID and must find the owning org without scanning every account.
        .index("by_shopifyCustomerId", ["shopifyCustomerId"]),

    // Resale certificates — the seller's-permit record behind tax exemption.
    //
    // `portalAccounts.taxExempt` is a bare boolean and is the WRONG model: a
    // certificate is issued by a specific state, carries a permit number, is
    // approved by a named employee, and EXPIRES. One row per submission, kept as
    // history — never overwritten — so a lapsed certificate stays auditable.
    resaleCertificates: defineTable({
        clerkOrgId: v.string(),
        legalBusinessName: v.string(),
        issuingState: v.string(),                    // two-letter code, e.g. "CA"
        permitNumber: v.string(),                    // CDTFA seller's permit no. or state equivalent
        documentStorageId: v.optional(v.id("_storage")), // uploaded CDTFA-230 or equivalent

        status: v.union(
            v.literal("pending"),
            v.literal("approved"),
            v.literal("rejected"),
            v.literal("expired"),
            v.literal("revoked"),
        ),

        submittedAt: v.number(),
        submittedBy: v.string(),                     // Clerk user ID
        reviewedAt: v.optional(v.number()),
        reviewedBy: v.optional(v.string()),          // Clerk user ID of the approving employee
        reviewNote: v.optional(v.string()),          // rejection reason, shown to the customer
        expiresAt: v.optional(v.number()),

        // Shopify exemption code actually written, e.g. "US_CA_RESELLER_EXEMPTION".
        // Null until the write succeeds — approval in Convex and exemption in
        // Shopify are separate facts and must not be conflated.
        shopifyExemptionCode: v.optional(v.string()),
        shopifySyncedAt: v.optional(v.number()),
    })
        .index("by_orgId", ["clerkOrgId"])
        .index("by_status", ["status"])
        // Drives expiry sweeps: approved certificates ordered by expiry date.
        .index("by_status_expiresAt", ["status", "expiresAt"]),

    // Order history — seeded from QuickBooks, later synced from Shopify webhooks.
    portalOrders: defineTable({
        clerkOrgId: v.string(),
        orderId: v.string(),
        lineItems: v.array(v.object({
            sku: v.string(),
            description: v.string(),
            quantity: v.number(),
            unitPrice: v.optional(v.number()),
        })),
        status: v.union(
            v.literal("processing"),
            v.literal("in_transit"),
            v.literal("delivered"),
            v.literal("cancelled"),
        ),
        orderDate: v.number(),
        estimatedDelivery: v.optional(v.string()),
        trackingNumber: v.optional(v.string()),
        carrier: v.optional(v.string()),
        shipFrom: v.optional(v.string()),
        shipTo: v.optional(v.string()),
        totalAmount: v.optional(v.number()),
    })
        .index("by_orgId", ["clerkOrgId"])
        .index("by_orderId", ["orderId"]),

    // Saved draft orders — native portal data, not synced from any external system.
    portalDrafts: defineTable({
        clerkOrgId: v.string(),
        name: v.string(),
        status: v.union(
            v.literal("draft"),
            v.literal("in_review"),
            v.literal("submitted"),
        ),
        lineItems: v.array(v.object({
            sku: v.string(),
            description: v.string(),
            quantity: v.number(),
            unitPrice: v.optional(v.number()),
        })),
        totalAmount: v.optional(v.number()),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_orgId", ["clerkOrgId"]),

    // Grace AI workspace projects — collections of saved bottle configs + conversation history.
    graceProjects: defineTable({
        clerkOrgId: v.string(),
        name: v.string(),
        savedBottles: v.array(v.object({
            description: v.string(),
            sku: v.optional(v.string()),
            notes: v.optional(v.string()),
        })),
        convexConversationId: v.optional(v.id("conversations")),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_orgId", ["clerkOrgId"]),

    // -------------------------------------------------------------------------
    // FORM SUBMISSIONS (sample requests, quotes, contact)
    // -------------------------------------------------------------------------

    formSubmissions: defineTable({
        formType: v.union(
            v.literal("sample"),
            v.literal("quote"),
            v.literal("contact"),
            v.literal("newsletter")
        ),
        name: v.optional(v.string()),
        email: v.string(),
        company: v.optional(v.string()),
        phone: v.optional(v.string()),
        message: v.optional(v.string()),
        products: v.optional(v.string()),
        quantities: v.optional(v.string()),
        rfqLineItems: v.optional(v.array(v.object({
            sku: v.string(),
            websiteSku: v.optional(v.string()),
            variantId: v.optional(v.string()),
            productGroupSlug: v.optional(v.string()),
            name: v.string(),
            quantity: v.number(),
            unitPrice: v.optional(v.union(v.number(), v.null())),
            notes: v.optional(v.string()),
            family: v.optional(v.string()),
            capacity: v.optional(v.string()),
            color: v.optional(v.string()),
            applicator: v.optional(v.union(v.string(), v.null())),
            capColor: v.optional(v.union(v.string(), v.null())),
            neckThreadSize: v.optional(v.union(v.string(), v.null())),
        }))),
        source: v.optional(v.string()),
        submittedAt: v.number(),
    })
        .index("by_type", ["formType"])
        .index("by_email", ["email"]),

    // -------------------------------------------------------------------------
    // GRACE AI SHORTLISTS — saved product collections, shareable via opaque token
    // -------------------------------------------------------------------------

    // ownerKey is either a clerkOrgId (authed) or an anonymous UUID held in
    // localStorage. shareToken is server-minted and is the only field used in
    // public share URLs — never expose ownerKey externally.
    graceShortlists: defineTable({
        ownerKey: v.string(),
        name: v.optional(v.string()),
        items: v.array(v.object({
            graceSku: v.string(),
            addedAt: v.number(),
            notes: v.optional(v.string()),
        })),
        shareToken: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_owner", ["ownerKey"])
        .index("by_shareToken", ["shareToken"]),

    // -------------------------------------------------------------------------
    // GRACE AI UPLOADS — user-supplied images for reference match + brand mockup
    // -------------------------------------------------------------------------

    // blobId is the Convex storage ID. ownerKey scopes uploads to anonymous
    // sessions or authed orgs the same way as shortlists.
    graceUploads: defineTable({
        blobId: v.string(),
        mime: v.string(),
        size: v.number(),
        ownerKey: v.string(),
        kind: v.union(v.literal("reference"), v.literal("logo")),
        createdAt: v.number(),
    })
        .index("by_owner", ["ownerKey"])
        .index("by_blobId", ["blobId"]),

    // -------------------------------------------------------------------------
    // GRACE KNOWLEDGE OPERATIONS — minimized traces + controlled corrections
    // -------------------------------------------------------------------------

    knowledgeTraces: defineTable({
        requestId: v.string(),
        conversationId: v.string(),
        surface: v.union(
            v.literal("storefront"),
            v.literal("customer_portal"),
            v.literal("employee_workspace"),
            v.literal("executive_hub"),
            v.literal("chatgpt_app"),
        ),
        role: v.union(
            v.literal("public"),
            v.literal("customer"),
            v.literal("support"),
            v.literal("employee"),
            v.literal("executive"),
            v.literal("admin"),
        ),
        model: v.string(),
        startedAt: v.number(),
        completedAt: v.number(),
        durationMs: v.number(),
        status: v.union(
            v.literal("success"),
            v.literal("no_match"),
            v.literal("tool_error"),
            v.literal("model_error"),
            v.literal("blocked"),
        ),
        inputTokens: v.number(),
        cachedInputTokens: v.number(),
        outputTokens: v.number(),
        audioInputTokens: v.number(),
        audioOutputTokens: v.number(),
        fileSearchCalls: v.number(),
        estimatedCostUsd: v.number(),
        rateCardVersion: v.string(),
        toolCalls: v.array(v.object({
            name: v.string(),
            durationMs: v.number(),
            status: v.union(v.literal("success"), v.literal("error"), v.literal("blocked")),
        })),
        sourceIds: v.array(v.string()),
        rawContentStored: v.literal(false),
    })
        .index("by_completedAt", ["completedAt"])
        .index("by_surface", ["surface"])
        .index("by_status", ["status"]),

    knowledgeCorrections: defineTable({
        conversationId: v.string(),
        messageId: v.string(),
        requestId: v.optional(v.string()),
        actorId: v.string(),
        surface: v.union(
            v.literal("storefront"),
            v.literal("customer_portal"),
            v.literal("employee_workspace"),
            v.literal("executive_hub"),
            v.literal("chatgpt_app"),
        ),
        category: v.union(
            v.literal("product_truth"),
            v.literal("compatibility"),
            v.literal("policy"),
            v.literal("behavior"),
            v.literal("missing_knowledge"),
        ),
        correction: v.string(),
        sourceUrl: v.union(v.string(), v.null()),
        answerExcerpt: v.optional(v.string()),
        sourceIds: v.optional(v.array(v.string())),
        status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("rejected")),
        createdAt: v.number(),
        updatedAt: v.number(),
        reviewerId: v.optional(v.union(v.string(), v.null())),
    })
        .index("by_status", ["status"])
        .index("by_requestId", ["requestId"])
        .index("by_createdAt", ["createdAt"])
        .index("by_actorId", ["actorId"]),

    // -------------------------------------------------------------------------
    // GRACE PUBLIC ROUTE RATE LIMITS — server-side counters for anonymous flows
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    // GRACE AUDIT — executive-hub initiated accuracy runs.
    // A run is written scenario-by-scenario so the dashboard can render progress
    // reactively and a long run never depends on one request staying alive.
    // -------------------------------------------------------------------------

    graceAuditRuns: defineTable({
        kind: v.union(v.literal("conversation"), v.literal("integrity")),
        status: v.union(v.literal("running"), v.literal("complete"), v.literal("failed"), v.literal("cancelled")),
        startedAt: v.number(),
        finishedAt: v.union(v.number(), v.null()),
        triggeredBy: v.string(),          // Clerk user id or "system"
        environment: v.string(),          // convex deployment URL under test
        scenarioTotal: v.number(),
        scenarioComplete: v.number(),
        passCount: v.number(),
        warnCount: v.number(),
        failCount: v.number(),
        scorePct: v.union(v.number(), v.null()),
        notes: v.union(v.string(), v.null()),
    })
        .index("by_startedAt", ["startedAt"])
        .index("by_kind_startedAt", ["kind", "startedAt"]),

    graceAuditResults: defineTable({
        runId: v.id("graceAuditRuns"),
        scenarioId: v.string(),
        group: v.string(),
        title: v.string(),
        verdict: v.union(v.literal("pass"), v.literal("warn"), v.literal("fail")),
        checks: v.array(v.object({
            label: v.string(),
            passed: v.boolean(),
            severity: v.union(v.literal("critical"), v.literal("soft")),
            detail: v.string(),
        })),
        transcript: v.array(v.object({
            user: v.string(),
            assistant: v.string(),
            toolCalls: v.array(v.object({
                name: v.string(),
                argsJson: v.string(),
                executed: v.string(),
            })),
        })),
        toolCallCount: v.number(),
        durationMs: v.number(),
        error: v.union(v.string(), v.null()),
        createdAt: v.number(),
    })
        .index("by_runId", ["runId"])
        .index("by_runId_scenarioId", ["runId", "scenarioId"]),

    graceRateLimits: defineTable({
        key: v.string(),
        route: v.string(),
        identifier: v.string(),
        windowStart: v.number(),
        count: v.number(),
        updatedAt: v.number(),
    })
        .index("by_key", ["key"])
        .index("by_route_identifier", ["route", "identifier"]),

    // -------------------------------------------------------------------------
    // 3D CONFIGURATOR MATERIAL RECIPES — per-finish MeshPhysicalMaterial tunables
    // -------------------------------------------------------------------------

    // ONE studio environment lights the whole configurator scene; per-finish
    // variation (envMapIntensity, roughness, attenuation…) lives HERE so the
    // founder can tune a finish without a deploy — never in swapping
    // environments. Seeded by materialRecipes.seedPilotFinishes from
    // src/lib/materials/materialRecipes.ts; scale notes live in that module
    // (thickness/attenuationDistance are metres at real product scale).
    materialRecipes: defineTable({
        finishKey: v.string(),                               // e.g. "amber-glass" — unique
        label: v.string(),
        kind: v.union(v.literal("glass"), v.literal("metal")),
        color: v.string(),                                   // hex; glass stays white, tint via attenuation
        metalness: v.number(),
        roughness: v.number(),
        ior: v.optional(v.number()),
        transmission: v.optional(v.number()),
        thickness: v.optional(v.number()),                   // metres ≈ real wall thickness
        attenuationColor: v.optional(v.string()),
        attenuationDistance: v.optional(v.number()),         // metres
        envMapIntensity: v.number(),                         // default 1.0
        updatedAt: v.number(),
    })
        .index("by_finishKey", ["finishKey"]),

    // -------------------------------------------------------------------------
    // PAPER-DOLL PLATES AND COMPONENT KITS — the storefront's product imagery
    // -------------------------------------------------------------------------
    //
    // Bytes live on object storage (Vercel Blob today); these rows are the
    // index. A row's EXISTENCE is its readiness: there is no ready flag, no
    // release, no draft. The importer writes a row only after it has uploaded
    // the object and HEAD-verified its public URL, so nothing between "file
    // exists" and "page shows it" can silently fail. Never reuse the legacy
    // products.paperDoll* columns for this lane.
    productPlates: defineTable({
        sku: v.string(),                              // canonical lookup key: websiteSku as Convex spells it
        websiteSku: v.union(v.string(), v.null()),
        graceSku: v.union(v.string(), v.null()),      // looked up in products — NEVER derived
        familyId: v.string(),                         // <family>-<capacityMl>ml-<color>-<neck>
        front: plateAssetV,                           // cap-on plate; a row without one is not a row
        frontCapOff: v.union(plateAssetV, v.null()),
        thumb: plateAssetV,
        thumbCapOff: v.union(plateAssetV, v.null()),
        views: v.array(v.object({
            view: v.union(v.literal("side"), v.literal("aerial"), v.literal("depth"), v.literal("measured"), v.literal("exploded")),
            cap: v.union(v.literal("on"), v.literal("off")),
            source: v.union(v.literal("photo"), v.literal("composite")),
            kitSha256: v.union(v.string(), v.null()),
            plate: plateAssetV,
            thumb: v.union(plateAssetV, v.null()),
        })),
        source: v.object({
            library: v.string(),                      // "original" | "bbuat" | "layers" | "public-paper-doll"
            path: v.string(),
            psdSha256: v.union(v.string(), v.null()),
            psdSha256CapOff: v.union(v.string(), v.null()),
        }),
        builder: v.object({ name: v.string(), version: v.string(), builtAt: v.number() }),
        storageProvider: v.union(v.literal("vercel-blob"), v.literal("r2")),
        revision: v.number(),
        importedAt: v.number(),
    })
        .index("by_sku", ["sku"])
        .index("by_websiteSku", ["websiteSku"])
        .index("by_graceSku", ["graceSku"])
        .index("by_familyId", ["familyId"]),

    // Per-part alpha layers with anchors, registered pixel-for-pixel to the
    // SKU's plate. Read only on interaction (enhance / exploded), never in the
    // product page payload — hence its own table.
    productKits: defineTable({
        sku: v.string(),
        websiteSku: v.union(v.string(), v.null()),
        graceSku: v.union(v.string(), v.null()),
        familyId: v.string(),
        plateSha256: v.string(),                      // productPlates.front.sha256 this kit is registered to
        canvas: v.object({ width: v.number(), height: v.number() }),
        anchors: v.object({
            axisX: v.number(),                        // the closure axis the plate was framed on
            neckAxisX: v.union(v.number(), v.null()), // the body's own neck axis (may differ by a few px)
            seatY: v.number(),                        // closure seat — the 2D BB_ATTACH_NECK
            baselineY: v.number(),                    // bottle foot
            pxPerMm: v.union(v.number(), v.null()),
        }),
        completeness: v.union(v.literal("full"), v.literal("capSplit"), v.literal("bodyOnly")),
        parts: v.array(v.object({
            slot: kitSlotV,
            variantKey: v.union(v.string(), v.null()),
            zOrder: v.number(),
            explodeIndex: v.number(),
            bounds: v.object({ left: v.number(), top: v.number(), right: v.number(), bottom: v.number() }),
            assembled: v.object({ x: v.number(), y: v.number() }),
            exploded: v.object({ dx: v.number(), dy: v.number() }),
            image: plateAssetV,
            image2x: v.union(plateAssetV, v.null()),
            mask: v.union(plateAssetV, v.null()),
            derivation: v.union(v.literal("psd-layer"), v.literal("madison"), v.literal("pair-difference"), v.literal("background-matte")),
        })),
        three: v.union(v.null(), v.object({           // ids only, resolved through the shipped registries
            bodyId: v.string(),
            glass: v.string(),
            finish: v.union(v.literal("13-415"), v.literal("15-415"), v.literal("17-415"), v.literal("18-415")),
            closureAssemblyKind: v.union(v.string(), v.null()),
            capMaterialId: v.union(v.string(), v.null()),
            trimMaterialId: v.union(v.string(), v.null()),
            rollerVariant: v.union(v.literal("metal"), v.literal("plastic"), v.null()),
        })),
        source: v.object({ library: v.string(), path: v.string(), releaseVersion: v.union(v.string(), v.null()) }),
        builder: v.object({ name: v.string(), version: v.string(), builtAt: v.number() }),
        storageProvider: v.union(v.literal("vercel-blob"), v.literal("r2")),
        revision: v.number(),
        importedAt: v.number(),
    })
        .index("by_sku", ["sku"])
        .index("by_websiteSku", ["websiteSku"])
        .index("by_graceSku", ["graceSku"])
        .index("by_familyId", ["familyId"]),

    // Family registry for the lab and rails. Metadata, not a gate.
    plateFamilies: defineTable({
        familyId: v.string(),
        name: v.string(),
        neckFinish: v.string(),
        canvas: v.object({ width: v.number(), height: v.number() }),
        closures: v.array(v.object({ id: v.string(), label: v.string(), count: v.number() })),
        bodyMask: v.union(plateAssetV, v.null()),
        variantCount: v.number(),
        publishedAt: v.number(),
        buildId: v.string(),
    })
        .index("by_familyId", ["familyId"]),
});
