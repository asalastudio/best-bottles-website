"use client";

import { useActionState, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createProductAction, createProductImageUploadUrlAction, resolveProductImageUrlAction, type CreateProductState } from "@/app/team/products/actions";
import ProductImageDropField from "@/components/team/ProductImageDropField";
import { PRODUCT_IMAGE_SPEC } from "@/lib/team/productImageUpload";
import {
    CREATE_PRODUCT_CATEGORY_OPTIONS,
    CREATE_PRODUCT_COLOR_OPTIONS,
    CREATE_PRODUCT_FAMILY_OPTIONS,
    CREATE_PRODUCT_SECTIONS,
    EMPTY_CREATE_PRODUCT_DRAFT,
    STAFF_APPLICATOR_VALUES,
    previewCreateProduct,
    type CreateProductDraft,
} from "@/lib/team/createProduct";
import { cn } from "@/lib/utils";

const initialState: CreateProductState = { error: null, slug: null, websiteSku: null };

function Field({
    label,
    name,
    hint,
    field,
}: {
    label: string;
    name: string;
    hint?: string;
    field: ReactNode;
}) {
    return (
        <label className="block" htmlFor={name}>
            <span className="mb-1.5 block font-sans text-[12px] font-semibold text-obsidian">{label}</span>
            {field}
            {hint ? <span className="mt-1 block text-[12px] leading-5 text-slate">{hint}</span> : null}
        </label>
    );
}

const controlClass =
    "h-11 min-h-11 w-full rounded-md border border-champagne/70 bg-white px-3 font-sans text-[16px] text-obsidian placeholder:text-ash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold lg:h-10 lg:min-h-10 lg:text-sm";

export default function CreateProductForm({ previewMode = false }: { previewMode?: boolean }) {
    const [draft, setDraft] = useState<CreateProductDraft>(EMPTY_CREATE_PRODUCT_DRAFT);
    const [state, formAction, pending] = useActionState(createProductAction, initialState);
    const preview = useMemo(() => previewCreateProduct(draft), [draft]);

    const set = <K extends keyof CreateProductDraft>(key: K, value: CreateProductDraft[K]) => {
        setDraft((current) => ({ ...current, [key]: value }));
    };

    return (
        <form action={formAction} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6">
            <aside className="h-fit space-y-4 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-6" data-create-product-preview>
                <Card className="border-champagne/50 bg-linen shadow-[0_18px_45px_rgba(29,29,31,0.04)]">
                    <CardContent className="px-4 py-4 sm:px-5 sm:py-5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-dim">Product page preview</p>
                        <h2 className="mt-1.5 font-serif text-xl leading-tight text-obsidian sm:mt-2 sm:text-3xl">{preview.displayName}</h2>
                        <p className="mt-1.5 font-sans text-[13px] text-slate sm:mt-2">
                            /products/{preview.slug}
                        </p>
                        <dl className="mt-3 space-y-2 text-sm sm:mt-4">
                            <div className="flex justify-between gap-4">
                                <dt className="text-slate">Capacity</dt>
                                <dd className="font-medium text-obsidian">{preview.capacity}</dd>
                            </div>
                            <div className="flex justify-between gap-4">
                                <dt className="text-slate">Neck</dt>
                                <dd className="font-medium text-obsidian">{draft.neckThreadSize || "—"}</dd>
                            </div>
                            <div className="flex justify-between gap-4">
                                <dt className="text-slate">Applicator</dt>
                                <dd className="font-medium text-obsidian">{draft.applicator}</dd>
                            </div>
                            <div className="flex justify-between gap-4">
                                <dt className="text-slate">1-pc price</dt>
                                <dd className="font-medium text-obsidian">{draft.webPrice1pc ? `$${draft.webPrice1pc}` : "—"}</dd>
                            </div>
                        </dl>
                        <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
                            <Badge variant="outline" className="border-champagne/70 bg-bone text-[10px] uppercase tracking-[0.14em] text-gold-dim">
                                Quote-only until Shopify sync
                            </Badge>
                            {preview.paperDollEligible ? (
                                <Badge variant="outline" className="border-champagne/70 bg-bone text-[10px] uppercase tracking-[0.14em] text-gold-dim">
                                    Paper-doll eligible
                                </Badge>
                            ) : null}
                        </div>
                    </CardContent>
                </Card>
                {state.slug ? (
                    <Card className="border-champagne/50 bg-white shadow-none">
                        <CardContent className="px-5 py-4 text-sm leading-6 text-slate">
                            Created {state.websiteSku}.{" "}
                            <Link href={`/products/${state.slug}`} className="font-medium text-obsidian underline decoration-champagne underline-offset-4 hover:text-muted-gold">
                                Open the product page
                            </Link>
                            {preview.paperDollEligible ? (
                                <>
                                    {" "}or continue plates in the{" "}
                                    <Link href="/team/asset-ledger" className="font-medium text-obsidian underline decoration-champagne underline-offset-4 hover:text-muted-gold">
                                        Visual Asset Ledger
                                    </Link>
                                    .
                                </>
                            ) : null}
                        </CardContent>
                    </Card>
                ) : null}
            </aside>

            <div className="space-y-6 lg:col-start-1 lg:row-start-1">
                <nav
                    aria-label="Create product sections"
                    data-create-product-jumps
                    className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden"
                >
                    {CREATE_PRODUCT_SECTIONS.map((section) => (
                        <a
                            key={section.id}
                            href={`#create-${section.id}`}
                            className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-champagne/70 bg-linen px-3 font-sans text-[13px] text-obsidian"
                        >
                            {section.label}
                        </a>
                    ))}
                </nav>

                {CREATE_PRODUCT_SECTIONS.map((section) => (
                    <Card
                        key={section.id}
                        id={`create-${section.id}`}
                        className="scroll-mt-4 border-champagne/50 bg-linen shadow-[0_18px_45px_rgba(29,29,31,0.04)]"
                    >
                        <CardContent className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-dim">
                                    PDP · {section.pdpAnchor}
                                </p>
                                <h2 className="mt-1 font-serif text-xl font-semibold text-obsidian sm:text-2xl">{section.label}</h2>
                                <p className="mt-1 hidden text-sm leading-6 text-slate sm:block">{section.description}</p>
                            </div>

                            {section.id === "identity" ? (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field
                                        label="Display name"
                                        name="displayName"
                                        hint="Product page title."
                                        field={<input id="displayName" name="displayName" className={controlClass} value={draft.displayName} onChange={(event) => set("displayName", event.target.value)} placeholder="Cylinder 9ml Clear" />}
                                    />
                                    <Field
                                        label="Website SKU"
                                        name="websiteSku"
                                        hint="Stable storefront identifier."
                                        field={<input id="websiteSku" name="websiteSku" required className={controlClass} value={draft.websiteSku} onChange={(event) => set("websiteSku", event.target.value)} />}
                                    />
                                    <Field
                                        label="Grace SKU"
                                        name="graceSku"
                                        hint="Defaults to the website SKU if left blank."
                                        field={<input id="graceSku" name="graceSku" className={controlClass} value={draft.graceSku} onChange={(event) => set("graceSku", event.target.value)} />}
                                    />
                                    <Field
                                        label="Item name"
                                        name="itemName"
                                        hint="Variant title shown with the SKU."
                                        field={<input id="itemName" name="itemName" className={controlClass} value={draft.itemName} onChange={(event) => set("itemName", event.target.value)} />}
                                    />
                                    <Field
                                        label="Family"
                                        name="family"
                                        field={(
                                            <select id="family" name="family" className={controlClass} value={draft.family} onChange={(event) => set("family", event.target.value)}>
                                                {CREATE_PRODUCT_FAMILY_OPTIONS.map((family) => (
                                                    <option key={family} value={family}>{family}</option>
                                                ))}
                                            </select>
                                        )}
                                    />
                                    <Field
                                        label="Category"
                                        name="category"
                                        field={(
                                            <select id="category" name="category" className={controlClass} value={draft.category} onChange={(event) => set("category", event.target.value)}>
                                                {CREATE_PRODUCT_CATEGORY_OPTIONS.map((category) => (
                                                    <option key={category} value={category}>{category}</option>
                                                ))}
                                            </select>
                                        )}
                                    />
                                    <div className="sm:col-span-2">
                                        <Field
                                            label="Description"
                                            name="itemDescription"
                                            hint="Highlights copy above the fold on the PDP."
                                            field={<textarea id="itemDescription" name="itemDescription" rows={3} className={cn(controlClass, "h-auto min-h-11 py-2")} value={draft.itemDescription} onChange={(event) => set("itemDescription", event.target.value)} />}
                                        />
                                    </div>
                                    <input type="hidden" name="groupDescription" value={draft.groupDescription || draft.itemDescription} />
                                </div>
                            ) : null}

                            {section.id === "configurator" ? (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field
                                        label="Applicator"
                                        name="applicator"
                                        field={(
                                            <select id="applicator" name="applicator" className={controlClass} value={draft.applicator} onChange={(event) => set("applicator", event.target.value as typeof draft.applicator)}>
                                                {STAFF_APPLICATOR_VALUES.map((applicator) => (
                                                    <option key={applicator} value={applicator}>{applicator}</option>
                                                ))}
                                            </select>
                                        )}
                                    />
                                    <Field
                                        label="Glass color"
                                        name="color"
                                        field={(
                                            <select id="color" name="color" className={controlClass} value={draft.color} onChange={(event) => set("color", event.target.value)}>
                                                {CREATE_PRODUCT_COLOR_OPTIONS.map((color) => (
                                                    <option key={color} value={color}>{color}</option>
                                                ))}
                                            </select>
                                        )}
                                    />
                                    <Field label="Cap color" name="capColor" field={<input id="capColor" name="capColor" className={controlClass} value={draft.capColor} onChange={(event) => set("capColor", event.target.value)} />} />
                                    <Field label="Cap style" name="capStyle" field={<input id="capStyle" name="capStyle" className={controlClass} value={draft.capStyle} onChange={(event) => set("capStyle", event.target.value)} />} />
                                    <Field label="Trim color" name="trimColor" field={<input id="trimColor" name="trimColor" className={controlClass} value={draft.trimColor} onChange={(event) => set("trimColor", event.target.value)} />} />
                                    <Field label="Component profile" name="componentProfile" field={<input id="componentProfile" name="componentProfile" className={controlClass} value={draft.componentProfile} onChange={(event) => set("componentProfile", event.target.value)} />} />
                                    <Field
                                        label="Ball material"
                                        name="ballMaterial"
                                        hint="Used when the applicator is a roller."
                                        field={<input id="ballMaterial" name="ballMaterial" className={controlClass} value={draft.ballMaterial} onChange={(event) => set("ballMaterial", event.target.value)} />}
                                    />
                                    <Field label="Stock status" name="stockStatus" field={<input id="stockStatus" name="stockStatus" className={controlClass} value={draft.stockStatus} onChange={(event) => set("stockStatus", event.target.value)} />} />
                                </div>
                            ) : null}

                            {section.id === "specs" ? (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field label="Capacity (ml)" name="capacityMl" field={<input id="capacityMl" name="capacityMl" type="number" min="0.1" step="0.1" className={controlClass} value={draft.capacityMl} onChange={(event) => set("capacityMl", Number(event.target.value))} />} />
                                    <Field
                                        label="Neck thread size"
                                        name="neckThreadSize"
                                        hint="Shown on the card and in the specs table."
                                        field={<input id="neckThreadSize" name="neckThreadSize" className={controlClass} value={draft.neckThreadSize} onChange={(event) => set("neckThreadSize", event.target.value)} />}
                                    />
                                    <Field label="Collection" name="bottleCollection" field={<input id="bottleCollection" name="bottleCollection" className={controlClass} value={draft.bottleCollection} onChange={(event) => set("bottleCollection", event.target.value)} />} />
                                    <Field label="Height with cap" name="heightWithCap" field={<input id="heightWithCap" name="heightWithCap" className={controlClass} value={draft.heightWithCap} onChange={(event) => set("heightWithCap", event.target.value)} />} />
                                    <Field label="Height without cap" name="heightWithoutCap" field={<input id="heightWithoutCap" name="heightWithoutCap" className={controlClass} value={draft.heightWithoutCap} onChange={(event) => set("heightWithoutCap", event.target.value)} />} />
                                    <Field label="Diameter" name="diameter" field={<input id="diameter" name="diameter" className={controlClass} value={draft.diameter} onChange={(event) => set("diameter", event.target.value)} />} />
                                    <Field label="Bottle weight (g)" name="bottleWeightG" field={<input id="bottleWeightG" name="bottleWeightG" className={controlClass} value={draft.bottleWeightG} onChange={(event) => set("bottleWeightG", event.target.value)} />} />
                                    <Field label="Case quantity" name="caseQuantity" field={<input id="caseQuantity" name="caseQuantity" className={controlClass} value={draft.caseQuantity} onChange={(event) => set("caseQuantity", event.target.value)} />} />
                                </div>
                            ) : null}

                            {section.id === "pricing" ? (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field
                                        label="Price per piece"
                                        name="webPrice1pc"
                                        hint="Required. This is the PDP 1-pc price."
                                        field={<input id="webPrice1pc" name="webPrice1pc" required inputMode="decimal" className={controlClass} value={draft.webPrice1pc} onChange={(event) => set("webPrice1pc", event.target.value)} />}
                                    />
                                    <Field
                                        label="Price at 12 pieces"
                                        name="webPrice12pc"
                                        hint="Optional second rung on the existing volume ladder."
                                        field={<input id="webPrice12pc" name="webPrice12pc" inputMode="decimal" className={controlClass} value={draft.webPrice12pc} onChange={(event) => set("webPrice12pc", event.target.value)} />}
                                    />
                                </div>
                            ) : null}

                            {section.id === "imagery" ? (
                                <div className="grid gap-5">
                                    <aside
                                        data-product-image-spec
                                        className="rounded-md border border-champagne/70 bg-bone px-4 py-4"
                                    >
                                        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-dim">
                                            Product page photo spec
                                        </p>
                                        <p className="mt-1 text-[12px] leading-5 text-slate">
                                            Use this frame so the gallery, catalog card, and paper-doll stage stay aligned.
                                        </p>
                                        <dl className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
                                            <div>
                                                <dt className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-gold-dim">Aspect ratio</dt>
                                                <dd className="mt-0.5 font-medium text-obsidian">{PRODUCT_IMAGE_SPEC.aspectLabel}</dd>
                                            </div>
                                            <div>
                                                <dt className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-gold-dim">Preferred size</dt>
                                                <dd className="mt-0.5 font-medium text-obsidian">{PRODUCT_IMAGE_SPEC.preferredPixels} px</dd>
                                            </div>
                                            <div>
                                                <dt className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-gold-dim">File limit</dt>
                                                <dd className="mt-0.5 font-medium text-obsidian">{PRODUCT_IMAGE_SPEC.maxFileLabel}</dd>
                                            </div>
                                            <div>
                                                <dt className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-gold-dim">Formats</dt>
                                                <dd className="mt-0.5 font-medium text-obsidian">{PRODUCT_IMAGE_SPEC.formatsLabel}</dd>
                                            </div>
                                        </dl>
                                    </aside>
                                    <ProductImageDropField
                                        id="heroImageUrl"
                                        name="heroImageUrl"
                                        label="Hero image"
                                        hint="Catalog card and PDP fallback. Upload a photo here — Shopify or Convex URLs also work. Not Sanity."
                                        value={draft.heroImageUrl}
                                        onChange={(url) => set("heroImageUrl", url)}
                                        createUploadUrl={createProductImageUploadUrlAction}
                                        resolveUrl={resolveProductImageUrlAction}
                                    />
                                    <ProductImageDropField
                                        id="imageUrl"
                                        name="imageUrl"
                                        label="Cap-on / default gallery"
                                        hint="The primary variant image on the product page."
                                        value={draft.imageUrl}
                                        onChange={(url) => set("imageUrl", url)}
                                        createUploadUrl={createProductImageUploadUrlAction}
                                        resolveUrl={resolveProductImageUrlAction}
                                    />
                                    <ProductImageDropField
                                        id="imageUrlCapOff"
                                        name="imageUrlCapOff"
                                        label="Cap-off image"
                                        hint="Secondary gallery view, without the closure."
                                        value={draft.imageUrlCapOff}
                                        onChange={(url) => set("imageUrlCapOff", url)}
                                        createUploadUrl={createProductImageUploadUrlAction}
                                        resolveUrl={resolveProductImageUrlAction}
                                    />
                                    {preview.paperDollEligible ? (
                                        <Field
                                            label="Paper-doll family key"
                                            name="paperDollFamilyKey"
                                            hint="Optional. When this family already has plates, the SKU can join that kit after the Asset Ledger publishes it."
                                            field={<input id="paperDollFamilyKey" name="paperDollFamilyKey" className={controlClass} value={draft.paperDollFamilyKey} onChange={(event) => set("paperDollFamilyKey", event.target.value)} placeholder="CYL-9ML" />}
                                        />
                                    ) : (
                                        <input type="hidden" name="paperDollFamilyKey" value="" />
                                    )}
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>
                ))}

                {state.error ? (
                    <p className="rounded-md border border-red-200 bg-white px-4 py-3 text-sm text-red-700" role="alert">
                        {state.error}
                    </p>
                ) : null}

                <div
                    data-create-product-cta
                    className="sticky bottom-0 z-10 -mx-4 flex flex-wrap gap-3 border-t border-champagne/50 bg-bone/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] backdrop-blur supports-[backdrop-filter]:bg-bone/85 sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
                >
                    <Button type="submit" disabled={pending} className="min-h-11 rounded-md border border-obsidian bg-obsidian px-5 text-linen hover:border-muted-gold hover:bg-muted-gold hover:text-obsidian lg:min-h-10">
                        {pending ? "Creating…" : "Create product"}
                    </Button>
                    <Button asChild variant="outline" className="min-h-11 rounded-md border-champagne bg-bone text-obsidian lg:min-h-10">
                        <Link href={previewMode ? "/team?preview=1" : "/team"}>Back to Team Hub</Link>
                    </Button>
                </div>
            </div>
        </form>
    );
}
