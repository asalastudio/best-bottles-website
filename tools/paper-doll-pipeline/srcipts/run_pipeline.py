#!/usr/bin/env python3
"""
Best Bottles Paper Doll Image Processing Pipeline
Master Orchestrator - runs all steps in sequence.

Usage:
    python run_pipeline.py --source ./source-images --output ./processed --master-excel ./master_v8.3.xlsx
    python run_pipeline.py --source ./source-images --output ./processed --skip-psd-extraction
    python run_pipeline.py --source ./source-images --output ./processed --steps 3,4,5  # Run specific steps only
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path
from datetime import datetime


def log(msg: str, level: str = "INFO"):
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] [{level}] {msg}")


def run_step(step_num: int, step_name: str, func, **kwargs):
    """Execute a pipeline step with timing and error handling."""
    log(f"{'='*60}")
    log(f"STEP {step_num}: {step_name}")
    log(f"{'='*60}")
    start = time.time()
    try:
        result = func(**kwargs)
        elapsed = time.time() - start
        log(f"Step {step_num} completed in {elapsed:.1f}s", "SUCCESS")
        return result
    except Exception as e:
        elapsed = time.time() - start
        log(f"Step {step_num} FAILED after {elapsed:.1f}s: {e}", "ERROR")
        raise


def step_discover(source: Path, output: Path, master_excel: Path = None):
    """Step 1: Scan source folders and build inventory."""
    from discover import discover_products
    inventory = discover_products(source, master_excel)

    inventory_path = output / "inventory.json"
    with open(inventory_path, "w") as f:
        json.dump(inventory, f, indent=2)

    log(f"Found {inventory['total_products']} products, {inventory['total_layers']} layers")
    log(f"Inventory written to {inventory_path}")

    if inventory.get("warnings"):
        log(f"{len(inventory['warnings'])} warnings found - check inventory.json", "WARN")

    return inventory


def step_extract_psd(source: Path, output: Path):
    """Step 2: Extract PSD layers to transparent PNGs."""
    from extract_psd import extract_all_psds
    extracted = output / "01_extracted"
    extracted.mkdir(parents=True, exist_ok=True)
    stats = extract_all_psds(source, extracted)
    log(f"Extracted {stats['layers_extracted']} layers from {stats['psds_processed']} PSDs")
    return stats


def step_remove_bg(input_dir: Path, output: Path, model: str = "u2net"):
    """Step 3: Background removal via rembg."""
    from remove_bg import batch_remove_backgrounds
    clean_dir = output / "02_clean"
    clean_dir.mkdir(parents=True, exist_ok=True)
    stats = batch_remove_backgrounds(input_dir, clean_dir, model_name=model)
    log(f"Processed {stats['processed']} images, {stats['skipped']} skipped (already transparent)")
    return stats


def step_classify_rename(input_dir: Path, output: Path, use_vision: bool = False):
    """Step 4: Classify components and rename files."""
    from classify_rename import classify_and_rename_all
    named_dir = output / "03_named"
    named_dir.mkdir(parents=True, exist_ok=True)
    stats = classify_and_rename_all(input_dir, named_dir, use_vision=use_vision)
    log(f"Classified {stats['classified']} images, {stats['ambiguous']} flagged for review")
    return stats


def step_normalize_canvas(input_dir: Path, output: Path):
    """Step 5: Resize all images to 600x1063 standard canvas."""
    from normalize_canvas import normalize_all
    final_dir = output / "04_final"
    final_dir.mkdir(parents=True, exist_ok=True)
    stats = normalize_all(input_dir, final_dir)
    log(f"Normalized {stats['processed']} images to 600x1063")
    return stats


def step_qa_audit(input_dir: Path, output: Path, manifest_path: Path = None):
    """Step 6: Run QA checks and generate report."""
    from qa_audit import run_qa_audit
    report = run_qa_audit(input_dir, manifest_path)

    report_path = output / "qa-report.html"
    with open(report_path, "w") as f:
        f.write(report["html"])

    report_json_path = output / "qa-report.json"
    with open(report_json_path, "w") as f:
        json.dump(report["data"], f, indent=2)

    log(f"QA: {report['data']['pass_count']} pass, {report['data']['fail_count']} fail")
    log(f"QA report: {report_path}")
    return report["data"]


def step_manifest(input_dir: Path, output: Path):
    """Step 7: Generate Sanity-ready manifest JSON."""
    from manifest import generate_manifest
    manifest = generate_manifest(input_dir)

    manifest_path = output / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    log(f"Manifest generated with {len(manifest['products'])} products")
    log(f"Manifest written to {manifest_path}")
    return manifest_path


def main():
    parser = argparse.ArgumentParser(
        description="Best Bottles Paper Doll Image Processing Pipeline"
    )
    parser.add_argument("--source", type=Path, required=True,
                        help="Source image directory (SKU folders)")
    parser.add_argument("--output", type=Path, required=True,
                        help="Output directory for processed images")
    parser.add_argument("--master-excel", type=Path, default=None,
                        help="Path to master Excel v8.3 for SKU cross-reference")
    parser.add_argument("--skip-psd-extraction", action="store_true",
                        help="Skip PSD extraction (source already has PNGs)")
    parser.add_argument("--skip-bg-removal", action="store_true",
                        help="Skip background removal (images already transparent)")
    parser.add_argument("--use-vision", action="store_true",
                        help="Use Claude Vision API for ambiguous component classification")
    parser.add_argument("--bg-model", default="u2net",
                        choices=["u2net", "u2netp", "u2net_human_seg", "isnet-general-use"],
                        help="rembg model to use for background removal")
    parser.add_argument("--steps", type=str, default=None,
                        help="Comma-separated list of step numbers to run (e.g., '3,4,5')")
    parser.add_argument("--batch-size", type=int, default=0,
                        help="Process only N products (0 = all, useful for test runs)")

    args = parser.parse_args()

    # Validate source
    if not args.source.exists():
        log(f"Source directory not found: {args.source}", "ERROR")
        sys.exit(1)

    # Create output directory
    args.output.mkdir(parents=True, exist_ok=True)

    # Determine which steps to run
    if args.steps:
        steps_to_run = set(int(s) for s in args.steps.split(","))
    else:
        steps_to_run = {1, 2, 3, 4, 5, 6, 7}

    # Add scripts directory to Python path
    scripts_dir = Path(__file__).parent
    sys.path.insert(0, str(scripts_dir))

    log(f"Paper Doll Pipeline starting")
    log(f"Source: {args.source}")
    log(f"Output: {args.output}")
    log(f"Steps: {sorted(steps_to_run)}")
    pipeline_start = time.time()

    # Determine working directories
    # After PSD extraction, subsequent steps read from the extracted dir
    # After bg removal, from the clean dir, etc.
    current_input = args.source

    try:
        # Step 1: Discovery
        if 1 in steps_to_run:
            inventory = run_step(1, "Discovery & Inventory",
                                step_discover,
                                source=args.source,
                                output=args.output,
                                master_excel=args.master_excel)

        # Step 2: PSD Extraction
        if 2 in steps_to_run and not args.skip_psd_extraction:
            run_step(2, "PSD Layer Extraction",
                     step_extract_psd,
                     source=args.source,
                     output=args.output)
            current_input = args.output / "01_extracted"
        elif args.skip_psd_extraction:
            log("Skipping PSD extraction (--skip-psd-extraction)")
            current_input = args.source

        # Step 3: Background Removal
        if 3 in steps_to_run and not args.skip_bg_removal:
            run_step(3, "Background Removal",
                     step_remove_bg,
                     input_dir=current_input,
                     output=args.output,
                     model=args.bg_model)
            current_input = args.output / "02_clean"
        elif args.skip_bg_removal:
            log("Skipping background removal (--skip-bg-removal)")

        # Step 4: Classification & Renaming
        if 4 in steps_to_run:
            run_step(4, "Component Classification & Renaming",
                     step_classify_rename,
                     input_dir=current_input,
                     output=args.output,
                     use_vision=args.use_vision)
            current_input = args.output / "03_named"

        # Step 5: Canvas Normalization
        if 5 in steps_to_run:
            run_step(5, "Canvas Normalization (600×1063)",
                     step_normalize_canvas,
                     input_dir=current_input,
                     output=args.output)
            current_input = args.output / "04_final"

        # Step 7: Manifest (before QA so QA can reference it)
        manifest_path = None
        if 7 in steps_to_run:
            manifest_path = run_step(7, "Manifest Generation",
                                     step_manifest,
                                     input_dir=current_input,
                                     output=args.output)

        # Step 6: QA Audit
        if 6 in steps_to_run:
            run_step(6, "QA Audit",
                     step_qa_audit,
                     input_dir=current_input,
                     output=args.output,
                     manifest_path=manifest_path)

    except Exception as e:
        log(f"Pipeline failed: {e}", "FATAL")
        sys.exit(1)

    total_time = time.time() - pipeline_start
    log(f"{'='*60}")
    log(f"Pipeline complete in {total_time:.0f}s ({total_time/60:.1f} min)")
    log(f"Output directory: {args.output}")
    log(f"{'='*60}")


if __name__ == "__main__":
    main()
