import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("engineering routes (/dev, /lab)", () => {
    it("answer 404 on production and stay noindexed everywhere", () => {
        for (const path of ["src/app/dev/layout.tsx", "src/app/lab/layout.tsx"]) {
            const source = read(path);
            expect(source, path).toContain('if (process.env.VERCEL_ENV === "production") notFound();');
            expect(source, path).toContain('import { notFound } from "next/navigation";');
            expect(source, path).toContain("index: false");
        }
    });

    it("keeps the drawers out of the first-load JavaScript until idle or first open", () => {
        const host = read("src/components/grace/GraceChatDrawerHost.tsx");
        expect(host).toContain('dynamic(() => import("./GraceChatDrawer"), { ssr: false })');
        expect(host).toContain('panelMode !== "closed"');
        expect(read("src/components/AppProviders.tsx")).toContain("<GraceChatDrawerHost />");
        const navbar = read("src/components/Navbar.tsx");
        expect(navbar).toContain('dynamic(() => import("./CartDrawer"), { ssr: false })');
        expect(navbar).toContain("cartDrawerWanted && <CartDrawer");
    });

    it("builds Sanity image URLs without the API client", () => {
        const image = read("src/sanity/lib/image.ts");
        expect(image).not.toContain('from "./client"');
        expect(image).toContain("imageUrlBuilder({ projectId, dataset })");
    });
});
