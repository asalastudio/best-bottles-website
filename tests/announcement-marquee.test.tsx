// @vitest-environment jsdom
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import AnnouncementMarquee from "@/components/AnnouncementMarquee";
import en from "../messages/en.json";
import es from "../messages/es.json";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let el: HTMLDivElement;

function render(node: React.ReactElement) {
    el = document.createElement("div");
    document.body.append(el);
    root = createRoot(el);
    act(() => root.render(node));
}

afterEach(() => {
    act(() => root?.unmount());
    el?.remove();
});

describe("announcement marquee", () => {
    it("defaults to a non-shipping message and keeps scrolling on hover", () => {
        const css = readFileSync(
            resolve(__dirname, "../src/components/AnnouncementMarquee.module.css"),
            "utf8",
        );
        expect(css).not.toMatch(/animation-play-state:\s*paused/);
        expect(css).not.toMatch(/\.bar:hover/);
        expect(en.announcement.message.toLowerCase()).not.toMatch(/free shipping|\$99/);
        expect(es.announcement.message.toLowerCase()).not.toMatch(/env[ií]o gratis|\$99/);

        render(<AnnouncementMarquee />);
        expect(el.textContent).toContain(en.announcement.message);
        expect(el.textContent?.toLowerCase()).not.toMatch(/free shipping|\$99/);
    });
});
