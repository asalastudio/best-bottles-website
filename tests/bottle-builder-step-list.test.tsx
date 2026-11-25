// @vitest-environment jsdom
/**
 * Build Your Bottle as one list of five choices (Jordan, 24 Nov 2026: "find a better way to make the builder more
 * user-friendly so that it's explicitly clear of the natural flow"), and its first screen as groups of outline
 * icons in place of bottle photographs ("we can make a group of them: 15, 30, and 60, but in the nice icon").
 */
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FamilyChooser from "@/components/bottle-builder/FamilyChooser";
import type { BuilderFamilyPreview } from "@/lib/bottle-builder/family-previews";
import type { BuilderBody } from "@/lib/bottle-builder/model";
import { closeUpStyle, topWindow } from "@/lib/bottle-builder/top-close-up";
import { familyIconGroup, familySizeRange, familyTileOutline, steppedHeights } from "@/lib/catalog/family-icon-group";
import traced from "@/lib/catalog/family-shape-paths.generated.json";

const subpaths = (d: string) => d.split("M").length - 1;
const numbers = (d: string) => (d.match(/-?\d+\.\d+/g) ?? []).map(Number);

describe("family icon groups", () => {
    it("draws the family's outline once per size, side by side on one shelf", () => {
        const one = familyIconGroup("Boston Round", [1]);
        const three = familyIconGroup("Boston Round", [.72, .83, 1]);
        expect(subpaths(one)).toBe(1);
        expect(subpaths(three)).toBe(3);
        // Every icon stands on the shelf (y = 78) and the group stays inside the 100-unit tile.
        const ys = numbers(three).filter((_, index) => index % 2 === 1), xs = numbers(three).filter((_, index) => index % 2 === 0);
        expect(Math.max(...ys)).toBeCloseTo(78, 1);
        expect(Math.min(...xs)).toBeGreaterThanOrEqual(5);
        expect(Math.max(...xs)).toBeLessThanOrEqual(95);
        expect(Math.min(...ys)).toBeGreaterThanOrEqual(20);
    });

    it("scales each icon to its height: the smallest is the shortest and the last is the tallest", () => {
        const tops = familyIconGroup("Slim", [.57, .79, 1]).split("Z").filter(Boolean).map(part => Math.min(...numbers(part).filter((_, index) => index % 2 === 1)));
        expect(tops[0]).toBeGreaterThan(tops[1]);
        expect(tops[1]).toBeGreaterThan(tops[2]);
        expect(78 - tops[2]).toBeCloseTo(56, 0);
    });

    it("keeps two sizes a few millimetres apart visibly stepped, and never taller than the tile allows", () => {
        expect(steppedHeights([.5, .5, 1])).toEqual([.5, .58, 1]);
        expect(steppedHeights([.98, 1])[0]).toBeLessThan(.95);
        expect(steppedHeights([])).toEqual([1]);
        expect(Math.max(...steppedHeights([.9, .95, 1]))).toBe(1);
    });

    it("fits a wide family's three bottles inside the tile by drawing the group smaller", () => {
        const xs = numbers(familyIconGroup("Circle", [.57, .83, 1])).filter((_, index) => index % 2 === 0);
        expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(86.1);
    });

    it("gives Diva and Diamond the detail that identifies them at tile size, and leaves the menu icons plain", () => {
        expect(subpaths(familyTileOutline("Diva"))).toBeGreaterThan(5);
        expect(subpaths(familyTileOutline("Diamond"))).toBeGreaterThan(3);
        expect(subpaths((traced as Record<string, string>).Diva)).toBe(1);
        expect(subpaths((traced as Record<string, string>).Diamond)).toBe(1);
        // Straight segments only: the packer reads M, L and Z.
        for (const family of ["Diva", "Diamond", "Vial", "Cylinder", "No Such Family"]) expect(familyTileOutline(family)).toMatch(/^[MLZ\d.\s-]+$/);
    });

    it("says the sizes a family comes in", () => {
        expect(familySizeRange([55])).toBe("55 ml");
        expect(familySizeRange([128, 78])).toBe("78 and 128 ml");
        expect(familySizeRange([9, 3.3, 100])).toBe("3.3 to 100 ml");
        expect(familySizeRange([])).toBe("");
    });
});

describe("family screen", () => {
    let root: Root, container: HTMLDivElement;
    beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
    afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
    const body = (family: string, capacityMl: number) => ({ id: `${family}-${capacityMl}`, family, capacityMl, neck: "20-400", profileLabel: family, configurations: [] }) as unknown as BuilderBody;

    it("shows each family as icons, one per size, with its size range; no bottle photographs", async () => {
        const previews: Record<string, BuilderFamilyPreview> = {
            "Boston Round": { family: "Boston Round", groups: 9, options: 9, bodies: [body("Boston Round", 15), body("Boston Round", 30), body("Boston Round", 60)] },
        };
        await act(async () => root.render(<FamilyChooser families={[{ family: "Boston Round", groups: 9 }, { family: "Grace", groups: 1 }]} previews={previews} onChoose={() => {}} stepLabel="Step 1 of 5" />));
        const boston = container.querySelector<HTMLElement>("[data-family='Boston Round']")!;
        expect(boston.querySelector("svg")?.getAttribute("data-family-icons")).toBe("3");
        expect(subpaths(boston.querySelector("path")!.getAttribute("d")!)).toBe(3);
        expect(boston.textContent).toContain("15 to 60 ml");
        expect(boston.getAttribute("aria-label")).toBe("Boston Round, 15 to 60 ml");
        // Until its sizes arrive a family is one icon, and it is still a button the customer can press.
        const grace = container.querySelector<HTMLElement>("[data-family='Grace']")!;
        expect(grace.querySelector("svg")?.getAttribute("data-family-icons")).toBe("1");
        expect(container.querySelector("img")).toBeNull();
        expect(container.textContent).toContain("Choose a shape");
    });
});

describe("the desktop step list", () => {
    const client = readFileSync("src/components/matrix/MatrixClient.tsx", "utf8");
    const css = readFileSync("src/components/bottle-builder/Builder.module.css", "utf8");

    it("is one list of five choices in plain words, each a row that opens, folds and can be changed", () => {
        for (const title of ['title="Shape"', 'title="Size"', 'title="Glass"', 'title="Top"', "title={colorLabel}"]) expect(client).toContain(title);
        expect(client).toMatch(/data-step-state=\{open \? "open" : done \? "done" : locked \? "locked" : "next"\}/);
        expect(client).toMatch(/\{done \? "Change" : "Choose"\}/);
        expect(client).not.toMatch(/Fitment<|"Finish"|Choose Your Glass|Choose Your Fitment|Review Your Bottle/);
    });

    it("has one way forward: choosing an option. No next button, no step bar, no review step of its own", () => {
        expect(client).not.toContain("continueBuild");
        expect(client).not.toContain("nextActionLabel");
        expect(client).not.toContain("styles.stepsBar");
        expect(client).not.toContain("styles.summaryNextAction");
        expect(css).not.toMatch(/\.stepsBar|\.nextStepCue|\.optionAction|\.mobileAction/);
        // Quantity, price and Add to Cart sit under the list as soon as the bottle is complete.
        expect(client).toMatch(/data-builder-order=\{configuration \? "ready" : "waiting"\}/);
        expect(client).toMatch(/\{configuration \? <>[\s\S]*?id="builder-quantity"[\s\S]*?\{addButton\}/);
    });

    it("fills in a step that has one option and says so, instead of skipping it silently", () => {
        expect(client).toMatch(/opening === 2 && !fitment && current\.fitments\.length === 1[\s\S]*?update\(\{ fitment: current\.fitments\[0\], closure: null \}\)/);
        expect(client).toContain("The only glass for this bottle, so it is chosen for you.");
        expect(client).toContain("The only top that fits this bottle, so it is chosen for you.");
        // A filled-in step offers nothing to change.
        expect(client).toMatch(/\{!open && !locked && !auto && <button/);
    });

    it("lists a long family's bottles with what each takes and its neck", () => {
        expect(client).toContain("const manySizes = visibleBodies.length > 6;");
        expect(client).toMatch(/<Option key=\{b\.id\} row=\{manySizes\}/);
        expect(client).toMatch(/<small>\{takes\(b\)\}<\/small><span className=\{styles\.neckBadge\}>\{b\.neck\} neck<\/span>/);
        expect(css).toMatch(/\.sizeList \{[^}]*grid-template-columns: repeat\(2/);
    });

    it("uses the same words on a phone, which keeps its one-step-per-screen shape", () => {
        const phone = readFileSync("src/components/bottle-builder/MobileBuilder.tsx", "utf8");
        expect(phone).toContain('const stages = ["Size", "Glass", "Top", "Color"];');
        expect(phone).toContain('const colorLabel = /Roller|Cap|Reducer/.test(fitment ?? "") ? "Cap color" : "Color";');
        expect(client).toContain('const colorLabel = /Roller|Cap|Reducer/.test(fitment ?? "") ? "Cap color" : "Color";');
        expect(phone).not.toMatch(/Continue to (fitment|finish)|Choose your (fitment|finish)|Select a (fitment|finish)/);
        expect(client).toContain("return <MobileBuilder");
    });

    it("closes in on the neck for a top's photograph, whatever the bottle's size", () => {
        const body = { left: 400, right: 600, top: 300, bottom: 900 };
        const sprayer = { left: 440, right: 560, top: 150, bottom: 320 };
        // From the top of the sprayer (150) to just under the shoulder (300 + 55% of the 200 width), plus a margin.
        const window = topWindow(body, [sprayer], 500);
        expect(window.width).toBeCloseTo(296.4, 1);
        expect(window.height).toBe(window.width);
        expect(window.x + window.width / 2).toBeCloseTo(500, 5);
        expect(window.y + window.height / 2).toBeCloseTo(280, 5);
        // A dropper's pipette reaches the base; the window stays on the neck.
        expect(topWindow(body, [{ ...sprayer, bottom: 880 }], 500)).toEqual(window);
        // A squeeze bulb off to one side widens it, still centred on the bottle.
        const bulb = topWindow(body, [{ left: 250, right: 560, top: 150, bottom: 320 }], 500);
        expect(bulb.width).toBeCloseTo(550, 5);
        expect(bulb.x + bulb.width / 2).toBeCloseTo(500, 5);
        // The whole-bottle drawing is enlarged and shifted so that window fills the tile.
        const style = closeUpStyle({ x: 200, y: 0, width: 600, height: 1000 }, window);
        expect(style).toEqual({ width: "202.429%", aspectRatio: "600 / 1000", left: "-51.215%", transform: "translateY(-13.18%)" });
        expect(client).toMatch(/const closeUp = useMemo\(\(\) => topCloseUp\(config, parts, bodyReference, frame\)/);
    });

    it("shows each top as a photograph of it on this bottle, and never leaves the preview empty", () => {
        expect(client).toMatch(/function TopPhoto\([\s\S]*?previewParts\(config, "fitment"\)[\s\S]*?<FitmentIllustration fitment=\{fitment\} neck=\{neck\} \/>/);
        expect(client).toMatch(/const ghost = !body \? visibleBodies\[/);
        expect(client).toContain("until you pick a size.");
    });
});
