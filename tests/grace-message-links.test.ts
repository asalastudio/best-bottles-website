import { describe, expect, it } from "vitest";
import { graceMessageHasLinks, splitGraceMessageLinks } from "../src/lib/grace/messageLinks";

describe("links inside Grace's chat text", () => {
    it("turns markdown product links into link segments and keeps the prose", () => {
        const text = "Two options: [Cylinder 9 ml amber](/products/cylinder-9ml-amber-17-415-rollon?sku=GBCyl9AmbMtlRollGl) and [Elegant 15 ml](/products/elegant-15ml-frosted-13-415-rollon?sku=GBElgFrst15MtlRollGlSh). Shall I compare?";
        expect(splitGraceMessageLinks(text)).toEqual([
            { type: "text", text: "Two options: " },
            { type: "link", label: "Cylinder 9 ml amber", href: "/products/cylinder-9ml-amber-17-415-rollon?sku=GBCyl9AmbMtlRollGl" },
            { type: "text", text: " and " },
            { type: "link", label: "Elegant 15 ml", href: "/products/elegant-15ml-frosted-13-415-rollon?sku=GBElgFrst15MtlRollGlSh" },
            { type: "text", text: ". Shall I compare?" },
        ]);
        expect(graceMessageHasLinks(text)).toBe(true);
    });

    it("links bare site paths Grace typed, without their trailing punctuation", () => {
        expect(splitGraceMessageLinks("Open /products/vial-1ml-clear-plug?sku=GBVial1Clr, or browse /catalog?search=1ml.")).toEqual([
            { type: "text", text: "Open " },
            { type: "link", label: "/products/vial-1ml-clear-plug?sku=GBVial1Clr", href: "/products/vial-1ml-clear-plug?sku=GBVial1Clr" },
            { type: "text", text: ", or browse " },
            { type: "link", label: "/catalog?search=1ml", href: "/catalog?search=1ml" },
            { type: "text", text: "." },
        ]);
        expect(splitGraceMessageLinks("Quotes go through /request-quote and kits through /matrix")).toEqual([
            { type: "text", text: "Quotes go through " },
            { type: "link", label: "/request-quote", href: "/request-quote" },
            { type: "text", text: " and kits through " },
            { type: "link", label: "/matrix", href: "/matrix" },
        ]);
    });

    it("leaves external, protocol-relative and unknown paths as text", () => {
        expect(splitGraceMessageLinks("See [docs](https://example.com/x) or [bad](//evil.example) or /unknown/path")).toEqual([
            { type: "text", text: "See [docs](https://example.com/x) or [bad](//evil.example) or /unknown/path" },
        ]);
        expect(graceMessageHasLinks("Plain answer with a 13-415 neck and 9/10 ml sizes.")).toBe(false);
        expect(splitGraceMessageLinks("")).toEqual([]);
    });
});
