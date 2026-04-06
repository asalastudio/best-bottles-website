#!/usr/bin/env python3
"""
Best Bottles — Measurement Pipeline
Extracts dimensional geometry from reference PSDs/PNGs for AI prompt generation.

Usage:
  python measure.py reference/cylinder/          # Measure all images in a family dir
  python measure.py reference/cylinder/image.png  # Measure a single image
  python measure.py reference/                    # Measure all families
"""

import sys, os, json, glob
from PIL import Image

try:
    from psd_tools import PsdImage
    HAS_PSD = True
except ImportError:
    HAS_PSD = False


def extract_psd_preview(psd_path, output_path):
    if not HAS_PSD:
        print(f"  ⚠ psd-tools not installed, skipping {psd_path}")
        return None
    psd = PsdImage.open(psd_path)
    composite = psd.composite()
    composite.save(output_path)
    return composite.size


def measure_bottle(image_path, background="auto"):
    img = Image.open(image_path).convert("RGBA")
    w, h = img.size
    pixels = img.load()

    # Auto-detect background type
    if background == "auto":
        corners = [pixels[0, 0], pixels[w-1, 0], pixels[0, h-1], pixels[w-1, h-1]]
        avg_alpha = sum(c[3] for c in corners) / 4
        if avg_alpha < 50:
            background = "transparent"
        else:
            background = "white"

    top, bottom, left, right = h, 0, w, 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if background == "white":
                is_bg = (r > 240 and g > 240 and b > 240) or a < 20
            else:
                is_bg = a < 20

            if not is_bg:
                top = min(top, y)
                bottom = max(bottom, y)
                left = min(left, x)
                right = max(right, x)

    bottle_w = right - left
    bottle_h = bottom - top

    if bottle_w == 0 or bottle_h == 0:
        return {"error": "Could not detect bottle bounds", "image": image_path}

    hw_ratio = bottle_h / bottle_w

    # Find cap-body boundary via brightness transition
    center_x = (left + right) // 2
    brightness_profile = []
    for y in range(top, bottom):
        r, g, b, a = pixels[center_x, y]
        brightness = (r + g + b) / 3
        brightness_profile.append((y, brightness))

    half_point = len(brightness_profile) // 2
    max_jump = 0
    jump_y = None
    window = 5

    for i in range(window, min(half_point, len(brightness_profile) - window)):
        avg_before = sum(b for _, b in brightness_profile[i-window:i]) / window
        avg_after = sum(b for _, b in brightness_profile[i:i+window]) / window
        jump = abs(avg_after - avg_before)
        if jump > max_jump:
            max_jump = jump
            jump_y = brightness_profile[i][0]

    cap_boundary = jump_y
    cap_h = cap_boundary - top if cap_boundary else bottle_h * 0.3
    body_h = bottom - cap_boundary if cap_boundary else bottle_h * 0.7

    # Measure width at multiple points to detect taper
    widths = {}
    for label, y_pos in [("top_quarter", top + bottle_h // 4),
                          ("mid", top + bottle_h // 2),
                          ("bottom_quarter", bottom - bottle_h // 4)]:
        row_left, row_right = w, 0
        for x in range(left, right + 1):
            r, g, b, a = pixels[x, y_pos]
            if background == "white":
                is_bg = (r > 240 and g > 240 and b > 240) or a < 20
            else:
                is_bg = a < 20
            if not is_bg:
                row_left = min(row_left, x)
                row_right = max(row_right, x)
        widths[label] = row_right - row_left if row_right > row_left else 0

    return {
        "image_file": os.path.basename(image_path),
        "image_size": {"width": w, "height": h},
        "bottle_bounds": {"top": top, "bottom": bottom, "left": left, "right": right},
        "bottle_dimensions": {"width": bottle_w, "height": bottle_h},
        "height_width_ratio": round(hw_ratio, 2),
        "cap_body_boundary_y": cap_boundary,
        "cap_height_px": int(cap_h),
        "body_height_px": int(body_h),
        "cap_percent": round(cap_h / bottle_h * 100, 1),
        "body_percent": round(body_h / bottle_h * 100, 1),
        "frame_occupancy_height_pct": round(bottle_h / h * 100, 1),
        "frame_occupancy_width_pct": round(bottle_w / w * 100, 1),
        "width_profile": widths,
        "detected_background": background,
        "brightness_jump_magnitude": round(max_jump, 1),
    }


def process_directory(dir_path):
    """Process a single family directory: extract PSD previews, measure all images."""
    family = os.path.basename(dir_path.rstrip('/'))
    print(f"\n{'='*50}")
    print(f"  FAMILY: {family}")
    print(f"{'='*50}")

    # Extract PSD previews
    psds = glob.glob(os.path.join(dir_path, "**/*.psd"), recursive=True)
    psds += glob.glob(os.path.join(dir_path, "**/*.PSD"), recursive=True)

    for psd in psds:
        fname = os.path.basename(psd)
        preview_name = f"_preview-{fname.rsplit('.', 1)[0]}.png"
        preview_path = os.path.join(dir_path, preview_name)
        if not os.path.exists(preview_path):
            try:
                size = extract_psd_preview(psd, preview_path)
                print(f"  ✓ Extracted: {preview_name} ({size[0]}x{size[1]})")
            except Exception as e:
                print(f"  ✗ Failed: {fname} — {e}")

    # Measure all PNGs (previews + any direct references)
    images = glob.glob(os.path.join(dir_path, "*.png"))
    images += glob.glob(os.path.join(dir_path, "*.PNG"))
    images += glob.glob(os.path.join(dir_path, "*.jpg"))
    images += glob.glob(os.path.join(dir_path, "*.JPG"))

    if not images:
        print("  No images found to measure.")
        return {}

    measurements = {}
    for img_path in sorted(images):
        fname = os.path.basename(img_path)
        try:
            m = measure_bottle(img_path)
            if "error" in m:
                print(f"  ⚠ {fname}: {m['error']}")
            else:
                measurements[fname] = m
                print(f"  ✓ {fname}: H:W={m['height_width_ratio']}:1, cap={m['cap_percent']}%, body={m['body_percent']}%")
        except Exception as e:
            print(f"  ✗ {fname}: {e}")

    # Write measurements
    out_path = os.path.join(dir_path, "_measurements.json")
    with open(out_path, "w") as f:
        json.dump(measurements, f, indent=2)
    print(f"\n  → Saved: {out_path} ({len(measurements)} images)")

    return measurements


def main():
    if len(sys.argv) < 2:
        print("Usage: python measure.py <path>")
        print("  path = single image, family dir, or parent reference dir")
        sys.exit(1)

    target = sys.argv[1]

    if os.path.isfile(target):
        # Single image
        m = measure_bottle(target)
        print(json.dumps(m, indent=2))

    elif os.path.isdir(target):
        # Check if it's a family dir (has images directly) or a parent dir
        direct_images = glob.glob(os.path.join(target, "*.png")) + glob.glob(os.path.join(target, "*.jpg"))
        direct_psds = glob.glob(os.path.join(target, "**/*.psd"), recursive=True)

        if direct_images or direct_psds:
            process_directory(target)
        else:
            # Parent directory — process each subdirectory as a family
            for entry in sorted(os.listdir(target)):
                subdir = os.path.join(target, entry)
                if os.path.isdir(subdir) and not entry.startswith('.'):
                    process_directory(subdir)
    else:
        print(f"Not found: {target}")
        sys.exit(1)


if __name__ == "__main__":
    main()
