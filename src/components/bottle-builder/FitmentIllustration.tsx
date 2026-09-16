import styles from "./Builder.module.css";
import { displayApplicatorName } from "@/lib/catalogFilters";

// Pencil treatment referenced to original component PSDs, with user-confirmed
// smooth insertion plugs. Exact product photos remain in appearance and preview.
const cells: Record<string, number> = {
    "Fine Mist Sprayer": 0, "Perfume Sprayer": 0,
    "Metal Roller": 1, "Plastic Roller": 2, "Screw Cap": 3, "Tear-off Cap": 3,
    "Lotion Pump": 4, "Vintage Bulb Sprayer": 5, "Antique Bulb Sprayer": 5,
    "Vintage Bulb Sprayer with Tassel": 6, "Dropper": 7,
};
export default function FitmentIllustration({ fitment }: { fitment: string }) {
    const cell = cells[fitment];
    // The orifice reducer is drawn on its own sheet (2026-09-14): pencil after the
    // reducer photograph, proportions locked to it; see data/paper-doll/fitment-illustration-sources.json.
    // eslint-disable-next-line @next/next/no-img-element
    if (fitment === "Reducer") return <img src="/images/bottle-builder/fitment-pencil-reducer.png" alt="Reducer mechanism illustration"
        loading="lazy" style={{ width: 84, maxWidth: "100%", height: 100, maxHeight: "100%", objectFit: "contain", mixBlendMode: "multiply" }} />;
    if (cell == null) return <span className={styles.mechanismFallback} aria-hidden="true">{displayApplicatorName(fitment)}</span>;
    const frames = ["65 40 260 430", "510 95 195 220", "895 95 195 220", "1180 45 320 425",
        "65 550 260 430", "405 635 350 255", "790 590 360 350", "1260 550 160 430"];
    const heights = [118, 84, 84, 110, 118, 110, 120, 124];
    const widths = [96, 92, 92, 100, 96, 150, 150, 76];
    return <svg role="img" aria-label={`${displayApplicatorName(fitment)} mechanism illustration`} viewBox={frames[cell]}
        preserveAspectRatio="xMidYMax meet"
        style={{ width: widths[cell], maxWidth: "100%", height: heights[cell], maxHeight: "100%", mixBlendMode: "multiply" }}>
        <image href="/images/bottle-builder/fitment-pencil-approved.png" width="1536" height="1024" />
    </svg>;
}
