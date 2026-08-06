import assert from "node:assert/strict";
import test from "node:test";

import {
    CYLINDER_BEAUTY_UPLOADS,
    buildCylinderBeautyGalleryDocument,
} from "../scripts/cylinder-beauty-gallery-sanity-core.mjs";

test("publishes exactly the five canonical glass assets", () => {
    assert.deepEqual(
        CYLINDER_BEAUTY_UPLOADS.map((asset) => asset.glassKey),
        ["CLR", "AMB", "BLU", "FRS", "SWL"],
    );
    assert.ok(CYLINDER_BEAUTY_UPLOADS.every((asset) => asset.absolutePath.endsWith(".png")));
});

test("builds the atomic storefront-ready Sanity gallery document", () => {
    const uploadedAssets = Object.fromEntries(
        CYLINDER_BEAUTY_UPLOADS.map((asset) => [asset.glassKey, `image-${asset.glassKey}-2080x2288-png`]),
    );
    const document = buildCylinderBeautyGalleryDocument(uploadedAssets);

    assert.equal(document._id, "paperDollBeautyGallery.CYL-9ML");
    assert.equal(document._type, "paperDollBeautyGallery");
    assert.equal(document.canvasWidth, 2080);
    assert.equal(document.canvasHeight, 2288);
    assert.equal(document.storefrontReady, true);
    assert.equal(document.referenceRoller, "metal-roller");
    assert.equal(document.referenceCapFinish, "matte-silver");
    assert.equal(document.heroes.length, 5);
    assert.deepEqual(
        document.heroes.map((hero) => hero.image.asset._ref),
        CYLINDER_BEAUTY_UPLOADS.map((asset) => uploadedAssets[asset.glassKey]),
    );
});

test("refuses to build a partial gallery", () => {
    assert.throws(
        () => buildCylinderBeautyGalleryDocument({ CLR: "image-CLR-2080x2288-png" }),
        /all five/i,
    );
});
