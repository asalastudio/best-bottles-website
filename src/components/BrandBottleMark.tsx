"use client";

import { useId } from "react";
import styles from "./BrandBottleMark.module.css";

/** Geometry from the supplied September 27 Circle-bottle logo master. */
export default function BrandBottleMark({ size = 34, motion = "still", reversed = false }: {
    size?: number;
    motion?: "still" | "idle" | "working" | "once";
    reversed?: boolean;
}) {
    const id = useId().replace(/:/g, "");
    const ink = reversed ? "#FAF9F7" : "#1C1C1E";
    return (
        <svg viewBox="2 0 96 116" width={size * 96 / 116} height={size}
            className={styles.mark} data-motion={motion} aria-hidden="true" focusable="false">
            <defs>
                <clipPath id={`${id}-circle`}><circle cx="50" cy="71.5" r="39.5" /></clipPath>
                <clipPath id={`${id}-base`}><rect width="100" height="107.5" /></clipPath>
                <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#E3C07C" /><stop offset="1" stopColor="#C4964A" />
                </linearGradient>
            </defs>
            <g clipPath={`url(#${id}-base)`}><g clipPath={`url(#${id}-circle)`}>
                <path className={styles.backWave} d="M0 69.5 q25 -2.6 50 0 q25 2.6 50 0 q25 -2.6 50 0 q25 2.6 50 0 L200 130 L0 130Z" fill="#EFD8A4" />
                <path className={styles.frontWave} d="M0 72 q25 -2 50 0 q25 2 50 0 q25 -2 50 0 q25 2 50 0 L200 130 L0 130Z" fill={`url(#${id}-gold)`} />
            </g></g>
            <path d="M31.2 110.5 A44 44 0 1 1 68.8 110.5 Z" fill="none" stroke={ink} strokeWidth="3.6" strokeLinejoin="round" />
            <rect x="29" y="110.5" width="42" height="3.24" fill={ink} />
            <rect x="36" y="14" width="28" height="14" fill={ink} />
            <rect x="39.5" y="12.5" width="21" height="2" fill={ink} />
            <rect x="40.5" width="19" height="12" fill={ink} />
            <circle cx="50" cy="5" r="1.3" fill="#D4AA5E" />
        </svg>
    );
}
