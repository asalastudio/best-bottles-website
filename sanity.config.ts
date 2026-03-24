import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { presentationTool } from "sanity/presentation";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./src/sanity/schemaTypes";

export default defineConfig({
    name: "best-bottles",
    title: "Best Bottles",
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
                        S.divider(),
                        // ── Everything else ────────────────────────────────────
                        ...S.documentTypeListItems().filter(
                            (item) =>
                                !["homepagePage", "journal", "productFamilyContent", "productGroupContent"].includes(
                                    item.getId() ?? ""
                                )
                        ),
                    ]),
        }),
        visionTool(),
        presentationTool({
            previewUrl: {
                previewMode: {
                    enable: "/api/draft-mode/enable",
                    disable: "/api/draft-mode/disable",
                },
            },
        }),
    ],
    schema: {
        types: schemaTypes,
    },
});
