#!/usr/bin/env python3
"""
Step 6: QA Audit
Runs automated quality checks on processed images and generates an HTML report.
"""

import json
import os
import re
from pathlib import Path
from datetime import datetime

try:
    from PIL import Image
    import numpy as np
except ImportError:
    print("Error: Pillow/numpy not installed.")
    exit(1)

from tqdm import tqdm

CANVAS_WIDTH = 600
CANVAS_HEIGHT = 1063
VALID_COMPONENTS = {"body", "fitment", "roller", "cap", "shadow", "lighting"}


def check_single_image(image_path: Path) -> list:
    """Run all QA checks on a single image. Returns list of issues."""
    issues = []
    filename = image_path.name
    file_size = image_path.stat().st_size

    # Check file size
    if file_size < 10_000:
        issues.append({"check": "file_size", "severity": "HIGH",
                       "msg": f"File too small ({file_size} bytes) — possibly empty"})
    elif file_size > 15_000_000:
        issues.append({"check": "file_size", "severity": "MEDIUM",
                       "msg": f"File very large ({file_size / 1_000_000:.1f}MB)"})

    # Open and check image properties
    try:
        img = Image.open(image_path)
    except Exception as e:
        issues.append({"check": "readable", "severity": "CRITICAL",
                       "msg": f"Cannot open image: {e}"})
        return issues

    # Check color mode
    if img.mode != "RGBA":
        issues.append({"check": "color_mode", "severity": "CRITICAL",
                       "msg": f"Expected RGBA, got {img.mode}"})
        return issues

    # Check dimensions
    if img.size != (CANVAS_WIDTH, CANVAS_HEIGHT):
        issues.append({"check": "dimensions", "severity": "CRITICAL",
                       "msg": f"Expected {CANVAS_WIDTH}x{CANVAS_HEIGHT}, got {img.size[0]}x{img.size[1]}"})

    # Check alpha integrity
    alpha = np.array(img.split()[-1])
    transparent_ratio = np.sum(alpha == 0) / alpha.size
    content_ratio = np.sum(alpha > 20) / alpha.size

    if content_ratio < 0.02:
        issues.append({"check": "min_content", "severity": "HIGH",
                       "msg": f"Only {content_ratio:.1%} content — image appears nearly empty"})

    if content_ratio > 0.90:
        issues.append({"check": "max_content", "severity": "HIGH",
                       "msg": f"{content_ratio:.1%} content — background removal may have failed"})

    # Check for edge halos (white fringe around content)
    if content_ratio > 0.02:
        _check_edge_halo(img, alpha, issues)

    # Check naming convention
    stem = image_path.stem
    # Expected: SKU-component (e.g., GB-CYL-CLR-50ML-SPR-body)
    last_part = stem.rsplit("-", 1)[-1].rstrip("0123456789")
    if last_part not in VALID_COMPONENTS:
        issues.append({"check": "naming", "severity": "CRITICAL",
                       "msg": f"Filename does not end with valid component suffix: {filename}"})

    return issues


def _check_edge_halo(img: Image.Image, alpha: np.ndarray, issues: list):
    """Detect white/gray fringe around content edges."""
    # Find edge pixels (where alpha transitions from 0 to >0)
    from scipy import ndimage
    try:
        content_mask = alpha > 20
        dilated = ndimage.binary_dilation(content_mask, iterations=2)
        edge_mask = dilated & ~content_mask

        if np.sum(edge_mask) == 0:
            return

        # Check RGB values at edge pixels
        rgb = np.array(img.convert("RGB"))
        edge_r = rgb[edge_mask, 0]
        edge_g = rgb[edge_mask, 1]
        edge_b = rgb[edge_mask, 2]

        # White halo: high RGB values at edges
        white_edge_ratio = np.sum((edge_r > 200) & (edge_g > 200) & (edge_b > 200)) / len(edge_r)
        if white_edge_ratio > 0.3:
            issues.append({"check": "edge_halo", "severity": "HIGH",
                           "msg": f"{white_edge_ratio:.0%} of edge pixels are white — likely halo"})
    except ImportError:
        pass  # scipy not available, skip this check


def check_product(sku_folder: Path) -> dict:
    """Run QA on all images for a single product."""
    sku = sku_folder.name
    images = sorted([f for f in sku_folder.iterdir() if f.suffix.lower() == ".png"])

    result = {
        "sku": sku,
        "layer_count": len(images),
        "status": "pass",
        "issues": [],
        "images": []
    }

    # Check layer count
    if len(images) < 2:
        result["issues"].append({"check": "layer_count", "severity": "MEDIUM",
                                  "msg": f"Only {len(images)} layers (expected 2-4)"})
    elif len(images) > 4:
        result["issues"].append({"check": "layer_count", "severity": "MEDIUM",
                                  "msg": f"{len(images)} layers (expected 2-4, may have duplicates)"})

    # Check each image
    has_body = False
    has_cap = False
    for img_path in images:
        img_issues = check_single_image(img_path)
        img_result = {
            "filename": img_path.name,
            "filesize": img_path.stat().st_size,
            "issues": img_issues,
            "status": "pass" if not any(i["severity"] in ("CRITICAL", "HIGH") for i in img_issues) else "fail"
        }
        result["images"].append(img_result)
        result["issues"].extend(img_issues)

        if img_path.stem.endswith("-body"):
            has_body = True
        if img_path.stem.endswith("-cap"):
            has_cap = True

    if not has_body:
        result["issues"].append({"check": "missing_body", "severity": "HIGH",
                                  "msg": "No -body layer found"})
    if not has_cap:
        result["issues"].append({"check": "missing_cap", "severity": "MEDIUM",
                                  "msg": "No -cap layer found"})

    # Set overall status
    if any(i["severity"] == "CRITICAL" for i in result["issues"]):
        result["status"] = "fail"
    elif any(i["severity"] == "HIGH" for i in result["issues"]):
        result["status"] = "warning"

    return result


def generate_html_report(results: list, stats: dict) -> str:
    """Generate an HTML QA report with thumbnail grid and issue table."""
    html = f"""<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Paper Doll QA Report — {stats['generated_at']}</title>
<style>
body {{ font-family: Inter, system-ui, sans-serif; margin: 2rem; background: #F5F3EF; color: #1D1D1F; }}
h1 {{ font-family: 'EB Garamond', Georgia, serif; color: #1D1D1F; }}
.stats {{ display: flex; gap: 2rem; margin: 1.5rem 0; }}
.stat {{ background: white; padding: 1.5rem; border-radius: 3px; min-width: 120px; border: 1px solid #ddd; }}
.stat-value {{ font-size: 2rem; font-weight: 700; }}
.stat-label {{ font-size: 0.85rem; color: #666; margin-top: 0.25rem; }}
.pass {{ color: #16a34a; }} .fail {{ color: #dc2626; }} .warn {{ color: #ca8a04; }}
table {{ width: 100%; border-collapse: collapse; margin-top: 1.5rem; background: white; }}
th {{ background: #1D1D1F; color: white; padding: 0.75rem; text-align: left; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }}
td {{ padding: 0.75rem; border-bottom: 1px solid #eee; font-size: 0.9rem; }}
tr:hover {{ background: #f9f9f6; }}
.severity-CRITICAL {{ color: #dc2626; font-weight: 700; }}
.severity-HIGH {{ color: #ea580c; font-weight: 600; }}
.severity-MEDIUM {{ color: #ca8a04; }}
.severity-LOW {{ color: #6b7280; }}
.filter-bar {{ margin: 1rem 0; display: flex; gap: 0.5rem; }}
.filter-btn {{ padding: 0.4rem 1rem; border: 1px solid #ccc; background: white; cursor: pointer; border-radius: 2px; font-size: 0.85rem; }}
.filter-btn.active {{ background: #1D1D1F; color: white; border-color: #1D1D1F; }}
</style></head><body>
<h1>Paper Doll QA Report</h1>
<p>Generated: {stats['generated_at']}</p>
<div class="stats">
  <div class="stat"><div class="stat-value">{stats['total_products']}</div><div class="stat-label">Total Products</div></div>
  <div class="stat"><div class="stat-value pass">{stats['pass_count']}</div><div class="stat-label">Passed</div></div>
  <div class="stat"><div class="stat-value warn">{stats['warning_count']}</div><div class="stat-label">Warnings</div></div>
  <div class="stat"><div class="stat-value fail">{stats['fail_count']}</div><div class="stat-label">Failed</div></div>
  <div class="stat"><div class="stat-value">{stats['total_issues']}</div><div class="stat-label">Total Issues</div></div>
</div>

<h2>Issues</h2>
<table>
<thead><tr><th>SKU</th><th>Severity</th><th>Check</th><th>Message</th></tr></thead>
<tbody>"""

    for r in results:
        for issue in r["issues"]:
            html += f"""<tr>
<td>{r['sku']}</td>
<td class="severity-{issue['severity']}">{issue['severity']}</td>
<td>{issue['check']}</td>
<td>{issue['msg']}</td>
</tr>"""

    html += """</tbody></table>
</body></html>"""
    return html


def run_qa_audit(input_dir: Path, manifest_path: Path = None) -> dict:
    """Run full QA audit on processed image directory."""
    results = []

    for sku_folder in tqdm(sorted(input_dir.iterdir()), desc="QA Audit"):
        if not sku_folder.is_dir():
            continue
        result = check_product(sku_folder)
        results.append(result)

    stats = {
        "generated_at": datetime.now().isoformat(),
        "total_products": len(results),
        "pass_count": sum(1 for r in results if r["status"] == "pass"),
        "warning_count": sum(1 for r in results if r["status"] == "warning"),
        "fail_count": sum(1 for r in results if r["status"] == "fail"),
        "total_issues": sum(len(r["issues"]) for r in results),
    }

    html = generate_html_report(results, stats)

    return {
        "html": html,
        "data": {**stats, "results": results}
    }


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="QA audit for processed Paper Doll images")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, default=None)
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()

    report = run_qa_audit(args.input, args.manifest)
    
    out_dir = args.output or args.input.parent
    html_path = out_dir / "qa-report.html"
    with open(html_path, "w") as f:
        f.write(report["html"])

    json_path = out_dir / "qa-report.json"
    with open(json_path, "w") as f:
        json.dump(report["data"], f, indent=2)

    d = report["data"]
    print(f"\nQA Results: {d['pass_count']} pass, {d['warning_count']} warning, {d['fail_count']} fail")
    print(f"Total issues: {d['total_issues']}")
    print(f"Report: {html_path}")
