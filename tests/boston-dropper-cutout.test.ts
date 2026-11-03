import { describe, expect, it } from "vitest";
import { bostonDropperCutout } from "@/lib/products/boston-dropper-cutout";

describe("Boston 15 ml amber dropper cutouts", () => {
    it("masks the known body and white-dropper debris without affecting other art", () => {
        expect(bostonDropperCutout("https://blob/kits/master-parts/c67d14d5d51b63deaed9cdefb0a5e40c41edeb2743e308cd405538b8bd318c5b.body.webp")).toContain("polygon(");
        expect(bostonDropperCutout("https://blob/kits/master-parts/c360eb9151d02cbcaa3bd27a6971085c7f41af17b25570f27e336c1a21489df6.body.webp")).toContain("polygon(");
        expect(bostonDropperCutout("https://blob/kits/master-parts/c0c76896a877c4751fff0f109ea931633bc6b265020888afb93a6c704e6ab1f6.fitment.webp")).toContain("polygon(");
        expect(bostonDropperCutout("https://blob/kits/master-parts/eed3046cd34adfac7f1f89027a5f897e0c90910981ca06a5e181244a8bfb3941.body.webp")).toContain("polygon(");
        expect(bostonDropperCutout("https://blob/unrelated.webp")).toBeUndefined();
    });
});
