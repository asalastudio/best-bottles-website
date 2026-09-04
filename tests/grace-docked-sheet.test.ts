import { describe, expect, it } from "vitest";
import {
    GRACE_DOCK_KEYBOARD_PX,
    GRACE_DOCK_MIN_CHAT_PX,
    GRACE_DOCK_MIN_DOCKED_CHAT_PX,
    GRACE_DOCK_MIN_PEEK_PX,
    graceDockDetentForKeyboard,
    measureGraceDockedSheet,
    resolveGraceDockedSheetLayout,
} from "@/lib/grace/dockedSheet";

describe("grace docked sheet detents", () => {
    it("stays docked until the visual viewport shrinks by the keyboard threshold", () => {
        expect(graceDockDetentForKeyboard(664, 664)).toBe("docked");
        expect(graceDockDetentForKeyboard(664, 664 - GRACE_DOCK_KEYBOARD_PX)).toBe("docked");
        expect(graceDockDetentForKeyboard(664, 664 - GRACE_DOCK_KEYBOARD_PX - 1)).toBe("expanded");
        expect(graceDockDetentForKeyboard(0, 400)).toBe("docked");
    });

    it("docks under the hero when there is room for the composer", () => {
        const docked = resolveGraceDockedSheetLayout({
            heroBottom: 345,
            viewportHeight: 664,
            detent: "docked",
        });
        expect(docked.top).toBe(345);
        expect(docked.height).toBe(319);
        expect(docked.detent).toBe("docked");
        expect(docked.top + docked.height).toBe(664);
        expect(docked.height).toBeGreaterThanOrEqual(GRACE_DOCK_MIN_DOCKED_CHAT_PX);
    });

    it("expands to a hero peek when the keyboard has claimed the visual viewport", () => {
        const expanded = resolveGraceDockedSheetLayout({
            heroBottom: 345,
            viewportHeight: 360,
            viewportOffsetTop: 0,
            detent: "expanded",
        });
        expect(expanded.top).toBe(GRACE_DOCK_MIN_PEEK_PX);
        expect(expanded.height).toBe(360 - GRACE_DOCK_MIN_PEEK_PX);
        expect(expanded.detent).toBe("expanded");
        expect(expanded.height).toBeGreaterThanOrEqual(GRACE_DOCK_MIN_CHAT_PX - GRACE_DOCK_MIN_PEEK_PX);
    });

    it("never covers the whole viewport and never sits above the visual offset", () => {
        const shifted = resolveGraceDockedSheetLayout({
            heroBottom: 400,
            viewportHeight: 300,
            viewportOffsetTop: 40,
            detent: "expanded",
        });
        expect(shifted.top).toBeGreaterThanOrEqual(40);
        expect(shifted.top).toBeLessThan(40 + 300);
        expect(shifted.top + shifted.height).toBe(340);
    });

    it("picks the expanded detent from a visualViewport-shaped measurement", () => {
        const layout = measureGraceDockedSheet(
            { getBoundingClientRect: () => ({ bottom: 345 }) },
            { layoutHeight: 664, visualHeight: 360, visualOffsetTop: 0 },
        );
        expect(layout.detent).toBe("expanded");
        expect(layout.top).toBe(GRACE_DOCK_MIN_PEEK_PX);
    });
});
