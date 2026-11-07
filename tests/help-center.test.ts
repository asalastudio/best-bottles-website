import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FAQ_POLICY_ENTRIES } from "@/lib/faqPolicy";
import { KB_ENTRIES, publicEntries, sentences, toPublicEntry, type KbEntry } from "@/lib/help/kb";
import { allBodies, bodiesListing, bodyById, bodyLabel, componentById, fitReport } from "@/lib/help/fit";
import { buildRobots } from "@/lib/crawl/robots";
import fitIndex from "@/lib/help/fit-index.generated.json";
import { shortPartName } from "@/components/help/FitParts";
import { capacityMatches, parseCapacityMl, searchHelp } from "@/lib/help/search";
import { apiEntries, apiFit, apiSearch } from "@/lib/help/api";
import { buildKbOpenApi } from "@/lib/help/openapi";
import { validateHelpQuestion } from "@/lib/help/questions";
import { buildPageSitemap } from "@/lib/crawl/sitemap";

describe("help knowledge base", () => {
    it("publishes every approved FAQ answer verbatim, with stable unique ids and slugs", () => {
        expect(KB_ENTRIES).toHaveLength(FAQ_POLICY_ENTRIES.length);
        for (const faq of FAQ_POLICY_ENTRIES) {
            const entry = KB_ENTRIES.find((e) => e.id === `policy.${faq.id}`);
            expect(entry?.body).toBe(faq.a);
            expect(entry?.title).toBe(faq.q);
        }
        expect(new Set(KB_ENTRIES.map((e) => e.id)).size).toBe(KB_ENTRIES.length);
        expect(new Set(KB_ENTRIES.map((e) => e.slug)).size).toBe(KB_ENTRIES.length);
    });

    it("quotes each short answer verbatim from whole sentences of the approved answer", () => {
        for (const entry of KB_ENTRIES) {
            expect(entry.shortAnswer.length).toBeGreaterThan(10);
            const all = sentences(entry.body);
            const parts = sentences(entry.shortAnswer);
            for (const part of parts) expect(all, entry.id).toContain(part);
        }
        expect(KB_ENTRIES.find((e) => e.id === "policy.missing-items")?.shortAnswer).toMatch(/within 48 hours/);
        expect(sentences("Email sales@nematinternational.com. Call us.")).toEqual(["Email sales@nematinternational.com.", "Call us."]);
        expect(sentences("The minimum order is $50.00, excluding shipping. Next.")[0]).toBe("The minimum order is $50.00, excluding shipping.");
    });

    it("keeps drafts, reviews, retired and internal entries out of everything public", () => {
        const base = KB_ENTRIES[0];
        const hidden: KbEntry[] = [
            { ...base, id: "x.draft", status: "draft" },
            { ...base, id: "x.review", status: "review" },
            { ...base, id: "x.approved", status: "approved" },
            { ...base, id: "x.retired", status: "retired" },
            { ...base, id: "x.internal", audience: "internal" },
        ];
        expect(publicEntries(hidden)).toEqual([]);
        expect(publicEntries([...hidden, base]).map((e) => e.id)).toEqual([base.id]);
    });

    it("projects only whitelisted fields for pages and agents", () => {
        const pub = toPublicEntry(KB_ENTRIES[0]);
        expect(Object.keys(pub).sort()).toEqual([
            "answer", "id", "openQuestions", "publishedOn", "related", "shortAnswer", "sources", "status", "title", "topic", "type", "updatedOn", "url", "version",
        ]);
        expect(pub.sources[0]).not.toHaveProperty("ref");
    });

    it("flags the FAQ's own disagreement on the missing-item window instead of resolving it", () => {
        const missing = KB_ENTRIES.find((e) => e.id === "policy.missing-items")!;
        expect(missing.body).toContain("48 hours");
        expect(missing.openQuestions.join(" ")).toMatch(/48 hours.*7 business days/);
    });
});

describe("fit index", () => {
    it("is built from the committed register", () => {
        expect(() => execFileSync(process.execPath, [join("scripts", "help", "build-fit-index.mjs"), "--check"], { stdio: "pipe" })).not.toThrow();
    });

    it("lists the Bell 10 ml closures the catalog pairs with it, apart from same-thread parts", () => {
        const report = fitReport("bell-10ml-13-415")!;
        // 21 by catalog products, plus the six short caps with liner on Jordan's 13-415 ruling (2026-11-07).
        expect(report.counts.listed).toBe(27);
        expect(report.counts["not-confirmed"]).toBe(0);
        expect(report.body.teamConfirmed).toHaveLength(6);
        expect(report.listed.flatMap((g) => g.rows).filter((r) => r.basis === "team-confirmed")).toHaveLength(6);
        expect(report.body.listed).toContain("CMP-CAP-13-415"); // matte blue sprayer
        expect(report.body.sameThread.some((id) => report.body.listed.includes(id))).toBe(false);
        expect(report.formulaSuitability).toBe("unknown");
        expect(bodiesListing("CMP-CAP-13-415")).toHaveLength(15);
    });

    it("groups 13-415 closures the way the neck-thread matrix does", () => {
        const report = fitReport("bell-10ml-13-415")!;
        const groups = Object.fromEntries(report.listed.map((g) => [g.label, g.rows.map((r) => r.itemCode)]));
        expect(groups["Roll-on caps"]).toHaveLength(9);
        expect(groups["Fine mist sprayers"]).toHaveLength(8);
        expect(groups["Short ribbed caps"]?.sort()).toEqual(["CP13-415BlkSht", "CP13-415WhtSht"]);
        expect(groups["Tall caps with liner"]?.sort()).toEqual(["CP13-415Gl", "CP13-415Sl"]);
        expect(groups["Short caps with liner"]).toHaveLength(6);
    });

    it("keeps reviewed duplicate listings out of every fit list", () => {
        const codes = new Set(allBodies().flatMap((b) => [...b.listed, ...b.sameThread, ...b.conflicting]).map((id) => componentById(id)?.itemCode));
        for (const dup of ["13-415CAP4SpryCuMt", "13-415CAP4SpryGlSh", "13-415CAP4SprySlMt", "18-415CAP4SpryMtGl", "18-415CAP4SpryShnBlk"]) expect(codes.has(dup)).toBe(false);
    });

    it("never offers same-thread parts for bottles that are their own compatibility class", () => {
        const sets = allBodies().filter((b) => !b.interchangeable);
        expect(sets.length).toBeGreaterThan(0);
        for (const body of sets) expect(body.sameThread).toEqual([]);
        for (const body of allBodies().filter((b) => b.compatibilityClass === "plastic-bottle")) expect(body.interchangeable).toBe(false);
    });

    it("gives customers real item codes, never register placeholders", () => {
        const rows = fitReport("bell-10ml-13-415")!.listed.flatMap((group) => group.rows);
        expect(rows.every((row) => row.itemCode && !row.itemCode.startsWith("REF-"))).toBe(true);
        expect(rows.map((row) => row.itemCode)).toContain("CP13-415SpryBluMt");
    });

    it("keeps register staff notes out of the public index", () => {
        const text = JSON.stringify(fitIndex);
        expect(text).not.toMatch(/classify before|quarantin|statusReason|dimsSource/i);
    });

    it("names same-size siblings apart and never repeats the category", () => {
        expect(bodyLabel(bodyById("footed-rectangle-10ml-13-415")!)).toBe("Footed Rectangular 10 ml");
        expect(bodyLabel(bodyById("tall-rectangle-10ml-13-415")!)).toBe("Tall Rectangular 10 ml");
        expect(bodyLabel(bodyById("cylinder-9ml-13-415")!)).toBe("Tall Cylinder 9 ml");
        expect(bodyLabel(bodyById("cylinder-5ml-13-415")!)).toBe("Cylinder 5 ml");
        expect(bodyLabel(bodyById("aluminum-bottle-65ml-20-410")!)).toBe("Aluminum Bottle 65 ml");
        expect(shortPartName("Matte blue Fine Mist Sprayer, Thread size 13-415")).toBe("Matte blue Fine Mist Sprayer");
        expect(shortPartName("Matte Gold cap or closure for rollon bottles, Threadsize 13-415")).toBe("Matte Gold cap or closure for rollon bottles");
    });

    it("keeps every part on the bottle's own neck", () => {
        for (const body of allBodies().filter((b) => b.interchangeable)) {
            const report = fitReport(body.id)!;
            for (const group of [...report.listed, ...report.notConfirmed]) for (const row of group.rows) expect(row.neck).toBe(body.neck);
        }
    });
});

describe("help search", () => {
    it("converts everyday units", () => {
        expect(parseCapacityMl("7ml roller")).toBe(7);
        expect(parseCapacityMl("1 oz")).toBeCloseTo(29.57, 1);
        expect(parseCapacityMl("1/2 oz dropper")).toBeCloseTo(14.79, 1);
        expect(parseCapacityMl("2 drams")).toBeCloseTo(7.39, 1);
        expect(parseCapacityMl("ten millilitres")).toBeNull();
        expect(capacityMatches(29.57, 30)).toBe(true);
        expect(capacityMatches(7, 6)).toBe(false);
    });

    it("says a 7 ml roll-on is not offered and names the nearest sizes", () => {
        const { size } = searchHelp("7 ml roll-on bottle");
        expect(size?.notOffered).toBe(true);
        expect(size?.offered).toEqual([]);
        expect(size?.smaller?.ml).toBe(6);
        expect(size?.smaller?.bodies.map((b) => b.family)).toContain("Tulip");
        expect(size?.larger?.ml).toBe(8);
        expect(size?.larger?.bodies.map((b) => b.family)).toContain("Sleek");
    });

    it("finds sizes asked for in ounces", () => {
        const { size, catalogHref } = searchHelp("1 oz dropper");
        expect(size?.notOffered).toBe(false);
        expect(size?.offered.every((b) => b.capacityMl === 30)).toBe(true);
        expect(catalogHref).toContain("capacities=30+ml");
    });

    it("matches policy questions written in everyday words", () => {
        expect(searchHelp("can I get my money back").answers.map((a) => a.entry.id)).toContain("policy.returns");
        expect(searchHelp("my box arrived broken").answers[0]?.entry.id).toBe("policy.damaged-defective");
        expect(searchHelp("how long until it arrives").answers[0]?.entry.id).toBe("policy.lead-times");
    });

    it("reports topics the approved FAQ does not cover instead of answering them", () => {
        expect(searchHelp("do you offer free shipping?").gap).toMatch(/free-shipping/);
        expect(searchHelp("net 30 terms").gap).toMatch(/net terms/);
        expect(searchHelp("what is the return policy").gap).toBeNull();
    });

    it("finds nothing rather than guessing", () => {
        const result = searchHelp("zzqx flibber");
        expect(result.answers).toEqual([]);
        expect(result.size).toBeNull();
        expect(result.bottles).toEqual([]);
    });

    it("does not read Grace the assistant as the Grace bottle", () => {
        expect(searchHelp("grace what is the minimum").interpretation.join()).not.toMatch(/bottle/);
    });
});

describe("help API", () => {
    it("serves only published public entries", () => {
        const { entries } = apiEntries();
        expect(entries).toHaveLength(publicEntries().length);
        expect(entries.every((e) => e.status === "published" && e.url.startsWith("http"))).toBe(true);
        expect(apiEntries("returns").entries.every((e) => e.topic === "returns")).toBe(true);
    });

    it("never states price or stock, and keeps formula suitability unknown", () => {
        const text = JSON.stringify([apiSearch("7 ml roll-on"), apiFit("bell-10ml-13-415")]);
        expect(text).not.toMatch(/"(price|stockStatus|webPrice\w*)"/);
        expect(apiFit("bell-10ml-13-415")?.formulaSuitability.status).toBe("unknown");
        expect(apiFit("no-such-bottle")).toBeNull();
    });

    it("describes every route it serves", () => {
        const spec = buildKbOpenApi();
        for (const path of Object.keys(spec.paths)) {
            const dir = path.replace(/\{(\w+)\}/g, "[$1]");
            expect(existsSync(join("src", "app", "api", "kb", "v1", dir, "route.ts"))).toBe(true);
        }
        expect(bodyById("bell-10ml-13-415")).not.toBeNull();
    });
});

describe("help questions", () => {
    it("drops the email unless a reply was asked for, and requires consent when it was", () => {
        const noReply = validateHelpQuestion({ question: "Do roll-ons leak?", wantsReply: false, email: "a@b.co", consent: true });
        expect(noReply).toEqual({ ok: true, value: { question: "Do roll-ons leak?", wantsReply: false, consent: false } });
        expect(validateHelpQuestion({ question: "Do roll-ons leak?", wantsReply: true, email: "a@b.co", consent: false }).ok).toBe(false);
        expect(validateHelpQuestion({ question: "Do roll-ons leak?", wantsReply: true, email: "not-an-email", consent: true }).ok).toBe(false);
        const reply = validateHelpQuestion({ question: "Do roll-ons leak?", wantsReply: true, email: " A@B.co ", consent: true });
        expect(reply.ok && reply.value.email).toBe("a@b.co");
    });

    it("rejects empty and oversized questions", () => {
        expect(validateHelpQuestion({ question: "  " }).ok).toBe(false);
        expect(validateHelpQuestion({ question: "x".repeat(1001) }).ok).toBe(false);
        expect(validateHelpQuestion(null).ok).toBe(false);
    });
});

describe("help discovery", () => {
    it("lists the help home, fit finder, every published answer and each bottle's fit page", () => {
        const paths = buildPageSitemap("https://example.test", new Date()).map((p) => p.url.replace("https://example.test", ""));
        expect(paths).toEqual(expect.arrayContaining(["/help", "/help/fit", "/help/a/returns", "/help/topic/shipping", "/help/fit/bell-10ml-13-415"]));
        expect(paths).not.toContain("/help/search");
        expect(paths).not.toContain("/help/fit/aluminum-bottle-65ml-20-410");
    });

    it("lets crawlers read the help API while the rest of /api stays closed", () => {
        const rule = buildRobots("https://example.test").rules as { allow: string[]; disallow: string[] }[];
        expect(rule[0].allow).toContain("/api/kb/");
        expect(rule[0].disallow).toContain("/api/");
    });

    it("answers a closure question for one bottle with its matching parts", () => {
        const result = searchHelp("sprayer for bell 10 ml");
        expect(result.closure?.partTypes).toContain("fine-mist-sprayer");
        expect(result.bottles.map((b) => b.id)).toEqual(["bell-10ml-13-415"]);
        expect(apiSearch("sprayer for bell 10 ml").bottles[0].fitUrl).toMatch(/\/help\/fit\/bell-10ml-13-415$/);
    });
});
