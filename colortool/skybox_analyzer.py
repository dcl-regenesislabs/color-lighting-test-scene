#!/usr/bin/env python3
"""
Skybox Color Analyzer for Decentraland Godot Port
Analyzes skybox screenshots by orientation (W, E, N, S, U) and hour (0-23).
Expects filenames like E12.png, N06.png, U23.png.
"""

from PIL import Image
import json
import os
import re
import sys
from pathlib import Path

ORIENTATIONS = ('W', 'E', 'N', 'S', 'U')


def rgb_to_hex(r, g, b):
    """Convert RGB to hex color string"""
    return f"#{r:02x}{g:02x}{b:02x}"


def rgb_to_godot(r, g, b):
    """Convert RGB to Godot Color format (0-1 range)"""
    return {
        'r': round(r / 255.0, 3),
        'g': round(g / 255.0, 3),
        'b': round(b / 255.0, 3)
    }


def parse_orientation_hour_from_filename(filename):
    """
    Parse XNN.png -> (orientation, hour).
    X = W|E|N|S|U, NN = 00-23.
    """
    name = Path(filename).stem.upper()
    match = re.match(r'^([WENSU])(\d{2})$', name)
    if match:
        orient, hour_str = match.groups()
        hour = int(hour_str)
        if 0 <= hour <= 23:
            return orient, hour
    return None, None


def analyze_vertical_gradient(img, num_samples=10):
    """Sample colors vertically from top to bottom."""
    width, height = img.size
    x = width // 2
    colors = []
    for i in range(num_samples):
        y = int((height * i) / (num_samples - 1)) if num_samples > 1 else height // 2
        y = min(y, height - 1)
        try:
            pixel = img.getpixel((x, y))
            r, g, b = pixel[:3] if len(pixel) >= 3 else (pixel, pixel, pixel)
            colors.append({
                'position': round(i / (num_samples - 1), 2),
                'rgb': {'r': r, 'g': g, 'b': b},
                'hex': rgb_to_hex(r, g, b),
                'godot': rgb_to_godot(r, g, b)
            })
        except Exception:
            continue
    return colors


def analyze_sky_zones(img):
    """Analyze sky zones (zenith -> water)."""
    width, height = img.size
    x = width // 2
    zones = {
        'zenith': 0.05,
        'upper_sky': 0.25,
        'mid_sky': 0.50,
        'lower_sky': 0.75,
        'horizon': 0.90,
        'water_line': 0.95
    }
    zone_colors = {}
    for zone_name, y_percent in zones.items():
        y = min(int(height * y_percent), height - 1)
        try:
            pixel = img.getpixel((x, y))
            r, g, b = pixel[:3] if len(pixel) >= 3 else (pixel, pixel, pixel)
            zone_colors[zone_name] = {
                'rgb': {'r': r, 'g': g, 'b': b},
                'hex': rgb_to_hex(r, g, b),
                'godot': rgb_to_godot(r, g, b)
            }
        except Exception:
            continue
    return zone_colors


def analyze_brightness(img):
    """Average brightness of the image."""
    img_small = img.resize((100, 100))
    pixels = list(img_small.getdata())
    total = 0
    for pixel in pixels:
        if len(pixel) >= 3:
            r, g, b = pixel[:3]
            total += 0.299 * r + 0.587 * g + 0.114 * b
    avg = total / len(pixels)
    return {
        'average': round(avg, 2),
        'normalized': round(avg / 255, 3),
        'is_dark': avg < 85,
        'is_bright': avg > 170
    }


def analyze_image(image_path):
    """Full analysis for one skybox image. Returns dict with orientation and hour."""
    img = Image.open(image_path)
    filename = os.path.basename(image_path)
    orientation, hour = parse_orientation_hour_from_filename(filename)

    if orientation is None or hour is None:
        print(f"Skipping {filename} (expected XNN.png, e.g. E12.png)")
        return None

    print(f"Analyzing {filename} ({orientation} @ {hour:02d}:00)...")

    analysis = {
        'filename': filename,
        'orientation': orientation,
        'hour': hour,
        'time': f"{hour:02d}:00",
        'dimensions': {'width': img.width, 'height': img.height},
        'vertical_gradient': analyze_vertical_gradient(img, num_samples=10),
        'sky_zones': analyze_sky_zones(img),
        'brightness': analyze_brightness(img)
    }
    return analysis


def build_godot_entry(analysis):
    """One Godot-ready entry for web/export."""
    return {
        'orientation': analysis['orientation'],
        'hour': analysis['hour'],
        'time': analysis['time'],
        'colors': {
            'zenith': analysis['sky_zones'].get('zenith', {}).get('godot', {}),
            'upper': analysis['sky_zones'].get('upper_sky', {}).get('godot', {}),
            'middle': analysis['sky_zones'].get('mid_sky', {}).get('godot', {}),
            'lower': analysis['sky_zones'].get('lower_sky', {}).get('godot', {}),
            'horizon': analysis['sky_zones'].get('horizon', {}).get('godot', {}),
            'water': analysis['sky_zones'].get('water_line', {}).get('godot', {})
        },
        'brightness': analysis['brightness']['normalized']
    }


def generate_report(all_analyses, output_dir):
    """Write JSON report and Godot-ready list (by orientation + hour)."""
    sorted_analyses = sorted(all_analyses, key=lambda x: (x['orientation'], x['hour']))

    report = {
        'summary': {
            'total_images': len(all_analyses),
            'orientations': list({a['orientation'] for a in all_analyses}),
            'purpose': 'Skybox color extraction by orientation and hour'
        },
        'analyses': sorted_analyses
    }
    json_path = os.path.join(output_dir, 'skybox_analysis_report.json')
    with open(json_path, 'w') as f:
        json.dump(report, f, indent=2)
    print(f"✓ Saved JSON report: {json_path}")

    godot_data = [build_godot_entry(a) for a in sorted_analyses]
    godot_path = os.path.join(output_dir, 'skybox_colors_godot.json')
    with open(godot_path, 'w') as f:
        json.dump(godot_data, f, indent=2)
    print(f"✓ Saved Godot color data: {godot_path}")

    return json_path, godot_path


def main():
    script_dir = Path(__file__).resolve().parent
    default_screenshots = script_dir / 'Screenshots'

    if len(sys.argv) < 2:
        if default_screenshots.is_dir():
            image_dir = default_screenshots
            image_files = sorted(
                str(p) for p in image_dir.glob('*.png')
                if parse_orientation_hour_from_filename(p.name)[0] is not None
            )
        else:
            print("Usage: python skybox_analyzer.py <directory_with_images>")
            print("  or:  python skybox_analyzer.py <image1.png> <image2.png> ...")
            print("Expected filenames: XNN.png (e.g. E12.png, U06.png) with X in W,E,N,S,U and NN 00-23")
            sys.exit(1)
    else:
        if os.path.isdir(sys.argv[1]):
            image_dir = Path(sys.argv[1])
            image_files = []
            for ext in ['*.png', '*.jpg', '*.jpeg']:
                image_files.extend(image_dir.glob(ext))
            image_files = sorted(str(p) for p in image_files)
        else:
            image_files = sys.argv[1:]

    if not image_files:
        print("Error: No images found!")
        sys.exit(1)

    print("\n🎨 Skybox Color Analyzer (orientation + hour)")
    print("=" * 50)
    print(f"Found {len(image_files)} images\n")

    all_analyses = []
    for img_path in image_files:
        try:
            analysis = analyze_image(img_path)
            if analysis is not None:
                all_analyses.append(analysis)
        except Exception as e:
            print(f"✗ Error analyzing {img_path}: {e}")

    if not all_analyses:
        print("Error: No images were successfully analyzed!")
        sys.exit(1)

    print(f"\n✓ Analyzed {len(all_analyses)} images")

    output_dir = script_dir
    os.makedirs(output_dir, exist_ok=True)
    print("\n📊 Generating reports...")
    generate_report(all_analyses, output_dir)
    print("\n✅ Done. Open index.html in this folder to view results.")


if __name__ == "__main__":
    main()
