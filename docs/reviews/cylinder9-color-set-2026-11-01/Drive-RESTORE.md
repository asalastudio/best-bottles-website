# Cylinder 9 ml master archive recovery

The native masters are available individually in this Drive folder. The complete recovery archive is split into three parts because the upload tool accepts files smaller than 100 MB.

Download all three files into the same folder:

- Cylinder_9ml_Shared-Masters_2026-11-01_v04_REVIEW.zip.part01
- Cylinder_9ml_Shared-Masters_2026-11-01_v04_REVIEW.zip.part02
- Cylinder_9ml_Shared-Masters_2026-11-01_v04_REVIEW.zip.part03

On macOS/Linux, reassemble them with:

```sh
cat Cylinder_9ml_Shared-Masters_2026-11-01_v04_REVIEW.zip.part0[123] > Cylinder_9ml_Shared-Masters_2026-11-01_v04_REVIEW.zip
shasum -a 256 Cylinder_9ml_Shared-Masters_2026-11-01_v04_REVIEW.zip
```

Expected SHA-256: 4c433de52e32ffa4345da9ae431108a6576fccb7da1ce81d5d373c34859313a2

Expected size: 199,950,221 bytes.

Extract the ZIP. It contains 253 entries, including the manifest and the original, generated, editable and runtime sources. Integrity and file hashes were checked, and the runtime was restored into an empty directory before upload.

The source application lives on PR #382: https://github.com/asalastudio/best-bottles-website/pull/382

To restore runtime files into that checkout:

```sh
node cylinder9-color-set-2026-11-01/restore.mjs --root /absolute/path/to/checkout --apply
```

The restore checks the manifest before writing and backs up conflicting destination files.
