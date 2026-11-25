// @vitest-environment jsdom
/**
 * Build Your Bottle as one list of five choices (Jordan, 24 Nov 2026: "find a better way to make the builder more
 * user-friendly so that it's explicitly clear of the natural flow"). The first screen's icon tiles are PR #440's.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { closeUpStyle, topWindow } from "@/lib/bottle-builder/top-close-up";

describe("the first screen", () => {
    it("is step one of five and speaks in the same words as the list that follows", () => {
        const chooser = readFileSync("src/components/bottle-builder/FamilyChooser.tsx", "utf8");
        expect(chooser).toContain("Choose a shape</h2>");
        expect(chooser).toContain("Size, glass, top and cap color follow, each one fitted to the shape you pick.");
        expect(chooser).not.toMatch(/fitment after this/);
        expect(readFileSync("src/components/matrix/MatrixClient.tsx", "utf8")).toContain('stepLabel="Step 1 of 5"');
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
