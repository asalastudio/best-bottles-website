import { describe, expect, it } from "vitest";
import {
    graceConversationDisposition,
    gracePushEligiblePathname,
    resolveGraceSurface,
} from "@/lib/grace/pushLayout";

describe("Grace parallel workspace layout", () => {
    it("pushes the storefront on a wide desktop while Grace stays open", () => {
        expect(resolveGraceSurface({
            isOpen: true,
            viewportWidth: 1440,
            ownsViewport: false,
            pushEligible: true,
        })).toMatchObject({
            mode: "push",
            showBackdrop: false,
            contentIsInset: true,
        });
    });

    it("uses an overlay sheet on smaller screens instead of compressing the storefront", () => {
        expect(resolveGraceSurface({
            isOpen: true,
            viewportWidth: 900,
            ownsViewport: false,
            pushEligible: true,
        })).toMatchObject({
            mode: "overlay",
            showBackdrop: true,
            contentIsInset: false,
        });
    });

    it("does not push routes that already belong to Grace", () => {
        expect(resolveGraceSurface({
            isOpen: true,
            viewportWidth: 1440,
            ownsViewport: true,
            pushEligible: true,
        }).mode).toBe("owned");
    });

    it("keeps Grace over the homepage but docks her on shopping routes", () => {
        expect(gracePushEligiblePathname("/")).toBe(false);
        expect(gracePushEligiblePathname("/about")).toBe(false);
        expect(gracePushEligiblePathname("/catalog")).toBe(true);
        expect(gracePushEligiblePathname("/catalog/cylinder")).toBe(true);
        expect(gracePushEligiblePathname("/products/cylinder-9ml-17-415")).toBe(true);

        expect(resolveGraceSurface({
            isOpen: true,
            viewportWidth: 1440,
            ownsViewport: false,
            pushEligible: false,
        }).mode).toBe("overlay");
    });

    it("preserves conversation state when the drawer closes and resets only for New chat", () => {
        expect(graceConversationDisposition("close")).toBe("preserve");
        expect(graceConversationDisposition("navigate")).toBe("preserve");
        expect(graceConversationDisposition("new-chat")).toBe("reset");
    });
});
