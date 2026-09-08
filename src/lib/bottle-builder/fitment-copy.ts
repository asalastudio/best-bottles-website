/** Mechanisms and caps are separate choices; a cap-only bottle has no roller. */
export const fitmentChoiceHints: Record<string, string> = {
    "Screw Cap": "Cap only. No roller.",
    "Metal Roller": "Metal roller, then choose its cap.",
    "Plastic Roller": "Plastic roller, then choose its cap.",
    "Fine Mist Sprayer": "Choose the sprayer finish next.",
    "Perfume Sprayer": "Choose the sprayer finish next.",
};
export function fitmentContents(fitment: string | null) {
    if (fitment === "Screw Cap") return "Includes your bottle and selected screw cap. No roller is included.";
    if (fitment === "Metal Roller") return "Includes your bottle, metal roller, and selected roller cap.";
    if (fitment === "Plastic Roller") return "Includes your bottle, plastic roller, and selected roller cap.";
    return `Your bottle, ${fitment?.toLowerCase()}, and selected finish are included in one complete combination.`;
}
