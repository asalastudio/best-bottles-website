"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { HeroHotspot } from "@/sanity/lib/queries";
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
// v8 = v7 with the bottle centred in the arch. The generated plate stood it 32 px left of the
// opening's centreline (body centre 960.5 vs opening centre 992.5 on the 1536 master); the bottle
// was cut to its silhouette, recomposited on the empty-niche plate at the centre, and the kit
// rebuilt so every closure re-anchored to the moved neck axis. v7 is intact — revert by name.
const HERO_SET = process.env.NEXT_PUBLIC_HERO_SET ?? "v8";
const MANIFEST = `/assets/hero/${HERO_SET}/manifest.json`;
const HOLD_MS = 2000;     // one beat per closure (Jordan: "1, 2, switch")
/** Layout (Jordan, 2026-09-14): the niche box is NICHE_HEIGHT of the hero height, the moulding's outer edge sits
 *  RIGHT_GAP px from the hero's right edge, the frame is centred vertically. Beside the stage the page fills with the
 *  plaster tones from the manifest and the stage's outer edges are masked into them (no seam). Light reads in ONE
 *  direction: a stage-space overlay flattens the wall's baked left-bright gradient, then one hero-space gradient
 *  (.shade) fades the plaster out to the left from the moulding's left edge. At phone widths the copy stacks above
 *  the scene (CSS) and the frame is centred instead. */
const NICHE_HEIGHT = 0.8;
const RIGHT_GAP = 110;
const STACK_BELOW = 1100;     // matches the page CSS: at this width and below the copy stacks above the scene
const COPY_SHARE = 0.55;      // the moulding never crosses this share of the width, where the copy lives

type Patch = { src: string; x: number; y: number; w: number; h: number };
type Frame = { sku: string; src: string; label: string; patch?: Patch };
type Box = [number, number, number, number];
type Manifest = {
    base: string; width: number; height: number; frames: Frame[]; builtAt?: number;
    niche?: Box; frame?: Box; edge?: { left: string; right: string }; hold?: unknown;
};
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

/**
 * Hotspots come from Sanity (homepagePage.heroHotspots, placed on the hero reference still with
 * sanity-plugin-hotspot-array). x/y are % of that still = % of the stage, so they ride the same fit
 * transform as the patches but are drawn in scene space at a fixed size. Each renders as a swing tag
 * HANGING from its point on a thread (Jordan: "have it hang off… the left side at the base of that
 * little shelf"), so the editor clicks the underside of the sill; hover, focus or tap opens the tag
 * downward into the detail line and a click-through to the product.
 */
export default function EmpireFitmentHero({ hotspots }: { hotspots?: HeroHotspot[] }) {
    const [manifest, setManifest] = useState<Manifest | null>(null);
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const [fit, setFit] = useState({ scale: 1, x: 0, y: 0, mouldingLeft: 0 });
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

    // Fit the fixed-size stage so the WHOLE niche sits inside the hero box, never cropping the arch or the sill;
    // the stage always covers the box vertically, and horizontally the fill + edge mask take care of any gap.
    useLayoutEffect(() => {
        if (!manifest || !box.current) return;
        const el = box.current;
        const update = () => {
            const bw = el.clientWidth, bh = el.clientHeight;
            const n: Box = manifest.niche ?? [0, 0, manifest.width, manifest.height];
            const f: Box = manifest.frame ?? n;
            const nh = n[3] - n[1], fw = f[2] - f[0], fcx = (f[0] + f[2]) / 2, fcy = (f[1] + f[3]) / 2;
            const stacked = bw <= STACK_BELOW;
            let scale = (bh * NICHE_HEIGHT) / nh;
            scale = Math.min(scale, stacked ? (bw * 0.9) / fw : (bw * (1 - COPY_SHARE) - RIGHT_GAP) / fw);   // the frame never crosses into the copy
            scale = Math.max(scale, bh / manifest.height);                                       // but the stage always covers the box vertically
            const sh = manifest.height * scale;
            const x = stacked ? bw / 2 - fcx * scale : bw - RIGHT_GAP - f[2] * scale;
            let y = bh / 2 - fcy * scale;
            y = sh >= bh ? Math.min(0, Math.max(bh - sh, y)) : (bh - sh) / 2;
            setFit({ scale, x, y, mouldingLeft: x + f[0] * scale });
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
            {manifest && hotspots?.map((h) => {
                if (typeof h.x !== "number" || typeof h.y !== "number") return null;
                const label = h.follows === "closure" && current ? current.label : (h.label ?? "");
                const left = fit.x + (h.x / 100) * manifest.width * fit.scale;
                const top = fit.y + (h.y / 100) * manifest.height * fit.scale;
                const body = (
                    <>
                        <span className={styles.tagThread} aria-hidden="true" />
                        <span className={styles.tagBody}>
                            <span className={styles.tagEyelet} aria-hidden="true" />
                            <span className={styles.tagHead}>
                                <span className={styles.tagLabel}>{label}</span>
                                <span className={styles.tagChevron} aria-hidden="true" />
                            </span>
                            <span className={styles.tagMore}>
                                {h.detail && <span className={styles.tagDetail}>{h.detail}</span>}
                                {h.href && <span className={styles.tagCta}>View product</span>}
                            </span>
                        </span>
                    </>
                );
                return h.href
                    ? <Link key={h._key} href={h.href} className={styles.tag} style={{ left, top }} aria-label={`${label}: view product`}>{body}</Link>
                    : <span key={h._key} tabIndex={0} className={styles.tag} style={{ left, top }}>{body}</span>;
            })}
            <div className={styles.topBlend} aria-hidden="true" />
            <div className={styles.shade} aria-hidden="true" style={fit.mouldingLeft > 0 ? { background: `linear-gradient(90deg, rgba(48,38,26,0.34) 0px, rgba(48,38,26,0.16) ${Math.round(fit.mouldingLeft * 0.5)}px, rgba(48,38,26,0) ${Math.round(fit.mouldingLeft)}px)` } : undefined} />
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
