import type { Metadata } from "next";
import { Suspense } from "react";
import FormPage from "@/components/FormPage";
import { SITE_URL } from "@/lib/seo";

const FIELDS = [
    { name: "name", label: "Full Name", type: "text" as const, required: true, placeholder: "Jane Smith" },
    { name: "email", label: "Email", type: "email" as const, required: true, placeholder: "jane@yourbrand.com" },
    { name: "company", label: "Company / Brand", type: "text" as const, required: true, placeholder: "Your Brand Co." },
    { name: "phone", label: "Phone", type: "tel" as const, placeholder: "+1 (555) 000-0000" },
    { name: "products", label: "Products & Specifications", type: "textarea" as const, required: true, placeholder: "List the products, sizes, colors, and closure types you need..." },
    { name: "quantities", label: "Quantities per SKU", type: "text" as const, required: true, placeholder: "e.g. 5,000 per SKU, or 10,000+ total" },
    { name: "message", label: "Project Details", type: "textarea" as const, placeholder: "Launch timeline, recurring order frequency, delivery location..." },
];

export const metadata: Metadata = {
    title: { absolute: "Request a Quote | Best Bottles Wholesale Glass Packaging" },
    description:
        "Request volume pricing for wholesale glass bottles, jars, closures, applicators, and custom packaging from Best Bottles.",
    alternates: { canonical: `${SITE_URL}/request-quote` },
};

export default function RequestQuotePage() {
    return (
        <Suspense>
            <FormPage
                formType="quote"
                title="Request a Quote"
                subtitle="Volume pricing and wholesale accounts — we tailor solutions to fit your brand's needs and budget."
                fields={FIELDS}
            />
        </Suspense>
    );
}
