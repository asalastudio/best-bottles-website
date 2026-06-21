import type { Metadata } from "next";
import { Suspense } from "react";
import FormPage from "@/components/FormPage";
import { SITE_URL } from "@/lib/seo";

const FIELDS = [
    { name: "name", label: "Full Name", type: "text" as const, required: true, placeholder: "Jane Smith" },
    { name: "email", label: "Email", type: "email" as const, required: true, placeholder: "jane@yourbrand.com" },
    { name: "company", label: "Company / Brand", type: "text" as const, placeholder: "Your Brand Co." },
    { name: "phone", label: "Phone", type: "tel" as const, placeholder: "+1 (555) 000-0000" },
    { name: "message", label: "How Can We Help?", type: "textarea" as const, required: true, placeholder: "Questions about products, orders, compatibility, custom packaging, or anything else..." },
];

export const metadata: Metadata = {
    title: "Contact Best Bottles | Wholesale Packaging Support",
    description:
        "Contact the Best Bottles team for product questions, compatibility help, quotes, samples, and wholesale glass packaging support.",
    alternates: { canonical: `${SITE_URL}/contact` },
};

export default function ContactPage() {
    return (
        <Suspense>
            <FormPage
                formType="contact"
                title="Get in Touch"
                subtitle="Questions, feedback, or just want to say hello — we'd love to hear from you. Our team typically responds within one business day."
                fields={FIELDS}
            />
        </Suspense>
    );
}
