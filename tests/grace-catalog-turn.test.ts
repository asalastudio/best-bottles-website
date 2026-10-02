import { afterEach, describe, expect, it, vi } from "vitest";
import { GraceCatalogTurn, STALE_CATALOG_ACTION } from "@/lib/grace/catalogTurn";

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

afterEach(() => vi.useRealTimers());

describe("Grace catalogue async turn ownership", () => {
    it("does not stamp an old verification onto a newer identical request", async () => {
        const turns = new GraceCatalogTurn();
        const request = "Open the catalogue filtered to Elegant";
        turns.begin(request);
        const old = turns.beginRefinement();
        const http = deferred<string>();
        const navigate = vi.fn();
        const completion = http.promise.then(message => turns.commitRefinement(old, message, navigate));
        turns.begin(request); // equal words are a distinct turn, not equal ownership
        http.resolve("one group");
        expect(await completion).toBe(false);
        expect(navigate).not.toHaveBeenCalled();
        expect(turns.displayBlock(turns.capture())).toBeNull();
    });

    it("rejects old display rows that finish after a newer refinement in the same turn", async () => {
        const turns = new GraceCatalogTurn();
        turns.begin("Open the catalogue filtered to Elegant");
        const old = turns.capture();
        const http = deferred<void>();
        const cardsAndNavigation = vi.fn();
        const completion = http.promise.then(() => turns.applyDisplay(old, cardsAndNavigation));
        const refinement = turns.beginRefinement();
        const replace = vi.fn();
        expect(turns.commitRefinement(refinement, "one matching group", replace)).toBe(true);
        http.resolve();
        expect(await completion).toBe(false);
        expect(cardsAndNavigation).not.toHaveBeenCalled();
        expect(replace).toHaveBeenCalledOnce();
        expect(turns.displayBlock(turns.capture())).toContain("Keep this requested catalogue view open");
    });

    it("rejects a stale second group lookup even when its initial search was current", async () => {
        const turns = new GraceCatalogTurn();
        turns.begin("Show an Elegant bottle");
        const ticket = turns.capture();
        await Promise.resolve(); // first search finishes
        expect(turns.displayBlock(ticket)).toBeNull();
        const group = deferred<void>();
        const effects = vi.fn();
        const completion = group.promise.then(() => turns.applyDisplay(ticket, effects));
        turns.begin("Now show Cylinder");
        group.resolve();
        expect(await completion).toBe(false);
        expect(effects).not.toHaveBeenCalled();
    });

    it.each(["new turn", "refinement", "interruption"])("checks ownership again when a queued navigation fires after %s", async reason => {
        vi.useFakeTimers();
        const clear = vi.fn();
        const turns = new GraceCatalogTurn(clear);
        turns.begin("Show an Elegant bottle");
        const ticket = turns.capture();
        const navigationAndAnnouncement = vi.fn();
        setTimeout(() => turns.applyDisplay(ticket, navigationAndAnnouncement), 500);
        if (reason === "new turn") turns.begin("Show Cylinder");
        else if (reason === "refinement") turns.beginRefinement();
        else turns.interrupt();
        await vi.advanceTimersByTimeAsync(500);
        expect(navigationAndAnnouncement).not.toHaveBeenCalled();
        expect(clear).toHaveBeenCalledTimes(2); // clear already queued catalogue cards too
    });

    it("blocks stale error fallback navigation after interruption", async () => {
        const turns = new GraceCatalogTurn();
        turns.begin("Show a bottle");
        const ticket = turns.capture();
        const http = deferred<void>();
        const fallback = vi.fn();
        const completion = http.promise.catch(() => turns.applyDisplay(ticket, fallback));
        turns.interrupt();
        http.reject(new Error("request failed"));
        expect(await completion).toBe(false);
        expect(fallback).not.toHaveBeenCalled();
        expect(turns.displayBlock(turns.capture())).toBe(STALE_CATALOG_ACTION);
    });

    it("keeps a newer refinement when responses finish out of order", async () => {
        const turns = new GraceCatalogTurn();
        turns.begin("Open the catalogue");
        const first = turns.beginRefinement();
        const second = turns.beginRefinement();
        const oldApply = vi.fn();
        const newApply = vi.fn();
        expect(turns.commitRefinement(second, "new result", newApply)).toBe(true);
        expect(turns.commitRefinement(first, "old result", oldApply)).toBe(false);
        expect(turns.displayBlock(turns.capture())).toContain("new result");
        expect(oldApply).not.toHaveBeenCalled();
    });

    it("keeps queued request delivery scoped to the turn, not a catalogue revision", () => {
        const turns = new GraceCatalogTurn();
        turns.begin("Show a bottle");
        const queuedRequest = turns.capture();
        turns.beginRefinement();
        expect(turns.isTurnCurrent(queuedRequest)).toBe(true);
        expect(turns.isCurrent(queuedRequest)).toBe(false);
        turns.begin("Show a bottle");
        expect(turns.isTurnCurrent(queuedRequest)).toBe(false);
    });

    it("allows current work and a new turn after interruption", () => {
        const turns = new GraceCatalogTurn();
        turns.begin("Show a bottle");
        const apply = vi.fn();
        expect(turns.applyDisplay(turns.capture(), apply)).toBe(true);
        turns.interrupt();
        turns.begin("Show the same bottle");
        expect(turns.applyDisplay(turns.capture(), apply)).toBe(true);
        expect(apply).toHaveBeenCalledTimes(2);
    });
});
