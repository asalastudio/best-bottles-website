"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Send, CheckCircle2, Loader2 } from "@/components/icons";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

type FormType = "sample" | "quote" | "contact" | "newsletter";

type RfqLineItem = {
    sku: string;
    websiteSku?: string;
    variantId?: string;
    productGroupSlug?: string;
    name: string;
    quantity: number;
    unitPrice?: number | null;
    notes?: string;
    family?: string;
    capacity?: string;
    color?: string;
    applicator?: string | null;
    capColor?: string | null;
    neckThreadSize?: string | null;
};

interface FormField {
    name: string;
    label: string;
    type: "text" | "email" | "tel" | "textarea";
    required?: boolean;
    placeholder?: string;
}

interface FormPageProps {
    formType: FormType;
    title: string;
    subtitle: string;
    fields: FormField[];
}

export default function FormPage({ formType, title, subtitle, fields }: FormPageProps) {
    const searchParams = useSearchParams();
    const submitForm = useMutation(api.forms.submit);
    const [values, setValues] = useState<Record<string, string>>(() => {
        const prefilled: Record<string, string> = {};
        fields.forEach((f) => {
            const param = searchParams.get(f.name);
            if (param) prefilled[f.name] = param;
        });
        return prefilled;
    });
    const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [rfqLineItems, setRfqLineItems] = useState<RfqLineItem[]>([]);
    const hasQuoteContext = formType === "quote" && !!(values.products || values.quantities);

    // React to URL searchParam changes (e.g. when Grace navigates to this page with pre-filled params)
    useEffect(() => {
        const prefilled: Record<string, string> = {};
        fields.forEach((f) => {
            const param = searchParams.get(f.name);
            if (param) prefilled[f.name] = param;
        });
        if (Object.keys(prefilled).length > 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setValues((v) => ({ ...v, ...prefilled }));
        }
    }, [searchParams, fields]);

    useEffect(() => {
        if (formType !== "quote") return;
        let cancelled = false;
        try {
            const raw = sessionStorage.getItem("bb-rfq-line-items");
            if (!raw) return;
            const parsed = JSON.parse(raw) as RfqLineItem[];
            if (!Array.isArray(parsed) || parsed.length === 0) return;
            const normalized = parsed
                .filter((item) => item?.sku && item?.name)
                .map((item) => ({
                    ...item,
                    quantity: Math.max(1, Number(item.quantity) || 1),
                }));
            if (normalized.length === 0) return;
            window.setTimeout(() => {
                if (cancelled) return;
                setRfqLineItems(normalized);
                setValues((current) => ({
                    ...current,
                    products: current.products || normalized.map((item) => `${item.name} (SKU: ${item.sku ?? item.websiteSku})`).join("\n"),
                    quantities: current.quantities || normalized.map((item) => `${item.sku ?? item.websiteSku}: ${item.quantity}`).join("\n"),
                }));
            }, 0);
        } catch {
            // Ignore malformed draft data; the legacy text fields remain usable.
        }
        return () => { cancelled = true; };
    }, [formType]);

    // React to Grace in-place pre-fill when already on this form page
    useEffect(() => {
        const handler = (e: Event) => {
            const { formType: targetType, fields: prefilled } = (e as CustomEvent<{ formType: string; fields: Record<string, string> }>).detail;
            if (targetType === formType) {
                setValues((v) => ({ ...v, ...prefilled }));
            }
        };
        window.addEventListener("grace:prefillForm", handler);
        return () => window.removeEventListener("grace:prefillForm", handler);
    }, [formType]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setStatus("submitting");
        setErrorMsg("");
        const structuredProducts = rfqLineItems.map((item) => `${item.name} (SKU: ${item.sku ?? item.websiteSku})`).join("\n");
        const structuredQuantities = rfqLineItems.map((item) => `${item.sku ?? item.websiteSku}: ${item.quantity}${item.notes ? ` - ${item.notes}` : ""}`).join("\n");

        try {
            await submitForm({
                formType,
                name: values.name || undefined,
                email: values.email || "",
                company: values.company || undefined,
                phone: values.phone || undefined,
                message: values.message || undefined,
                products: values.products || structuredProducts || undefined,
                quantities: values.quantities || structuredQuantities || undefined,
                rfqLineItems: rfqLineItems.length > 0 ? rfqLineItems : undefined,
                source: "website",
            });
            setStatus("success");
        } catch (err) {
            console.error("[Form] Submit error:", err);
            setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
            setStatus("error");
        }
    };

    const renderField = (field: FormField) => (
        <div key={field.name}>
            <label
                htmlFor={field.name}
                className="block text-xs font-bold uppercase tracking-wider text-obsidian/70 mb-1.5"
            >
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {field.type === "textarea" ? (
                <textarea
                    id={field.name}
                    name={field.name}
                    required={field.required}
                    placeholder={field.placeholder}
                    value={values[field.name] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                    rows={4}
                    className="w-full bg-white border border-champagne/60 rounded-lg px-4 py-3 text-sm text-obsidian placeholder-slate/40 focus:outline-none focus:border-muted-gold focus:ring-2 focus:ring-muted-gold/15 transition-all resize-none"
                />
            ) : (
                <input
                    id={field.name}
                    name={field.name}
                    type={field.type}
                    required={field.required}
                    placeholder={field.placeholder}
                    value={values[field.name] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                    className="w-full bg-white border border-champagne/60 rounded-lg px-4 py-3 text-sm text-obsidian placeholder-slate/40 focus:outline-none focus:border-muted-gold focus:ring-2 focus:ring-muted-gold/15 transition-all"
                />
            )}
        </div>
    );

    const quoteFields = fields.filter((field) => field.name === "products" || field.name === "quantities");
    const contactFields = fields.filter((field) => field.name !== "products" && field.name !== "quantities");
    const updateRfqLineItem = (index: number, patch: Partial<RfqLineItem>) => {
        setRfqLineItems((items) => items.map((item, i) => i === index ? { ...item, ...patch } : item));
    };

    if (status === "success") {
        return (
            <div className="min-h-screen bg-bone flex items-center justify-center px-6">
                <div className="max-w-md text-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h1 className="font-serif text-3xl text-obsidian mb-3">Thank You</h1>
                    <p className="text-slate text-sm leading-relaxed mb-8">
                        {formType === "sample"
                            ? "We've received your sample request. Our team will review it and get back to you within 1-2 business days."
                            : formType === "quote"
                            ? "Your quote request has been submitted. Our sales team will prepare a custom quote and reach out shortly."
                            : "Your message has been received. We'll get back to you as soon as possible."}
                    </p>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-obsidian text-bone text-sm font-semibold tracking-wide uppercase hover:bg-muted-gold transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Home
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-bone">
            <div className="max-w-[640px] mx-auto px-6 pt-32 pb-20">
                <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 text-sm text-slate hover:text-obsidian transition-colors mb-8"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </Link>

                <h1 className="font-serif text-4xl lg:text-5xl text-obsidian mb-3">{title}</h1>
                <p className="text-slate text-sm leading-relaxed mb-10 max-w-md">{subtitle}</p>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {formType === "quote" ? (
                        <>
                            <section className="rounded-lg border border-champagne/60 bg-white px-4 py-4">
                                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-gold mb-1">
                                    Quote Review
                                </p>
                                <h2 className="font-serif text-xl text-obsidian mb-2">Confirm products and quantities</h2>
                                <p className="text-xs text-slate leading-relaxed mb-5">
                                    {hasQuoteContext
                                        ? "We carried over your product details. Edit anything here before sending the request."
                                        : "Add the products, SKUs, finishes, and quantities you want priced."}
                                </p>
                                {rfqLineItems.length > 0 && (
                                    <div className="mb-5 space-y-3">
                                        {rfqLineItems.map((item, index) => (
                                            <div key={`${item.sku}-${index}`} className="rounded-md border border-champagne/60 bg-bone/50 p-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-obsidian leading-snug">{item.name}</p>
                                                        <p className="mt-1 text-[10px] uppercase tracking-wider text-slate font-mono">
                                                            SKU {item.sku ?? item.websiteSku}
                                                        </p>
                                                        <p className="mt-1 text-xs text-slate">
                                                            {[item.family, item.capacity, item.color, item.applicator, item.capColor].filter(Boolean).join(" · ")}
                                                        </p>
                                                    </div>
                                                    <input
                                                        aria-label={`Quantity for ${item.name}`}
                                                        type="number"
                                                        min={1}
                                                        value={item.quantity}
                                                        onChange={(e) => updateRfqLineItem(index, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                                                        className="w-20 rounded-md border border-champagne/60 bg-white px-3 py-2 text-sm text-obsidian"
                                                    />
                                                </div>
                                                <textarea
                                                    aria-label={`Notes for ${item.name}`}
                                                    placeholder="Line item notes, target price, finish substitutions..."
                                                    value={item.notes ?? ""}
                                                    onChange={(e) => updateRfqLineItem(index, { notes: e.target.value })}
                                                    rows={2}
                                                    className="mt-3 w-full resize-none rounded-md border border-champagne/60 bg-white px-3 py-2 text-xs text-obsidian placeholder-slate/40 focus:outline-none focus:border-muted-gold focus:ring-2 focus:ring-muted-gold/15"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="space-y-5">
                                    {quoteFields.map(renderField)}
                                </div>
                            </section>

                            <section className="pt-4">
                                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-gold mb-4">
                                    Contact Details
                                </p>
                                <div className="space-y-5">
                                    {contactFields.map(renderField)}
                                </div>
                            </section>
                        </>
                    ) : (
                        fields.map(renderField)
                    )}

                    {status === "error" && errorMsg && (
                        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                            {errorMsg}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={status === "submitting"}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-obsidian text-bone text-sm font-semibold tracking-wide uppercase hover:bg-muted-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {status === "submitting" ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                Submit
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
