---
name: paper-doll-image-processing
description: >
  Batch processing pipeline for Best Bottles product images to support the Paper Doll
  configurator on bestbottles.com. Use this skill whenever the user asks to process,
  prepare, extract, rename, clean, background-remove, normalize, or batch-convert product
  images for the Paper Doll system. Also triggers for: PSD layer extraction, SKU-based
  image renaming, component identification (bottle/cap/fitment/roller/spray/dropper),
  transparent PNG export, Sanity CMS image upload preparation, product image QA/audit,
  or any task involving the Best Bottles image asset folder structure. This skill handles
  the full pipeline from raw PSD/PNG source folders through to Sanity-ready layered assets.
  Always use this skill before writing any image batch processing code for Best Bottles,
  even for single-product processing or test runs.
---

# Paper Doll Image Processing Pipeline

A production batch-processing system for preparing ~2,300 Best Bottles product images
(6,000–7,000 individual layers) for the Paper Doll configurator. Converts raw product
photography organized by SKU folder into clean, properly named, background-removed
transparent PNGs ready for layered rendering in the Next.js frontend and storage in
Sanity CMS + Convex.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Source Folder Structure](#2-source-folder-structure)
3. [Component Types & Identification](#3-component-types--identification)
4. [Naming Convention](#4-naming-convention)
5. [Processing Pipeline](#5-processing-pipeline)
6. [Background Removal Strategy](#6-background-removal-strategy)
7. [Canvas Normalization](#7-canvas-normalization)
8. [Quality Assurance](#8-quality-assurance)
9. [Sanity CMS Upload](#9-sanity-cms-upload)
10. [Convex Metadata Sync](#10-convex-metadata-sync)
11. [Execution Environments](#11-execution-environments)
12. [Scripts Reference](#12-scripts-reference)
13. [Edge Cases & Gotchas](#13-edge-cases--gotchas)

---

## 1. Architecture Overview

### Why No AI Generation

The source images are existing high-resolution product photographs. Running them through
any generative AI model (Stable Diffusion, DALL-E, Midjourney, etc.) would:

- **Degrade accuracy**: Generative models hallucinate details. A 13/415 thread rendered
  by AI might look like an 18/415. Customers depend on visual fidelity for purchasing
  decisions.
- **Introduce inconsistency**: Each generation produces slightly different results. The
  Paper Doll system requires pixel-perfect layer alignment across components.
- **Waste time at scale**: 6,000+ images through a generation pipeline adds hours of
  GPU time for zero benefit. The originals are already production-quality.

The correct approach is **destructive-free cleanup**: background removal, canvas
normalization, and metadata tagging. Keep the original pixels intact.

### Pipeline Summary

```
SOURCE (SKU folders)
  → PSD Layer Extraction (psd-tools)
  → Background Removal (rembg / Photoshop Actions)
  → Component Classification (heuristic + optional Claude Vision)
  → SKU-Based Renaming
  → Canvas Normalization (600×1063px)
  → QA Pass (automated + manual spot-check)
  → Manifest Generation (JSON)
  → Sanity Upload + Convex Metadata Sync
OUTPUT (layered transparent PNGs per product)
```

### Tech Stack

| Tool | Purpose | Install |
|------|---------|---------|
| Python 3.10+ | Pipeline orchestration | System |
| `psd-tools` | PSD file parsing and layer extraction | `pip install psd-tools` |
| `rembg` | ML-based background removal (U²-Net) | `pip install rembg[gpu]` or `rembg[cpu]` |
| `Pillow` (PIL) | Image manipulation, canvas resize, compositing | `pip install Pillow` |
| `onnxruntime` | Inference backend for rembg | Installed with rembg |
| `tqdm` | Progress bars for batch ops | `pip install tqdm` |
| `openpyxl` | Cross-reference master Excel (v8.3) | `pip install openpyxl` |

**Optional (if using Photoshop path):**
| Tool | Purpose |
|------|---------|
| Photoshop + ExtendScript | Native PSD processing with Actions |
| Adobe UXP Plugin API | Modern Photoshop scripting (2024+) |

---

## 2. Source Folder Structure

### Expected Input Layout

```
/source-images/
├── GB-CYL-CLR-50ML-SPR/          ← SKU is the folder name
│   ├── layer_001.png              ← Bottle body (glass)
│   ├── layer_002.png              ← Fitment/sprayer mechanism
│   └── layer_003.png              ← Cap/overcap
├── GB-BST-AMB-30ML-ROL/
│   ├── layer_001.png
│   ├── layer_002.png              ← Roll-on ball insert
│   └── layer_003.png
├── GB-EMP-CLR-100ML/              ← No applicator (bottle + cap only)
│   ├── layer_001.png
│   └── layer_002.png
└── ...2,300 more folders
```

### Alternative: Raw PSD Input

If source material is PSD files rather than pre-exported PNGs:

```
/source-psds/
├── GB-CYL-CLR-50ML-SPR/
│   └── product.psd                ← Contains 2–4 layers
├── GB-BST-AMB-30ML-ROL/
│   └── product.psd
└── ...
```

The pipeline handles both. If PSDs are present, extraction happens first.
If PNGs are already exported, extraction is skipped.

### Folder Name = Product SKU

The folder name IS the canonical SKU identifier. This must match the SKU in:
- The master Excel (v8.3) `Grace SKU` or `QB SKU` column
- The Convex `products` table `sku` field
- The Sanity CMS `product` document `sku` field

**If a folder name does not match any known SKU, it is flagged in the QA report and
skipped.** Do not guess or auto-correct SKUs.

---

## 3. Component Types & Identification

### The Five Component Types

Every Best Bottles product is composed of 1–4 of these components, layered bottom-to-top:

| Layer | Component | Code Suffix | Description | Visual Heuristics |
|-------|-----------|-------------|-------------|-------------------|
| 1 (base) | **Bottle/Glass Vessel** | `-body` | The glass container itself | Largest element; occupies bottom 60–80% of frame; transparent/colored glass material |
| 2 | **Fitment/Applicator** | `-fitment` | The functional mechanism (spray pump, roll-on ball, dropper pipette, reducer) | Mid-frame, sits in the neck area; metallic or plastic; narrow width relative to bottle |
| 3 | **Roller Ball** | `-roller` | Steel or glass ball insert (roll-on products only) | Very small, spherical, sits at neck opening; only present on roll-on SKUs |
| 4 (top) | **Cap/Overcap** | `-cap` | The closure that covers everything | Top of frame; roughly circular/cylindrical from above; solid color (black, gold, silver) |

### Applicator Subtypes

The `-fitment` suffix covers all of these. The specific subtype is recorded in metadata,
not in the filename:

- **Spray Pump** (`spray`): Tall actuator with nozzle, dip tube visible
- **Roll-On** (`roll-on`): Ball sits in housing at neck; cap covers ball
- **Dropper** (`dropper`): Glass pipette + rubber bulb assembly
- **Lotion Pump** (`lotion-pump`): Wide actuator head, longer tube
- **Reducer/Orifice** (`reducer`): Small insert, barely visible, sits inside neck
- **Plug/Stopper** (`stopper`): Cork or plastic insert

### Identification Strategy

**Primary method: Layer order heuristic (no AI needed)**

In the vast majority of Best Bottles PSDs and exported layer sets, the layer order
is consistent:

1. Bottom layer → bottle body
2. Middle layer(s) → fitment/applicator components
3. Top layer → cap

Combined with these image analysis heuristics:

```python
def classify_component(image: PIL.Image, layer_index: int, total_layers: int) -> str:
    """
    Classify a component image based on position and visual properties.
    
    Rules:
    1. If layer_index == 0 (bottom): almost always 'body'
    2. If layer_index == total_layers - 1 (top): almost always 'cap'
    3. Middle layers: 'fitment' (or 'roller' if very small bounding box)
    
    Visual validation:
    - Body: bounding box height > 50% of canvas height
    - Cap: bounding box concentrated in top 30% of canvas
    - Fitment: bounding box concentrated in top 40-60% of canvas
    - Roller: bounding box < 10% of canvas area, centered at neck
    """
```

**Secondary method: Claude Vision API (optional, for ambiguous cases)**

For the ~5–10% of products where heuristics are insufficient (unusual layer orders,
combined components, non-standard photography), use Claude Vision to classify:

```python
# Only invoke for images that fail heuristic confidence threshold
response = anthropic.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=200,
    messages=[{
        "role": "user",
        "content": [
            {"type": "image", "source": {"type": "base64", ...}},
            {"type": "text", "text": (
                "This is a product photography layer from a glass bottle packaging company. "
                "Classify this image as exactly ONE of: body, fitment, roller, cap. "
                "Respond with only the classification word, nothing else."
            )}
        ]
    }]
)
```

Cost estimate for Vision fallback at 500 images: ~$2–5 total (negligible).

---

## 4. Naming Convention

### Output Filename Pattern

```
{SKU}-{component}.png
```

**Examples:**

| Folder (SKU) | Input Layer | Output Filename |
|---------------|-------------|-----------------|
| `GB-CYL-CLR-50ML-SPR` | `layer_001.png` | `GB-CYL-CLR-50ML-SPR-body.png` |
| `GB-CYL-CLR-50ML-SPR` | `layer_002.png` | `GB-CYL-CLR-50ML-SPR-fitment.png` |
| `GB-CYL-CLR-50ML-SPR` | `layer_003.png` | `GB-CYL-CLR-50ML-SPR-cap.png` |
| `GB-BST-AMB-30ML-ROL` | `layer_001.png` | `GB-BST-AMB-30ML-ROL-body.png` |
| `GB-BST-AMB-30ML-ROL` | `layer_002.png` | `GB-BST-AMB-30ML-ROL-roller.png` |
| `GB-BST-AMB-30ML-ROL` | `layer_003.png` | `GB-BST-AMB-30ML-ROL-cap.png` |

### Rules

1. **All lowercase** in component suffix: `-body`, `-fitment`, `-roller`, `-cap`
2. **SKU portion preserves original casing** from folder name
3. **No spaces**, no special characters beyond hyphens
4. If a product has both a roller AND a separate fitment housing, use `-roller` for the
   ball and `-fitment` for the housing
5. If a product has only 2 layers (body + cap, no applicator), there is no `-fitment` file
6. Shadow/lighting layers (if present) use `-shadow` and `-lighting` suffixes

---

## 5. Processing Pipeline

### Step-by-Step Execution

Read the `scripts/` directory for executable implementations. The pipeline runs in this order:

#### Step 1: Discovery & Inventory

```bash
python scripts/01_discover.py --source /path/to/source-images --output /path/to/output
```

Scans all SKU folders, counts layers per product, cross-references against master Excel,
and generates `inventory.json`:

```json
{
  "total_products": 2347,
  "total_layers": 6892,
  "products": [
    {
      "sku": "GB-CYL-CLR-50ML-SPR",
      "source_path": "/source-images/GB-CYL-CLR-50ML-SPR",
      "layer_count": 3,
      "source_type": "png",
      "in_master_excel": true,
      "status": "ready"
    }
  ],
  "warnings": [
    {"sku": "UNKNOWN-FOLDER", "issue": "SKU not found in master Excel"}
  ]
}
```

#### Step 2: PSD Extraction (conditional)

```bash
python scripts/02_extract_psd.py --source /path/to/source-psds --output /path/to/extracted
```

Only runs if source contains `.psd` files. Uses `psd-tools` to extract each layer
as a transparent PNG:

```python
from psd_tools import PSDImage

psd = PSDImage.open(psd_path)
for i, layer in enumerate(psd):
    if layer.is_visible():
        image = layer.composite()
        image.save(f"layer_{i:03d}.png")
```

#### Step 3: Background Removal

```bash
python scripts/03_remove_bg.py --input /path/to/extracted --output /path/to/clean
```

Uses `rembg` with the `u2net` model (best for product photography on white/gray
studio backgrounds):

```python
from rembg import remove, new_session

session = new_session("u2net")  # Load model once, reuse across all images

for image_path in all_images:
    with open(image_path, "rb") as f:
        output = remove(
            f.read(),
            session=session,
            alpha_matting=True,           # Better edge quality
            alpha_matting_foreground_threshold=240,
            alpha_matting_background_threshold=10,
            alpha_matting_erode_size=10
        )
```

**Important rembg notes:**
- First run downloads the U²-Net model (~170MB). Subsequent runs use cache.
- GPU acceleration (`rembg[gpu]` + CUDA) processes ~2–3 images/second.
- CPU-only processes ~0.5–1 images/second. At 6,000 images: ~2 hours GPU, ~3.5 hours CPU.
- `alpha_matting=True` is critical for glass bottles — standard removal leaves halos
  on transparent/frosted glass.

#### Step 4: Component Classification & Renaming

```bash
python scripts/04_classify_rename.py --input /path/to/clean --output /path/to/named
```

Applies the heuristic classifier from Section 3, renames files per Section 4 convention,
and generates a classification report.

#### Step 5: Canvas Normalization

```bash
python scripts/05_normalize_canvas.py --input /path/to/named --output /path/to/final
```

Resizes and positions every image onto the standard Paper Doll canvas. See Section 7.

#### Step 6: QA Audit

```bash
python scripts/06_qa_audit.py --input /path/to/final --manifest /path/to/manifest.json
```

Runs automated checks (Section 8) and generates an HTML report for manual spot-checking.

#### Step 7: Manifest & Upload Prep

```bash
python scripts/07_manifest.py --input /path/to/final --output /path/to/manifest.json
```

Generates the Sanity-ready manifest. See Section 9.

---

## 6. Background Removal Strategy

### Decision Tree

```
Is the layer already on a transparent background (alpha channel)?
├── YES → Skip background removal. Just validate alpha integrity.
└── NO → What kind of background?
    ├── Solid white/gray studio → rembg with alpha_matting=True (standard)
    ├── Gradient or textured → rembg with alpha_matting=True + manual QA flag
    └── Complex/lifestyle → Flag for manual Photoshop processing
```

### Glass Transparency Handling

Glass bottles are the hardest case because the glass itself is semi-transparent.
The `rembg` alpha matting handles this well for most cases, but frosted glass
and cobalt blue glass sometimes need adjustment:

```python
# For frosted/transparent glass, use tighter matting thresholds
if "FRS" in sku or "CLR" in sku:
    output = remove(
        data,
        session=session,
        alpha_matting=True,
        alpha_matting_foreground_threshold=200,  # Tighter (default 240)
        alpha_matting_background_threshold=20,   # Looser (default 10)
        alpha_matting_erode_size=5               # Less erosion for glass edges
    )
```

### When to Use Photoshop Instead

Flag for manual Photoshop processing if:
- `rembg` confidence score (edge quality metric) is below threshold
- Image has multiple overlapping products (composite shots)
- Layer contains both product and decorative elements (lifestyle shot crops)

The Photoshop batch action path is documented in `references/photoshop-actions.md`.

---

## 7. Canvas Normalization

### Standard Canvas: 600×1063px

This is the Paper Doll configurator's native canvas size (established in the
original architecture plan). All component images must fit within this canvas
for proper layered stacking.

### Normalization Rules

```python
CANVAS_WIDTH = 600
CANVAS_HEIGHT = 1063

def normalize_to_canvas(image: PIL.Image, component_type: str) -> PIL.Image:
    """
    Fit image onto standard canvas while maintaining aspect ratio.
    Position varies by component type for proper stacking alignment.
    """
    # 1. Calculate scale factor (fit within canvas with padding)
    PADDING_RATIO = 0.05  # 5% padding on each side
    max_w = int(CANVAS_WIDTH * (1 - 2 * PADDING_RATIO))
    max_h = int(CANVAS_HEIGHT * (1 - 2 * PADDING_RATIO))
    
    ratio = min(max_w / image.width, max_h / image.height)
    new_size = (int(image.width * ratio), int(image.height * ratio))
    resized = image.resize(new_size, Image.LANCZOS)
    
    # 2. Create transparent canvas
    canvas = Image.new("RGBA", (CANVAS_WIDTH, CANVAS_HEIGHT), (0, 0, 0, 0))
    
    # 3. Position based on component type
    x = (CANVAS_WIDTH - new_size[0]) // 2  # Always horizontally centered
    
    if component_type == "body":
        # Anchor to bottom-center (bottle sits on ground plane)
        y = CANVAS_HEIGHT - new_size[1] - int(CANVAS_HEIGHT * PADDING_RATIO)
    elif component_type == "cap":
        # Anchor to top-center (cap sits on top of bottle)
        y = int(CANVAS_HEIGHT * PADDING_RATIO)
    elif component_type in ("fitment", "roller"):
        # Center vertically (mechanism sits at neck junction)
        y = (CANVAS_HEIGHT - new_size[1]) // 2
    else:
        # Default: center
        y = (CANVAS_HEIGHT - new_size[1]) // 2
    
    canvas.paste(resized, (x, y), resized)
    return canvas
```

### Critical Alignment Note

All layers for a single product MUST align when stacked. This means:

1. If the original PSD had pixel-perfect alignment, preserve relative positions
   from the PSD rather than re-centering each layer independently.
2. The `psd-tools` layer extraction preserves `layer.offset` — use this for
   positioning instead of the heuristic above when available.
3. When source is pre-exported PNGs (not PSDs), assume they were exported at
   the same canvas size and preserve their relative positions.

```python
# PSD-aware positioning (preferred)
def extract_with_alignment(psd_path: str, canvas_size: tuple) -> dict:
    psd = PSDImage.open(psd_path)
    layers = {}
    for i, layer in enumerate(psd):
        if layer.is_visible():
            # composite() returns image at layer's own bbox
            img = layer.composite()
            # layer.offset gives (left, top) position in the full PSD canvas
            offset = layer.offset
            
            # Place on our standard canvas maintaining relative position
            scale = min(canvas_size[0] / psd.width, canvas_size[1] / psd.height)
            scaled_offset = (int(offset[0] * scale), int(offset[1] * scale))
            scaled_size = (int(img.width * scale), int(img.height * scale))
            
            canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
            resized = img.resize(scaled_size, Image.LANCZOS)
            canvas.paste(resized, scaled_offset, resized)
            
            layers[f"layer_{i:03d}"] = canvas
    return layers
```

---

## 8. Quality Assurance

### Automated Checks (per image)

| Check | Criteria | Severity |
|-------|----------|----------|
| **Alpha integrity** | Image has alpha channel; background pixels are fully transparent (alpha=0) | CRITICAL |
| **Edge halo** | No white/gray fringe exceeding 2px around subject | HIGH |
| **Minimum content** | Non-transparent pixels occupy at least 5% of canvas | HIGH |
| **Maximum content** | Non-transparent pixels don't exceed 90% of canvas (likely failed bg removal) | HIGH |
| **File size** | PNG is between 10KB and 15MB (too small = empty; too large = uncompressed) | MEDIUM |
| **Dimensions** | Exactly 600×1063px after normalization | CRITICAL |
| **Color mode** | RGBA (not RGB, not CMYK, not grayscale) | CRITICAL |
| **Layer count** | Product has 2–4 layers (fewer = missing component; more = extra artifacts) | MEDIUM |
| **SKU match** | Folder name exists in master Excel or Convex product list | CRITICAL |
| **Naming** | All files follow `{SKU}-{component}.png` pattern | CRITICAL |

### Automated Checks (cross-product)

| Check | Criteria | Severity |
|-------|----------|----------|
| **Duplicate SKU** | No two folders produce the same output filenames | CRITICAL |
| **Coverage** | Every product in master Excel has a corresponding image folder | MEDIUM |
| **Component consistency** | Products of same family have same number of layers | LOW |

### QA Report Output

The QA script generates an HTML report at `qa-report.html` with:
- Summary stats (pass/fail counts, processing time)
- Thumbnail grid of all processed products (click to expand)
- Sortable/filterable table of all issues found
- Side-by-side comparison: original vs. processed for spot-checking

### Manual Spot-Check Protocol

After automated QA, manually review:
1. **10 random products** from each bottle family (24 families × 10 = 240 spot checks)
2. **All products flagged** with HIGH or CRITICAL issues
3. **All frosted/clear glass** products (glass transparency is the hardest case)

---

## 9. Sanity CMS Upload

### Target Schema

The processed images map to the existing Sanity `productViewerBlock` schema:

```typescript
// From sanity-studio/schemaTypes/productViewerBlock.ts
{
  name: 'productViewerBlock',
  fields: [
    { name: 'outlineImage', type: 'image' },      // Not used in this pipeline
    { name: 'lightingOverlay', type: 'image' },    // → {SKU}-lighting.png (if exists)
    { name: 'shadowLayer', type: 'image' },        // → {SKU}-shadow.png (if exists)
    { name: 'backgroundColor', type: 'string' },   // Default: '#F5F3EF' (Bone)
    { name: 'layerOrder', type: 'array' },          // Auto-populated from manifest
  ]
}
```

And the component-specific schemas:

```typescript
// Glass variant → body image
// fitmentVariant → fitment image (image_url field)
// capOption → cap image (image_url field)
```

### Manifest JSON Structure

The `07_manifest.py` script outputs a manifest that maps directly to Sanity import:

```json
{
  "generated_at": "2026-03-15T12:00:00Z",
  "pipeline_version": "1.0.0",
  "products": [
    {
      "sku": "GB-CYL-CLR-50ML-SPR",
      "layers": {
        "body": {
          "file": "GB-CYL-CLR-50ML-SPR-body.png",
          "width": 600,
          "height": 1063,
          "filesize_bytes": 245000,
          "component_type": "body",
          "classification_method": "heuristic",
          "classification_confidence": 0.95
        },
        "fitment": {
          "file": "GB-CYL-CLR-50ML-SPR-fitment.png",
          "width": 600,
          "height": 1063,
          "filesize_bytes": 180000,
          "component_type": "fitment",
          "fitment_subtype": "spray",
          "classification_method": "heuristic",
          "classification_confidence": 0.88
        },
        "cap": {
          "file": "GB-CYL-CLR-50ML-SPR-cap.png",
          "width": 600,
          "height": 1063,
          "filesize_bytes": 120000,
          "component_type": "cap",
          "classification_method": "heuristic",
          "classification_confidence": 0.92
        }
      },
      "layer_order": ["body", "fitment", "cap"],
      "qa_status": "pass",
      "qa_issues": []
    }
  ]
}
```

### Sanity Upload Script

Use the Sanity CLI or API client to batch upload:

```bash
python scripts/08_upload_sanity.py \
  --manifest /path/to/manifest.json \
  --images /path/to/final \
  --sanity-project YOUR_PROJECT_ID \
  --sanity-dataset production \
  --sanity-token $SANITY_TOKEN \
  --dry-run  # Remove for actual upload
```

The upload script:
1. Reads the manifest
2. For each product, uploads images to Sanity's asset pipeline
3. Creates or updates the `productViewerBlock` on the corresponding product document
4. Updates `fitmentVariant.image_url` and `capOption.image_url` references
5. Logs all operations for rollback capability

---

## 10. Convex Metadata Sync

After Sanity upload, sync the image references to Convex:

```typescript
// Convex mutation: updateProductLayers
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const updateProductLayers = mutation({
  args: {
    sku: v.string(),
    bodyImageUrl: v.string(),
    fitmentImageUrl: v.optional(v.string()),
    capImageUrl: v.optional(v.string()),
    rollerImageUrl: v.optional(v.string()),
    layerOrder: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_sku", (q) => q.eq("sku", args.sku))
      .unique();
    
    if (!product) throw new Error(`Product not found: ${args.sku}`);
    
    await ctx.db.patch(product._id, {
      bodyImageUrl: args.bodyImageUrl,
      fitmentImageUrl: args.fitmentImageUrl,
      capImageUrl: args.capImageUrl,
      rollerImageUrl: args.rollerImageUrl,
      layerOrder: args.layerOrder,
      paperDollReady: true,
      paperDollProcessedAt: Date.now(),
    });
  },
});
```

---

## 11. Execution Environments

### Option A: Claude Code / Cursor Agent Mode (Recommended)

Best for: Full pipeline execution with real-time monitoring.

1. Open terminal in project root
2. Attach the source image folder to the workspace
3. Run scripts sequentially or via the master orchestrator:

```bash
python scripts/run_pipeline.py \
  --source /path/to/source-images \
  --output /path/to/output \
  --master-excel /path/to/master_v8.3.xlsx \
  --skip-psd-extraction  # If source is already PNGs
```

### Option B: Claude Desktop + CoWorks

Best for: Processing attached folders without a full dev environment.

1. Attach the image folder in CoWorks
2. The pipeline runs in the sandboxed environment
3. Output is available for download or direct Sanity upload

**CoWorks-specific notes:**
- File size limits may apply. Process in batches of ~500 products if needed.
- GPU acceleration is not available — expect CPU-only rembg speeds (~1 img/sec).
- For 6,000+ images, recommend splitting into multiple sessions by bottle family.

### Option C: Photoshop Batch Actions (Supplementary)

Best for: Manual corrections on flagged images, or if team prefers Photoshop workflow.

There is no official Photoshop MCP server. Instead, use Photoshop's built-in
batch processing with a custom Action set:

1. **Action: "BB_BackgroundRemove"** — Select All → Select Subject → Inverse →
   Delete → Defringe (1px)
2. **Action: "BB_CanvasNormalize"** — Canvas Size 600×1063, anchor center, transparent
3. **Action: "BB_ExportPNG"** — Export As PNG-24, transparency on

Run via: File → Automate → Batch → select action → select source folder.

For scripting: `references/photoshop-extendscript.md` contains the ExtendScript
equivalent for headless execution.

**Hybrid approach (recommended):**
- Run the Python pipeline for the bulk (90%+ of images)
- Use Photoshop for the flagged edge cases from QA

---

## 12. Scripts Reference

All scripts live in the `scripts/` directory of this skill. Read them before execution.

| Script | Purpose | Key Args |
|--------|---------|----------|
| `01_discover.py` | Scan source folders, cross-ref Excel, produce inventory.json | `--source`, `--output`, `--excel` |
| `02_extract_psd.py` | Extract PSD layers to transparent PNGs | `--source`, `--output` |
| `03_remove_bg.py` | Background removal via rembg | `--input`, `--output`, `--model u2net` |
| `04_classify_rename.py` | Component classification + SKU renaming | `--input`, `--output`, `--use-vision` |
| `05_normalize_canvas.py` | Resize to 600×1063 standard canvas | `--input`, `--output` |
| `06_qa_audit.py` | Run all QA checks, generate HTML report | `--input`, `--manifest` |
| `07_manifest.py` | Generate Sanity-ready JSON manifest | `--input`, `--output` |
| `08_upload_sanity.py` | Upload to Sanity CMS | `--manifest`, `--images`, `--dry-run` |
| `run_pipeline.py` | Master orchestrator (runs all steps) | `--source`, `--output`, `--excel` |

---

## 13. Edge Cases & Gotchas

### Known Issues

1. **Metal atomizers (GBAtom SKUs)**: These are NOT glass bottles. They have a different
   layer structure (metal body, no transparency). The background removal model needs
   different thresholds. Flag `GBAtom` prefix for separate processing.

2. **Frosted glass halos**: Frosted bottles (`-FRS-` in SKU) often retain a faint white
   halo after rembg. Mitigation: tighter alpha matting thresholds (see Section 6).

3. **Bulb sprayers with tassels**: Products like the Empire 100ml with black vintage bulb
   sprayer + tassel have complex geometry. The tassel may be misclassified as a separate
   component. Treat bulb+tassel as part of the `-fitment` layer.

4. **Composite product shots**: Some source images show the assembled product (all
   components together) rather than separated layers. These CANNOT be used directly —
   they need manual Photoshop separation or must be re-photographed as layers.

5. **Inconsistent source resolutions**: Source images range from 800px to 4000px+ wide.
   The canvas normalization step handles this, but very low-res sources (<500px) should
   be flagged for re-photography.

6. **Diva Frosted / Elegant Frosted**: These are NOT separate families. Frosted is a
   finish variant. The SKU will contain `-FRS-` as a modifier, not as a family code.

7. **Cap/closure taxonomy (Schema v1.2)**: Caps have `capHeight` (tall vs short),
   `assemblyType`, and `componentGroup` fields. The manifest must populate these from
   the master Excel cross-reference.

8. **Dual-SKU system**: Some products have both a QuickBooks SKU and a Grace-readable SKU.
   Folder names should use the Grace-readable SKU format. The manifest includes both
   SKU formats for cross-referencing.

### Performance Estimates

| Step | Time (GPU) | Time (CPU) | Notes |
|------|-----------|-----------|-------|
| Discovery | <1 min | <1 min | I/O bound |
| PSD Extraction | ~10 min | ~10 min | I/O bound |
| Background Removal | ~45 min | ~2.5 hrs | GPU strongly recommended |
| Classification | ~5 min | ~5 min | Mostly heuristic |
| Canvas Normalization | ~10 min | ~10 min | I/O bound |
| QA Audit | ~5 min | ~5 min | I/O bound |
| Manifest Generation | <1 min | <1 min | JSON writing |
| **Total** | **~1.5 hrs** | **~3.5 hrs** | For ~6,000 images |

---

## Quick Start

For the fastest possible start, run the master pipeline:

```bash
# Install dependencies
pip install psd-tools rembg[gpu] Pillow tqdm openpyxl

# Run full pipeline
python scripts/run_pipeline.py \
  --source ./source-images \
  --output ./processed \
  --master-excel ./master_v8.3.xlsx

# Review QA report
open ./processed/qa-report.html

# Upload to Sanity (dry run first!)
python scripts/08_upload_sanity.py \
  --manifest ./processed/manifest.json \
  --images ./processed/final \
  --dry-run
```
