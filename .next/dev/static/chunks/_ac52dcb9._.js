(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/sanity/schemaTypes/documents/journal.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "journal",
    ()=>journal
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+types@5.18.0_@types+react@19.2.14_debug@4.4.3/node_modules/@sanity/types/lib/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$icons$40$3$2e$7$2e$4_react$40$19$2e$2$2e$3$2f$node_modules$2f40$sanity$2f$icons$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+icons@3.7.4_react@19.2.3/node_modules/@sanity/icons/dist/index.js [app-client] (ecmascript)");
;
;
const journal = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineType"])({
    name: "journal",
    title: "Journal Article",
    type: "document",
    icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$icons$40$3$2e$7$2e$4_react$40$19$2e$2$2e$3$2f$node_modules$2f40$sanity$2f$icons$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BookIcon"],
    fields: [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "title",
            title: "Title",
            type: "string",
            validation: (Rule)=>Rule.required().max(100)
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "slug",
            title: "Slug",
            type: "slug",
            options: {
                source: "title",
                maxLength: 96
            },
            validation: (Rule)=>Rule.required()
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "category",
            title: "Category",
            type: "string",
            options: {
                list: [
                    {
                        title: "Packaging 101",
                        value: "packaging-101"
                    },
                    {
                        title: "Fragrance Guides",
                        value: "fragrance-guides"
                    },
                    {
                        title: "Brand Stories",
                        value: "brand-stories"
                    },
                    {
                        title: "Ingredient Science",
                        value: "ingredient-science"
                    },
                    {
                        title: "How-To",
                        value: "how-to"
                    },
                    {
                        title: "Industry News",
                        value: "industry-news"
                    }
                ]
            },
            validation: (Rule)=>Rule.required()
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "publishedAt",
            title: "Published At",
            type: "datetime",
            validation: (Rule)=>Rule.required()
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "estimatedReadTime",
            title: "Estimated Read Time (minutes)",
            type: "number",
            validation: (Rule)=>Rule.required().min(0)
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "excerpt",
            title: "Excerpt",
            type: "text",
            validation: (Rule)=>Rule.max(300)
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "image",
            title: "Hero Image",
            type: "image",
            options: {
                hotspot: true
            },
            description: "Optional for seed content; add in Studio before publishing."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "content",
            title: "Content",
            type: "array",
            of: [
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineArrayMember"])({
                    type: "block"
                }),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineArrayMember"])({
                    type: "image",
                    fields: [
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
                            name: "alt",
                            title: "Alt Text",
                            type: "string"
                        }),
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
                            name: "caption",
                            title: "Caption",
                            type: "string"
                        })
                    ]
                })
            ],
            validation: (Rule)=>Rule.required()
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "relatedProducts",
            title: "Related Products",
            type: "array",
            of: [
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineArrayMember"])({
                    type: "reference",
                    to: [
                        {
                            type: "product"
                        }
                    ]
                })
            ]
        }),
        // Madison Studio workflow fields
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "madisonId",
            title: "Madison ID",
            type: "string",
            description: "UUID from Madison Studio — set automatically on sync",
            readOnly: true
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "readyForReview",
            title: "Ready for Review",
            type: "boolean",
            description: "Set by Madison Studio when content is ready for editorial review",
            initialValue: false
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "generationSource",
            title: "Generation Source",
            type: "string",
            options: {
                list: [
                    {
                        title: "Madison Studio (AI)",
                        value: "madison-studio"
                    },
                    {
                        title: "Manual",
                        value: "manual"
                    }
                ],
                layout: "radio"
            },
            initialValue: "manual"
        })
    ],
    preview: {
        select: {
            title: "title",
            subtitle: "category",
            media: "image"
        }
    }
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/sanity/schemaTypes/documents/product.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "product",
    ()=>product
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+types@5.18.0_@types+react@19.2.14_debug@4.4.3/node_modules/@sanity/types/lib/index.js [app-client] (ecmascript)");
;
const product = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineType"])({
    name: "product",
    title: "Product",
    type: "document",
    fields: [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "title",
            title: "Title",
            type: "string"
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "websiteSku",
            title: "Website SKU",
            type: "string",
            description: "The websiteSku from Convex — links this Sanity record to a specific product variant. Used to look up editorial content on the product page."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "description",
            title: "Product Description",
            type: "text",
            rows: 5,
            description: "Editorial description shown below the Add to Cart button on the product detail page. Overrides the catalog description when present."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "shopifyHandle",
            title: "Shopify Handle",
            type: "slug"
        })
    ]
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/sanity/schemaTypes/documents/homepagePage.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "homepagePage",
    ()=>homepagePage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+types@5.18.0_@types+react@19.2.14_debug@4.4.3/node_modules/@sanity/types/lib/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$icons$40$3$2e$7$2e$4_react$40$19$2e$2$2e$3$2f$node_modules$2f40$sanity$2f$icons$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+icons@3.7.4_react@19.2.3/node_modules/@sanity/icons/dist/index.js [app-client] (ecmascript)");
;
;
const homepagePage = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineType"])({
    name: "homepagePage",
    title: "Homepage",
    type: "document",
    icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$icons$40$3$2e$7$2e$4_react$40$19$2e$2$2e$3$2f$node_modules$2f40$sanity$2f$icons$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["HomeIcon"],
    fields: [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "heroSlides",
            title: "Hero Slider",
            type: "array",
            of: [
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineArrayMember"])({
                    type: "heroBlock"
                })
            ],
            validation: (Rule)=>Rule.min(1).max(6),
            description: "Add 1 slide for a static hero, or 2+ for a rotating carousel (e.g. Black Friday, seasonal promos). Each slide has its own image, text, and button link."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "mobileHeroMode",
            title: "Mobile Hero Mode",
            type: "string",
            options: {
                list: [
                    {
                        title: "Category Grid (default)",
                        value: "categories"
                    },
                    {
                        title: "Full Hero (sales, promos)",
                        value: "hero"
                    }
                ],
                layout: "radio"
            },
            initialValue: "categories",
            description: "Choose what mobile users see at the top. 'Category Grid' shows the Shop by Application cards. 'Full Hero' shows the hero slider (great for sales, seasonal promos, product launches)."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "mobileTagline",
            title: "Mobile Tagline",
            type: "string",
            description: "One-line value prop shown on mobile below the logo (replaces hero). Example: Premium glass packaging for beauty & wellness brands.",
            initialValue: "Premium glass packaging for beauty & wellness brands."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "mobileSectionLabel",
            title: "Mobile Section Label",
            type: "string",
            description: "Label above the mobile category grid. Example: Shop by Application",
            initialValue: "Shop by Application"
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "mobileCategoryCards",
            title: "Mobile Category Cards",
            type: "array",
            of: [
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineArrayMember"])({
                    type: "mobileCategoryCard"
                })
            ],
            validation: (Rule)=>Rule.max(8),
            description: "2-column card grid shown on mobile in place of the hero. Up to 8 cards. Drag to reorder."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "startHereEyebrow",
            title: "Start Here — Eyebrow",
            type: "string",
            description: "Small uppercase label above the section title. Example: Guided Browsing",
            initialValue: "Guided Browsing"
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "startHereTitle",
            title: "Start Here — Section Title",
            type: "string",
            description: "Main heading for the section. Example: Start Here",
            initialValue: "Start Here"
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "startHereSubheading",
            title: "Start Here — Subheading",
            type: "text",
            description: "Supporting sentence below the title. Explains what the cards do.",
            initialValue: "Choose your use case to narrow the catalog faster."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "startHereCards",
            title: "Start Here Cards",
            type: "array",
            of: [
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineArrayMember"])({
                    type: "startHereCard"
                })
            ],
            validation: (Rule)=>Rule.max(6),
            description: "Up to 6 cards. Each links to a filtered catalog view. Drag to reorder."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "designFamilyCards",
            title: "Design Family Cards",
            type: "array",
            of: [
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineArrayMember"])({
                    type: "designFamilyCard"
                })
            ],
            validation: (Rule)=>Rule.max(12),
            description: "Bottle families shown in the carousel. Family Slug must match catalog exactly (e.g. Boston Round, Cylinder). Use Order to sort."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "educationPreview",
            title: "Education Preview",
            type: "educationPreview",
            description: "Featured blog articles and section heading. Links to Journal posts."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "megaMenuPanels",
            title: "Mega Menu Panels",
            type: "megaMenuPanels",
            description: "Optional featured images for mega menu. Link structure stays in code."
        })
    ],
    preview: {
        prepare () {
            return {
                title: "Homepage"
            };
        }
    }
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/sanity/schemaTypes/documents/productFamilyContent.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "productFamilyContent",
    ()=>productFamilyContent
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+types@5.18.0_@types+react@19.2.14_debug@4.4.3/node_modules/@sanity/types/lib/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$icons$40$3$2e$7$2e$4_react$40$19$2e$2$2e$3$2f$node_modules$2f40$sanity$2f$icons$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+icons@3.7.4_react@19.2.3/node_modules/@sanity/icons/dist/index.js [app-client] (ecmascript)");
;
;
// The list of product families — matches the values used in the Convex catalog.
const FAMILY_OPTIONS = [
    "Aluminum Bottle",
    "Apothecary",
    "Atomizer",
    "Bell",
    "Boston Round",
    "Circle",
    "Cream Jar",
    "Cylinder",
    "Decorative",
    "Diamond",
    "Diva",
    "Elegant",
    "Empire",
    "Flair",
    "Grace",
    "Lotion Bottle",
    "Pillar",
    "Plastic Bottle",
    "Rectangle",
    "Roll-On Cap",
    "Round",
    "Royal",
    "Sleek",
    "Slim",
    "Square",
    "Teardrop",
    "Tulip",
    "Vial"
].map(_c = (f)=>({
        title: f,
        value: f
    }));
_c1 = FAMILY_OPTIONS;
const TEMPLATE_OPTIONS = [
    {
        title: "Standard — Description · Features · Badges",
        value: "standard"
    },
    {
        title: "Premium — Gallery · Description · Feature Strip · FAQ",
        value: "premium"
    },
    {
        title: "Collection — Promo Banner · Features · Gallery · Description",
        value: "collection"
    }
];
const productFamilyContent = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineType"])({
    name: "productFamilyContent",
    title: "Product Family Content",
    type: "document",
    icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$icons$40$3$2e$7$2e$4_react$40$19$2e$2$2e$3$2f$node_modules$2f40$sanity$2f$icons$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ComponentIcon"],
    description: "Editorial content that applies to ALL products in a design family. Individual product overrides take priority over this.",
    fields: [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "family",
            title: "Design Family",
            type: "string",
            options: {
                list: FAMILY_OPTIONS
            },
            validation: (Rule)=>Rule.required(),
            description: "Must match the family name exactly as it appears in the catalog (e.g. Diva, Cylinder, Boston Round)."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "templateType",
            title: "Default Template",
            type: "string",
            options: {
                list: TEMPLATE_OPTIONS,
                layout: "radio"
            },
            initialValue: "standard",
            description: "Sets the default block order for all products in this family. Individual product overrides can change the order."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "familyHeroImage",
            title: "Family Hero Image",
            type: "image",
            options: {
                hotspot: true
            },
            description: "Lifestyle or editorial image representing the whole family. Shown as the banner on the catalog page when this family is filtered. Recommended: 1400×600px wide."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "familyStory",
            title: "Family Story",
            type: "text",
            rows: 3,
            description: "2–3 sentence brand narrative about this bottle family. Shown below the family name on catalog and product pages."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "pageBlocks",
            title: "Page Blocks",
            type: "array",
            of: [
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineArrayMember"])({
                    type: "pdpFeatureStrip"
                }),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineArrayMember"])({
                    type: "pdpRichDescription"
                }),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineArrayMember"])({
                    type: "pdpGalleryRow"
                }),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineArrayMember"])({
                    type: "pdpPromoBanner"
                }),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineArrayMember"])({
                    type: "pdpFaqAccordion"
                }),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineArrayMember"])({
                    type: "pdpTrustBadges"
                })
            ],
            description: "Drag blocks into the order you want them to appear on every product page in this family. Individual products can add their own blocks or override the order."
        })
    ],
    preview: {
        select: {
            family: "family",
            template: "templateType"
        },
        prepare ({ family, template }) {
            return {
                title: family ? `${family} Family` : "Product Family Content",
                subtitle: template ?? "standard"
            };
        }
    }
});
var _c, _c1;
__turbopack_context__.k.register(_c, 'FAMILY_OPTIONS$[\n    "Aluminum Bottle", "Apothecary", "Atomizer", "Bell", "Boston Round",\n    "Circle", "Cream Jar", "Cylinder", "Decorative", "Diamond", "Diva",\n    "Elegant", "Empire", "Flair", "Grace", "Lotion Bottle", "Pillar",\n    "Plastic Bottle", "Rectangle", "Roll-On Cap", "Round", "Royal",\n    "Sleek", "Slim", "Square", "Teardrop", "Tulip", "Vial",\n].map');
__turbopack_context__.k.register(_c1, "FAMILY_OPTIONS");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/sanity/schemaTypes/documents/productGroupContent.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "productGroupContent",
    ()=>productGroupContent
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+types@5.18.0_@types+react@19.2.14_debug@4.4.3/node_modules/@sanity/types/lib/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$icons$40$3$2e$7$2e$4_react$40$19$2e$2$2e$3$2f$node_modules$2f40$sanity$2f$icons$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+icons@3.7.4_react@19.2.3/node_modules/@sanity/icons/dist/index.js [app-client] (ecmascript)");
;
;
const productGroupContent = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineType"])({
    name: "productGroupContent",
    title: "Product Page Override",
    type: "document",
    icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$icons$40$3$2e$7$2e$4_react$40$19$2e$2$2e$3$2f$node_modules$2f40$sanity$2f$icons$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EditIcon"],
    description: "Editorial content for a specific product page. Identified by its catalog slug (e.g. diva-10ml-clear-rollon-bottle). Blocks here are merged with the family template — product-level blocks appear first.",
    fields: [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "slug",
            title: "Product Slug",
            type: "slug",
            description: "Must match the product's URL slug exactly (e.g. diva-10ml-clear-rollon-bottle). Copy it from the browser bar when viewing the product page.",
            validation: (Rule)=>Rule.required(),
            options: {
                source: "title"
            }
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "title",
            title: "Internal Label",
            type: "string",
            description: "For your reference only — not shown on the site. Use the product display name.",
            validation: (Rule)=>Rule.required()
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "overrideTemplate",
            title: "Override Family Template?",
            type: "boolean",
            initialValue: false,
            description: "OFF = this product's blocks are prepended to the family template blocks. ON = only this product's blocks are shown (family template is ignored entirely)."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "pageBlocks",
            title: "Page Blocks",
            type: "array",
            of: [
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineArrayMember"])({
                    type: "pdpFeatureStrip"
                }),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineArrayMember"])({
                    type: "pdpRichDescription"
                }),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineArrayMember"])({
                    type: "pdpGalleryRow"
                }),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineArrayMember"])({
                    type: "pdpPromoBanner"
                }),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineArrayMember"])({
                    type: "pdpFaqAccordion"
                }),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineArrayMember"])({
                    type: "pdpTrustBadges"
                })
            ],
            description: "Add and reorder blocks for this product specifically. If Override Family Template is OFF, these appear before the family blocks."
        })
    ],
    preview: {
        select: {
            title: "title",
            slug: "slug.current",
            override: "overrideTemplate"
        },
        prepare ({ title, slug, override }) {
            return {
                title: title ?? slug ?? "Product Override",
                subtitle: `/${slug ?? "?"}${override ? " · full override" : ""}`
            };
        }
    }
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/sanity/schemaTypes/objects/heroBlock.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "heroBlock",
    ()=>heroBlock
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+types@5.18.0_@types+react@19.2.14_debug@4.4.3/node_modules/@sanity/types/lib/index.js [app-client] (ecmascript)");
;
const heroBlock = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineType"])({
    name: "heroBlock",
    title: "Hero Block",
    type: "object",
    description: "The large banner at the top of the homepage. Choose image or video, then add text overlays.",
    fields: [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "mediaType",
            title: "Media Type",
            type: "string",
            options: {
                list: [
                    {
                        title: "Image",
                        value: "image"
                    },
                    {
                        title: "Video",
                        value: "video"
                    }
                ],
                layout: "radio"
            },
            initialValue: "image",
            description: "Image = static photo. Video = auto-playing MP4/WebM (add a poster image for loading)."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "image",
            title: "Hero Image",
            type: "image",
            options: {
                hotspot: true
            },
            description: "Main hero image. Use hotspot to crop the focal point. Recommended: 1920×1080 or larger."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "video",
            title: "Hero Video",
            type: "file",
            options: {
                accept: "video/mp4,video/webm"
            },
            hidden: ({ parent })=>parent?.mediaType !== "video",
            description: "MP4 or WebM. Keep under 10MB for fast loading."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "videoPoster",
            title: "Video Poster",
            type: "image",
            options: {
                hotspot: true
            },
            description: "Frame shown while video loads. Use a key frame from the video.",
            hidden: ({ parent })=>parent?.mediaType !== "video"
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "mobileImage",
            title: "Mobile Hero Image",
            type: "image",
            options: {
                hotspot: true
            },
            description: "Optional. Separate image for mobile viewports. Use portrait or square crop (e.g. 1080×1920). Falls back to desktop image if empty."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "mobileVideo",
            title: "Mobile Hero Video",
            type: "file",
            options: {
                accept: "video/mp4,video/webm"
            },
            hidden: ({ parent })=>parent?.mediaType !== "video",
            description: "Optional. Separate video for mobile. Falls back to desktop video if empty."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "mobileVideoPoster",
            title: "Mobile Video Poster",
            type: "image",
            options: {
                hotspot: true
            },
            hidden: ({ parent })=>parent?.mediaType !== "video",
            description: "Frame shown while mobile video loads. Falls back to desktop poster if empty."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "headline",
            title: "Headline",
            type: "string",
            description: "Main heading (e.g. Beautifully Contained). Leave empty for default."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "subheadline",
            title: "Subheadline",
            type: "text",
            description: "Supporting tagline below the headline. Leave empty for default."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "eyebrow",
            title: "Eyebrow",
            type: "string",
            description: "Small label above the headline (e.g. A Division of Nemat International)."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "ctaText",
            title: "Button Text",
            type: "string",
            description: "Primary CTA button label (e.g. Browse Catalog, Shop Black Friday). Leave empty for default.",
            initialValue: "Browse Catalog"
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "ctaHref",
            title: "Button Link",
            type: "string",
            description: "Where the button goes. Examples: /catalog, /catalog?search=sale, /catalog?families=Boston+Round",
            initialValue: "/catalog"
        })
    ]
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/sanity/schemaTypes/objects/startHereCard.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "startHereCard",
    ()=>startHereCard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+types@5.18.0_@types+react@19.2.14_debug@4.4.3/node_modules/@sanity/types/lib/index.js [app-client] (ecmascript)");
;
const startHereCard = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineType"])({
    name: "startHereCard",
    title: "Start Here Card",
    type: "object",
    description: "One card in the Guided Browsing section. Links to a filtered catalog view.",
    fields: [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "title",
            title: "Title",
            type: "string",
            validation: (Rule)=>Rule.required(),
            description: "Card title (e.g. essential oils & roll-ons). Use lowercase for consistency."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "subtitle",
            title: "Subtitle",
            type: "string",
            description: "Short description shown on the card. Uppercase for emphasis."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "href",
            title: "Link URL",
            type: "string",
            description: "Where the card links. Examples: /catalog?applicators=rollon, /catalog?families=Vial, /catalog?category=Packaging",
            validation: (Rule)=>Rule.required()
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "image",
            title: "Card Image",
            type: "image",
            options: {
                hotspot: true
            },
            description: "Product or lifestyle image. Recommended: 600×400px. Leave empty to use default."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "backgroundColor",
            title: "Background Color",
            type: "string",
            description: "Hex color (e.g. #DFD6C9) for the card background. Use a color picker or leave empty."
        })
    ],
    preview: {
        select: {
            title: "title"
        },
        prepare ({ title }) {
            return {
                title: title || "Start Here Card"
            };
        }
    }
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/sanity/schemaTypes/objects/designFamilyCard.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "designFamilyCard",
    ()=>designFamilyCard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+types@5.18.0_@types+react@19.2.14_debug@4.4.3/node_modules/@sanity/types/lib/index.js [app-client] (ecmascript)");
;
const designFamilyCard = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineType"])({
    name: "designFamilyCard",
    title: "Design Family Card",
    type: "object",
    description: "One bottle family in the Design Families carousel. Family Slug must match catalog exactly.",
    fields: [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "family",
            title: "Family Slug",
            type: "string",
            description: "Must match catalog exactly. Examples: Cylinder, Boston Round, Diva, Elegant, Sleek, Atomizer, Flair. Do not change unless adding a new family.",
            validation: (Rule)=>Rule.required()
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "title",
            title: "Display Title",
            type: "string",
            description: "Label shown on the card. Can differ from Family Slug (e.g. Atomizers for Atomizer).",
            validation: (Rule)=>Rule.required()
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "image",
            title: "Card Image",
            type: "image",
            options: {
                hotspot: true
            },
            description: "Bottle or product image. Recommended: 600×800px portrait. Leave empty to use default."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "order",
            title: "Sort Order",
            type: "number",
            initialValue: 0,
            description: "Lower numbers appear first. 0, 1, 2, 3..."
        })
    ],
    preview: {
        select: {
            title: "title",
            family: "family"
        },
        prepare ({ title, family }) {
            return {
                title: title || family || "Design Family Card"
            };
        }
    }
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/sanity/schemaTypes/objects/educationPreview.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "educationPreview",
    ()=>educationPreview
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+types@5.18.0_@types+react@19.2.14_debug@4.4.3/node_modules/@sanity/types/lib/index.js [app-client] (ecmascript)");
;
const educationPreview = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineType"])({
    name: "educationPreview",
    title: "Education Preview",
    type: "object",
    description: "Featured blog articles section. Links to Journal posts.",
    fields: [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "sectionTitle",
            title: "Section Title",
            type: "string",
            description: "Main heading (e.g. Packaging Insights)",
            initialValue: "Packaging Insights"
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "sectionEyebrow",
            title: "Section Eyebrow",
            type: "string",
            description: "Small label above the title (e.g. From the Lab)",
            initialValue: "From the Lab"
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "featuredArticles",
            title: "Featured Articles",
            type: "array",
            of: [
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineArrayMember"])({
                    type: "reference",
                    to: [
                        {
                            type: "journal"
                        }
                    ]
                })
            ],
            validation: (Rule)=>Rule.max(5),
            description: "Select up to 5 Journal articles to feature. Create articles in the Journal section first."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "viewAllHref",
            title: "View All Link",
            type: "string",
            description: "URL for the View All button. Usually /blog or /resources.",
            initialValue: "/blog"
        })
    ]
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/sanity/schemaTypes/objects/megaMenuFeaturedCard.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "megaMenuFeaturedCard",
    ()=>megaMenuFeaturedCard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+types@5.18.0_@types+react@19.2.14_debug@4.4.3/node_modules/@sanity/types/lib/index.js [app-client] (ecmascript)");
;
const megaMenuFeaturedCard = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineType"])({
    name: "megaMenuFeaturedCard",
    title: "Mega Menu Featured Card",
    type: "object",
    description: "Optional featured image and link for a mega menu dropdown.",
    fields: [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "featuredImage",
            title: "Featured Image",
            type: "image",
            options: {
                hotspot: true
            },
            description: "Image shown in the dropdown. Recommended: 400×300px."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "title",
            title: "Title",
            type: "string",
            description: "Link text (e.g. Shop Boston Rounds)"
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "subtitle",
            title: "Subtitle",
            type: "text",
            description: "Optional supporting text"
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "href",
            title: "Link URL",
            type: "string",
            description: "Where the card links (e.g. /catalog?families=Boston+Round)"
        })
    ]
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/sanity/schemaTypes/objects/mobileCategoryCard.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "mobileCategoryCard",
    ()=>mobileCategoryCard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+types@5.18.0_@types+react@19.2.14_debug@4.4.3/node_modules/@sanity/types/lib/index.js [app-client] (ecmascript)");
;
const mobileCategoryCard = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineType"])({
    name: "mobileCategoryCard",
    title: "Mobile Category Card",
    type: "object",
    description: "A compact category card shown on mobile in place of the hero. 2-column grid layout.",
    fields: [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "label",
            title: "Label",
            type: "string",
            validation: (Rule)=>Rule.required(),
            description: "Short category name (e.g. Roll-On Bottles, Spray Bottles). Keep it under 20 characters."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "href",
            title: "Link URL",
            type: "string",
            validation: (Rule)=>Rule.required(),
            description: "Where the card links. Examples: /catalog?applicators=rollon, /catalog?families=Cylinder"
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "image",
            title: "Card Image",
            type: "image",
            options: {
                hotspot: true
            },
            description: "Product lifestyle image. Recommended: 400×500px (portrait). Leave empty to use a placeholder."
        })
    ],
    preview: {
        select: {
            title: "label"
        },
        prepare ({ title }) {
            return {
                title: title || "Mobile Category Card"
            };
        }
    }
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/sanity/schemaTypes/objects/megaMenuPanels.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "megaMenuPanels",
    ()=>megaMenuPanels
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+types@5.18.0_@types+react@19.2.14_debug@4.4.3/node_modules/@sanity/types/lib/index.js [app-client] (ecmascript)");
;
const megaMenuPanels = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineType"])({
    name: "megaMenuPanels",
    title: "Mega Menu Panels",
    type: "object",
    description: "Optional featured images for the dropdown menus (Bottles, Closures, Specialty). Links appear when hovering nav items.",
    fields: [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "bottles",
            title: "Bottles Panel",
            type: "megaMenuFeaturedCard",
            description: "Featured image for the Bottles dropdown. Leave empty for icon-only."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "closures",
            title: "Closures Panel",
            type: "megaMenuFeaturedCard",
            description: "Featured image for the Closures dropdown."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "specialty",
            title: "Specialty Panel",
            type: "megaMenuFeaturedCard",
            description: "Featured image for the Specialty dropdown."
        })
    ]
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/sanity/schemaTypes/objects/pdpFeatureStrip.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "pdpFeatureStrip",
    ()=>pdpFeatureStrip
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+types@5.18.0_@types+react@19.2.14_debug@4.4.3/node_modules/@sanity/types/lib/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$icons$40$3$2e$7$2e$4_react$40$19$2e$2$2e$3$2f$node_modules$2f40$sanity$2f$icons$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+icons@3.7.4_react@19.2.3/node_modules/@sanity/icons/dist/index.js [app-client] (ecmascript)");
;
;
// Valid Lucide icon names editors can pick from.
// These are mapped to actual React components in the frontend.
const ICON_OPTIONS = [
    {
        title: "Shield — Quality / Durability",
        value: "Shield"
    },
    {
        title: "Droplets — Liquid-Safe / Leak-Proof",
        value: "Droplets"
    },
    {
        title: "Sun — UV Protection",
        value: "Sun"
    },
    {
        title: "Leaf — Eco / Natural / Sustainable",
        value: "Leaf"
    },
    {
        title: "Zap — Fast Shipping",
        value: "Zap"
    },
    {
        title: "Award — Certified / Premium Grade",
        value: "Award"
    },
    {
        title: "FlaskConical — Lab-Tested / Type III Glass",
        value: "FlaskConical"
    },
    {
        title: "Package — Ready to Ship",
        value: "Package"
    },
    {
        title: "Recycle — Recyclable / Refillable",
        value: "Recycle"
    },
    {
        title: "Layers — Multiple Variants Available",
        value: "Layers"
    },
    {
        title: "Check — In Stock / Verified",
        value: "Check"
    },
    {
        title: "Star — Best Seller",
        value: "Star"
    },
    {
        title: "Clock — Limited Time",
        value: "Clock"
    },
    {
        title: "Sparkles — New Arrival",
        value: "Sparkles"
    },
    {
        title: "Tag — On Sale",
        value: "Tag"
    },
    {
        title: "Globe — Made in USA",
        value: "Globe"
    }
];
const pdpFeatureStrip = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineType"])({
    name: "pdpFeatureStrip",
    title: "Feature Strip",
    type: "object",
    icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$icons$40$3$2e$7$2e$4_react$40$19$2e$2$2e$3$2f$node_modules$2f40$sanity$2f$icons$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StarIcon"],
    description: "A horizontal row of icon + label cards. Great for callouts like 'UV Protected', 'Type III Glass', 'Ships in 3 Days'.",
    fields: [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "items",
            title: "Feature Items",
            type: "array",
            of: [
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineArrayMember"])({
                    type: "object",
                    fields: [
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
                            name: "icon",
                            title: "Icon",
                            type: "string",
                            options: {
                                list: ICON_OPTIONS
                            },
                            validation: (Rule)=>Rule.required(),
                            description: "Icon shown above the label."
                        }),
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
                            name: "label",
                            title: "Label",
                            type: "string",
                            validation: (Rule)=>Rule.required().max(40),
                            description: "Short callout text, e.g. 'UV Protected' or 'Type III Glass'."
                        }),
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
                            name: "body",
                            title: "Tooltip / Sub-text",
                            type: "string",
                            description: "Optional one-liner shown on hover or below the label."
                        })
                    ],
                    preview: {
                        select: {
                            title: "label",
                            subtitle: "icon"
                        },
                        prepare ({ title, subtitle }) {
                            return {
                                title: title ?? "Feature",
                                subtitle: subtitle
                            };
                        }
                    }
                })
            ],
            validation: (Rule)=>Rule.min(1).max(8),
            description: "Add 1–8 features. Drag to reorder."
        })
    ],
    preview: {
        select: {
            items: "items"
        },
        prepare ({ items }) {
            const count = Array.isArray(items) ? items.length : 0;
            return {
                title: "Feature Strip",
                subtitle: `${count} item${count !== 1 ? "s" : ""}`
            };
        }
    }
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/sanity/schemaTypes/objects/pdpRichDescription.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "pdpRichDescription",
    ()=>pdpRichDescription
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+types@5.18.0_@types+react@19.2.14_debug@4.4.3/node_modules/@sanity/types/lib/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$icons$40$3$2e$7$2e$4_react$40$19$2e$2$2e$3$2f$node_modules$2f40$sanity$2f$icons$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+icons@3.7.4_react@19.2.3/node_modules/@sanity/icons/dist/index.js [app-client] (ecmascript)");
;
;
const pdpRichDescription = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineType"])({
    name: "pdpRichDescription",
    title: "Rich Description",
    type: "object",
    icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$icons$40$3$2e$7$2e$4_react$40$19$2e$2$2e$3$2f$node_modules$2f40$sanity$2f$icons$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DocumentTextIcon"],
    description: "Full editorial copy for this product. Supports bold, italics, links, and callout quotes. Overrides the plain-text description from the catalog.",
    fields: [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "eyebrow",
            title: "Eyebrow Label",
            type: "string",
            description: "Small uppercase label above the heading. Example: About This Product",
            initialValue: "About This Product"
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "heading",
            title: "Section Heading",
            type: "string",
            description: "Optional heading above the body text."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "body",
            title: "Body",
            type: "array",
            of: [
                {
                    type: "block",
                    marks: {
                        annotations: [
                            {
                                name: "link",
                                type: "object",
                                title: "Link",
                                fields: [
                                    {
                                        name: "href",
                                        type: "url",
                                        title: "URL",
                                        validation: (Rule)=>Rule.uri({
                                                scheme: [
                                                    "http",
                                                    "https",
                                                    "mailto",
                                                    "tel"
                                                ],
                                                allowRelative: true
                                            })
                                    }
                                ]
                            }
                        ],
                        decorators: [
                            {
                                title: "Bold",
                                value: "strong"
                            },
                            {
                                title: "Italic",
                                value: "em"
                            },
                            {
                                title: "Underline",
                                value: "underline"
                            }
                        ]
                    },
                    styles: [
                        {
                            title: "Normal",
                            value: "normal"
                        },
                        {
                            title: "Heading",
                            value: "h3"
                        },
                        {
                            title: "Quote",
                            value: "blockquote"
                        }
                    ],
                    lists: [
                        {
                            title: "Bullet",
                            value: "bullet"
                        },
                        {
                            title: "Numbered",
                            value: "number"
                        }
                    ]
                }
            ],
            description: "Use bold for key terms, blockquotes for standout statements.",
            validation: (Rule)=>Rule.required()
        })
    ],
    preview: {
        select: {
            eyebrow: "eyebrow",
            heading: "heading"
        },
        prepare ({ eyebrow, heading }) {
            return {
                title: heading ?? "Rich Description",
                subtitle: eyebrow
            };
        }
    }
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/sanity/schemaTypes/objects/pdpGalleryRow.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "pdpGalleryRow",
    ()=>pdpGalleryRow
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+types@5.18.0_@types+react@19.2.14_debug@4.4.3/node_modules/@sanity/types/lib/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$icons$40$3$2e$7$2e$4_react$40$19$2e$2$2e$3$2f$node_modules$2f40$sanity$2f$icons$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+icons@3.7.4_react@19.2.3/node_modules/@sanity/icons/dist/index.js [app-client] (ecmascript)");
;
;
const pdpGalleryRow = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineType"])({
    name: "pdpGalleryRow",
    title: "Gallery Row",
    type: "object",
    icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$icons$40$3$2e$7$2e$4_react$40$19$2e$2$2e$3$2f$node_modules$2f40$sanity$2f$icons$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ImagesIcon"],
    description: "A scrollable row of additional product images — lifestyle shots, in-use photos, detail close-ups. These appear alongside or below the main product image.",
    fields: [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "eyebrow",
            title: "Section Label",
            type: "string",
            description: "Optional label above the gallery.",
            initialValue: "Gallery"
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "images",
            title: "Images",
            type: "array",
            of: [
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineArrayMember"])({
                    type: "object",
                    fields: [
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
                            name: "image",
                            title: "Image",
                            type: "image",
                            options: {
                                hotspot: true
                            },
                            validation: (Rule)=>Rule.required()
                        }),
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
                            name: "alt",
                            title: "Alt Text",
                            type: "string",
                            description: "Describe the image for screen readers and SEO.",
                            validation: (Rule)=>Rule.required().max(120)
                        }),
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
                            name: "caption",
                            title: "Caption",
                            type: "string",
                            description: "Optional caption shown below the image."
                        })
                    ],
                    preview: {
                        select: {
                            title: "alt",
                            media: "image"
                        },
                        prepare ({ title, media }) {
                            return {
                                title: title ?? "Image",
                                media
                            };
                        }
                    }
                })
            ],
            validation: (Rule)=>Rule.min(1).max(12),
            description: "Upload 1–12 images. Recommended: 800×800px square or 4:3 landscape."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "layout",
            title: "Layout",
            type: "string",
            options: {
                list: [
                    {
                        title: "Scroll row (horizontal)",
                        value: "scroll"
                    },
                    {
                        title: "Grid (2 or 3 columns)",
                        value: "grid"
                    }
                ],
                layout: "radio"
            },
            initialValue: "scroll"
        })
    ],
    preview: {
        select: {
            images: "images",
            eyebrow: "eyebrow"
        },
        prepare ({ images, eyebrow }) {
            const count = Array.isArray(images) ? images.length : 0;
            return {
                title: eyebrow ?? "Gallery Row",
                subtitle: `${count} image${count !== 1 ? "s" : ""}`
            };
        }
    }
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/sanity/schemaTypes/objects/pdpPromoBanner.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "pdpPromoBanner",
    ()=>pdpPromoBanner
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+types@5.18.0_@types+react@19.2.14_debug@4.4.3/node_modules/@sanity/types/lib/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$icons$40$3$2e$7$2e$4_react$40$19$2e$2$2e$3$2f$node_modules$2f40$sanity$2f$icons$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+icons@3.7.4_react@19.2.3/node_modules/@sanity/icons/dist/index.js [app-client] (ecmascript)");
;
;
const pdpPromoBanner = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineType"])({
    name: "pdpPromoBanner",
    title: "Promo Banner",
    type: "object",
    icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$icons$40$3$2e$7$2e$4_react$40$19$2e$2$2e$3$2f$node_modules$2f40$sanity$2f$icons$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BellIcon"],
    description: "A high-visibility promotional strip. Add a headline, supporting copy, optional countdown timer, and a CTA button. Great for limited-time deals, new arrivals, or featured collections.",
    fields: [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "style",
            title: "Banner Style",
            type: "string",
            options: {
                list: [
                    {
                        title: "Subtle (light background, gold accent)",
                        value: "subtle"
                    },
                    {
                        title: "Bold (dark background, white text)",
                        value: "bold"
                    },
                    {
                        title: "Urgent (gold background, dark text)",
                        value: "urgent"
                    }
                ],
                layout: "radio"
            },
            initialValue: "subtle"
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "eyebrow",
            title: "Eyebrow",
            type: "string",
            description: "Small uppercase text above the headline. Example: Limited Time · New Arrival · Sale"
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "headline",
            title: "Headline",
            type: "string",
            validation: (Rule)=>Rule.required().max(80),
            description: "Main banner message. Example: Order by Friday — Ships Before the Weekend."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "body",
            title: "Supporting Copy",
            type: "text",
            rows: 2,
            description: "Optional one or two sentences below the headline."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "ctaText",
            title: "Button Label",
            type: "string",
            description: "CTA button text. Leave empty to hide the button."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "ctaHref",
            title: "Button Link",
            type: "string",
            description: "Where the button goes. Can be an internal path or external URL."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "countdownEndDate",
            title: "Countdown End Date & Time",
            type: "datetime",
            description: "If set, a live countdown timer appears in the banner. Leave empty for no countdown. Use your local time — the site converts automatically.",
            options: {
                dateFormat: "MMMM D, YYYY",
                timeFormat: "h:mm A"
            }
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "countdownLabel",
            title: "Countdown Label",
            type: "string",
            description: "Text after the timer. Example: until sale ends · left to order at this price",
            initialValue: "remaining",
            hidden: ({ parent })=>!parent?.countdownEndDate
        })
    ],
    preview: {
        select: {
            headline: "headline",
            style: "style",
            countdown: "countdownEndDate"
        },
        prepare ({ headline, style, countdown }) {
            const sub = [
                style,
                countdown ? "⏱ countdown" : null
            ].filter(Boolean).join(" · ");
            return {
                title: headline ?? "Promo Banner",
                subtitle: sub
            };
        }
    }
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/sanity/schemaTypes/objects/pdpFaqAccordion.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "pdpFaqAccordion",
    ()=>pdpFaqAccordion
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+types@5.18.0_@types+react@19.2.14_debug@4.4.3/node_modules/@sanity/types/lib/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$icons$40$3$2e$7$2e$4_react$40$19$2e$2$2e$3$2f$node_modules$2f40$sanity$2f$icons$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+icons@3.7.4_react@19.2.3/node_modules/@sanity/icons/dist/index.js [app-client] (ecmascript)");
;
;
const pdpFaqAccordion = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineType"])({
    name: "pdpFaqAccordion",
    title: "FAQ Accordion",
    type: "object",
    icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$icons$40$3$2e$7$2e$4_react$40$19$2e$2$2e$3$2f$node_modules$2f40$sanity$2f$icons$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["HelpCircleIcon"],
    description: "Collapsible Q&A section. Use for product-specific questions about compatibility, care, materials, or ordering.",
    fields: [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "eyebrow",
            title: "Section Label",
            type: "string",
            initialValue: "Frequently Asked",
            description: "Small label above the accordion."
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "heading",
            title: "Section Heading",
            type: "string",
            initialValue: "Questions & Answers"
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "items",
            title: "Questions",
            type: "array",
            of: [
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineArrayMember"])({
                    type: "object",
                    fields: [
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
                            name: "question",
                            title: "Question",
                            type: "string",
                            validation: (Rule)=>Rule.required()
                        }),
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
                            name: "answer",
                            title: "Answer",
                            type: "array",
                            of: [
                                {
                                    type: "block"
                                }
                            ],
                            description: "Supports bold, italics, and links.",
                            validation: (Rule)=>Rule.required()
                        })
                    ],
                    preview: {
                        select: {
                            title: "question"
                        },
                        prepare ({ title }) {
                            return {
                                title: title ?? "Question"
                            };
                        }
                    }
                })
            ],
            validation: (Rule)=>Rule.min(1).max(20),
            description: "Add questions. Drag to reorder."
        })
    ],
    preview: {
        select: {
            items: "items",
            heading: "heading"
        },
        prepare ({ items, heading }) {
            const count = Array.isArray(items) ? items.length : 0;
            return {
                title: heading ?? "FAQ Accordion",
                subtitle: `${count} question${count !== 1 ? "s" : ""}`
            };
        }
    }
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/sanity/schemaTypes/objects/pdpTrustBadges.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "pdpTrustBadges",
    ()=>pdpTrustBadges
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+types@5.18.0_@types+react@19.2.14_debug@4.4.3/node_modules/@sanity/types/lib/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$icons$40$3$2e$7$2e$4_react$40$19$2e$2$2e$3$2f$node_modules$2f40$sanity$2f$icons$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+icons@3.7.4_react@19.2.3/node_modules/@sanity/icons/dist/index.js [app-client] (ecmascript)");
;
;
const PRESET_BADGES = [
    {
        title: "UV Protected",
        value: "UV Protected"
    },
    {
        title: "Type III Glass",
        value: "Type III Glass"
    },
    {
        title: "Sample Ready",
        value: "Sample Ready"
    },
    {
        title: "Low MOQ",
        value: "Low MOQ"
    },
    {
        title: "Ships in 3–5 Days",
        value: "Ships in 3–5 Days"
    },
    {
        title: "Made in USA",
        value: "Made in USA"
    },
    {
        title: "Leak-Proof",
        value: "Leak-Proof"
    },
    {
        title: "Recyclable",
        value: "Recyclable"
    },
    {
        title: "Refillable",
        value: "Refillable"
    },
    {
        title: "Fragrance Safe",
        value: "Fragrance Safe"
    },
    {
        title: "Essential Oil Safe",
        value: "Essential Oil Safe"
    },
    {
        title: "Cosmetic Grade",
        value: "Cosmetic Grade"
    },
    {
        title: "In Stock",
        value: "In Stock"
    },
    {
        title: "New Arrival",
        value: "New Arrival"
    },
    {
        title: "Best Seller",
        value: "Best Seller"
    },
    {
        title: "Volume Pricing Available",
        value: "Volume Pricing Available"
    }
];
const pdpTrustBadges = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineType"])({
    name: "pdpTrustBadges",
    title: "Trust Badges",
    type: "object",
    icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$icons$40$3$2e$7$2e$4_react$40$19$2e$2$2e$3$2f$node_modules$2f40$sanity$2f$icons$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TagIcon"],
    description: "Small pill badges that appear as a row below the product name or Add to Cart. Use presets or add custom text.",
    fields: [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "badges",
            title: "Badge Labels",
            type: "array",
            of: [
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineArrayMember"])({
                    type: "object",
                    fields: [
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
                            name: "label",
                            title: "Badge Text",
                            type: "string",
                            description: "Choose a preset or type your own (max 30 characters).",
                            options: {
                                list: PRESET_BADGES
                            },
                            validation: (Rule)=>Rule.required().max(30)
                        }),
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
                            name: "style",
                            title: "Style",
                            type: "string",
                            options: {
                                list: [
                                    {
                                        title: "Default (light outline)",
                                        value: "default"
                                    },
                                    {
                                        title: "Gold (highlight)",
                                        value: "gold"
                                    },
                                    {
                                        title: "Dark (emphasis)",
                                        value: "dark"
                                    },
                                    {
                                        title: "Green (in stock / eco)",
                                        value: "green"
                                    }
                                ],
                                layout: "radio"
                            },
                            initialValue: "default"
                        })
                    ],
                    preview: {
                        select: {
                            title: "label",
                            subtitle: "style"
                        },
                        prepare ({ title, subtitle }) {
                            return {
                                title: title ?? "Badge",
                                subtitle: subtitle
                            };
                        }
                    }
                })
            ],
            validation: (Rule)=>Rule.min(1).max(10),
            description: "Add up to 10 badges. Drag to reorder."
        })
    ],
    preview: {
        select: {
            badges: "badges"
        },
        prepare ({ badges }) {
            const labels = Array.isArray(badges) ? badges.map((b)=>b.label).filter(Boolean).join(" · ") : "";
            return {
                title: "Trust Badges",
                subtitle: labels || "No badges"
            };
        }
    }
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/sanity/schemaTypes/objects/paperDollLayerAsset.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "paperDollLayerAsset",
    ()=>paperDollLayerAsset
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+types@5.18.0_@types+react@19.2.14_debug@4.4.3/node_modules/@sanity/types/lib/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$icons$40$3$2e$7$2e$4_react$40$19$2e$2$2e$3$2f$node_modules$2f40$sanity$2f$icons$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+icons@3.7.4_react@19.2.3/node_modules/@sanity/icons/dist/index.js [app-client] (ecmascript)");
;
;
const paperDollLayerAsset = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineType"])({
    name: "paperDollLayerAsset",
    title: "Paper Doll Layer Asset",
    type: "object",
    icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$icons$40$3$2e$7$2e$4_react$40$19$2e$2$2e$3$2f$node_modules$2f40$sanity$2f$icons$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ImageIcon"],
    fields: [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "slot",
            title: "Slot",
            type: "string",
            options: {
                list: [
                    {
                        title: "Body (glass)",
                        value: "body"
                    },
                    {
                        title: "Cap",
                        value: "cap"
                    },
                    {
                        title: "Roller fitment",
                        value: "roller"
                    },
                    {
                        title: "Sprayer",
                        value: "sprayer"
                    },
                    {
                        title: "Lotion pump",
                        value: "pump"
                    }
                ],
                layout: "dropdown"
            },
            validation: (Rule)=>Rule.required()
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "variantKey",
            title: "Variant key",
            type: "string",
            description: "Short code matching filenames, e.g. CLR, BLK-DOT, MTL-ROLL",
            validation: (Rule)=>Rule.required()
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "sourceFilename",
            title: "Source filename",
            type: "string",
            description: "Original PNG basename for traceability"
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "image",
            title: "Layer PNG",
            type: "image",
            options: {
                hotspot: false
            },
            validation: (Rule)=>Rule.required()
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "offsetX",
            title: "Offset X (px)",
            type: "number",
            initialValue: 0,
            description: "Horizontal nudge — positive = right, negative = left"
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "offsetY",
            title: "Offset Y (px)",
            type: "number",
            initialValue: 0,
            description: "Vertical nudge — positive = down, negative = up"
        })
    ],
    preview: {
        select: {
            slot: "slot",
            variantKey: "variantKey",
            media: "image"
        },
        prepare ({ slot, variantKey, media }) {
            return {
                title: `${slot ?? "?"} — ${variantKey ?? ""}`,
                media
            };
        }
    }
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/sanity/schemaTypes/documents/paperDollFamily.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "paperDollFamily",
    ()=>paperDollFamily
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+types@5.18.0_@types+react@19.2.14_debug@4.4.3/node_modules/@sanity/types/lib/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$icons$40$3$2e$7$2e$4_react$40$19$2e$2$2e$3$2f$node_modules$2f40$sanity$2f$icons$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+icons@3.7.4_react@19.2.3/node_modules/@sanity/icons/dist/index.js [app-client] (ecmascript)");
;
;
const paperDollFamily = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineType"])({
    name: "paperDollFamily",
    title: "Paper Doll Family",
    type: "document",
    icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$icons$40$3$2e$7$2e$4_react$40$19$2e$2$2e$3$2f$node_modules$2f40$sanity$2f$icons$2f$dist$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ComponentIcon"],
    fields: [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "familyKey",
            title: "Family key",
            type: "string",
            description: "Stable key, e.g. CYL-9ML — used by API and Convex sync",
            validation: (Rule)=>Rule.required()
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "displayName",
            title: "Display name",
            type: "string",
            validation: (Rule)=>Rule.required()
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "canvasWidth",
            title: "Canvas width (px)",
            type: "number",
            initialValue: 2000,
            validation: (Rule)=>Rule.required().min(1)
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "canvasHeight",
            title: "Canvas height (px)",
            type: "number",
            initialValue: 2200,
            validation: (Rule)=>Rule.required().min(1)
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "layerOrderRollon",
            title: "Layer order — Roll-on",
            type: "array",
            of: [
                {
                    type: "string"
                }
            ],
            description: "Bottom to top, e.g. body → roller → cap"
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "layerOrderSpray",
            title: "Layer order — Spray",
            type: "array",
            of: [
                {
                    type: "string"
                }
            ]
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "layerOrderLotion",
            title: "Layer order — Lotion",
            type: "array",
            of: [
                {
                    type: "string"
                }
            ]
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "anchorsJson",
            title: "Anchors (JSON)",
            type: "text",
            rows: 8,
            description: "Paste family-model.json anchors / contentBounds as JSON for renderer alignment"
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineField"])({
            name: "layerAssets",
            title: "Layer assets",
            type: "array",
            of: [
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$types$40$5$2e$18$2e$0_$40$types$2b$react$40$19$2e$2$2e$14_debug$40$4$2e$4$2e$3$2f$node_modules$2f40$sanity$2f$types$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defineArrayMember"])({
                    type: "paperDollLayerAsset"
                })
            ]
        })
    ],
    preview: {
        select: {
            title: "displayName",
            subtitle: "familyKey"
        }
    }
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/sanity/schemaTypes/index.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "schemaTypes",
    ()=>schemaTypes
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$documents$2f$journal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/sanity/schemaTypes/documents/journal.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$documents$2f$product$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/sanity/schemaTypes/documents/product.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$documents$2f$homepagePage$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/sanity/schemaTypes/documents/homepagePage.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$documents$2f$productFamilyContent$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/sanity/schemaTypes/documents/productFamilyContent.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$documents$2f$productGroupContent$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/sanity/schemaTypes/documents/productGroupContent.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$heroBlock$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/sanity/schemaTypes/objects/heroBlock.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$startHereCard$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/sanity/schemaTypes/objects/startHereCard.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$designFamilyCard$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/sanity/schemaTypes/objects/designFamilyCard.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$educationPreview$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/sanity/schemaTypes/objects/educationPreview.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$megaMenuFeaturedCard$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/sanity/schemaTypes/objects/megaMenuFeaturedCard.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$mobileCategoryCard$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/sanity/schemaTypes/objects/mobileCategoryCard.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$megaMenuPanels$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/sanity/schemaTypes/objects/megaMenuPanels.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$pdpFeatureStrip$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/sanity/schemaTypes/objects/pdpFeatureStrip.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$pdpRichDescription$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/sanity/schemaTypes/objects/pdpRichDescription.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$pdpGalleryRow$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/sanity/schemaTypes/objects/pdpGalleryRow.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$pdpPromoBanner$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/sanity/schemaTypes/objects/pdpPromoBanner.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$pdpFaqAccordion$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/sanity/schemaTypes/objects/pdpFaqAccordion.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$pdpTrustBadges$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/sanity/schemaTypes/objects/pdpTrustBadges.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$paperDollLayerAsset$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/sanity/schemaTypes/objects/paperDollLayerAsset.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$documents$2f$paperDollFamily$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/sanity/schemaTypes/documents/paperDollFamily.ts [app-client] (ecmascript)");
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
const schemaTypes = [
    // Documents
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$documents$2f$journal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["journal"],
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$documents$2f$product$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["product"],
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$documents$2f$homepagePage$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["homepagePage"],
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$documents$2f$productFamilyContent$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["productFamilyContent"],
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$documents$2f$productGroupContent$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["productGroupContent"],
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$documents$2f$paperDollFamily$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["paperDollFamily"],
    // Objects — Homepage
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$heroBlock$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["heroBlock"],
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$startHereCard$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["startHereCard"],
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$designFamilyCard$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["designFamilyCard"],
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$mobileCategoryCard$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["mobileCategoryCard"],
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$educationPreview$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["educationPreview"],
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$megaMenuFeaturedCard$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["megaMenuFeaturedCard"],
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$megaMenuPanels$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["megaMenuPanels"],
    // Objects — Product Page Blocks
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$pdpFeatureStrip$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pdpFeatureStrip"],
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$pdpRichDescription$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pdpRichDescription"],
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$pdpGalleryRow$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pdpGalleryRow"],
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$pdpPromoBanner$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pdpPromoBanner"],
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$pdpFaqAccordion$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pdpFaqAccordion"],
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$pdpTrustBadges$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pdpTrustBadges"],
    // Paper Doll
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$objects$2f$paperDollLayerAsset$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["paperDollLayerAsset"]
];
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/sanity.config.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$1$2e$6_$40$babel$2b$core$40$7$2e$29$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$react$2d$compiler$40$1$2e$0_dfe2944aa2de3f51ba172bc2570b2432$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.1.6_@babel+core@7.29.0_@opentelemetry+api@1.9.0_babel-plugin-react-compiler@1.0_dfe2944aa2de3f51ba172bc2570b2432/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sanity$40$5$2e$18$2e$0_$40$emotion$2b$is$2d$prop$2d$valid$40$1$2e$4$2e$0_$40$noble$2b$hashes$40$2$2e$0$2e$1_$40$oclif$2b$core$40$4$2e$10$2e$3_$40$sani_65cd2cb7f6c2940af0c8465504a3d602$2f$node_modules$2f$sanity$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/sanity@5.18.0_@emotion+is-prop-valid@1.4.0_@noble+hashes@2.0.1_@oclif+core@4.10.3_@sani_65cd2cb7f6c2940af0c8465504a3d602/node_modules/sanity/lib/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sanity$40$5$2e$18$2e$0_$40$emotion$2b$is$2d$prop$2d$valid$40$1$2e$4$2e$0_$40$noble$2b$hashes$40$2$2e$0$2e$1_$40$oclif$2b$core$40$4$2e$10$2e$3_$40$sani_65cd2cb7f6c2940af0c8465504a3d602$2f$node_modules$2f$sanity$2f$lib$2f$_chunks$2d$es$2f$structureTool$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/sanity@5.18.0_@emotion+is-prop-valid@1.4.0_@noble+hashes@2.0.1_@oclif+core@4.10.3_@sani_65cd2cb7f6c2940af0c8465504a3d602/node_modules/sanity/lib/_chunks-es/structureTool.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$vision$40$5$2e$18$2e$0_$40$babel$2b$runtime$40$7$2e$29$2e$2_$40$codemirror$2b$lint$40$6$2e$9$2e$5_$40$codemirror$2b$theme$2d$on_0af0efd22d84048102ba455a2acc4cab$2f$node_modules$2f40$sanity$2f$vision$2f$lib$2f$_chunks$2d$es$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@sanity+vision@5.18.0_@babel+runtime@7.29.2_@codemirror+lint@6.9.5_@codemirror+theme-on_0af0efd22d84048102ba455a2acc4cab/node_modules/@sanity/vision/lib/_chunks-es/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/sanity/schemaTypes/index.ts [app-client] (ecmascript)");
;
;
;
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sanity$40$5$2e$18$2e$0_$40$emotion$2b$is$2d$prop$2d$valid$40$1$2e$4$2e$0_$40$noble$2b$hashes$40$2$2e$0$2e$1_$40$oclif$2b$core$40$4$2e$10$2e$3_$40$sani_65cd2cb7f6c2940af0c8465504a3d602$2f$node_modules$2f$sanity$2f$lib$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["defineConfig"])({
    name: "best-bottles",
    title: "Best Bottles",
    projectId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$1$2e$6_$40$babel$2b$core$40$7$2e$29$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$react$2d$compiler$40$1$2e$0_dfe2944aa2de3f51ba172bc2570b2432$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.SANITY_STUDIO_PROJECT_ID ?? ("TURBOPACK compile-time value", "gh97irjh"),
    dataset: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$1$2e$6_$40$babel$2b$core$40$7$2e$29$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$react$2d$compiler$40$1$2e$0_dfe2944aa2de3f51ba172bc2570b2432$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.SANITY_STUDIO_DATASET ?? ("TURBOPACK compile-time value", "production") ?? "production",
    plugins: [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$sanity$40$5$2e$18$2e$0_$40$emotion$2b$is$2d$prop$2d$valid$40$1$2e$4$2e$0_$40$noble$2b$hashes$40$2$2e$0$2e$1_$40$oclif$2b$core$40$4$2e$10$2e$3_$40$sani_65cd2cb7f6c2940af0c8465504a3d602$2f$node_modules$2f$sanity$2f$lib$2f$_chunks$2d$es$2f$structureTool$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["structureTool"])({
            structure: (S)=>S.list().title("Content").items([
                    // ── Site Content ─────────────────────────────────────
                    S.listItem().title("Homepage").child(S.documentList().title("Homepage").apiVersion("v2025-02-19").filter('_type == "homepagePage"').defaultOrdering([
                        {
                            field: "_updatedAt",
                            direction: "desc"
                        }
                    ])),
                    S.listItem().title("Journal Articles").child(S.documentList().title("Journal Articles").apiVersion("v2025-02-19").filter('_type == "journal"').defaultOrdering([
                        {
                            field: "publishedAt",
                            direction: "desc"
                        }
                    ])),
                    S.listItem().title("Journal Drafts (Unpublished)").child(S.documentList().title("Unpublished Journal Articles").apiVersion("v2025-02-19").filter('_type == "journal" && _id in path("drafts.**")').defaultOrdering([
                        {
                            field: "_updatedAt",
                            direction: "desc"
                        }
                    ])),
                    S.divider(),
                    // ── Product Pages ─────────────────────────────────────
                    S.listItem().title("Product Family Templates").child(S.documentList().title("Family Templates").apiVersion("v2025-02-19").filter('_type == "productFamilyContent"').defaultOrdering([
                        {
                            field: "family",
                            direction: "asc"
                        }
                    ])),
                    S.listItem().title("Product Page Overrides").child(S.documentList().title("Product Overrides").apiVersion("v2025-02-19").filter('_type == "productGroupContent"').defaultOrdering([
                        {
                            field: "_updatedAt",
                            direction: "desc"
                        }
                    ])),
                    S.listItem().title("Paper Doll Families").child(S.documentList().title("Paper Doll Families").apiVersion("v2025-02-19").filter('_type == "paperDollFamily"').defaultOrdering([
                        {
                            field: "familyKey",
                            direction: "asc"
                        }
                    ])),
                    S.divider(),
                    // ── Everything else ────────────────────────────────────
                    ...S.documentTypeListItems().filter((item)=>![
                            "homepagePage",
                            "journal",
                            "productFamilyContent",
                            "productGroupContent",
                            "paperDollFamily"
                        ].includes(item.getId() ?? ""))
                ])
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$sanity$2b$vision$40$5$2e$18$2e$0_$40$babel$2b$runtime$40$7$2e$29$2e$2_$40$codemirror$2b$lint$40$6$2e$9$2e$5_$40$codemirror$2b$theme$2d$on_0af0efd22d84048102ba455a2acc4cab$2f$node_modules$2f40$sanity$2f$vision$2f$lib$2f$_chunks$2d$es$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["visionTool"])()
    ],
    schema: {
        types: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$sanity$2f$schemaTypes$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["schemaTypes"]
    }
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/app/studio/[[...tool]]/StudioPageClient.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>StudioPageClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$1$2e$6_$40$babel$2b$core$40$7$2e$29$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$react$2d$compiler$40$1$2e$0_dfe2944aa2de3f51ba172bc2570b2432$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.1.6_@babel+core@7.29.0_@opentelemetry+api@1.9.0_babel-plugin-react-compiler@1.0_dfe2944aa2de3f51ba172bc2570b2432/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$1$2e$6_$40$babel$2b$core$40$7$2e$29$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$react$2d$compiler$40$1$2e$0_dfe2944aa2de3f51ba172bc2570b2432$2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.1.6_@babel+core@7.29.0_@opentelemetry+api@1.9.0_babel-plugin-react-compiler@1.0_dfe2944aa2de3f51ba172bc2570b2432/node_modules/next/dist/shared/lib/app-dynamic.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$sanity$2e$config$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/sanity.config.ts [app-client] (ecmascript)");
;
"use client";
;
;
;
const NextStudio = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$1$2e$6_$40$babel$2b$core$40$7$2e$29$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$react$2d$compiler$40$1$2e$0_dfe2944aa2de3f51ba172bc2570b2432$2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(()=>__turbopack_context__.A("[project]/node_modules/.pnpm/next-sanity@12.2.1_@emotion+is-prop-valid@1.4.0_@sanity+client@7.20.0_@sanity+types@5.1_19b1e33e6828f6109957930cbf3a792d/node_modules/next-sanity/dist/studio/index.js [app-client] (ecmascript, next/dynamic entry, async loader)").then((mod)=>mod.NextStudio), {
    loadableGenerated: {
        modules: [
            "[project]/node_modules/.pnpm/next-sanity@12.2.1_@emotion+is-prop-valid@1.4.0_@sanity+client@7.20.0_@sanity+types@5.1_19b1e33e6828f6109957930cbf3a792d/node_modules/next-sanity/dist/studio/index.js [app-client] (ecmascript, next/dynamic entry)"
        ]
    },
    ssr: false
});
_c = NextStudio;
function StudioPageClient() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$1$2e$6_$40$babel$2b$core$40$7$2e$29$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$react$2d$compiler$40$1$2e$0_dfe2944aa2de3f51ba172bc2570b2432$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NextStudio, {
        config: __TURBOPACK__imported__module__$5b$project$5d2f$sanity$2e$config$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"]
    }, void 0, false, {
        fileName: "[project]/src/app/studio/[[...tool]]/StudioPageClient.tsx",
        lineNumber: 12,
        columnNumber: 12
    }, this);
}
_c1 = StudioPageClient;
var _c, _c1;
__turbopack_context__.k.register(_c, "NextStudio");
__turbopack_context__.k.register(_c1, "StudioPageClient");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=_ac52dcb9._.js.map