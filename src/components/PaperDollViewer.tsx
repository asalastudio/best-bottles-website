"use client";

import { useState, useEffect, useMemo } from "react";
import { client, isSanityConfigured } from "@/sanity/lib/client";

// ── Types ────────────────────────────────────────────────────────────────────

interface LayerAsset {
  _key: string;
  slot: string;
  variantKey: string;
  sourceFilename: string;
  image: { asset: { _ref: string; url: string } };
}

interface PaperDollFamilyData {
  _id: string;
  familyKey: string;
  displayName: string;
  canvasWidth: number;
  canvasHeight: number;
  layerOrderRollon: string[];
  layerOrderSpray: string[];
  layerOrderLotion: string[];
  layerAssets: LayerAsset[];
}

type ApplicatorType = "rollon" | "spray" | "lotion";

interface PaperDollViewerProps {
  familyKey: string;
  /** Pre-select a bottle color (e.g. "AMB") */
  initialBottle?: string;
  /** Pre-select applicator type */
  initialApplicator?: ApplicatorType;
  /** Pre-select a cap variant (roller only) */
  initialCap?: string;
  /** Pre-select a roller/sprayer/pump variant */
  initialTopComponent?: string;
  /** Pre-select a roller fitment (roller only, e.g. "MTL-ROLL") */
  initialFitment?: string;
  /** Background color for the canvas (default: transparent via Bone) */
  bgColor?: string;
}

// ── GROQ Query ───────────────────────────────────────────────────────────────

const PAPER_DOLL_QUERY = `
  *[_type == "paperDollFamily" && familyKey == $familyKey][0] {
    _id,
    familyKey,
    displayName,
    canvasWidth,
    canvasHeight,
    layerOrderRollon,
    layerOrderSpray,
    layerOrderLotion,
    layerAssets[] {
      _key,
      slot,
      variantKey,
      sourceFilename,
      "image": {
        "asset": {
          "_ref": image.asset._ref,
          "url": image.asset->url
        }
      }
    }
  }
`;

// ── Display Labels ───────────────────────────────────────────────────────────

const BOTTLE_LABELS: Record<string, string> = {
  AMB: "Amber",
  BLU: "Cobalt Blue",
  CLR: "Clear",
  FRS: "Frosted",
  SWL: "Swirl",
};

const APPLICATOR_LABELS: Record<ApplicatorType, string> = {
  rollon: "Roll-On",
  spray: "Fine Mist Spray",
  lotion: "Lotion Pump",
};

const GLASS_COLORS: Record<string, string> = {
  AMB: "#C8720A",
  BLU: "#5B87B5",
  CLR: "rgba(200, 235, 245, 0.55)",
  FRS: "#D8D8D8",
  SWL: "#B8D4E3",
};

const FINISH_COLORS: Record<string, string> = {
  "BLK": "#1D1D1F",
  "BLK-DOT": "#1D1D1F",
  "GL": "#D4AF37",
  "MATT-CU": "#B87333",
  "MATT-GL": "#C5A065",
  "MATT-SL": "#ADADAD",
  "MTL-ROLL": "#C8C8C8",
  "PLS-ROLL": "#E8E8E8",
  "PNK-DOT": "#F4A7B9",
  "RD": "#C41E3A",
  "SHN-BLK": "#0D0D0D",
  "SHN-GL": "#D4AF37",
  "SHN-SL": "#C8C8C8",
  "SL-DOT": "#C8C8C8",
  "TUR": "#40B5AD",
  "WHT": "#F5F5F0",
};

const LIGHT_SWATCHES = new Set([
  "CLR", "FRS", "SWL", "WHT", "SHN-SL", "MATT-SL", "SL-DOT",
  "PLS-ROLL", "MTL-ROLL", "PNK-DOT",
]);

// ── Swatch Component ─────────────────────────────────────────────────────────

function Swatch({
  color,
  label,
  selected,
  onClick,
  isLight,
}: {
  color: string;
  label: string;
  selected: boolean;
  onClick: () => void;
  isLight: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`
        w-8 h-8 rounded-full border-2 transition-all duration-150
        flex items-center justify-center shrink-0
        ${selected ? "border-obsidian scale-110 shadow-md" : "border-champagne/50 hover:border-champagne hover:scale-105"}
      `}
      style={{ backgroundColor: color }}
    >
      {selected && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M2 6L5 9L10 3"
            stroke={isLight ? "#1D1D1F" : "#FFFFFF"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

// ── Sanity Image URL helper ──────────────────────────────────────────────────

function sanityImageUrl(url: string, width: number): string {
  if (!url) return "";
  // Sanity CDN URL with on-the-fly resize
  return `${url}?w=${width}&fm=png&q=90`;
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function PaperDollViewer({
  familyKey,
  initialBottle,
  initialApplicator = "rollon",
  initialCap,
  initialTopComponent,
  initialFitment,
  bgColor = "#F5F3EF",
}: PaperDollViewerProps) {
  const [familyData, setFamilyData] = useState<PaperDollFamilyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [applicator, setApplicator] = useState<ApplicatorType>(initialApplicator);
  const [selectedBottle, setSelectedBottle] = useState<string | null>(initialBottle ?? null);
  const [selectedCap, setSelectedCap] = useState<string | null>(initialCap ?? null);
  const [selectedFitment, setSelectedFitment] = useState<string | null>(initialFitment ?? null);
  const [selectedSprayer, setSelectedSprayer] = useState<string | null>(initialTopComponent ?? null);
  const [selectedPump, setSelectedPump] = useState<string | null>(initialTopComponent ?? null);

  // ── Fetch family data from Sanity ────────────────────────────────────────

  useEffect(() => {
    if (!isSanityConfigured) {
      setError("Sanity not configured");
      setLoading(false);
      return;
    }

    client
      .fetch<PaperDollFamilyData | null>(PAPER_DOLL_QUERY, { familyKey })
      .then((data) => {
        if (!data) {
          setError(`Family "${familyKey}" not found`);
        } else {
          setFamilyData(data);
          // Set defaults from first available variant per slot
          const bySlot = groupBySlot(data.layerAssets);
          if (!selectedBottle && bySlot.body?.[0]) setSelectedBottle(bySlot.body[0].variantKey);
          if (!selectedCap && bySlot.cap?.[0]) setSelectedCap(bySlot.cap[0].variantKey);
          if (!selectedFitment && bySlot.roller?.[0]) setSelectedFitment(bySlot.roller[0].variantKey);
          if (!selectedSprayer && bySlot.sprayer?.[0]) setSelectedSprayer(bySlot.sprayer[0].variantKey);
          if (!selectedPump && bySlot.pump?.[0]) setSelectedPump(bySlot.pump[0].variantKey);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyKey]);

  // ── Group assets by slot ─────────────────────────────────────────────────

  const bySlot = useMemo(() => {
    if (!familyData) return {};
    return groupBySlot(familyData.layerAssets);
  }, [familyData]);

  // ── Determine active layers based on applicator + selections ─────────────

  const activeLayers = useMemo(() => {
    if (!familyData) return [];

    const layerOrder =
      applicator === "rollon"
        ? familyData.layerOrderRollon
        : applicator === "spray"
          ? familyData.layerOrderSpray
          : familyData.layerOrderLotion;

    if (!layerOrder) return [];

    const layers: { slot: string; asset: LayerAsset; zIndex: number }[] = [];

    layerOrder.forEach((slot, index) => {
      let variantKey: string | null = null;

      if (slot === "body") variantKey = selectedBottle;
      else if (slot === "cap") variantKey = selectedCap;
      else if (slot === "roller") variantKey = selectedFitment;
      else if (slot === "sprayer") variantKey = selectedSprayer;
      else if (slot === "pump") variantKey = selectedPump;

      if (!variantKey) return;

      const asset = bySlot[slot]?.find((a) => a.variantKey === variantKey);
      if (asset) {
        layers.push({ slot, asset, zIndex: index + 1 });
      }
    });

    return layers;
  }, [familyData, applicator, selectedBottle, selectedCap, selectedFitment, selectedSprayer, selectedPump, bySlot]);

  // ── Loading / Error states ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="aspect-[10/11] bg-bone rounded-sm border border-champagne/50 animate-pulse flex items-center justify-center">
        <p className="text-xs text-slate/40 uppercase tracking-widest">Loading configurator…</p>
      </div>
    );
  }

  if (error || !familyData) {
    return (
      <div className="aspect-[10/11] bg-bone rounded-sm border border-champagne/50 flex items-center justify-center">
        <p className="text-xs text-red-400 uppercase tracking-widest">{error || "No data"}</p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const bottles = bySlot.body ?? [];
  const caps = bySlot.cap ?? [];
  const rollers = bySlot.roller ?? [];
  const sprayers = bySlot.sprayer ?? [];
  const pumps = bySlot.pump ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* ── Canvas: Stacked layers ────────────────────────────────────── */}
      <div
        className="relative aspect-[10/11] rounded-sm border border-champagne/50 overflow-hidden"
        style={{ backgroundColor: bgColor }}
      >
        {activeLayers.map(({ slot, asset, zIndex }) => (
          <img
            key={asset._key}
            src={sanityImageUrl(asset.image.asset.url, 1000)}
            alt={`${slot} — ${asset.variantKey}`}
            className="absolute inset-0 w-full h-full object-contain transition-opacity duration-200"
            style={{ zIndex }}
            draggable={false}
          />
        ))}

        {/* Family label */}
        <div className="absolute top-3 left-3 z-50">
          <span className="inline-flex items-center px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full bg-obsidian/80 text-white backdrop-blur-sm">
            {familyData.displayName}
          </span>
        </div>
      </div>

      {/* ── Controls ──────────────────────────────────────────────────── */}
      <div className="space-y-5">

        {/* Applicator type toggle */}
        <div>
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate mb-2">
            Applicator Type
          </p>
          <div className="flex gap-2">
            {(["rollon", "spray", "lotion"] as ApplicatorType[]).map((type) => (
              <button
                key={type}
                onClick={() => setApplicator(type)}
                className={`
                  px-3 py-1.5 text-[11px] font-medium tracking-wide rounded-md border transition-all
                  ${applicator === type
                    ? "bg-obsidian text-white border-obsidian"
                    : "bg-white text-slate border-champagne hover:border-obsidian/30"
                  }
                `}
              >
                {APPLICATOR_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {/* Glass color swatches */}
        <div>
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate mb-2">
            Glass Color
            {selectedBottle && (
              <span className="ml-2 font-normal normal-case tracking-normal text-slate/60">
                {BOTTLE_LABELS[selectedBottle] ?? selectedBottle}
              </span>
            )}
          </p>
          <div className="flex gap-2">
            {bottles.map((asset) => (
              <Swatch
                key={asset.variantKey}
                color={GLASS_COLORS[asset.variantKey] ?? "#CCC"}
                label={BOTTLE_LABELS[asset.variantKey] ?? asset.variantKey}
                selected={selectedBottle === asset.variantKey}
                onClick={() => setSelectedBottle(asset.variantKey)}
                isLight={LIGHT_SWATCHES.has(asset.variantKey)}
              />
            ))}
          </div>
        </div>

        {/* Roller-specific: fitment + cap */}
        {applicator === "rollon" && (
          <>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate mb-2">
                Roller Type
                {selectedFitment && (
                  <span className="ml-2 font-normal normal-case tracking-normal text-slate/60">
                    {selectedFitment === "MTL-ROLL" ? "Metal" : "Plastic"}
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                {rollers.map((asset) => (
                  <Swatch
                    key={asset.variantKey}
                    color={FINISH_COLORS[asset.variantKey] ?? "#CCC"}
                    label={asset.variantKey === "MTL-ROLL" ? "Metal Roller" : "Plastic Roller"}
                    selected={selectedFitment === asset.variantKey}
                    onClick={() => setSelectedFitment(asset.variantKey)}
                    isLight={LIGHT_SWATCHES.has(asset.variantKey)}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate mb-2">
                Cap Finish
                {selectedCap && (
                  <span className="ml-2 font-normal normal-case tracking-normal text-slate/60">
                    {selectedCap}
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {caps.map((asset) => (
                  <Swatch
                    key={asset.variantKey}
                    color={FINISH_COLORS[asset.variantKey] ?? "#CCC"}
                    label={asset.variantKey}
                    selected={selectedCap === asset.variantKey}
                    onClick={() => setSelectedCap(asset.variantKey)}
                    isLight={LIGHT_SWATCHES.has(asset.variantKey)}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Sprayer finish */}
        {applicator === "spray" && (
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate mb-2">
              Spray Finish
              {selectedSprayer && (
                <span className="ml-2 font-normal normal-case tracking-normal text-slate/60">
                  {selectedSprayer}
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {sprayers.map((asset) => (
                <Swatch
                  key={asset.variantKey}
                  color={FINISH_COLORS[asset.variantKey] ?? "#CCC"}
                  label={asset.variantKey}
                  selected={selectedSprayer === asset.variantKey}
                  onClick={() => setSelectedSprayer(asset.variantKey)}
                  isLight={LIGHT_SWATCHES.has(asset.variantKey)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Lotion pump finish */}
        {applicator === "lotion" && (
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate mb-2">
              Pump Finish
              {selectedPump && (
                <span className="ml-2 font-normal normal-case tracking-normal text-slate/60">
                  {selectedPump}
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {pumps.map((asset) => (
                <Swatch
                  key={asset.variantKey}
                  color={FINISH_COLORS[asset.variantKey] ?? "#CCC"}
                  label={asset.variantKey}
                  selected={selectedPump === asset.variantKey}
                  onClick={() => setSelectedPump(asset.variantKey)}
                  isLight={LIGHT_SWATCHES.has(asset.variantKey)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function groupBySlot(assets: LayerAsset[]): Record<string, LayerAsset[]> {
  const result: Record<string, LayerAsset[]> = {};
  for (const asset of assets) {
    if (!result[asset.slot]) result[asset.slot] = [];
    result[asset.slot].push(asset);
  }
  return result;
}
