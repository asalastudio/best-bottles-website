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
 */
const HERO_SET = process.env.NEXT_PUBLIC_HERO_SET ?? "v7";
const MANIFEST = `/assets/hero/${HERO_SET}/manifest.json`;
const HOLD_MS = 3600;
const FADE_IN_MS = 900;   // new closure fades in over the old one (still opaque)
const FADE_OUT_MS = 600;  // then the old one dissolves (see .leaving delay in the stylesheet)
/** Focal point kept in view when the stage is cropped to the hero box (fractions of stage size). */
const FOCAL = { x: 0.64, y: 0.5 };

type Patch = { src: string; x: number; y: number; w: number; h: number };
type Frame = { sku: string; src: string; label: string; patch?: Patch };
type Manifest = { base: string; width: number; height: number; frames: Frame[]; builtAt?: number };
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
    const [prev, setPrev] = useState<number | null>(null);
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

    // Cover-fit the fixed-size stage to the hero box (same maths as object-fit: cover with a focal point).
    useLayoutEffect(() => {
        if (!manifest || !box.current) return;
        const el = box.current;
        const update = () => {
            const bw = el.clientWidth, bh = el.clientHeight;
            const scale = Math.max(bw / manifest.width, bh / manifest.height);
            const x = (bw - manifest.width * scale) * FOCAL.x;
            const y = (bh - manifest.height * scale) * FOCAL.y;
            setFit({ scale, x, y });
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, [manifest]);

    const frames = manifest?.frames ?? [];

    useEffect(() => {
        if (!manifest) return;
        frames.slice(index + 1, index + 4).forEach((f) => { const img = new Image(); img.src = stamp(manifest, f.patch?.src ?? f.src); });
    }, [manifest, frames, index]);

    useEffect(() => {
        if (frames.length < 2 || paused || reduced.current) return;
        const t = setTimeout(() => { setPrev(index); setIndex((i) => (i + 1) % frames.length); }, HOLD_MS);
        return () => clearTimeout(t);
    }, [frames.length, index, paused]);

    useEffect(() => {
        if (prev === null) return;
        const t = setTimeout(() => setPrev(null), FADE_IN_MS + FADE_OUT_MS + 50);
        return () => clearTimeout(t);
    }, [prev]);

    const current = frames[index];
    const renderPatch = (f: Frame, cls: string) => (manifest && f.patch)
        ? <img key={f.sku} className={`${styles.patch} ${cls}`} src={stamp(manifest, f.patch.src)} alt="" width={f.patch.w} height={f.patch.h} style={{ left: f.patch.x, top: f.patch.y, width: f.patch.w, height: f.patch.h }} />
        : <img key={f.sku} className={`${styles.full} ${cls}`} src={manifest ? stamp(manifest, f.src) : f.src} alt="" />;

    return (
        <div ref={box} className={styles.scene} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-label="Empire 50 mL bottle with its closures">
            {manifest && (
                <div className={styles.stage} style={{ width: manifest.width, height: manifest.height, transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})` }}>
                    <img className={styles.base} src={stamp(manifest, manifest.base)} alt="" width={manifest.width} height={manifest.height} fetchPriority="high" />
                    {prev !== null && frames[prev] && renderPatch(frames[prev], styles.leaving)}
                    {current && renderPatch(current, styles.entering)}
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
