# Bare glass masters — source separation correction

13 October 2026. Local work only. No masters accepted or replaced in the UI.

## Required asset structure

One master per exact body/capacity/neck/glass colour, with an empty open glass neck and no reducer, dip tube, actuator, cap, overcap, liquid or oil. Existing exterior dimensions, silhouette, shoulder, foot, axis and seating remain authoritative. Do not resize a different bottle to stand in for the required size.

Reducers, tubes, sprayers/pumps, collars, caps and overcaps are separate source-backed parts. A seated insert and its exposed exploded depiction may need two registered views of the same physical part. Only combinations supported by exact SKU/fitment evidence receive those parts. A reducer is not universally added to spray bottles.

## Confirmed finding

Empire 50 ml PSD body layers contain the reducer. The current registered body retains an insert-like interior, so the earlier tube-only pass did not establish bare-bottle acceptance. That family stays open. Source hashes and layer inventories are saved in source-layer-inventory.json.

The standalone source exists: BB-PSD-Files-Master/20. Caps/23. 18-415 Reducer/18-415Reducer.psd. Layer 2 is the visible white reducer, 114 x 128 pixels; Layer 1 is an unused black cap and is excluded. The reducer still needs exact dimensions, seating and quality clearance before integration. No master PSD was modified.

## Drafts generated

- Empire 50 ml v1: transparent output; edge noise and changed dimensions keep it rejected for use.
- Empire 50 ml v2: improved open mouth, original bone background. Sampled exterior body edges differ by up to two source-normalized pixels. Whole-body RGB mean difference 6.85/255.
- Empire 100 ml v1: open-neck candidate. Sampled exterior body edges differ by up to five source-normalized pixels. Whole-body RGB mean difference 4.52/255.

These measurements are diagnostics, not proof of exact geometry. The tool changed output resolutions; no candidate has been registered, integrated or accepted as a master. Both final drafts are held for full neck/body geometry review, including the appearance of the exposed bore. Native image editing was used; the tool did not expose its model version. Prompts, original output files, hashes and diagnostics are retained.

## Catalogue scope

The dated production snapshot contains 2,220 Glass Bottle records, mapping to 105 distinct body/neck/glass master keys. Ninety-six have a registered plate; nine do not. This includes held records and is not a count of defects or approved launch products. See glass-bottle-master-scope.csv. Existing plates all remain pending inspection for baked-in hardware and correct empty-glass appearance.

## Acceptance and continuation

1. Finish the Empire bare-neck geometry review against source and dimensions; the generated full-image drafts cannot be called pixel-identical.
2. Approve a registered bare master and separately verified reducer. Keep the shared master fixed while changing parts.
3. Update local master references and revalidate every dependent tube/component placement; their existing old-plate guards must not be bypassed.
4. Re-run all eight Empire lotion finishes and every reducer/spray/bulb/tassel assembly using that body in PDP, Builder and supported views.
5. Repeat by master key across the catalogue, retaining separate local, visual, UI and release statuses.

No publication, production write, merge or deployment. Browser/UI acceptance is still pending.

Evidence: /Users/jordanrichter/Documents/Codex/2026-10-01/users-jordanrichter-projects-clients-nemat-international/outputs/media-completion-2026-10-12/bare-glass-masters-2026-10-13
