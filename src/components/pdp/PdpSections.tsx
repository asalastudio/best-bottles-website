"use client";

/**
 * The smaller blocks of the product page (design 3a §4.5–§5, §9): the "In this
 * order" panel, product information, the Build Your Bottle strip, the tech
 * sheet, the collection band and the mobile sticky bar. Presentational; every
 * value arrives resolved from the page model.
 */
import type { CSSProperties, ReactNode } from "react";
import LocaleLink from "@/components/LocaleLink";
import styles from "./pdp.module.css";
import PdpKitPartImage from "./PdpKitPartImage";
import PdpKitStackImage from "./PdpKitStackImage";
import PdpDimensionDrawing from "./PdpDimensionDrawing";
import type { DrawingSpec } from "@/lib/products/pdp-redesign/drawings";
import { useIsPdpMobile } from "./PdpStage";
import { ORDER_MINIMUM } from "@/lib/checkout";
import type { CollectionBand, TechRow } from "@/lib/products/pdp-redesign/model";
import { bodyPart, closureParts, fitmentPart, type KitLike } from "@/lib/products/pdp-redesign/stage";

// ── In this order ─────────────────────────────────────────────────────────────

export type OrderLineView = {
    key: string;
    swatchStyle: CSSProperties;
    label: string;
    qty: number;
    total: number;
    onRemove: () => void;
};

export function PdpOrderLines({
    lines, total, minimum, formatPrice,
}: {
    lines: OrderLineView[];
    total: number;
    minimum: { subtotal: number; remaining: number; met: boolean };
    formatPrice: (usd: number) => string;
}) {
    if (lines.length === 0) return null;
    const percent = Math.min(100, Math.round((minimum.subtotal / ORDER_MINIMUM) * 100));
    return (
        <div className={styles.order} data-testid="pdp-order-lines" aria-live="polite">
            <div className={styles.orderHead}>
                <span>In this order · {lines.length}</span>
                <span>{formatPrice(total)}</span>
            </div>
            {lines.map((line) => (
                <div key={line.key} className={styles.orderLine} data-testid="pdp-order-line">
                    <span className={styles.orderSwatch} style={line.swatchStyle} aria-hidden />
                    <span className={styles.orderLabel}>{line.label}</span>
                    <span className={styles.orderQty}>× {line.qty.toLocaleString("en-US")}</span>
                    <span className={styles.orderTotal}>{formatPrice(line.total)}</span>
                    <button type="button" className={styles.orderRemove} aria-label={`Remove ${line.label}`} onClick={line.onRemove}>×</button>
                </div>
            ))}
            <div className={styles.orderBar} aria-hidden><div className={styles.orderBarFill} style={{ width: `${percent}%` }} /></div>
            <span className={styles.orderMinimum} data-testid="pdp-order-minimum">
                {minimum.met ? "Order minimum reached" : `Add ${formatPrice(minimum.remaining)} more to reach the ${formatPrice(ORDER_MINIMUM)} order minimum`}
            </span>
        </div>
    );
}

// ── Product information ───────────────────────────────────────────────────────

export function PdpProductInfo({ itemType, itemName, description }: { itemType: string | null; itemName: string | null; description: string | null }) {
    return (
        <dl className={styles.info} data-testid="pdp-product-info">
            {itemType && (<><dt className={styles.infoKey}>Item type</dt><dd>{itemType}</dd></>)}
            {itemName && (<><dt className={styles.infoKey}>Item name</dt><dd className={styles.infoMono} data-testid="pdp-item-name">{itemName}</dd></>)}
            {description && (<><dt className={styles.infoKey}>Item description</dt><dd className={styles.infoDescription} data-testid="pdp-item-description">{description}</dd></>)}
        </dl>
    );
}

// ── Build Your Bottle ─────────────────────────────────────────────────────────

export function PdpBuildStrip({
    capacityLabel, glassLabel, neck, bodyKit, fitmentKit, capKits, href,
}: {
    capacityLabel: string;
    glassLabel: string;
    neck: string | null;
    bodyKit: KitLike | null;
    fitmentKit: KitLike | null;
    capKits: KitLike[];
    href: string;
}) {
    const mobile = useIsPdpMobile();
    const body = bodyPart(bodyKit);
    const fitment = fitmentPart(fitmentKit);
    // Option 4a shows two caps at 40 px in the 64 px well; 3a shows three at 72 px in the 120 px well.
    const caps = capKits.map((kit) => ({ kit, parts: closureParts(kit) })).filter((entry) => entry.parts.length).slice(0, mobile ? 2 : 3);
    const bodyHeight = mobile ? 60 : 112;
    const partHeight = mobile ? 40 : 72;
    return (
        <section className={styles.build} aria-labelledby="pdp-build-title" data-testid="pdp-build-strip">
            <div className={styles.buildHead}>
                <h2 id="pdp-build-title" className={styles.buildTitle}>BUILD YOUR BOTTLE.</h2>
                <span className={styles.buildLine}>Start from this {capacityLabel}. Three steps.</span>
            </div>
            <div className={styles.buildGrid}>
                <div className={styles.tile}>
                    <span className={styles.tileNumber}>01</span>
                    <div className={styles.tileWell}>
                        {body && bodyKit ? <PdpKitPartImage part={body} canvas={bodyKit.canvas} height={bodyHeight} /> : null}
                    </div>
                    <span className={styles.tileTitle}>Shape &amp; size</span>
                    <span className={styles.tileBody}>{glassLabel} {capacityLabel}, pre-selected.</span>
                </div>
                <div className={styles.tile}>
                    <span className={styles.tileNumber}>02</span>
                    <div className={styles.tileWell}>
                        {fitment && fitmentKit ? <PdpKitPartImage part={fitment} canvas={fitmentKit.canvas} height={partHeight} /> : null}
                    </div>
                    <span className={styles.tileTitle}>Fitment</span>
                    <span className={styles.tileBody}>Roller, spray, dropper or pump{neck ? ` for the ${neck} neck` : ""}.</span>
                </div>
                <div className={styles.tile}>
                    <span className={styles.tileNumber}>03</span>
                    <div className={styles.tileWell}>
                        {caps.map(({ kit, parts }) => <PdpKitStackImage key={kit.sku} parts={parts} canvas={kit.canvas} height={partHeight} />)}
                    </div>
                    <span className={styles.tileTitle}>Cap</span>
                    <span className={styles.tileBody}>Choose the finish. Every cap shown fits.</span>
                </div>
                <div className={styles.tileCta}>
                    <div className={styles.tileCtaText}>
                        <span className={styles.tileCtaTitle}>Your vision.<br />Our expertise.</span>
                        <span className={styles.tileBody}>Sold assembled, from one piece.</span>
                        <LocaleLink href={href} className={styles.blackButton} data-testid="pdp-build-cta">Start building →</LocaleLink>
                    </div>
                    {body && bodyKit ? <PdpKitPartImage part={body} canvas={bodyKit.canvas} height={130} className={styles.tileKit} /> : null}
                </div>
            </div>
        </section>
    );
}

// ── Tech sheet ────────────────────────────────────────────────────────────────

export function PdpTechSheet({ rows, onPrint, drawing = null }: { rows: TechRow[]; onPrint?: () => void; drawing?: DrawingSpec | null }) {
    if (rows.length === 0) return null;
    return (
        <section className={styles.techWrap} aria-label="Tech sheet" data-testid="pdp-tech-sheet">
            <div className={styles.tech}>
                {drawing
                    ? <div className={styles.techDrawing} data-has-drawing="true"><PdpDimensionDrawing spec={drawing} /></div>
                    : <div className={styles.techDrawing} aria-hidden>dimension drawing</div>}
                <div>
                    <div className={styles.techHead}>
                        <span className={styles.techLabel}>TECH SHEET</span>
                        {onPrint ? <button type="button" className={styles.techPdf} onClick={onPrint}>PDF</button> : null}
                    </div>
                    <div className={styles.techRows}>
                        {rows.map((row) => (
                            <div key={row.k} className={styles.techRow}><span>{row.k}</span><span>{row.v}</span></div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

// ── Collection band ───────────────────────────────────────────────────────────

export function PdpCollectionBand({
    band, description, familyHref, familyLabel,
}: {
    band: CollectionBand;
    description: string;
    familyHref: string;
    familyLabel: string;
}) {
    return (
        <section className={styles.collectionWrap} aria-labelledby="pdp-collection-title" data-testid="pdp-collection">
            <div className={styles.collection}>
                <div className={styles.collectionText}>
                    <span className={styles.eyebrow}>Part of the collection</span>
                    <h2 id="pdp-collection-title" className={styles.collectionTitle}>{band.title}</h2>
                    <p className={styles.collectionBody}>{description}</p>
                    <div className={styles.collectionButtons}>
                        <LocaleLink href={band.href} className={styles.blackButton}>View the collection</LocaleLink>
                        <LocaleLink href={familyHref} className={styles.outlineButton}>All {familyLabel} bottles</LocaleLink>
                    </div>
                </div>
                <div className={styles.collectionImage}>
                    {/* Kit layers and plates stay plain <img>: their pixel canvas and alpha must not change. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={band.image} alt={`${band.title} collection`} loading="lazy" decoding="async" />
                </div>
            </div>
        </section>
    );
}

// ── Sticky bar (mobile) ───────────────────────────────────────────────────────

export function PdpStickyBar({
    line, total, disabled, label, onAdd,
}: {
    line: ReactNode;
    total: string;
    disabled: boolean;
    label: string;
    onAdd: () => void;
}) {
    return (
        <div className={styles.sticky} data-testid="pdp-sticky-bar" role="region" aria-label="Add to cart">
            <span className={styles.stickyText}>
                <span className={styles.stickyLine}>{line}</span>
                <span className={styles.stickyTotal}>{total}</span>
            </span>
            <button type="button" className={styles.stickyButton} disabled={disabled} onClick={onAdd} data-testid="pdp-sticky-add">{label}</button>
        </div>
    );
}
