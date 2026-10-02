type VariantFactsSource = {
    color?: string | null;
    applicator?: string | null;
    capStyle?: string | null;
    itemName?: string | null;
};

function known(value: string | null | undefined): string | null {
    const text = value?.trim();
    return text && !/^(mixed|unknown|n\/a|none|standard)$/i.test(text) ? text : null;
}

/** Display-only recovery for imports with empty structured fields. Read explicit
 * body/closure wording on the selected SKU, never a cap color, asset path or SKU
 * abbreviation. Unknown facts stay absent instead of becoming clear/spray. */
export function pdpVariantFacts(variant: VariantFactsSource | null | undefined, groupColor?: string | null) {
    const name = variant?.itemName ?? "";
    const bodyColor = name.match(/\b(cobalt blue|amber|frosted|clear|green|blue|black|white)\s+(?:(?:glass|plastic)\s+)?(?:bottle|jar)\b/i)
        ?? name.match(/\b(cobalt blue|amber|frosted|clear|green|blue|black|white)\s+(?:glass|plastic)\s+(?:cream\s+)?jar\b/i);
    const color = known(variant?.color)
        ?? (bodyColor ? bodyColor[1].replace(/\b\w/g, (letter) => letter.toUpperCase()) : null)
        ?? known(groupColor);
    const applicator = known(variant?.applicator);
    const closure = applicator === "Cap/Closure"
        ? known(variant?.capStyle) ?? "Cap/Closure"
        : applicator ?? known(variant?.capStyle) ?? (/\bwith\s+(?:[\w-]+\s+){0,4}cap\b/i.test(name) ? "Cap" : null);
    return { color, closure };
}
