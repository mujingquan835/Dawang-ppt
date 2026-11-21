#!/usr/bin/env python3
"""
Fast 1-second material ingester for Dawang-PPT:
  - Extracts text from .md, .txt, .json, .pptx, .docx, and summarizes .xlsx tables/counts
  - Generates ONE labeled Contact Sheet PNG (contact-sheet.png) of all images with index, dimensions, aspect ratio & filename
  - Writes a compact material-brief.md so the LLM needs only 1 command + 1 image read to survey any folder.
"""
import argparse
import json
import os
import sys
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

IMG_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
DOC_EXTS = {".md", ".txt", ".pptx", ".xlsx", ".docx", ".csv"}


def read_pptx(path: Path, media_out: Path | None = None) -> tuple[str, list[Path]]:
    out = []
    extracted_imgs = []
    with zipfile.ZipFile(path, "r") as z:
        slides = sorted(
            [n for n in z.namelist() if n.startswith("ppt/slides/slide") and n.endswith(".xml")],
            key=lambda s: int("".join(ch for ch in Path(s).stem if ch.isdigit()) or 0),
        )
        for idx, s in enumerate(slides, 1):
            root = ET.fromstring(z.read(s))
            texts = [t.text.strip() for t in root.iter() if t.tag.endswith("}t") and t.text and t.text.strip()]
            out.append(f"  - Slide {idx}: " + " | ".join(texts))
        if media_out is not None:
            for name in sorted(z.namelist()):
                if name.startswith("ppt/media/") and Path(name).suffix.lower() in IMG_EXTS:
                    media_out.mkdir(parents=True, exist_ok=True)
                    dest = media_out / f"{path.stem}_{Path(name).name}"
                    dest.write_bytes(z.read(name))
                    extracted_imgs.append(dest)
    return "\n".join(out), extracted_imgs


def read_docx(path: Path) -> str:
    out = []
    with zipfile.ZipFile(path, "r") as z:
        if "word/document.xml" not in z.namelist():
            return ""
        root = ET.fromstring(z.read("word/document.xml"))
        for p in root.iter():
            if p.tag.endswith("}p"):
                ts = [t.text for t in p.iter() if t.tag.endswith("}t") and t.text]
                line = "".join(ts).strip()
                if line:
                    out.append(line)
    return "\n".join(out[:120])


def read_xlsx(path: Path) -> str:
    try:
        import openpyxl
    except ImportError:
        return "(openpyxl not installed; skipped)"
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    parts = []
    for name in wb.sheetnames:
        ws = wb[name]
        rows = [list(r) for r in ws.iter_rows(values_only=True) if any(v is not None and str(v).strip() for v in r)]
        if not rows:
            continue
        headers = [str(c).strip() if c is not None else f"Col{i+1}" for i, c in enumerate(rows[0])]
        data_rows = rows[1:]
        parts.append(f"  - Sheet `{name}`: {len(data_rows)} data rows, columns = {headers}")
        # Auto-summarize distinct counts & top values for categorical columns
        for ci, h in enumerate(headers):
            vals = [str(r[ci]).strip() for r in data_rows if ci < len(r) and r[ci] is not None and str(r[ci]).strip()]
            if not vals:
                continue
            uniq = len(set(vals))
            top = Counter(vals).most_common(5)
            if uniq <= max(15, len(vals) * 0.4):
                top_str = ", ".join(f"{k}({v})" for k, v in top)
                parts.append(f"    * {h}: {uniq} unique | top: {top_str}")
            else:
                parts.append(f"    * {h}: {uniq} unique (non-empty {len(vals)})")
        # Include all rows if small table (<= 25 rows), otherwise first 5 sample rows
        limit = len(data_rows) if len(data_rows) <= 25 else 5
        for r in data_rows[:limit]:
            parts.append("    row: " + " | ".join(str(c) if c is not None else "" for c in r[:10]))
    wb.close()
    return "\n".join(parts)


def shape_tag(ratio: float) -> str:
    if ratio >= 2.0:
        return "宽图band"
    if ratio >= 1.15:
        return "横图"
    if ratio >= 0.85:
        return "方图"
    return "竖图"


def build_contact_sheet(images: list, out_png: Path):
    if not images:
        return None
    n = len(images)
    cols = min(4, max(1, n)) if n <= 8 else 5
    rows = (n + cols - 1) // cols
    cell_w, cell_h = 360, 270
    label_h = 46
    pad = 14
    sheet_w = cols * cell_w + (cols + 1) * pad
    sheet_h = rows * (cell_h + label_h) + (rows + 1) * pad
    sheet = Image.new("RGB", (sheet_w, sheet_h), (244, 246, 250))
    draw = ImageDraw.Draw(sheet)

    font = None
    for cand in [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
    ]:
        if os.path.exists(cand):
            try:
                font = ImageFont.truetype(cand, 15)
                break
            except Exception:
                pass
    if font is None:
        font = ImageFont.load_default()

    for idx, info in enumerate(images):
        r, c = divmod(idx, cols)
        x0 = pad + c * (cell_w + pad)
        y0 = pad + r * (cell_h + label_h + pad)
        # Card background
        draw.rectangle([x0, y0, x0 + cell_w, y0 + cell_h + label_h], fill=(255, 255, 255), outline=(216, 222, 232))
        try:
            with Image.open(info["path"]) as im:
                im = ImageOps.exif_transpose(im).convert("RGB")
                im.thumbnail((cell_w - 8, cell_h - 8))
                ox = x0 + (cell_w - im.width) // 2
                oy = y0 + (cell_h - im.height) // 2
                sheet.paste(im, (ox, oy))
        except Exception:
            draw.text((x0 + 12, y0 + 20), "IMAGE READ ERROR", fill=(200, 30, 30), font=font)
        # Badge + label
        line1 = f"{info['id']} | {info['width']}x{info['height']} ({info['ratio']:.2f}:1 {info['orientation']})"
        line2 = info["rel"][-42:]
        draw.text((x0 + 8, y0 + cell_h + 4), line1, fill=(24, 34, 64), font=font)
        draw.text((x0 + 8, y0 + cell_h + 24), line2, fill=(100, 112, 130), font=font)

    out_png.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(str(out_png), optimize=True)
    return str(out_png)


def main():
    parser = argparse.ArgumentParser(description="Fast 1-second material ingester for Dawang-PPT")
    parser.add_argument("src", help="Source directory or file")
    parser.add_argument("out_dir", help="Output directory for brief & contact-sheet.png")
    args = parser.parse_args()

    src = Path(args.src).resolve()
    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    files = [src] if src.is_file() else sorted(p for p in src.rglob("*") if p.is_file() and not p.name.startswith("."))

    docs = []
    images = []
    img_idx = 0

    for f in files:
        rel = str(f.relative_to(src)) if src.is_dir() else f.name
        ext = f.suffix.lower()
        if ext in IMG_EXTS:
            try:
                with Image.open(f) as im:
                    im = ImageOps.exif_transpose(im)
                    w, h = im.size
                ratio = w / max(1, h)
                img_idx += 1
                images.append({
                    "id": f"IMG-{img_idx:02d}",
                    "path": str(f),
                    "rel": rel,
                    "width": w,
                    "height": h,
                    "ratio": round(ratio, 2),
                    "orientation": shape_tag(ratio),
                })
            except Exception as e:
                docs.append((rel, f"(image error: {e})"))
        elif ext in DOC_EXTS:
            try:
                if ext in {".md", ".txt", ".csv"}:
                    text = f.read_text(encoding="utf-8", errors="ignore").strip()
                    if len(text) > 12000:
                        text = text[:12000] + "\n... (truncated)"
                    docs.append((rel, text))
                elif ext == ".pptx":
                    txt, pptx_imgs = read_pptx(f, out_dir / "pptx-media")
                    docs.append((rel, txt))
                    for pimg in pptx_imgs:
                        try:
                            with Image.open(pimg) as im:
                                im = ImageOps.exif_transpose(im)
                                w, h = im.size
                            if w < 120 or h < 120:
                                continue
                            ratio = w / max(1, h)
                            img_idx += 1
                            images.append({
                                "id": f"IMG-{img_idx:02d}",
                                "path": str(pimg),
                                "rel": f"{rel}!{pimg.name}",
                                "width": w,
                                "height": h,
                                "ratio": round(ratio, 2),
                                "orientation": shape_tag(ratio),
                            })
                        except Exception:
                            pass
                elif ext == ".docx":
                    docs.append((rel, read_docx(f)))
                elif ext == ".xlsx":
                    docs.append((rel, read_xlsx(f)))
            except Exception as e:
                docs.append((rel, f"(parse error: {e})"))

    contact_sheet = build_contact_sheet(images, out_dir / "contact-sheet.png") if images else None

    # Write compact material-brief.md
    brief_lines = [f"# Material Brief: {src.name}", ""]
    if images:
        brief_lines.append(f"## Images ({len(images)} total — view ONE contact sheet: `{contact_sheet}`)")
        for img in images:
            brief_lines.append(f"- **{img['id']}** (`{img['width']}×{img['height']}`, {img['ratio']}:1 {img['orientation']}): `{img['path']}`")
        brief_lines.append("")

    for rel, content in docs:
        brief_lines.append(f"## File: `{rel}`")
        brief_lines.append(content)
        brief_lines.append("")

    brief_file = out_dir / "material-brief.md"
    brief_file.write_text("\n".join(brief_lines), encoding="utf-8")

    print(json.dumps({
        "ok": True,
        "source": str(src),
        "briefFile": str(brief_file),
        "contactSheet": contact_sheet,
        "docCount": len(docs),
        "imageCount": len(images),
        "images": images,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
