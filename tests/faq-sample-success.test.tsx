// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import RequestSamplePage from "../src/app/request-sample/page";

const { submit, params } = vi.hoisted(() => ({
    submit: vi.fn(),
    params: new URLSearchParams({ name: "Sample Buyer", email: "buyer@example.test", products: "Verified sample item" }),
}));
vi.mock("convex/react", () => ({ useMutation: () => submit }));
vi.mock("next/navigation", () => ({ useSearchParams: () => params }));
vi.mock("../src/components/Navbar", () => ({ default: () => null }));
vi.mock("../src/components/Footer", () => ({ default: () => null }));
// Keep the actual FormPage: this regression must submit through handleSubmit
// and render its real success branch, not a mock of the page subtitle.
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    sessionStorage.clear();
    submit.mockReset().mockResolvedValue("inquiry_saved");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    sessionStorage.clear();
    vi.unstubAllGlobals();
});

it("acknowledges a submitted sample inquiry without an unsupported response-time promise", async () => {
    await act(async () => root.render(<RequestSamplePage />));
    expect(container.textContent).toContain("Customers with verified businesses");
    const form = container.querySelector("form")!;
    expect(form).not.toBeNull();
    await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(submit).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({
        formType: "sample", name: "Sample Buyer", email: "buyer@example.test", source: "website",
    }));
    expect(container.querySelector("h1")?.textContent).toBe("Thank You");
    expect(container.querySelector("p")?.textContent).toBe("We've received your sample inquiry.");
    expect(container.textContent).not.toMatch(/1[-–]2|business days|reach out|shortly|within/i);
    expect(container.querySelector("form")).toBeNull();
});
