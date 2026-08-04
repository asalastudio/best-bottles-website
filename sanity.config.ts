import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { presentationTool } from "sanity/presentation";
import { schemaTypes } from "./src/sanity/schemaTypes";
import { resolve } from "./src/sanity/presentation/resolve";

export default defineConfig({
    name: "best-bottles",
    title: "Best Bottles",
    // The Studio is embedded in the Next.js app at /studio. Without basePath the
    // Studio router treats the "studio" URL segment as a tool name → "Tool not found".
    basePath: "/studio",
    projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.SANITY_STUDIO_DATASET ?? process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
    plugins: [
        structureTool({
            structure: (S) =>
                S.list()
                    .title("Content")
                    .items([
                        // ── Site Content ─────────────────────────────────────
                        S.listItem()
                            .title("Homepage")
                            .child(
                                S.documentList()
                                    .title("Homepage")
                                    .apiVersion("v2025-02-19")
                                    .filter('_type == "homepagePage"')
                                    .defaultOrdering([{ field: "_updatedAt", direction: "desc" }])
                            ),
                        S.listItem()
                            .title("Journal Articles")
                            .child(
                                S.documentList()
                                    .title("Journal Articles")
                                    .apiVersion("v2025-02-19")
                                    .filter('_type == "journal"')
                                    .defaultOrdering([{ field: "publishedAt", direction: "desc" }])
                            ),
                        S.listItem()
                            .title("Journal Drafts (Unpublished)")
                            .child(
                                S.documentList()
                                    .title("Unpublished Journal Articles")
                                    .apiVersion("v2025-02-19")
                                    .filter('_type == "journal" && _id in path("drafts.**")')
                                    .defaultOrdering([{ field: "_updatedAt", direction: "desc" }])
                            ),
                        S.divider(),
                        // ── Product Pages ─────────────────────────────────────
                        S.listItem()
                            .title("Product Family Templates")
                            .child(
                                S.documentList()
                                    .title("Family Templates")
                                    .apiVersion("v2025-02-19")
                                    .filter('_type == "productFamilyContent"')
                                    .defaultOrdering([{ field: "family", direction: "asc" }])
                            ),
                        S.listItem()
                            .title("Product Page Overrides")
                            .child(
                                S.documentList()
                                    .title("Product Overrides")
                                    .apiVersion("v2025-02-19")
                                    .filter('_type == "productGroupContent"')
                                    .defaultOrdering([{ field: "_updatedAt", direction: "desc" }])
                            ),
                        S.listItem()
                            .title("Paper Doll Families")
                            .child(
                                S.documentList()
                                    .title("Paper Doll Families")
                                    .apiVersion("v2025-02-19")
                                    .filter('_type == "paperDollFamily"')
                                    .defaultOrdering([{ field: "familyKey", direction: "asc" }])
                            ),
                        S.listItem()
                            .title("Paper Doll Beauty Galleries")
                            .child(
                                S.documentList()
                                    .title("Paper Doll Beauty Galleries")
                                    .apiVersion("v2025-02-19")
                                    .filter('_type == "paperDollBeautyGallery"')
                                    .defaultOrdering([{ field: "familyKey", direction: "asc" }])
                            ),
                        S.divider(),
                        // ── Everything else ────────────────────────────────────
                        ...S.documentTypeListItems().filter(
                            (item) =>
                                ![
                                    "homepagePage",
                                    "journal",
                                    "productFamilyContent",
                                    "productGroupContent",
                                    "paperDollFamily",
                                    "paperDollBeautyGallery",
                                ].includes(item.getId() ?? "")
                        ),
                    ]),
        }),
        presentationTool({
            resolve,
            previewUrl: {
                // Same-origin: the embedded Studio previews the site it ships with.
                previewMode: {
                    enable: "/api/draft-mode/enable",
                    disable: "/api/draft-mode/disable",
                },
            },
        }),
        visionTool(),
    ],
    schema: {
        types: schemaTypes,
    },
});
