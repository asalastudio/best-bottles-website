# Catalog Reconciliation Report

Generated: 2026-06-24T22:26:06.439Z

## Sources

| Source | Records | Notes |
|---|---|---|
| **CSV (canonical)** | 2285 rows | `data/grace_products_final.v2.csv` |
| **master_v8.3** | 3179 entries | `data/master_v8.3_products.json` |

## CSV self-coverage

- Rows with graceSku: **2285** / 2285
- Rows with valid color: **2081** / 2285
- Distinct (family, capacity, color) tuples: **218**

## CSV ↔ master_v8.3 (graceSku overlap)

| Set | Count |
|---|---|
| In both | **2153** |
| CSV only (not in master) | 132 |
| master_v8.3 only (not in CSV) | 994 |

### Sample CSV-only graceSkus

- `GB-CIR-CLR-100ML-RDC-SBLK`
- `GB-CIR-CLR-100ML-RDC-MSLV`
- `GB-CIR-CLR-100ML-RDC-SBLK-T`
- `GB-CIR-CLR-100ML-RDC-MSLV-T`
- `GB-CIR-FRS-100ML-RDC-SBLK`
- `GB-CIR-FRS-100ML-RDC-MSLV`
- `GB-CIR-FRS-100ML-RDC-SBLK-T`
- `GB-CIR-FRS-100ML-RDC-MSLV-T`
- `GB-CIR-CLR-50ML-RDC-SBLK`
- `GB-CIR-CLR-50ML-RDC-MSLV`

### Sample master-only graceSkus

- `CMP-CAP-BLK-20-400`
- `AB-ALU-CLR-250ML-SPR-BLK`
- `CMP-SPR-BLK-18-415-01`
- `CMP-SPR-SGLD-18-415`
- `CMP-SPR-IVGD-18-415-01`
- `CMP-SPR-IVSL-18-415-01`
- `CMP-SPR-LVN-18-415-01`
- `CMP-SPR-MSLV-18-415-01`
- `CMP-SPR-RED-18-415-01`
- `CMP-SPR-WHT-18-415-01`

## Recommendations

1. **CSV is the canonical source.** Any SKUs in master_v8.3 or Convex not in CSV are candidates for archival.
2. **The `canonical_slug` column in v2 CSV is the join key.** Use it for any CSV ↔ Convex ↔ Sanity reconciliation.
3. **Convex groups with no CSV match** may be legacy orphans. Decide: archive them, or add them to the CSV.
4. **Sanity documents with no CSV match** are likely orphaned editorial overrides. Reconcile manually.
5. **Run this report daily** after any CSV edit. The numbers should stabilize as Phase 2 (rebuildProductGroupsFromCsv) lands.
