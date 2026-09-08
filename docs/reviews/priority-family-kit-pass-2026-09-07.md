# Priority family kit pass — 2026-09-07

Target environment: Convex development `helpful-elephant-638`. Production is
untouched. A kit can advance only when its recorded `plateSha256` equals the
currently published development plate.

| Family | Plate-backed target | Safe master source inspected | Structurally separable | Source/layer review |
| --- | ---: | ---: | ---: | ---: |
| Round | 141 | 32 | 14 | 18 |
| Elegant | 224 | 102 | 72 | 30 |
| Circle | 192 | 88 | 61 | 27 |
| Diva | 120 | 25 | 25 | 0 |
| Empire | 65 | 27 | 25 | 2 |
| **Total** | **742** | **274** | **197** | **77** |

These are source-qualification counts, not release counts. A flat exact plate
can remain valid while its Photoshop source lacks safe, independently usable
physical layers.

## Round tranche 1

- 14 structurally separable candidates were compared with the live development
  plate hashes.
- 13 still matched the current front plate. `GBRnd78SpryCu` did not; its newer
  approved hero is retained and the obsolete PSD render is not used for a kit.
- 12 exact-current 128 mL kits pass alpha and assembled-parity gates.
- `LBRnd128LtnClOvrCap` remains held because the dip tube touches the PSD/output
  edge and fails the no-clipping alpha rule.
- Passing parity means range from 1.1469 to 1.7184 on the 0–255 scale, below the
  required maximum of 6, with tail-over-40 at or below 0.001874.
- Visual review collection: `round-128-kits-2026-09-07`.

No kit from this pass has been uploaded or indexed. Visual approval, publisher
dry run, development publication, hosted-asset verification, and mobile/desktop
picker verification remain separate gates.

## Elegant, Circle, Diva, and Empire candidate pass

| Family | Exact-current recipes | Clean candidates | Build holds | Passing parity mean | Maximum tail >40 | Review collection |
| --- | ---: | ---: | ---: | --- | ---: | --- |
| Elegant | 72 | 67 | 5 | 0.4702–1.5276 | 0.001371 | `elegant-kits-2026-09-08` |
| Circle | 41 | 40 | 1 | 1.1714–2.1950 | 0.004327 | `circle-kits-2026-09-08` |
| Diva | 25 | 24 | 1 | 1.5451–3.0714 | 0.008855 | `diva-kits-2026-09-08` |
| Empire | 25 | 19 | 6 | 1.1400–2.7672 | 0.000078 | `empire-kits-2026-09-08` |
| **Total** | **163** | **150** | **13** |  |  |  |

All 150 candidates record the current development plate hash and rebuild that
same plate within the alpha/parity gates. They are visual-review candidates;
none has been uploaded or indexed.

Circle has 20 additional structurally separable PSD assemblies whose capped
source render no longer matches the current shoulder/color-corrected front
plate. Those PSDs remain held so the kit pass cannot revert approved Circle
artwork. The other build holds are explicit in
`data/paper-doll/priority-family-kit-holds-2026-09-08.json`.

Empire atomizer hardware is often fused in the PSD. For accepted rows the
sprayer, bulb, hose, and tassel pixels remain one exact `fitment` assembly. The
six 50 mL tassel files with visible adjustment layers remain held; flattening or
mislabeling those layers would not produce an independently verified kit.

Across all five priority families, including Round tranche 1, this work has 162
clean local candidates, 14 build holds, and 21 exact-source hash holds. The 77
sources already classified for source/layer review remain outside the builder.
These totals are candidate coverage, not publication or full 742-row kit
coverage.
