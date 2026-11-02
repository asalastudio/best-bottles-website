# Publish the corrected 3.3 ml and 4 ml sprayers

The earlier hosted release omitted these four reviewed configurations, leaving the live page on its legacy photograph. This correction adds GBSpry3mlClBlk, GBSpry3mlClWht, GBSpry4mlClBlk and GBSpry4mlClWh to the approved hosted manifest. The previous 267 recipes are preserved.

The same continuous, registered glass replaces the old ghost-rim source for black and white sprayers of each size. Seven source media layers are content-addressed in Vercel Blob and verified by public GET against SHA-256. Both the assembled and detached clear overcap use hosted media. Stage geometry, tube length, frame, shoulder seating, and all three views retain the reviewed local values. Exploded labels identify the 12 mm neck finish and included clear overcap independently of local filenames.

These small sprays remain excluded from the standalone builder. Catalog cards, product hero, glass selector and component strip resolve the shared hosted recipes. No backend records, product identity, price, inventory or source assets are changed.

Run `node --env-file=PATH_TO_EXISTING_BLOB_ENV scripts/paperdoll/publish-small-sprayer-masters.mjs --apply` from the verified checkout to reproduce the extension. The script refuses a baseline other than the existing 267 plus these four exact SKUs and never overwrites or deletes media.

Regression checks cover the previously missing hosted recipes, source hashes, detached media, product-page-only policy and preserved geometry across all views. Hosted desktop/mobile verification and CI are required before merge. This file does not claim production deployment.
