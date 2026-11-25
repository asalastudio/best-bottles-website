// @vitest-environment jsdom
/**
 * Build Your Bottle as one list of five choices (Jordan, 24 Nov 2026: "find a better way to make the builder more
 * user-friendly so that it's explicitly clear of the natural flow"). The first screen's icon tiles are PR #440's.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import BuilderSetQuantity from "@/components/bottle-builder/BuilderSetQuantity";
import { builderSets, piecesFor, readSets } from "@/lib/bottle-builder/set-quantity";
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
        expect(client).toMatch(/data-builder-order=\{configuration \? "ready" : "waiting"\}/);
        expect(client).toMatch(/\{configuration \? <>[\s\S]*?id="builder-quantity"[\s\S]*?\{addButton\}/);
    });

    it("puts the order under the finished bottle: what was built, its SKU, the quantity in sets, the total and the button", () => {
        // Jordan, 25 Nov 2026: "move over the add-to-cart button and the total, along with the quantity picker ...
        // underneath the final assembled bottle, listing the product type, SKU number".
        const preview = client.slice(client.indexOf('<section className={styles.preview}'), client.indexOf('<div className={styles.stepList}'));
        const list = client.slice(client.indexOf('<div className={styles.stepList}'), client.indexOf('<div className={styles.addBar}'));
        expect(preview).toContain('aria-label="Your order"');
        expect(preview).toMatch(/<dt>Product<\/dt><dd>\{configuration\.product\.itemName\}<\/dd>/);
        expect(preview).toMatch(/<dt>SKU<\/dt><dd data-builder-sku>\{configuration\.id\}<\/dd>/);
        expect(preview).toMatch(/<dt>Includes<\/dt><dd>\{includes\}<\/dd>/);
        expect(preview).toMatch(/<BuilderSetQuantity id="builder-quantity" quantity=\{selection\.quantity\} caseQuantity=\{configuration\.caseQuantity\}/);
        expect(preview).toContain("{addButton}");
        expect(list).not.toContain("data-builder-order");
        expect(list).not.toContain("{addButton}");
        // The card grows with its order instead of clipping it, and is only pinned on a screen tall enough for it.
        expect(css).toMatch(/\.preview \{ height: auto; min-height: max\(420px, var\(--panel-height\)\); max-height: none; overflow: visible; \}/);
        expect(css).toMatch(/@media \(min-width: 1100px\) and \(max-height: 639px\) \{\s*\.preview \{ position: static;/);
        // Add to Cart is never below the fold on a finished bottle: when the card's button is not fully on screen,
        // a bar at the foot of the window carries the bottle, its total and the same button.
        expect(client).toMatch(/new IntersectionObserver\(\(\[entry\]\) => setAddOffScreen\(!entry\.isIntersecting\), \{ threshold: \.95 \}\)/);
        expect(client).toMatch(/<div ref=\{addAnchor\} data-builder-add>\{addButton\}<\/div>/);
        expect(client).toMatch(/\{configuration && addOffScreen && !lastAdded && <div className=\{styles\.addBar\}[\s\S]*?\{addButton\}\s*<\/div>\}/);
        expect(css).toMatch(/\.addBar \{ position: fixed; left: 0; right: 0; bottom: 0;/);
        // The phone uses the same picker on its last step.
        expect(readFileSync("src/components/bottle-builder/MobileBuilder.tsx", "utf8")).toMatch(/<BuilderSetQuantity id=\{`\$\{id\}-quantity`\}/);
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

describe("quantity in sets", () => {
    it("offers sets of 1, 12 and 144, and the case when it is a different quantity", () => {
        expect(builderSets(null).map(set => set.size)).toEqual([1, 12, 144]);
        expect(builderSets(845).map(set => set.label)).toEqual(["1", "12", "144", "Case of 845"]);
        expect(builderSets(144).map(set => set.label)).toEqual(["1", "12", "144 (case)"]);
        expect(builderSets(1).length).toBe(3);
    });

    it("reads pieces back as sets, keeping the chosen set size while the quantity is whole sets of it", () => {
        const sets = builderSets(280);
        expect(readSets(sets, 12)).toEqual({ size: 12, count: 1 });
        expect(readSets(sets, 144)).toEqual({ size: 144, count: 1 });
        expect(readSets(sets, 144, 12)).toEqual({ size: 12, count: 12 });
        expect(readSets(sets, 280)).toEqual({ size: 280, count: 1 });
        expect(readSets(sets, 7)).toEqual({ size: 1, count: 7 });
        expect(readSets(sets, 30, 12)).toEqual({ size: 1, count: 30 });
        // An emptied field keeps the set size and has no count.
        expect(readSets(sets, NaN, 144)).toEqual({ size: 144, count: NaN });
        expect(piecesFor(144, 3)).toBe(432);
        expect(piecesFor(12, 0)).toBe(12);
        expect(piecesFor(144, 1e9)).toBe(Math.floor(1_000_000 / 144) * 144);
        expect(piecesFor(12, NaN)).toBeNaN();
    });

    it("is the catalog card's control: a Set of menu, a count of sets, and the total in pieces", async () => {
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        const container = document.createElement("div"); document.body.append(container);
        const root = createRoot(container);
        let quantity = 12;
        const changed = vi.fn((pieces: number) => { quantity = pieces; });
        const priceFor = (pieces: number) => ({ unitPrice: .61, total: Math.round(61 * pieces) / 100 });
        const draw = () => act(async () => root.render(<BuilderSetQuantity id="q" quantity={quantity} caseQuantity={280} priceFor={priceFor} onQuantity={changed} />));
        const press = (selector: string) => act(async () => { container.querySelector<HTMLElement>(selector)!.click(); });
        const toggle = () => container.querySelector<HTMLButtonElement>("[data-builder-set-toggle]")!;
        await draw();
        expect(toggle().textContent).toContain("Set of 12");
        expect(toggle().getAttribute("aria-haspopup")).toBe("listbox");
        expect(container.querySelector("[role=listbox]")).toBeNull();
        expect(container.querySelector("[data-builder-total-quantity]")?.textContent).toContain("12 pcs");
        // The menu lists every set with what the cart charges for it.
        await press("[data-builder-set-toggle]");
        expect([...container.querySelectorAll("[role=option]")].map(option => option.textContent)).toEqual([
            "Set of 1 – $0.61 each", "Set of 12 – $7.32 ($0.61 each)", "Set of 144 – $87.84 ($0.61 each)", "Case of 280 – $170.80 ($0.61 each)"]);
        expect(container.querySelector('[role=option][aria-selected="true"]')?.getAttribute("data-set-size")).toBe("12");
        // Choosing a set starts at one of it and closes the menu.
        await press('[role=option][data-set-size="144"]'); expect(changed).toHaveBeenLastCalledWith(144); await draw();
        expect(container.querySelector("[role=listbox]")).toBeNull();
        expect(toggle().textContent).toContain("Set of 144");
        expect((container.querySelector("input") as HTMLInputElement).value).toBe("1");
        await press('button[aria-label="Increase quantity"]'); expect(changed).toHaveBeenLastCalledWith(288); await draw();
        expect(container.querySelector("[data-builder-total-quantity]")?.textContent).toContain("288 pcs");
        expect(toggle().textContent).toContain("Set of 144");
        await press("[data-builder-set-toggle]"); await press('[role=option][data-set-size="280"]'); expect(changed).toHaveBeenLastCalledWith(280); await draw();
        expect(toggle().textContent).toContain("Case of 280");
        await press("[data-builder-set-toggle]"); await press('[role=option][data-set-size="1"]'); await draw();
        expect(container.querySelector("[data-builder-total-quantity]")?.textContent).toContain("1 pc");
        expect((container.querySelector('button[aria-label="Decrease quantity"]') as HTMLButtonElement).disabled).toBe(true);
        // Escape closes the menu without changing anything.
        await press("[data-builder-set-toggle]");
        await act(async () => { container.querySelector("[role=listbox]")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
        expect(container.querySelector("[role=listbox]")).toBeNull();
        await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
    });
});
