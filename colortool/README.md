# Skybox Color Analyzer

Standalone tool to analyze skybox screenshots by **orientation** (W, E, N, S, U) and **hour** (0–23). Outputs Godot-ready color data and a web viewer.

## Setup

```bash
pip install -r requirements.txt
```

## Run

1. Put screenshots in `Screenshots/` named `XNN.png` (e.g. `E12.png`, `U06.png`):
   - **X** = W | E | N | S | U
   - **NN** = hour 00–23

2. Analyze (defaults to `Screenshots/` in this folder):

   ```bash
   python skybox_analyzer.py
   ```

   Or pass a directory:

   ```bash
   python skybox_analyzer.py /path/to/images
   ```

3. Open `index.html` in a browser to view results. Use the orientation tabs and hour dropdown to browse by view and time.

## Outputs

- `skybox_analysis_report.json` — full analysis per image
- `skybox_colors_godot.json` — Godot-ready colors (used by the web viewer)
