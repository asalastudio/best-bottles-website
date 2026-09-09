"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { SlidersHorizontal, X } from "@/components/icons";
import FocusedProductCard from "./FocusedProductCard";
import {
  APPLICATOR_NAV,
  EMPTY_FILTERS,
  type CatalogFilters,
} from "@/lib/catalogFilters";
import type { CatalogSearchResultShape } from "@/lib/catalogSearchFallback";
import type {
  GuidedFinderFamily,
  GuidedFinderProduct,
} from "@/lib/products/guided-finder";
import styles from "./MobileFamilyCatalog.module.css";

type Props = {
  family: string;
  families: readonly GuidedFinderFamily[];
  count: number;
  finderUrl: string;
  filters: CatalogFilters;
  facets: CatalogSearchResultShape["facets"];
  onFilters: (filters: CatalogFilters) => void;
  onProductOpen: (product: GuidedFinderProduct) => void;
  updating: boolean;
  error: string | null;
  story: string;
  hero: string;
  heroAlt: string;
  onHelp: () => void;
};

export default function MobileFamilyCatalog(p: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState(p.filters);
  const [open, setOpen] = useState(false);
  const products = p.families.flatMap((f) => f.exactProducts);
  const application = (filters: CatalogFilters) =>
    APPLICATOR_NAV.find(
      (a) =>
        a.buckets.length === filters.applicators.length &&
        a.buckets.every((b) => filters.applicators.includes(b)),
    )?.value ?? "";
  const clear = {
    ...EMPTY_FILTERS,
    families: [p.family],
    category: p.filters.category,
    collection: p.filters.collection,
  };
  const chips: { label: string; next: CatalogFilters }[] = [
    ...(
      ["capacities", "colors", "neckThreadSizes", "rollerMaterials"] as const
    ).flatMap((key) =>
      p.filters[key].map((value) => ({
        label:
          key === "rollerMaterials"
            ? `${value === "metal" ? "Metal" : "Plastic"} roller`
            : key === "neckThreadSizes"
              ? `${value} neck`
              : value,
        next: {
          ...p.filters,
          [key]: p.filters[key].filter((v) => v !== value),
        },
      })),
    ),
    ...(p.filters.applicators.length
      ? [
          {
            label:
              APPLICATOR_NAV.find((a) => a.value === application(p.filters))
                ?.label ?? "Fitment",
            next: { ...p.filters, applicators: [], rollerMaterials: [] },
          },
        ]
      : []),
    ...(p.filters.search
      ? [{ label: p.filters.search, next: { ...p.filters, search: "" } }]
      : []),
    ...(p.filters.priceMin != null || p.filters.priceMax != null
      ? [
          {
            label: "Price range",
            next: { ...p.filters, priceMin: null, priceMax: null },
          },
        ]
      : []),
  ];
  const close = () => {
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <section
      className={styles.mobile}
      data-mobile-family-catalog
      aria-labelledby="mobile-family-title"
    >
      <header className={styles.heading}>
        <h1 id="mobile-family-title">
          {p.family}
          {/bottles?$|jars?$/i.test(p.family) ? "" : " bottles"}
        </h1>
        <p role="status" aria-live="polite">
          {p.updating
            ? "Updating products…"
            : `${p.count.toLocaleString()} products`}
        </p>
      </header>
      <div className={styles.toolbar}>
        <button
          ref={trigger}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => {
            setDraft(p.filters);
            setOpen(true);
            dialog.current?.showModal();
          }}
        >
          <SlidersHorizontal size={19} /> Filters
          {chips.length ? ` (${chips.length})` : ""}
        </button>
        <Link
          href={`/matrix?family=${encodeURIComponent(p.family)}&from=finder`}
        >
          Build a Bottle
        </Link>
      </div>
      {chips.length > 0 && (
        <div className={styles.chips} aria-label="Active filters">
          {chips.map((chip) => (
            <button
              key={chip.label}
              disabled={p.updating}
              onClick={() => p.onFilters(chip.next)}
              aria-label={`Remove ${chip.label} filter`}
            >
              {chip.label}
              <X size={14} />
            </button>
          ))}
          <button disabled={p.updating} onClick={() => p.onFilters(clear)}>
            Clear filters
          </button>
        </div>
      )}
      {p.error && (
        <p role="alert" className={styles.error}>
          {p.error}{" "}
          <button onClick={() => p.onFilters(p.filters)}>Try again</button>
        </p>
      )}
      <div
        className={styles.grid}
        aria-busy={p.updating}
        aria-label={`${p.family} products`}
      >
        {products.map((product) => (
          <FocusedProductCard
            key={product.id}
            product={product}
            finderUrl={p.finderUrl}
            onOpen={p.onProductOpen}
          />
        ))}
      </div>
      {!products.length && (
        <div className={styles.empty}>
          <h2>No matching products</h2>
          <p>Try fewer filters to see more {p.family} bottles.</p>
          <button onClick={() => p.onFilters(clear)}>Clear filters</button>
          <button onClick={p.onHelp}>Ask Grace for help</button>
        </div>
      )}
      <details className={styles.about}>
        <summary>About {p.family === "Atomizer" ? "Atomizers" : `${p.family} bottles`}</summary>
        <p>{p.story}</p>
        {/* Existing editorial photography is retained below the listings. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.hero} alt={p.heroAlt} loading="lazy" />
        <button onClick={p.onHelp}>Ask Grace for help choosing</button>
      </details>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="family-filters-heading"
        onClose={() => {
          setOpen(false);
          trigger.current?.focus();
        }}
      >
        <div className={styles.dialogHeading}>
          <h2 id="family-filters-heading">Filter {p.family} bottles</h2>
          <button onClick={close} aria-label="Close filters">
            <X size={22} />
          </button>
        </div>
        <label className={styles.field}>
          Bottle size
          <select
            aria-label="Bottle size"
            value={draft.capacities.length === 1 ? draft.capacities[0] : ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                capacities: e.target.value ? [e.target.value] : [],
              })
            }
          >
            <option value="">All sizes</option>
            {Object.values(p.facets.capacities)
              .sort((a, b) => (a.ml ?? Infinity) - (b.ml ?? Infinity))
              .map((c) => (
                <option key={c.label}>{c.label}</option>
              ))}
          </select>
        </label>
        <fieldset>
          <legend>Glass</legend>
          <div className={styles.glass}>
            {Object.keys(p.facets.colors).map((color) => (
              <label key={color}>
                <input
                  type="checkbox"
                  checked={draft.colors.includes(color)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      colors: e.target.checked
                        ? [...draft.colors, color]
                        : draft.colors.filter((c) => c !== color),
                    })
                  }
                />
                {color}
              </label>
            ))}
          </div>
        </fieldset>
        <label className={styles.field}>
          Fitment
          <select
            aria-label="Fitment"
            value={application(draft)}
            onChange={(e) => {
              const a = APPLICATOR_NAV.find((a) => a.value === e.target.value);
              setDraft({
                ...draft,
                applicators: a ? [...a.buckets] : [],
                rollerMaterials:
                  a?.value === "rollon" ? draft.rollerMaterials : [],
              });
            }}
          >
            <option value="">All fitments</option>
            {APPLICATOR_NAV.filter((a) =>
              a.buckets.some((b) => p.facets.applicators[b] > 0),
            ).map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        {application(draft) === "rollon" && (
          <label className={styles.field}>
            Roller material
            <select
              aria-label="Roller material"
              value={draft.rollerMaterials[0] ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  rollerMaterials: e.target.value
                    ? [e.target.value as "metal" | "plastic"]
                    : [],
                })
              }
            >
              <option value="">All roller materials</option>
              <option value="metal">Metal</option>
              <option value="plastic">Plastic</option>
            </select>
          </label>
        )}
        <fieldset>
          <legend>Finish</legend>
          <p className={styles.hint}>
            Choose the cap or finish on the product page.
          </p>
        </fieldset>
        <label className={styles.field}>
          Neck size
          <select
            aria-label="Neck size"
            value={draft.neckThreadSizes[0] ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                neckThreadSizes: e.target.value ? [e.target.value] : [],
              })
            }
          >
            <option value="">All neck sizes</option>
            {Object.keys(p.facets.neckThreadSizes).map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <div className={styles.dialogActions}>
          <button onClick={() => setDraft(clear)}>Clear filters</button>
          <button
            className={styles.apply}
            disabled={p.updating}
            onClick={() => {
              p.onFilters(draft);
              close();
            }}
          >
            Show products
          </button>
        </div>
      </dialog>
    </section>
  );
}
