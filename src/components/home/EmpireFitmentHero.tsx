"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import styles from "./EmpireFitmentHero.module.css";

/**
 * Hero prototype: one Empire 50 mL bottle in a lit stone niche, its fitments
 * turning over one by one. Frames are Sunburst renders built from the catalogue
 * plates: one base frame, then masked edits of the closure region only, with the
 * base pixels hard-composited back outside the mask — so glass, sill and wall are
 * identical in every frame and only the closure changes.
 */
export const EMPIRE_HERO_FAMILY = "empire-50ml-clear-18-415";
const MANIFEST = "/assets/hero/frames/manifest.json";
type Frame = { sku: string; src: string; label: string };
const HOLD_MS = 2600;
const FADE_MS = 700;

const TOKENS: Array<[RegExp, string]> = [
    [/AnSpTsl/, "Antique sprayer · tassel"],
    [/AnSp/, "Antique sprayer"],
    [/Drp/, "Glass dropper"],
    [/RdcrMtSlTall/, "Tall reducer · matte silver"],
    [/RdcrShnBlkTall/, "Tall reducer · shiny black"],
    [/Rdcr/, "Reducer"],
    [/OvrCp/, "Overcap"],
];
const COLOURS: Array<[RegExp, string]> = [
    [/IvyGl/, "ivory & gold"], [/IvySl/, "ivory & silver"], [/MtSl/, "matte silver"],
    [/ShnBlk/, "shiny black"], [/ShnGl/, "shiny gold"], [/ShnSl/, "shiny silver"],
    [/BlkLthr/, "black leather"], [/BrwnLthr/, "brown leather"], [/LBrwnLthr/, "light brown leather"], [/IvyLthr/, "ivory leather"], [/PnkLthr/, "pink leather"],
    [/Blk/, "black"], [/Wht/, "white"], [/Red/, "red"], [/Pnk/, "pink"], [/Lvn/, "lavender"], [/Cu/, "copper"], [/Gl/, "gold"], [/Sl/, "silver"],
];
export function fitmentLabel(sku: string): string {
    const tail = sku.replace(/^[GL]BEmp50/, "");
    const kind = TOKENS.find(([re]) => re.test(tail))?.[1] ?? "Closure";
    const colour = COLOURS.find(([re]) => re.test(tail.replace(/Tsl|AnSp|Drp|Rdcr|Tall|OvrCp/g, "")))?.[1];
    return colour && !kind.includes("·") ? `${kind} · ${colour}` : kind;
}


/** Odometer-style counter: each digit is a 0–9 strip that rolls to the new value. */
function Odometer({ value, digits }: { value: number; digits: number }) {
    const str = String(value).padStart(digits, "0");
    return (
        <span className={styles.odo} aria-hidden="true">
            {str.split("").map((d, i) => (
                <span key={i} className={styles.odoDigit}>
                    <span className={styles.odoStrip} style={{ transform: `translateY(-${Number(d) * 10}%)` }}>
                        {"0123456789".split("").map((n) => <span key={n}>{n}</span>)}
                    </span>
                </span>
            ))}
        </span>
    );
}

export default function EmpireFitmentHero() {
    const [rows, setRows] = useState<Frame[]>([]);
    useEffect(() => {
        let alive = true;
        fetch(MANIFEST).then((r) => r.json()).then((frames: Frame[]) => { if (alive) setRows(frames); }).catch(() => undefined);
        return () => { alive = false; };
    }, []);
    const [index, setIndex] = useState(0);
    const [prev, setPrev] = useState<number | null>(null);
    const [paused, setPaused] = useState(false);
    const reduced = useRef(false);

    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        reduced.current = mq.matches;
        const sync = () => { reduced.current = mq.matches; };
        mq.addEventListener("change", sync);
        return () => mq.removeEventListener("change", sync);
    }, []);

    // Preload the next few frames so the crossfade never waits on the network.
    useEffect(() => {
        rows.slice(index + 1, index + 4).forEach((r) => { const img = new Image(); img.src = r.src; });
    }, [rows, index]);

    useEffect(() => {
        if (rows.length < 2 || paused || reduced.current) return;
        const t = setTimeout(() => {
            setPrev(index);
            setIndex((i) => (i + 1) % rows.length);
        }, HOLD_MS);
        return () => clearTimeout(t);
    }, [rows.length, index, paused]);

    useEffect(() => {
        if (prev === null) return;
        const t = setTimeout(() => setPrev(null), FADE_MS + 50);
        return () => clearTimeout(t);
    }, [prev]);

    const current = rows[index];
    return (
        <div className={styles.scene} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-label="Empire 50 mL bottle with its closures">
            <div className={styles.stage}>
                <img className={styles.wall} src="/assets/hero/frames/frame-GBEmp50AnSpGl.webp" alt="" width={1536} height={1024} fetchPriority="high" />
                {prev !== null && rows[prev] && <img key={`p-${rows[prev].sku}`} className={`${styles.frame} ${styles.leaving}`} src={rows[prev].src} alt="" />}
                {current && <img key={current.sku} className={`${styles.frame} ${styles.entering}`} src={current.src} alt="" />}
            </div>
            {current && (
                <p className={styles.caption} aria-live="polite">
                    <span>Empire 50 mL</span>
                    <span className={styles.rule} />
                    <span>{current.label}</span>
                    <span className={styles.count}><Odometer value={index + 1} digits={2} /><span className={styles.sr}>{index + 1}</span> / {String(rows.length).padStart(2, "0")}</span>
                </p>
            )}
        </div>
    );
}
