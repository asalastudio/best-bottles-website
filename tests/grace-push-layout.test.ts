import { describe, expect, it } from "vitest";
import {
    graceConversationDisposition,
    gracePushEligiblePathname,
    resolveGraceSurface,
} from "@/lib/grace/pushLayout";

describe("Grace parallel workspace layout", () => {
    it("pushes only when the measured content remaining beside the resolved drawer is safe", () => {
        expect(resolveGraceSurface({
            isOpen: true,
            viewportWidth: 1440,
            drawerWidth: 480,
            minimumContentWidth: 920,
            ownsViewport: false,
            pushEligible: true,
        })).toMatchObject({
            mode: "push",
            showBackdrop: false,
            contentIsInset: true,
        });
    });

    it("uses an overlay before the two-panel PDP drops below its safe content width", () => {
        expect(resolveGraceSurface({
            isOpen: true,
            viewportWidth: 1399,
            drawerWidth: 480,
            minimumContentWidth: 920,
            ownsViewport: false,
            pushEligible: true,
        })).toMatchObject({
            mode: "overlay",
            showBackdrop: true,
            contentIsInset: false,
        });
    });

    it("reports the available content width from the measured drawer, not an old viewport breakpoint", () => {
        expect(resolveGraceSurface({
            isOpen: true,
            viewportWidth: 1400,
            drawerWidth: 440,
            minimumContentWidth: 920,
            ownsViewport: false,
            pushEligible: true,
        })).toMatchObject({ mode: "push", availableContentWidth: 960 });
    });

    it("does not push routes that already belong to Grace", () => {
        expect(resolveGraceSurface({
            isOpen: true,
            viewportWidth: 1440,
            drawerWidth: 480,
            minimumContentWidth: 920,
            ownsViewport: true,
            pushEligible: true,
        }).mode).toBe("owned");
    });

    it("keeps Grace over the homepage but docks her on shopping routes", () => {
        expect(gracePushEligiblePathname("/")).toBe(false);
        expect(gracePushEligiblePathname("/about")).toBe(false);
        expect(gracePushEligiblePathname("/catalog")).toBe(true);
        expect(gracePushEligiblePathname("/catalog/cylinder")).toBe(true);
        expect(gracePushEligiblePathname("/catalog/application/roll-on")).toBe(true);
        expect(gracePushEligiblePathname("/products/cylinder-9ml-17-415")).toBe(true);

        expect(resolveGraceSurface({
            isOpen: true,
            viewportWidth: 1440,
            drawerWidth: 480,
            minimumContentWidth: 920,
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
