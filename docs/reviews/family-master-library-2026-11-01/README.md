# Best Bottles family master library

Jordan's November 1 instruction: after every batch, save the individual bottle masters in properly labeled family folders in Best Bottles Drive so approved versions can always be retrieved.

Canonical library: https://drive.google.com/drive/folders/1kztMnt9MYau-UfgN6sK8kI7fJZsMnQUe

The library is directly inside the existing Best Bottles client folder. Each family has `Approved masters` and a dated `Review - YYYY-MM-DD - batch-id` folder. This organization supplements the complete audit/code backups; it does not move or delete them.

## Required closeout after each batch

1. Reuse the existing family folder in `registry.json`; inspect Drive before creating a new one. Use the catalog family name. Preserve shape distinctions such as Footed Rectangle and Tall Rectangle in each master identity.
2. Save each body as an individual full-resolution PNG with its original transparency and exact bytes. Never hide the only retrievable master inside a ZIP or combined contact sheet. Keep components and native working scenes separate from body masters.
3. Label each image with shape, capacity, neck finish, glass color, BODY, source revision, REVIEW or APPROVED, batch date and a content-hash suffix. Example: `BB_cylinder-5ml-13-415_Clear_BODY_GPT-r03_REVIEW_2026-10-31_3d366e116958.png`.
4. Save a batch manifest with exact SHA-256 and dimensions, original source/provenance, canvas, body placement, neck axis, seat and base anchors, approved scale target and landmark, linked SKUs, review URL, source commit and Drive file ID/URL. Do not imply a bare-body image includes a cap or roller assembly.
5. Verify the remote file name, byte size and family/batch parent after upload. Preserve a local checksum record. A copied Drive-desktop file does not prove cloud sync completed.
6. Update the dated master index and save the family registry/checkpoint in Git. Report the Drive folder and any unverified uploads before calling the batch archived.

## Approval and version protection

- Only explicit approval of the exact image version/hash promotes a copy to `Approved masters`. Record who approved it, when, the approval evidence, intended scope and original review file ID. General praise, a prior historical approval, passing layout checks or approval of another color does not approve this version.
- Preserve every reviewed and approved version. Never overwrite or delete an earlier master. A new approved image gets a new versioned filename and file ID; the approved index identifies which version is current for that body/color/neck identity. Older approved files remain retrievable.
- One current approved body per physical design/size/neck and glass color is shared across eligible product-page and builder configurations. A component change does not create a new body master or refit its scale.
- Material edits must preserve the accepted geometry, anchors and catalog size curve with its approved family exceptions. New candidates do not silently replace measured or already accepted bodies.
- Drive archival and approval do not authorize production publication, a database mutation or a merge. Those are separately tracked release actions.

## Initial batch

The `2026-10-31-gpt13-ff83c6df` batch contains 18 body/color images across 11 families. All are filed for review. The two Cylinder 5 ml images are existing revision-3 appearance candidates. The other 16 are recovered GPT sources. Their technical layout verification does not mark them newly approved. Approved folders begin empty for this batch.

This first family archive covers the latest composition pilot, not all 109 recovered historical images. The complete historical source backup remains preserved in the earlier catalog audit Drive folder. Future batches use this same closeout workflow.
