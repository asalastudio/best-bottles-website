/** Guided-flow content map (design handoff, copy approved 2026-08-31):
 *  use case → ranked closure bases + the one-line benefit per closure.
 *  This is CONTENT, not fitment truth — fitment comes from the family
 *  registry / neck platform; a base only renders if the family sells it. */
import type { ClosureBase } from "@/lib/configurator/families";

export type UseCaseId =
  | "fragrance" | "bodyOil" | "treatment" | "lotion" | "samples";

export const USE_CASES: {
  id: UseCaseId; label: string;
  /** Phosphor icon name exported from src/components/icons.tsx */
  icon: "SprayBottle" | "Drop" | "Eyedropper" | "HandSoap" | "TestTube";
  ranked: ClosureBase[];
}[] = [
  { id: "fragrance", label: "Fine fragrance", icon: "SprayBottle",
    ranked: ["sprayer", "antique", "roller", "reducer"] },
  { id: "bodyOil", label: "Face or body oil", icon: "Drop",
    ranked: ["roller", "dropper", "reducer", "pump"] },
  { id: "treatment", label: "Serum or treatment", icon: "Eyedropper",
    ranked: ["dropper", "pump", "roller", "reducer"] },
  { id: "lotion", label: "Lotion or soap", icon: "HandSoap",
    ranked: ["pump", "sprayer", "reducer", "dropper"] },
  { id: "samples", label: "Samples or controlled pour", icon: "TestTube",
    ranked: ["reducer", "roller", "dropper", "sprayer"] },
];

export const CLOSURE_META: Record<Exclude<ClosureBase, "none">, {
  name: string; benefit: string;
}> = {
  sprayer: { name: "Fine Mist Spray", benefit: "Even, everyday application" },
  antique: { name: "Vintage Bulb", benefit: "Premium presentation and display" },
  antiqueTassel: { name: "Vintage Bulb · Tassel", benefit: "Bulb sprayer with decorative tassel" },
  pump: { name: "Lotion Pump", benefit: "Measured dose for thicker product" },
  dropper: { name: "Glass Dropper", benefit: "Drop-precise for oils and serums" },
  roller: { name: "Roll-on", benefit: "Direct glide-on application" },
  reducer: { name: "Reducer", benefit: "Controlled pour, splash-free" },
};
