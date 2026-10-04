import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FAQ_POLICY_ENTRIES, FAQ_POLICY_SOURCE } from "../src/lib/faqPolicy";
import ResourcesPage from "../src/app/resources/page";
import ShippingReturnsPage from "../src/app/shipping-returns/page";
import RequestSamplePage from "../src/app/request-sample/page";

vi.mock("../src/components/Navbar", () => ({ default: () => null }));
vi.mock("../src/components/Footer", () => ({ default: () => null }));
vi.mock("../src/components/FormPage", () => ({ default: ({ subtitle }: { subtitle: string }) => <p>{subtitle}</p> }));
const paragraph = (text: string) => renderToStaticMarkup(<p>{text}</p>).slice(3, -4);

describe("rendered FAQ policy parity", () => {
    it("renders approved answers and only those answers in FAQ structured data", () => {
        const html = renderToStaticMarkup(<ResourcesPage />);
        const json = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
        expect(json.mainEntity.map((entry: { acceptedAnswer: { text: string } }) => entry.acceptedAnswer.text))
            .toEqual(FAQ_POLICY_ENTRIES.map((entry) => entry.a));
        for (const entry of FAQ_POLICY_ENTRIES) expect(html).toContain(paragraph(entry.a));
        expect(html).toContain(FAQ_POLICY_SOURCE.url);
        expect(html).not.toContain("approximately $50");
        expect(html).not.toContain("ship within 3-5");
    });

    it("renders shipping, returns, refund, damage, and missing terms from the same contract", () => {
        const html = renderToStaticMarkup(<ShippingReturnsPage />);
        for (const id of ["lead-times", "same-day", "pickup", "returns", "refund-timing", "damaged-defective", "missing-items", "order-changes", "samples"])
            expect(html).toContain(paragraph(FAQ_POLICY_ENTRIES.find((entry) => entry.id === id)!.a));
        expect(html).not.toContain("within 30 days");
        expect(html).not.toContain("clearance items");
        expect(html).toContain(FAQ_POLICY_SOURCE.url);
    });

    it("keeps the sample inquiry page consistent with the emailed verified-business process", () => {
        expect(renderToStaticMarkup(<RequestSamplePage />))
            .toContain(paragraph(FAQ_POLICY_ENTRIES.find((entry) => entry.id === "samples")!.a));
    });
});
