"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

export type Variant = {
  sku: string;
  graceSku: string | null;
  closure: string;
  closureLabel: string;
  color: string;
  swatch: string;
  image: string;
  thumb: string;
  price: number | null;
  stock: string | null;
  applicator: string | null;
  productUrl: string | null;
  capacityMl: string | null;
  sourcePsd: string;
};

export type FamilyManifest = {
  id: string;
  name: string;
  neckFinish: string;
  canvas: { width: number; height: number };
  closures: { id: string; label: string; count: number }[];
  variants: Variant[];
};

const money = (v: number | null) =>
  v === null ? "—" : `$${v.toFixed(2)}`;

export default function PaperDollSwapper({ family }: { family: FamilyManifest }) {
  const [closure, setClosure] = useState(family.closures[0].id);
  const [color, setColor] = useState(
    family.variants.find((v) => v.closure === family.closures[0].id)!.color,
  );

  const forClosure = useMemo(
    () => family.variants.filter((v) => v.closure === closure),
    [family.variants, closure],
  );

  const selected =
    forClosure.find((v) => v.color === color) ?? forClosure[0];

  // Changing closure keeps the colourway when that finish exists on the new
  // closure, so switching Bulb -> Bulb+Tassel does not reset the customer's
  // colour choice.
  function pickClosure(next: string) {
    const pool = family.variants.filter((v) => v.closure === next);
    setClosure(next);
    if (!pool.some((v) => v.color === color)) setColor(pool[0].color);
  }

  return (
    <main className="min-h-screen bg-bone">
      <section className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:py-16">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2 lg:gap-20">

          {/* ── Image panel ───────────────────────────────────────────── */}
          <div className="lg:sticky lg:top-[120px]">
            <div className="lg:grid lg:grid-cols-[58px_minmax(0,1fr)] lg:gap-3">

              {/* Closure-type rail: one representative plate per archetype */}
              <div className="mb-3 flex gap-2 overflow-x-auto lg:mb-0 lg:flex-col lg:overflow-visible">
                {family.closures.map((c) => {
                  const rep =
                    family.variants.find(
                      (v) => v.closure === c.id && v.color === color,
                    ) ?? family.variants.find((v) => v.closure === c.id)!;
                  const on = c.id === closure;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => pickClosure(c.id)}
                      aria-pressed={on}
                      title={c.label}
                      className={`relative aspect-square w-14 shrink-0 overflow-hidden rounded-sm border bg-white transition lg:w-full ${
                        on
                          ? "border-obsidian ring-1 ring-obsidian"
                          : "border-champagne/60 hover:border-muted-gold"
                      }`}
                    >
                      <Image
                        src={rep.thumb}
                        alt={c.label}
                        fill
                        sizes="58px"
                        className="object-contain p-0.5"
                      />
                    </button>
                  );
                })}
              </div>

              <div className="min-w-0">
                <div className="relative aspect-[10/11] overflow-hidden rounded-sm border border-champagne/50 bg-white">
                  <Image
                    key={selected.sku}
                    src={selected.image}
                    alt={`${family.name} with ${selected.closureLabel}, ${selected.color}`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 620px"
                    priority
                    className="object-contain"
                  />
                  <div className="pointer-events-none absolute left-3 top-3">
                    <span className="rounded-full bg-obsidian/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                      {family.variants.length} Variants
                    </span>
                  </div>
                  <div className="pointer-events-none absolute bottom-3 right-3">
                    <span className="select-none font-mono text-[9px] uppercase tracking-widest text-slate/40">
                      {selected.sku}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Detail panel ──────────────────────────────────────────── */}
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-gold">
              {family.neckFinish} neck finish
            </p>
            <h1 className="mt-2 font-serif text-3xl leading-tight text-obsidian lg:text-4xl">
              {family.name}
            </h1>
            <p className="mt-2 text-sm text-slate">
              {selected.applicator ?? selected.closureLabel} · {selected.color}
            </p>

            <div className="mt-5 flex items-baseline gap-3">
              <span className="text-2xl font-semibold text-obsidian">
                {money(selected.price)}
              </span>
              <span className="text-xs text-slate">each</span>
              {selected.stock && (
                <span className="ml-auto text-[11px] font-semibold uppercase tracking-wider text-muted-gold">
                  {selected.stock}
                </span>
              )}
            </div>

            {/* Step 1 — closure archetype */}
            <div className="mt-8">
              <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold text-obsidian">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-muted-gold text-[10px] font-bold text-muted-gold">
                  1
                </span>
                Closure
              </h2>
              <div className="flex flex-wrap gap-2">
                {family.closures.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickClosure(c.id)}
                    aria-pressed={c.id === closure}
                    className={`min-h-10 border px-3 py-2 text-xs transition ${
                      c.id === closure
                        ? "border-obsidian bg-obsidian text-white"
                        : "border-champagne bg-white text-obsidian hover:border-muted-gold"
                    }`}
                  >
                    {c.label}
                    <span
                      className={`ml-2 text-[10px] ${
                        c.id === closure ? "text-white/60" : "text-slate/60"
                      }`}
                    >
                      {c.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2 — colourway */}
            <div className="mt-8">
              <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold text-obsidian">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-muted-gold text-[10px] font-bold text-muted-gold">
                  2
                </span>
                Finish
                <span className="ml-1 font-normal text-slate">{selected.color}</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                {forClosure.map((v) => (
                  <button
                    key={v.sku}
                    type="button"
                    onClick={() => setColor(v.color)}
                    aria-pressed={v.sku === selected.sku}
                    title={v.color}
                    className={`h-9 w-9 rounded-full border-2 transition ${
                      v.sku === selected.sku
                        ? "border-obsidian"
                        : "border-transparent hover:border-champagne"
                    }`}
                  >
                    <span
                      className="block h-full w-full rounded-full border border-black/10"
                      style={{ background: v.swatch }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="mt-10 min-h-12 w-full bg-obsidian px-6 text-sm font-semibold uppercase tracking-wider text-white transition hover:bg-ink"
            >
              Add to cart — {money(selected.price)}
            </button>

            <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-champagne/60 pt-6 text-xs">
              {[
                ["Website SKU", selected.sku],
                ["Grace SKU", selected.graceSku ?? "—"],
                ["Capacity", selected.capacityMl ? `${selected.capacityMl} ml` : "—"],
                ["Neck finish", family.neckFinish],
              ].map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-slate">{k}</dt>
                  <dd className="font-mono text-obsidian">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    </main>
  );
}
