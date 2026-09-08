# Mobile builder preview and touch investigation — September 8, 2026

## Reproduced causes and repairs

- Cobalt 5 ml metal-roller kits omit the roller layer. Restore the nine exact-SKU original PSD layers only when the current body image SHA matches their registration. One metal mechanism, nine cap finishes; no new compatibility is inferred.
- Fitment-stage filtering hid every cap, including cap-only choices. Screw and tear-off cap mechanisms now show their cap while roller caps remain hidden until Finish.
- Mobile preview selected the first configuration before a fitment was selected. It now remains uncapped until the customer chooses a mechanism.
- The preview frame was calculated only from body height. Tall sprayers could extend above it. Frames now include actual registered part bounds, including expanded views and vintage hoses/tassels. Source geometry is unchanged.

## Button investigation

The reported intermittent Continue stall has NOT been reproduced or declared fixed. Traced enabled/pending state, event hit targets, click handling, stage updates and focus/scroll behavior. No speculative pointer-up or duplicate click handler was added.

`node scripts/verify-builder-mobile-controls.mjs` runs 48 mobile paths across WebKit and Chrome, 320/390 px portrait and 844 px landscape, Clear/Cobalt, metal/plastic rollers, screw cap and sprayer. It uses raw touch taps on text, SVG arrows and lower-right edges after scrolling, verifies selected preview layers, opens/closes previews, continues through Finish/Review and edits fitment. Captures and pointer/stage traces go to BB_PROOF_DIR. It does not submit a cart or mutate products.

Use BB_PLAYWRIGHT_MODULE for an installed Playwright module, BB_CHROME_PATH for Chrome, and BB_BASE_URL for the local production server. The separate `verify-builder-preview-close.mjs` covers close icon/text/edge, native dismissal, Escape, focus and quantity preservation.

## Source provenance

`cobalt-roller-sources.json` records exact uncapped PSD paths/hashes, layer names, body hashes and uniform transforms. Reproduce via `scripts/paperdoll/export_cobalt_builder_rollers.py --source-root <PSD master> --configurations <builder snapshot.json>` with Pillow, numpy and psd-tools. Original PSDs are read-only. No backend kits, hero assets, compatibility records, pricing or cart code changed.

## Verification boundary

Full Vitest suite: 1,551 passed, seven skipped. Targeted lint and standalone TypeScript passed. Production Webpack build passed. All 48 production-browser paths and 10 additional modal-dismissal checks passed with zero browser runtime errors. Local production server: http://localhost:3001/matrix?family=Cylinder. Saved screenshots show the exact Cobalt metal roller, screw cap and uncropped sprayer.

Physical iPhone Safari toolbar/touch behavior remains unverified. Browser-engine emulation does not reproduce the iOS browser chrome. No production deployment is included. The intermittent stall remains open pending a reproducible case.
