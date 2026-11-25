# Dawang-PPT

**Pure-Node Fast Presentation Engine · Modern Web UI Aesthetics · Zero-Lag Offline HTML Studio · Native Editable PPTX Export**

Turn raw notes, spreadsheets, screenshots, and business reports into a **single self-contained offline-editable HTML Studio** and a **native editable PPTX** in seconds. AI automatically composes modern Web UI components on one click, and recipients can open the delivered HTML directly in Chrome/Edge with zero installation to edit text, drag/align elements, switch between 4 zero-loss layouts per slide or 11 palettes in one click, and export to PPTX/PDF/PNG.

[中文文档](README.md) · [Installation & Usage](docs/USAGE.md) · [Showcase](docs/SHOWCASE.md) · [Authoring Approach](docs/APPROACH.md)

![Dawang-PPT 7-slide full-component showcase overview](docs/images/showcase-overview.png)

## Key Highlights

- **35 Modern Web UI & Executive Structure Components (AI Auto-Composed · 100% Native PPTX Editable):** Inspired by **Tremor, shadcn/ui, Magic UI, Aceternity UI, Kibo UI, ReUI, Origin UI, Tailark, Linear, Stripe, and AntV Infographic**. Powered by a two-tier **Card Density & Anti-Empty-Box Engine** (`fitCardHeight`, `extractCardMetric`, aspect-aware horizontal metric split), covering:
  - *Data & Charts:* Sparkline KPIs, Tremor Category Breakdown (`breakdown`), Multi-Period SLA Tracker (`tracker`), Smooth SVG Radial Gauges (`gauges`), Grouped/Stacked Bar Charts (`barChart`), Multi-Line/Area/Combo Charts (`lineChart`), and Ranked BarLists (`rankList`).
  - *Strategy & Infographics:* 2×2 Quadrant Matrix (`matrix`), Issue→Cause→Solution Diagnosis Trio (`diagnosis`), SaaS Feature Matrix (`featureMatrix`), Conversion Funnel (`funnel`), Hub & Spoke (`hub`), Pyramid Stack (`pyramid`), Orbit Growth Flywheel (`orbit`), Iceberg Root-Cause Model (`iceberg`), and Multi-Axis Radar Scorecards (`radar`).
  - *Executive & Roadmap:* Executive One-Pager Bento (`execBrief`), Project Spec Cards (`specCard`), OKR Goal Trees (`okr`), Risk & Mitigation Strips (`risks`), Multi-Lane Gantt / Kanban Boards (`gantt`), Dual-Track Roadmaps (`dualTrack`), Quote & Owner Cards (`quotes`), Auto Top Segmented Section Nav Tabs (`PILL-02`), plus **Section Dividers (`role: "section"`) and Executive Closings (`role: "closing"`)**—every slide with 4 zero-loss switchable variants.
- **Refined Dual-Font Hierarchy & High-Density Resilience:** Bundles **Source Han Sans SC (400 Regular body / 700 Bold headings / 900 Heavy figures)** + **YouSheBiaoTiHei (auto-applied to covers & ≤10-char short titles)**, with adaptive 2-line long-headline wrapping and a `compact` layout fallback tier so dense single-slide cases never overflow or auto-split pages.
- **Screenshot & Tall Poster Framed Contain Mode (`fit: "contain"`):** Automatically distinguishes desktop UI/dashboard screenshots (`kind: "screenshot"`, rendered inside a subtle browser window chrome card) and vertical campaign posters (`kind: "poster"`, centered inside a gallery mat frame) to keep edges, axes, and labels 100% uncropped across HTML and PPTX, while keeping live photos crisp with `cover` framing and `50% 25%` portrait top protection.
- **Offline Studio v4 Editor (`file://` Ready):**
  - **4 Zero-Content-Loss Switchable Layouts per Slide** automatically composed by `report-deck.mjs` from real slide data (e.g. Segmented Bar ↔ Ranked Bars ↔ Bento Tiles, Centered Funnel ↔ Step Cards ↔ Ladder Bars, Hub ↔ Layered Pipeline, Horizontal Stepper ↔ Vertical Timeline ↔ Ribbon Band), with instant switching and `⌘Z` undo.
  - **One-Click 11 Three-Tone Palettes** (9 light + 2 dark flagship themes), automatically remapping every slide and every stored layout variant.
  - **Minimal Topbar & Figma-style Canvas:** clean `Text / Shape / Image` toolbar, marquee multi-select, smart snapping & distribution, in-place image cropping, and 80% smaller single-file HTML via dynamic font subsetting & deduplicated asset pooling.
- **Role-Aware Ingestion, Layout-Decoupled Lint & Sub-2s Pure-Node Pipeline:** `dawang.mjs ingest` merges folders, `--draft`, `--history`, and `--note` inputs into paginated `contact-sheet.png` volumes + `IMG-XX` / `TBL-XX` short IDs; `dawang.mjs outline:lint` pre-validates layout-decoupled plans; `dawang.mjs fast:build` compiles HTML, native PPTX, and DOM-checked `preview.png` without Chrome in under 2s.

![Dawang-PPT Studio offline editor workspace](docs/images/editor-overview.png)

## Quick Start

Requires Node.js 22+ (primarily tested on macOS + Chrome). Viewers/editors of delivered HTML files need no installation at all.

```sh
git clone https://github.com/mujingquan835/Dawang-ppt.git
cd Dawang-ppt/skills/dawang-ppt
npm ci --prefix project
node scripts/install.mjs
node scripts/dawang.mjs doctor
```

Once `doctor` reports `ready: true`, invoke `dawang-ppt` in your AI coding agent (Claude Code, Codex, Cursor, Antigravity) or build directly via CLI:

```sh
# 1. Role-aware multi-source ingest + paginated contact sheets + IMG-XX/TBL-XX short IDs
node skills/dawang-ppt/scripts/dawang.mjs ingest "<materials_dir>" --draft "<draft.pptx>" --history "<history.pptx>" --note "<instructions>" --out "<tmp_dir>"

# 2. Optional: render a layout-decoupled outline review table
node skills/dawang-ppt/scripts/dawang.mjs outline:lint "<outline.json>" --md "<tmp_dir>/outline-plan.md"

# 3. Pure-Node fast build to HTML + PPTX + preview grid
node skills/dawang-ppt/scripts/dawang.mjs fast:build "<outline.json>" "<out.html>" --pptx "<out.pptx>" --preview "<preview.png>"
```

See [README.md](README.md), [USAGE.md](docs/USAGE.md), [LICENSE](LICENSE), and [NOTICE.md](NOTICE.md) for full details.
