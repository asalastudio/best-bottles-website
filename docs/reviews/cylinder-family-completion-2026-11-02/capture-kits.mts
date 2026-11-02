import fs from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { loadRegisterKits } from "../../../src/lib/register/load";
import { builderBodyIdentity, type CatalogRow } from "../../../src/lib/bottle-builder/model";
const dir = "docs/reviews/cylinder-family-completion-2026-11-02";
const snapshot = JSON.parse(fs.readFileSync(dir + "/current-family-snapshot.json", "utf8"));
const rows = Object.values(snapshot.families).flatMap((family: any) => family.rows) as CatalogRow[];
const glass = rows.filter(row => row.category === "Glass Bottle");
const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const registered = await loadRegisterKits(client, glass.map(row => row.graceSku), { strict: true });
const approved = JSON.parse(fs.readFileSync("src/lib/paper-doll/approved-kits.generated.json", "utf8"));
const kits = Object.fromEntries(glass.flatMap(row => {
    const kit = registered[row.websiteSku!] ?? registered[row.graceSku!];
    return kit ? [[row.websiteSku!, kit]] : [];
}));
fs.writeFileSync(dir + "/register-kits-before.json", JSON.stringify({ capturedAt: new Date().toISOString(), kits }, null, 2) + "\n");
const groups = new Map<string, any>();
for (const row of glass) {
    const key = builderBodyIdentity(row).bodyId + "|" + row.color;
    const group = groups.get(key) ?? { key, profile: builderBodyIdentity(row).bodyId, glass: row.color, category: row.category,
        capacityMl: row.capacityMl, neck: row.neckThreadSize, rows: [], registerAvailable: 0, approvedAvailable: 0, bodies: {}, tubeSources: {} };
    group.rows.push(row.websiteSku);
    const kit = approved.rows[row.websiteSku!] ?? kits[row.websiteSku!];
    if (kits[row.websiteSku!]) group.registerAvailable++;
    if (approved.rows[row.websiteSku!]) group.approvedAvailable++;
    for (const part of kit?.parts ?? []) {
        if (part.slot === "body") group.bodies[part.image.url] = (group.bodies[part.image.url] ?? 0) + 1;
        if (part.slot === "diptube") group.tubeSources[part.image.url] = (group.tubeSources[part.image.url] ?? 0) + 1;
    }
    groups.set(key, group);
}
const inventory = { capturedAt: snapshot.capturedAt, scope: "Current orderable Cylinder and Tulip rows; read-only, not a legacy coverage claim", catalogRows: rows.length,
    glassRows: glass.length, standalonePlasticRows: rows.filter(row => row.category === "Plastic Bottle").map(row => row.websiteSku),
    approvedManifestVersion: approved.version, groups: [...groups.values()] };
fs.writeFileSync(dir + "/inventory-before.json", JSON.stringify(inventory, null, 2) + "\n");
console.log(JSON.stringify({ catalogRows: inventory.catalogRows, glassRows: glass.length, groups: groups.size, registered: Object.keys(kits).length }));
for (const group of groups.values()) console.log(JSON.stringify({ key: group.key, skus: group.rows.length, register: group.registerAvailable,
    approved: group.approvedAvailable, bodySources: Object.keys(group.bodies).length, tubeSources: Object.keys(group.tubeSources).length }));
