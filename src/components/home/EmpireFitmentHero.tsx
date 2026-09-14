"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./EmpireFitmentHero.module.css";

/**
 * Hero: one Empire 50 mL bottle in a lit plaster niche, its closures turning over.
 * The scene is ONE static base image. Each closure is a small lossless transparent
 * patch placed at its exact pixel position on a 1536×1024 stage that is scaled to
 * cover the hero box — so nothing outside the closure can ever change or shimmer.
 * Closures come from the PSD master layers (scripts/hero-empire/kit.py) placed on the one bottle by body-width scale + shoulder anchor.
 *
 * The changeover is a JUMP CUT (Jordan: "like a video jump cut"), never a fade: the next patch is
 * mounted a beat early at opacity 0 and decoded, so the cut is one atomic paint with the layer
 * already there to catch it. The bare-neck beat renders nothing — the base IS the bare bottle.
 */
const HERO_SET = process.env.NEXT_PUBLIC_HERO_SET ?? "v7";
const MANIFEST = `/assets/hero/${HERO_SET}/manifest.json`;
const HOLD_MS = 2000;     // one beat per closure (Jordan: "1, 2, switch")
/** The niche fills this share of the hero height, centred vertically, its centre at NICHE_X of the hero width
 *  (the copy lives on the left). On wide boxes the stage is narrower than the box; the plaster tone from the
 *  manifest fills the sides and the stage's outer edges are masked into it (see .stage in the stylesheet). */
const NICHE_HEIGHT = 0.8;
const NICHE_X = 0.62;

type Patch = { src: string; x: number; y: number; w: number; h: number };
type Frame = { sku: string; src: string; label: string; patch?: Patch };
type Manifest = { base: string; width: number; height: number; frames: Frame[]; builtAt?: number; niche?: [number, number, number, number]; edge?: { left: string; right: string }; hold?: unknown };
/** Cache-bust every asset with the manifest's build stamp so a rebuilt set never mixes with a cached one. */
const stamp = (m: Manifest, src: string) => (m.builtAt ? `${src}?v=${m.builtAt}` : src);

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
    const [manifest, setManifest] = useState<Manifest | null>(null);
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const [fit, setFit] = useState({ scale: 1, x: 0, y: 0 });
    const box = useRef<HTMLDivElement>(null);
    const reduced = useRef(false);

    useEffect(() => {
        let alive = true;
        fetch(`${MANIFEST}?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()).then((m: Manifest) => { if (alive) setManifest(m); }).catch(() => undefined);
        return () => { alive = false; };
    }, []);

    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        reduced.current = mq.matches;
        const sync = () => { reduced.current = mq.matches; };
        mq.addEventListener("change", sync);
        return () => mq.removeEventListener("change", sync);
    }, []);

    // Fit the fixed-size stage so the WHOLE niche sits inside the hero box (Jordan: "the whole entire niche fits in
    // the frame nicely"), never cropping the arch or the sill; the stage still covers the box vertically.
    useLayoutEffect(() => {
        if (!manifest || !box.current) return;
        const el = box.current;
        const update = () => {
            const bw = el.clientWidth, bh = el.clientHeight;
            const n = manifest.niche ?? [0, 0, manifest.width, manifest.height];
            const nw = n[2] - n[0], nh = n[3] - n[1], ncx = (n[0] + n[2]) / 2, ncy = (n[1] + n[3]) / 2;
            let scale = (bh * NICHE_HEIGHT) / nh;
            scale = Math.min(scale, (bw * 0.9) / nw);              // a narrow box: the niche must fit the width too
            scale = Math.max(scale, bh / manifest.height);         // but the stage always covers the box vertically
            const sw = manifest.width * scale, sh = manifest.height * scale;
            let x = NICHE_X * bw - ncx * scale;
            if (sw >= bw) x = Math.min(0, Math.max(bw - sw, x));  // covering: keep the stage over the box
            let y = bh / 2 - ncy * scale;
            y = sh >= bh ? Math.min(0, Math.max(bh - sh, y)) : (bh - sh) / 2;
            setFit({ scale, x, y });
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, [manifest]);

    const frames = manifest?.frames ?? [];
    const patchBased = frames.some((f) => f.patch);
    const warm = useRef<HTMLImageElement[]>([]);

    // Fetch + decode the next few patches ahead of their beat (kept referenced so the decoded bitmaps stay cached).
    useEffect(() => {
        if (!manifest) return;
        warm.current = frames.slice(index + 1, index + 4).flatMap((f) => {
            if (patchBased && !f.patch) return [];
            const img = new Image();
            img.src = stamp(manifest, f.patch?.src ?? f.src);
            img.decode?.().catch(() => undefined);
            return [img];
        });
    }, [manifest, frames, index, patchBased]);

    useEffect(() => {
        if (frames.length < 2 || paused || reduced.current) return;
        const t = setTimeout(() => setIndex((i) => (i + 1) % frames.length), HOLD_MS);
        return () => clearTimeout(t);
    }, [frames.length, index, paused]);

    const current = frames[index];
    const next = frames.length > 1 ? frames[(index + 1) % frames.length] : undefined;
    const decodeOnMount = (el: HTMLImageElement | null) => { el?.decode?.().catch(() => undefined); };
    const renderPatch = (f: Frame, cls: string, ahead = false) => {
        if (!manifest) return null;
        if (f.patch) return <img key={f.sku} ref={ahead ? decodeOnMount : undefined} className={`${styles.patch} ${cls}`} src={stamp(manifest, f.patch.src)} alt="" width={f.patch.w} height={f.patch.h} style={{ left: f.patch.x, top: f.patch.y, width: f.patch.w, height: f.patch.h }} />;
        if (patchBased) return null;                       // a bare beat in a patch set: the base already is the bare bottle
        return <img key={f.sku} ref={ahead ? decodeOnMount : undefined} className={`${styles.full} ${cls}`} src={stamp(manifest, f.src)} alt="" />;
    };

    return (
        <div ref={box} className={styles.scene} style={manifest?.edge ? { background: `linear-gradient(90deg, ${manifest.edge.left} 0%, ${manifest.edge.left} 50%, ${manifest.edge.right} 50%, ${manifest.edge.right} 100%)` } : undefined} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-label="Empire 50 mL bottle with its closures">
            {manifest && (
                <div className={styles.stage} style={{ width: manifest.width, height: manifest.height, transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})` }}>
                    <img className={styles.base} src={stamp(manifest, manifest.base)} alt="" width={manifest.width} height={manifest.height} fetchPriority="high" />
                    {next && next.sku !== current?.sku && renderPatch(next, styles.next, true)}
                    {current && renderPatch(current, styles.current)}
                </div>
            )}
            <div className={styles.shade} aria-hidden="true" />
            {current && (
                <p className={styles.caption} aria-live="polite">
                    <span>Empire 50 mL</span>
                    <span className={styles.rule} />
                    <span>{current.label}</span>
                    <span className={styles.count}><Odometer value={index + 1} digits={2} /><span className={styles.sr}>{index + 1}</span> / {String(frames.length).padStart(2, "0")}</span>
                </p>
            )}
        </div>
    );
}
