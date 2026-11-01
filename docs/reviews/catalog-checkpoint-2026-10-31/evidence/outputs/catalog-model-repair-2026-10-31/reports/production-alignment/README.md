# Local and production alignment

Localhost now reads the production catalog and component register. Production was inspected only. No backend write, deployment, merge, push, media upload, or domain change was performed.

The production commit is `087ff9b028763a4793882f909180c7a01ca5eb54`; local HEAD is `4c3793cc9413f7bc1c604a6bb1226437f9c07523`. Their committed source tree is identical: `7b5ee860186dafefde573f33fee896a034d38029`. Existing uncommitted local work remains preserved. The working tree is intentionally different because it contains the vial correction and shared-stage sizing changes under review.

The local public Convex URL changed from helpful-elephant-638 to precise-raccoon-123, matching production. Sanity project/dataset and catalog hero pilot match production. Local site origin is localhost:3010. The Convex CLI deployment remains development, separate from the public read endpoint. No private credentials were copied from production. The original local environment is backed up privately at `/private/tmp/best-bottles-production-alignment-2026-10-31/.env.local.before-alignment`; it must not be committed or placed in a public folder.

The component comparison found identical 93 body records and 2,485 assemblies, with two different Empire plates and 21 different component records between development and production. All captured records are retained. Production's approved versions now supply the local preview.

Browser checks passed for the 9 ml clear Cylinder: both pages return 200 and use the same body, dip tube, sprayer, collar and overcap URLs. The local glass remains stationary through all three views and a finish change. Builder selection and cap toggles preserve the same normalized body frame. Local sizing intentionally differs from production pending review. The new scale sheet loads 110 images without failures or mobile overflow. See the JSON reports and screenshots in this directory.

## Start locally

Run `npm run dev -- --hostname localhost --port 3010` from this checkout. The CSS entry now limits Tailwind class detection to `src`, excluding local repair archives from compilation. Official syntax: https://tailwindcss.com/docs/detecting-classes-in-source-files. The first verified product request returned 200 in 15.4 seconds after the correction. The old build cache remains preserved in `/private/tmp/best-bottles-production-alignment-2026-10-31/next-cache-before-alignment`.

## Preservation

`local-work-before-alignment.patch` and `git-status-before.txt` record the tracked working state before alignment. Source backups are under `outputs/catalog-model-repair-2026-10-31/backups/stage-scale-before/`. No reset, checkout, rebase or overwrite of production assets was used. `alignment.json` records the exact deployment and safe public settings. The product model archive is unchanged.

## Storage inspection only

The repair folder occupies 25.82 GiB allocated. Approximately 15 GiB is working model variants and 11 GiB is render outputs, which also contain saved Blender review scenes. By logical file size, `.blend` files alone account for 23.09 GiB; PNG images account for 1.31 GiB. No Blender application or batch renderer was running during inspection. Two Blender MCP helper processes were idle at 0% CPU. The website compiler was active during page compilation; this is distinct from rendering in Blender.

The largest reproducible candidate is the retained old Next build cache at 48.14 GiB. Within the repair folder, `renders/superseded` is about 1 GiB and pilot scenes/renders total about 1.2 GiB. These are potential archive candidates after checking manifest references and verifying a restorable copy, not authorized cleanup. Working scenes, final review scenes, before/after images, audit provenance and approved libraries must remain available for the current review. Nothing was moved or deleted by this storage inspection. See `storage-inspection.json` for measured values and processes.

Full catalog visual approval and the 54 redirect corrections remain separate unfinished work.
