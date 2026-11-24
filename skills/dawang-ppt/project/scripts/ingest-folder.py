#!/usr/bin/env python3
"""
Multi-source role-aware material ingester (v2) for Dawang-PPT:
  - Accepts multiple directories/files + explicit role flags (--draft, --history, --note) + positional backward compatibility
  - Extracts fidelity-preserving content from .pptx (slide order, tables, speaker notes, master-logo dedup, slide-to-image provenance),
    .docx (headings, full text, tables, embedded images), .xlsx/.csv (tables + precomputed sums/avgs/breakdown pct excluding total rows),
    .pdf (pdftotext), .html (portable project or readable text), .md/.txt/.json
  - Separates oral directives / do-not-display bans (口述要求与上屏禁令) and detects relation signals
  - Generates contact-sheet.png, material-pack.json (IMG-XX / TBL-XX short IDs), and material-brief.md
"""
import argparse
import csv
import hashlib
import html as html_lib
import json
import os
import posixpath
import re
import shutil
import subprocess
import sys
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

IMG_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
DOC_EXTS = {".md", ".txt", ".pptx", ".xlsx", ".docx", ".csv", ".json", ".pdf", ".html", ".htm"}

HISTORY_RE = re.compile(r"历史|往期|去年|上期|上季|参考|模板|202[0-5]|history|ref", re.I)
DRAFT_RE = re.compile(r"粗版|草稿|初稿|draft|v0", re.I)
ORAL_RE = re.compile(r"口述|要求|说明|指令|备注|prompt", re.I)
SCREENSHOT_RE = re.compile(r"截图|screen|shot|后台|看板|表格|ui|dashboard|chart|数据图|系统|页面|网页|企微|群聊", re.I)
POSTER_RE = re.compile(r"海报|长图|战报|易拉宝|展架|kv|poster|banner|flyer|竖版图", re.I)
DIRECTIVE_RE = re.compile(
    r"不放进|不上屏|不进\s*PPT|别放|不要放|删掉|去掉|剔除|仅供内部|制作说明|内部参考|待确认|TODO|重点突出|强调|口径以|保留.*风格|参考.*结构",
    re.I,
)
TOTAL_ROW_RE = re.compile(r"^(合计|总计|小计|总盘|总和|汇总|total|sum)\b", re.I)
SKIP_SUM_HEADER_RE = re.compile(r"^(序号|编号|id|年份|年度|日期|时间|月份|季度|排期)$", re.I)
PREFERRED_VALUE_COL_RE = re.compile(r"金额|营收|收入|成交|GMV|预算|费用|数量|单数|人数|销量|投入|产出|规模|销售额", re.I)
PERSONAL_COL_RE = re.compile(r"^(姓名|电话|手机|手机号|联系方式|微信|序号|编号|id|身份证)$", re.I)
PREFERRED_CAT_COL_RE = re.compile(r"部门|渠道|类别|分类|奖项|奖品|等级|产品线|区域|公司|门店", re.I)

MAX_DOC_CHARS = 30000
MAX_TABLE_PREVIEW_ROWS = 30


def resolve_caller_path(raw: str, caller_cwd: Path) -> Path:
    p = Path(raw)
    if p.is_absolute():
        return p.resolve()
    return (caller_cwd / p).resolve()


def infer_role(rel: str, forced_role: str | None = None) -> str:
    if forced_role:
        return forced_role
    if HISTORY_RE.search(rel):
        return "history"
    if DRAFT_RE.search(rel):
        return "draft"
    if ORAL_RE.search(rel):
        return "oral"
    return "material"


def shape_tag(ratio: float) -> str:
    if ratio >= 2.0:
        return "宽图band"
    if ratio >= 1.15:
        return "横图"
    if ratio >= 0.85:
        return "方图"
    return "竖图"


def infer_kind_hint(rel: str, ratio: float) -> str:
    if POSTER_RE.search(rel):
        return "poster"
    if SCREENSHOT_RE.search(rel):
        return "screenshot"
    if ratio < 0.56 or ratio > 2.4:
        return "poster"
    return "photo"


def safe_stem(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9\u4e00-\u9fff._-]+", "_", name).strip("_")
    return cleaned[:48] or "file"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def parse_rels(xml_bytes: bytes | None) -> dict[str, str]:
    if not xml_bytes:
        return {}
    out = {}
    try:
        root = ET.fromstring(xml_bytes)
        for rel in root.iter():
            if rel.tag.endswith("}Relationship"):
                rid = rel.attrib.get("Id")
                target = rel.attrib.get("Target")
                if rid and target:
                    out[rid] = target
    except Exception:
        pass
    return out


def resolve_zip_target(base_file: str, target: str) -> str:
    if target.startswith("/"):
        return target.lstrip("/")
    return posixpath.normpath(posixpath.join(posixpath.dirname(base_file), target))


def collect_paragraphs(node: ET.Element, skip_tables: bool = True) -> list[str]:
    out = []

    def walk(el: ET.Element):
        if skip_tables and el.tag.endswith("}tbl"):
            return
        if el.tag.endswith("}p"):
            texts = [t.text for t in el.iter() if t.tag.endswith("}t") and t.text]
            line = "".join(texts).strip()
            if line:
                out.append(line)
            return
        for child in el:
            walk(child)

    walk(node)
    return out


def extract_xml_table(tbl_el: ET.Element) -> list[list[str]]:
    rows = []
    for tr in tbl_el:
        if not tr.tag.endswith("}tr"):
            continue
        row = []
        for tc in tr:
            if not tc.tag.endswith("}tc"):
                continue
            cell_lines = collect_paragraphs(tc, skip_tables=False)
            cell_text = " ".join(cell_lines).replace("|", "／").strip()
            row.append(cell_text)
        if any(row):
            rows.append(row)
    return rows


def rows_to_markdown(columns: list[str], rows: list[list[str]], max_rows: int = 20) -> str:
    if not columns:
        return ""
    width = len(columns)
    norm_cols = [str(c).replace("\n", " ").replace("|", "／").strip() or f"列{i+1}" for i, c in enumerate(columns)]
    lines = [
        "| " + " | ".join(norm_cols) + " |",
        "| " + " | ".join(["---"] * width) + " |",
    ]
    for r in rows[:max_rows]:
        padded = [str(r[i] if i < len(r) else "").replace("\n", " ").replace("|", "／").strip() for i in range(width)]
        lines.append("| " + " | ".join(padded) + " |")
    if len(rows) > max_rows:
        lines.append(f"*(表共 {len(rows)} 行，展示前 {max_rows} 行)*")
    return "\n".join(lines)


def parse_number_cell(raw) -> tuple[float, str] | None:
    if raw is None or isinstance(raw, bool):
        return None
    if isinstance(raw, (int, float)):
        return float(raw), ""
    s = str(raw).strip()
    if not s:
        return None
    s_clean = s.replace(",", "").replace("，", "").replace("¥", "").replace("￥", "").replace("$", "").strip()
    m = re.match(r"^([+\-]?\d+(?:\.\d+)?)\s*(%|％|万|亿元|亿|元|万元|单|家|个|人|次|份|场)?$", s_clean)
    if not m:
        return None
    try:
        val = float(m.group(1))
    except ValueError:
        return None
    unit = (m.group(2) or "").replace("％", "%")
    return val, unit


def largest_remainder_pcts(values: list[float]) -> list[int]:
    total = sum(v for v in values if v > 0)
    if total <= 0:
        return [0] * len(values)
    raw = [(max(0.0, v) / total) * 100.0 for v in values]
    floors = [int(x) for x in raw]
    rem = 100 - sum(floors)
    order = sorted(range(len(values)), key=lambda idx: raw[idx] - floors[idx], reverse=True)
    for idx in order[:max(0, rem)]:
        floors[idx] += 1
    return floors


def format_num_short(val: float) -> str:
    if abs(val - round(val)) < 1e-6:
        return f"{int(round(val)):,}"
    return f"{val:,.2f}".rstrip("0").rstrip(".")


def summarize_tabular(
    title: str,
    columns: list[str],
    all_rows: list[list],
    source_rel: str,
    source_role: str,
    from_slide: str | None = None,
) -> tuple[dict, str]:
    str_rows = [[str(c).strip() if c is not None else "" for c in r[: len(columns)]] for r in all_rows]
    # Separate explicit total/summary rows so aggregations never double-count
    data_rows = []
    excluded_total_rows = 0
    for r in str_rows:
        first_cell = re.sub(r"[*\s]+", "", r[0]) if r else ""
        if first_cell and TOTAL_ROW_RE.match(first_cell):
            excluded_total_rows += 1
        else:
            data_rows.append(r)

    raw_data_rows = [
        r for idx, r in enumerate(all_rows)
        if not (str_rows[idx][0] and TOTAL_ROW_RE.match(re.sub(r"[*\s]+", "", str_rows[idx][0])))
    ]

    stats = []
    col_numeric_values: dict[int, list[tuple[int, float, str]]] = {}
    for ci, col_name in enumerate(columns):
        parsed = []
        for ri, r in enumerate(raw_data_rows):
            cell = r[ci] if ci < len(r) else None
            num = parse_number_cell(cell)
            if num is not None:
                parsed.append((ri, num[0], num[1]))
        non_empty = sum(1 for r in data_rows if ci < len(r) and r[ci])
        if non_empty >= 2 and len(parsed) >= max(2, int(non_empty * 0.6)) and not SKIP_SUM_HEADER_RE.match(col_name.strip()):
            vals = [x[1] for x in parsed]
            units = Counter(x[2] for x in parsed if x[2])
            unit = units.most_common(1)[0][0] if units else ""
            is_pct_col = unit == "%" or "占比" in col_name or "比例" in col_name or "率" in col_name
            col_numeric_values[ci] = parsed
            stats.append({
                "column": col_name,
                "count": len(vals),
                "sum": round(sum(vals), 4),
                "avg": round(sum(vals) / len(vals), 4),
                "min": round(min(vals), 4),
                "max": round(max(vals), 4),
                "unit": unit,
                "isPct": is_pct_col,
            })

    # Compute breakdown hints if 2..12 categorical data rows & a positive numeric column exists
    breakdown_hint = None
    if 2 <= len(data_rows) <= 12 and columns and col_numeric_values:
        # Check first column looks categorical (non-numeric)
        cat_vals = [r[0] if r else "" for r in data_rows]
        if all(cat_vals) and sum(1 for v in cat_vals if parse_number_cell(v) is None) >= max(1, len(cat_vals) // 2):
            # Pick best absolute numeric column first, fallback to pct column
            abs_cands = [st for st in stats if not st["isPct"] and st["sum"] > 0]
            pref_cands = [st for st in abs_cands if PREFERRED_VALUE_COL_RE.search(st["column"])]
            chosen_stat = pref_cands[0] if pref_cands else (abs_cands[0] if abs_cands else (stats[0] if stats[0]["sum"] > 0 else None))
            if chosen_stat:
                ci = columns.index(chosen_stat["column"])
                row_vals = []
                valid = True
                for ri, r in enumerate(raw_data_rows):
                    cell = r[ci] if ci < len(r) else None
                    num = parse_number_cell(cell)
                    if num is None or num[0] < 0:
                        valid = False
                        break
                    row_vals.append((cat_vals[ri], num[0], num[1] or chosen_stat["unit"]))
                if valid and len(row_vals) == len(data_rows) and sum(v[1] for v in row_vals) > 0:
                    pcts = largest_remainder_pcts([v[1] for v in row_vals])
                    items = []
                    for (lbl, num_v, unit), pct in zip(row_vals, pcts):
                        val_disp = format_num_short(num_v) + (f" {unit}" if unit and unit != "%" else ("%" if unit == "%" else ""))
                        items.append({"label": lbl, "value": val_disp, "pct": pct})
                    total_disp = format_num_short(sum(v[1] for v in row_vals)) + (
                        f" {chosen_stat['unit']}" if chosen_stat["unit"] and chosen_stat["unit"] != "%" else ""
                    )
                    breakdown_hint = {
                        "column": chosen_stat["column"],
                        "total": total_disp,
                        "items": items,
                    }

    # Categorical distribution stats (crucial for roster/winner tables with no numeric columns)
    categorical_stats = []
    for ci, col_name in enumerate(columns):
        if ci in col_numeric_values or PERSONAL_COL_RE.match(col_name.strip()):
            continue
        vals = [r[ci] for r in data_rows if ci < len(r) and r[ci]]
        if len(vals) < 3:
            continue
        uniq = len(set(vals))
        top = Counter(vals).most_common(6)
        categorical_stats.append({
            "column": col_name,
            "total": len(vals),
            "unique": uniq,
            "top": [
                {"value": k, "count": v, "pct": round(v * 100.0 / len(vals), 1)}
                for k, v in top
            ],
        })

    if breakdown_hint is None and categorical_stats:
        cat_cands = [cs for cs in categorical_stats if 2 <= cs["unique"] <= 8 and cs["total"] >= 3]
        pref_cat = [cs for cs in cat_cands if PREFERRED_CAT_COL_RE.search(cs["column"])]
        chosen_cat = pref_cat[0] if pref_cat else (cat_cands[0] if cat_cands else None)
        if chosen_cat:
            top_items = chosen_cat["top"]
            pcts = largest_remainder_pcts([float(x["count"]) for x in top_items])
            breakdown_hint = {
                "column": f"{chosen_cat['column']}（条数分布）",
                "total": f"{chosen_cat['total']} 条",
                "items": [
                    {"label": x["value"], "value": f"{x['count']} 条", "pct": pct}
                    for x, pct in zip(top_items, pcts)
                ],
            }

    table_meta = {
        "title": title,
        "source": source_rel,
        "sourceRole": source_role,
        **({"fromSlide": from_slide} if from_slide else {}),
        "columns": columns,
        "rows": str_rows[:MAX_TABLE_PREVIEW_ROWS],
        "totalRows": len(str_rows),
        "dataRowsCount": len(data_rows),
        "excludedTotalRows": excluded_total_rows,
        "stats": stats,
        **({"categoricalStats": categorical_stats} if categorical_stats else {}),
        **({"breakdownHint": breakdown_hint} if breakdown_hint else {}),
    }

    md_parts = [f"  - Table `{title}`: {len(data_rows)} data rows" + (f" (excluded {excluded_total_rows} total row)" if excluded_total_rows else "") + f", columns = {columns}"]
    for st in stats:
        u = f" {st['unit']}" if st["unit"] else ""
        if st["isPct"]:
            md_parts.append(f"    * {st['column']}: avg={format_num_short(st['avg'])}{u}, range=[{format_num_short(st['min'])}{u}, {format_num_short(st['max'])}{u}]")
        else:
            md_parts.append(f"    * {st['column']}: sum={format_num_short(st['sum'])}{u}, avg={format_num_short(st['avg'])}{u}, range=[{format_num_short(st['min'])}{u}, {format_num_short(st['max'])}{u}]")
    for cs in categorical_stats:
        top_str = ", ".join(f"{x['value']}({x['count']}条/{x['pct']}%)" for x in cs["top"][:5])
        md_parts.append(f"    * {cs['column']}: {cs['unique']} unique / {cs['total']} rows | top: {top_str}")
    if breakdown_hint:
        hint_items = ", ".join(f"{it['label']}: {it['value']} ({it['pct']}%)" for it in breakdown_hint["items"])
        md_parts.append(f"    * 💡 适合 `breakdown`（合计 {breakdown_hint['total']}）: {hint_items}")
    md_parts.append(rows_to_markdown(columns, str_rows, max_rows=5 if len(str_rows) > 12 else 20))
    return table_meta, "\n".join(md_parts)


def read_pptx_v2(path: Path, rel: str, role: str, out_dir: Path, table_registry: list, img_registrar):
    out_lines = []
    skipped_master = []
    with zipfile.ZipFile(path, "r") as z:
        names = set(z.namelist())
        pres_rels = parse_rels(z.read("ppt/_rels/presentation.xml.rels")) if "ppt/_rels/presentation.xml.rels" in names else {}
        slide_targets = []
        if "ppt/presentation.xml" in names:
            pres_root = ET.fromstring(z.read("ppt/presentation.xml"))
            for el in pres_root.iter():
                if el.tag.endswith("}sldId"):
                    rid = next((v for k, v in el.attrib.items() if k.endswith("}id") or k == "r:id"), None)
                    if rid and rid in pres_rels:
                        slide_targets.append(resolve_zip_target("ppt/presentation.xml", pres_rels[rid]))
        if not slide_targets:
            slide_targets = sorted(
                [n for n in names if n.startswith("ppt/slides/slide") and n.endswith(".xml")],
                key=lambda s: int("".join(ch for ch in Path(s).stem if ch.isdigit()) or 0),
            )

        # Pass 1: collect slide data and image hashes to detect master/template repeated logos
        slide_records = []
        hash_slides: dict[str, set[int]] = defaultdict(set)
        for idx, slide_zip_path in enumerate(slide_targets, 1):
            if slide_zip_path not in names:
                continue
            raw_xml = z.read(slide_zip_path)
            hidden = bool(re.search(rb'\bshow="0"', raw_xml[:800]))
            root = ET.fromstring(raw_xml)
            lines = collect_paragraphs(root, skip_tables=True)
            slide_title = lines[0][:42] if lines else f"Slide {idx}"

            tables = []
            for tbl_el in root.iter():
                if tbl_el.tag.endswith("}tbl"):
                    rows = extract_xml_table(tbl_el)
                    if rows:
                        tables.append(rows)

            slide_base = posixpath.basename(slide_zip_path)
            s_rels_path = f"ppt/slides/_rels/{slide_base}.rels"
            s_rels = parse_rels(z.read(s_rels_path)) if s_rels_path in names else {}

            notes = []
            for tgt in s_rels.values():
                if "notesSlide" in tgt:
                    npath = resolve_zip_target(slide_zip_path, tgt)
                    if npath in names:
                        nroot = ET.fromstring(z.read(npath))
                        notes = [l for l in collect_paragraphs(nroot, skip_tables=False) if not l.isdigit()]

            blips = []
            seen_rids = set()
            for el in root.iter():
                if el.tag.endswith("}blip"):
                    rid = next((v for k, v in el.attrib.items() if k.endswith("}embed") or k == "embed"), None)
                    if rid and rid not in seen_rids and rid in s_rels:
                        seen_rids.add(rid)
                        img_zip_path = resolve_zip_target(slide_zip_path, s_rels[rid])
                        if img_zip_path in names and Path(img_zip_path).suffix.lower() in IMG_EXTS:
                            data = z.read(img_zip_path)
                            h = sha256_bytes(data)
                            hash_slides[h].add(idx)
                            blips.append((img_zip_path, data, h))

            slide_records.append({
                "idx": idx,
                "hidden": hidden,
                "title": slide_title,
                "lines": lines,
                "tables": tables,
                "notes": notes,
                "blips": blips,
            })

        total_slides = len(slide_records)
        stem = safe_stem(path.stem)
        media_dir = out_dir / "pptx-media"

        for rec in slide_records:
            idx = rec["idx"]
            slide_tag = f"Slide {idx}"
            hidden_mark = "（隐藏）" if rec["hidden"] else ""
            out_lines.append(f"### {slide_tag}{hidden_mark}: {rec['title']}")
            if rec["lines"]:
                out_lines.append("  - 文本: " + " | ".join(rec["lines"]))

            for t_idx, rows in enumerate(rec["tables"], 1):
                cols = rows[0]
                data_rows = rows[1:]
                tbl_id = f"TBL-{len(table_registry) + 1:02d}"
                meta, tbl_md = summarize_tabular(
                    f"{path.stem}#{slide_tag}-T{t_idx}",
                    cols,
                    data_rows,
                    rel,
                    role,
                    from_slide=slide_tag,
                )
                meta["id"] = tbl_id
                table_registry.append(meta)
                out_lines.append(f"  - **{tbl_id}** (来自 {slide_tag}):\n{rows_to_markdown(cols, data_rows)}")

            slide_img_ids = []
            for b_idx, (img_zip_path, data, h) in enumerate(rec["blips"], 1):
                if total_slides >= 4 and len(hash_slides[h]) >= 3:
                    skipped_master.append({
                        "file": f"{rel}!{posixpath.basename(img_zip_path)}",
                        "reason": f"repeated across {len(hash_slides[h])}/{total_slides} slides (master/logo)",
                        "sha256": h[:12],
                    })
                    continue
                media_dir.mkdir(parents=True, exist_ok=True)
                ext = Path(img_zip_path).suffix.lower()
                dest = media_dir / f"{stem}_s{idx:02d}_{b_idx}{ext}"
                dest.write_bytes(data)
                img_rec = img_registrar(
                    dest,
                    f"{rel}!{slide_tag}/{posixpath.basename(img_zip_path)}",
                    role,
                    from_slide=slide_tag,
                    slide_title=rec["title"],
                    min_dim=120,
                )
                if img_rec is None:
                    dest.unlink(missing_ok=True)
                    skipped_master.append({
                        "file": f"{rel}!{posixpath.basename(img_zip_path)}",
                        "reason": "too small (<120px)",
                    })
                else:
                    slide_img_ids.append(img_rec["id"])

            if slide_img_ids:
                out_lines.append(f"  - 配图资产: {', '.join(slide_img_ids)}")
            if rec["notes"]:
                out_lines.append("  - 备注: " + " | ".join(rec["notes"]))
            out_lines.append("")

    return "\n".join(out_lines), skipped_master


def read_docx_v2(path: Path, rel: str, role: str, out_dir: Path, table_registry: list, img_registrar) -> str:
    out = []
    with zipfile.ZipFile(path, "r") as z:
        names = set(z.namelist())
        if "word/document.xml" in names:
            root = ET.fromstring(z.read("word/document.xml"))
            body = next((el for el in root if el.tag.endswith("}body")), root)
            tbl_seq = 0
            for child in body:
                if child.tag.endswith("}p"):
                    texts = [t.text for t in child.iter() if t.tag.endswith("}t") and t.text]
                    line = "".join(texts).strip()
                    if not line:
                        continue
                    style_val = ""
                    for ppr in child:
                        if ppr.tag.endswith("}pPr"):
                            for ps in ppr:
                                if ps.tag.endswith("}pStyle"):
                                    style_val = next(
                                        (v for k, v in ps.attrib.items() if k.endswith("}val") or k == "val"),
                                        "",
                                    )
                    if re.match(r"^(Heading\s*1|1|标题\s*1)$", style_val, re.I):
                        out.append(f"# {line}")
                    elif re.match(r"^(Heading\s*2|2|标题\s*2)$", style_val, re.I):
                        out.append(f"## {line}")
                    elif re.match(r"^(Heading\s*3|3|标题\s*3)$", style_val, re.I):
                        out.append(f"### {line}")
                    else:
                        out.append(line)
                elif child.tag.endswith("}tbl"):
                    rows = extract_xml_table(child)
                    if rows:
                        tbl_seq += 1
                        cols = rows[0]
                        data_rows = rows[1:]
                        tbl_id = f"TBL-{len(table_registry) + 1:02d}"
                        meta, _ = summarize_tabular(
                            f"{path.stem}-T{tbl_seq}",
                            cols,
                            data_rows,
                            rel,
                            role,
                        )
                        meta["id"] = tbl_id
                        table_registry.append(meta)
                        out.append(f"\n**{tbl_id}** (Word 表格):\n" + rows_to_markdown(cols, data_rows) + "\n")

        # Extract embedded images from word/media/
        stem = safe_stem(path.stem)
        media_dir = out_dir / "docx-media"
        extracted_ids = []
        for name in sorted(names):
            if name.startswith("word/media/") and Path(name).suffix.lower() in IMG_EXTS:
                media_dir.mkdir(parents=True, exist_ok=True)
                dest = media_dir / f"{stem}_{Path(name).name}"
                dest.write_bytes(z.read(name))
                img_rec = img_registrar(dest, f"{rel}!{Path(name).name}", role, min_dim=120)
                if img_rec is None:
                    dest.unlink(missing_ok=True)
                else:
                    extracted_ids.append(img_rec["id"])
        if extracted_ids:
            out.append(f"\n内嵌图片资产: {', '.join(extracted_ids)}")

    text = "\n".join(out)
    if len(text) > MAX_DOC_CHARS:
        text = text[:MAX_DOC_CHARS] + f"\n... (truncated at {MAX_DOC_CHARS} chars)"
    return text


def read_xlsx_v2(path: Path, rel: str, role: str, table_registry: list) -> str:
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
        non_empty_0 = sum(1 for c in rows[0] if c is not None and str(c).strip())
        non_empty_1 = sum(1 for c in rows[1] if c is not None and str(c).strip()) if len(rows) >= 2 else 0
        if len(rows) >= 3 and non_empty_0 < non_empty_1 and non_empty_0 <= max(1, int(non_empty_1 * 0.7)):
            max_cols = max(len(rows[0]), len(rows[1]))
            filled_0 = []
            cur_g = ""
            for ci in range(max_cols):
                v = rows[0][ci] if ci < len(rows[0]) else None
                if v is not None and str(v).strip():
                    cur_g = str(v).strip()
                filled_0.append(cur_g)
            headers = []
            for ci in range(max_cols):
                g = filled_0[ci]
                c = str(rows[1][ci]).strip() if ci < len(rows[1]) and rows[1][ci] is not None else ""
                if g and c and g != c:
                    headers.append(f"{g}-{c}")
                else:
                    headers.append(c or g or f"Col{ci+1}")
            all_data_rows = rows[2:]
        else:
            headers = [str(c).strip() if c is not None else f"Col{i+1}" for i, c in enumerate(rows[0])]
            all_data_rows = rows[1:]
        tbl_id = f"TBL-{len(table_registry) + 1:02d}"
        meta, md = summarize_tabular(f"{path.stem}/{name}", headers, all_data_rows, rel, role)
        meta["id"] = tbl_id
        table_registry.append(meta)
        parts.append(f"  - **{tbl_id}** (`{name}`):\n{md}")
    wb.close()
    return "\n".join(parts)


def read_csv_v2(path: Path, rel: str, role: str, table_registry: list) -> str:
    text = path.read_text(encoding="utf-8-sig", errors="ignore")
    rows = [r for r in csv.reader(text.splitlines()) if any(c.strip() for c in r)]
    if not rows:
        return "(empty csv)"
    headers = [c.strip() or f"Col{i+1}" for i, c in enumerate(rows[0])]
    tbl_id = f"TBL-{len(table_registry) + 1:02d}"
    meta, md = summarize_tabular(path.stem, headers, rows[1:], rel, role)
    meta["id"] = tbl_id
    table_registry.append(meta)
    return f"  - **{tbl_id}**:\n{md}"


def read_pdf_v2(path: Path) -> str:
    pdftotext = shutil.which("pdftotext")
    if not pdftotext:
        return "(pdftotext not installed; PDF text extraction skipped)"
    try:
        res = subprocess.run([pdftotext, "-layout", str(path), "-"], capture_output=True, text=True, timeout=20)
        if res.returncode == 0 and res.stdout.strip():
            txt = res.stdout.strip()
            return txt[:MAX_DOC_CHARS] + (f"\n... (truncated at {MAX_DOC_CHARS} chars)" if len(txt) > MAX_DOC_CHARS else "")
        return "(PDF yielded no selectable text)"
    except Exception as e:
        return f"(PDF extraction error: {e})"


def read_html_v2(path: Path) -> str:
    raw = path.read_text(encoding="utf-8", errors="ignore")
    m = re.search(
        r'<script[^>]*id=["\'](?:portable-project|fusion-project)["\'][^>]*>([\s\S]*?)</script>',
        raw,
        re.I,
    )
    if m:
        try:
            proj = json.loads(html_lib.unescape(m.group(1)))
            lines = []
            title = (proj.get("requirements") or {}).get("title")
            if title:
                lines.append(f"# {title}")
            for i, s in enumerate(proj.get("slides") or [], 1):
                texts = []
                for el in s.get("elements") or []:
                    if el.get("type") == "text":
                        t = el.get("text") or "".join(r.get("text", "") for r in (el.get("runs") or []))
                        if t and t.strip():
                            texts.append(t.strip())
                if texts:
                    lines.append(f"- Slide {i}: " + " | ".join(texts))
            if lines:
                return "\n".join(lines)[:MAX_DOC_CHARS]
        except Exception:
            pass
    cleaned = re.sub(r"<(script|style)[^>]*>[\s\S]*?</\1>", " ", raw, flags=re.I)
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    cleaned = html_lib.unescape(re.sub(r"[ \t]+", " ", cleaned))
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    return cleaned[:MAX_DOC_CHARS]


def extract_oral_directives(docs: list[dict]) -> list[dict]:
    seen = set()
    directives = []
    for d in docs:
        role = d["role"]
        rel = d["rel"]
        for line in d["content"].splitlines():
            clean = re.sub(r"^\s*(?:[-*+>]|#{1,6})\s*", "", line).strip()
            if not clean or len(clean) < 2:
                continue
            if role == "oral" or DIRECTIVE_RE.search(clean):
                key = clean
                if key not in seen:
                    seen.add(key)
                    directives.append({"source": rel, "role": role, "text": clean})
    return directives


def detect_relation_signals(docs: list[dict], tables: list[dict], directives: list[dict]) -> list[dict]:
    blob = "\n".join([d["content"] for d in docs] + [x["text"] for x in directives])
    signals = []
    if any("breakdownHint" in t for t in tables) or re.search(r"占比|构成|分布|拆解|结构", blob):
        bd_tables = [t["id"] for t in tables if "breakdownHint" in t]
        signals.append({
            "component": "breakdown",
            "reason": "存在构成/分项占比数据（已预计算 pct）" if bd_tables else "文本提及结构占比/构成拆解",
            "evidence": ", ".join(bd_tables) if bd_tables else "关键词命中",
        })
    if re.search(r"目标|计划值|预期|达成|完成率", blob):
        signals.append({"component": "data[].target", "reason": "存在实际值与目标值对照", "evidence": "目标/完成率口径"})
    if re.search(r"曝光|点击|线索|留资|转化率|漏斗", blob):
        signals.append({"component": "funnel", "reason": "存在多级递减转化路径", "evidence": "转化链路关键词"})
    if re.search(r"中台|多源|汇聚|分发|多端输出|底座", blob):
        signals.append({"component": "hub", "reason": "存在多源输入→核心引擎→多端输出架构", "evidence": "系统汇聚关键词"})
    if re.search(r"去年|上期|同比|环比|优化前|改进后|痛点|现状.*改进|问题.*对策", blob):
        signals.append({"component": "compare", "reason": "存在前后/新旧/问题与改进对照", "evidence": "对照变化关键词"})
    if re.search(r"Q[1-4]|阶段|排期|里程碑|时间线|[0-9一二三四五六七八九十]+月", blob):
        signals.append({"component": "periods", "reason": "存在时间周期或阶段推进节点", "evidence": "时间轴关键词"})
    if re.search(r"闭环|流程|步骤|链路|复盘回流", blob):
        signals.append({"component": "flows", "reason": "存在步骤链路或闭环回流", "evidence": "流程闭环关键词"})
    return signals


def _render_single_contact_sheet(sheet_images: list, out_png: Path, footer_note: str | None = None) -> str:
    n = len(sheet_images)
    if n <= 8:
        cols, cell_w, cell_h = min(4, max(1, n)), 360, 270
    elif n <= 20:
        cols, cell_w, cell_h = 5, 320, 240
    elif n <= 48:
        cols, cell_w, cell_h = 6, 280, 200
    else:
        cols, cell_w, cell_h = 8, 220, 160

    rows = (n + cols - 1) // cols
    label_h = 50
    pad = 12
    footer_h = 28 if footer_note else 0
    sheet_w = cols * cell_w + (cols + 1) * pad
    sheet_h = rows * (cell_h + label_h) + (rows + 1) * pad + footer_h
    sheet = Image.new("RGB", (sheet_w, sheet_h), (244, 246, 250))
    draw = ImageDraw.Draw(sheet)

    font = None
    font_sm = None
    for cand in [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
    ]:
        if os.path.exists(cand):
            try:
                font = ImageFont.truetype(cand, 13 if n > 20 else 15)
                font_sm = ImageFont.truetype(cand, 11 if n > 20 else 13)
                break
            except Exception:
                pass
    if font is None:
        font = ImageFont.load_default()
        font_sm = font

    for idx, info in enumerate(sheet_images):
        r, c = divmod(idx, cols)
        x0 = pad + c * (cell_w + pad)
        y0 = pad + r * (cell_h + label_h + pad)
        kind_hint = info.get("kindHint")
        outline_col = (
            (224, 158, 92) if info.get("fromHistory")
            else ((92, 148, 224) if kind_hint == "screenshot"
                  else ((124, 92, 224) if kind_hint == "poster" else (216, 222, 232)))
        )
        draw.rectangle([x0, y0, x0 + cell_w, y0 + cell_h + label_h], fill=(255, 255, 255), outline=outline_col, width=2 if info.get("fromHistory") or kind_hint in {"screenshot", "poster"} else 1)
        try:
            with Image.open(info["path"]) as im:
                if hasattr(im, "draft"):
                    try:
                        im.draft("RGB", (cell_w, cell_h))
                    except Exception:
                        pass
                im = ImageOps.exif_transpose(im).convert("RGB")
                im.thumbnail((cell_w - 8, cell_h - 8), Image.Resampling.BILINEAR)
                ox = x0 + (cell_w - im.width) // 2
                oy = y0 + (cell_h - im.height) // 2
                sheet.paste(im, (ox, oy))
        except Exception:
            draw.text((x0 + 12, y0 + 20), "IMAGE READ ERROR", fill=(200, 30, 30), font=font)

        tags = []
        if info.get("fromHistory"):
            tags.append("[历史]")
        elif info.get("sourceRole") == "draft":
            tags.append("[粗版]")
        if kind_hint == "screenshot":
            tags.append("[截图]")
        elif kind_hint == "poster":
            tags.append("[海报/长图]")
        tag_str = "".join(tags) + (" " if tags else "")
        line1 = f"{info['id']} | {info['width']}x{info['height']} ({info['ratio']:.2f}:1)"
        prov = f"{info['fromSlide']} " if info.get("fromSlide") else ""
        max_len = 28 if n > 48 else (36 if n > 20 else 46)
        line2 = f"{tag_str}{prov}{info['rel']}"[-max_len:]
        draw.text((x0 + 6, y0 + cell_h + 4), line1, fill=(24, 34, 64), font=font)
        line2_col = (
            (180, 83, 9) if info.get("fromHistory")
            else ((29, 78, 216) if kind_hint == "screenshot"
                  else ((109, 40, 217) if kind_hint == "poster" else (100, 112, 130)))
        )
        draw.text((x0 + 6, y0 + cell_h + 24), line2, fill=line2_col, font=font_sm)

    if footer_note:
        draw.text((pad, sheet_h - footer_h + 4), footer_note, fill=(71, 85, 105), font=font_sm)

    out_png.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(str(out_png), optimize=True)
    return str(out_png)


def build_contact_sheets(images: list, out_dir: Path, per_sheet: int = 80) -> list[dict]:
    if not images:
        return []
    total_n = len(images)
    chunks = [images[i : i + per_sheet] for i in range(0, total_n, per_sheet)]
    total_sheets = len(chunks)
    # Clean stale contact-sheet-N.png from earlier runs before writing
    for old_png in out_dir.glob("contact-sheet-*.png"):
        old_png.unlink(missing_ok=True)
    out = []
    for idx, chunk in enumerate(chunks, 1):
        fname = "contact-sheet.png" if idx == 1 else f"contact-sheet-{idx}.png"
        dest = out_dir / fname
        first_id = chunk[0]["id"]
        last_id = chunk[-1]["id"]
        note = f"第 {idx}/{total_sheets} 卷（{first_id} ~ {last_id}，共 {total_n} 张图片）" if total_sheets > 1 else None
        saved_path = _render_single_contact_sheet(chunk, dest, note)
        out.append({"index": idx, "path": saved_path, "firstId": first_id, "lastId": last_id, "count": len(chunk)})
    return out


def build_contact_sheet(images: list, out_png: Path):
    sheets = build_contact_sheets(images, out_png.parent)
    return sheets[0]["path"] if sheets else None


def parse_cli_args(argv: list[str], caller_cwd: Path):
    parser = argparse.ArgumentParser(description="Multi-source role-aware material ingester for Dawang-PPT")
    parser.add_argument("positional", nargs="*", help="Source paths (and output dir as last arg if --out omitted)")
    parser.add_argument("--out", "-o", dest="out_dir", help="Output directory")
    parser.add_argument("--draft", action="append", default=[], help="Draft PPTX/DOCX/MD path")
    parser.add_argument("--history", action="append", default=[], help="Historical reference PPTX/DOCX path")
    parser.add_argument("--note", action="append", default=[], help="Oral requirement text or file path")
    args = parser.parse_args(argv)

    pos = list(args.positional)
    if args.out_dir:
        out_dir = resolve_caller_path(args.out_dir, caller_cwd)
        pos_sources = pos
    else:
        if len(pos) < 1 or (len(pos) == 1 and not (args.draft or args.history or args.note)):
            parser.error("Provide <source...> <output-dir> or --out <output-dir>")
        out_dir = resolve_caller_path(pos[-1], caller_cwd)
        pos_sources = pos[:-1]

    inputs = []
    for p in args.draft:
        inputs.append((resolve_caller_path(p, caller_cwd), "draft"))
    for p in args.history:
        inputs.append((resolve_caller_path(p, caller_cwd), "history"))

    inline_notes = []
    for n in args.note:
        if len(n) < 400:
            cand = resolve_caller_path(n, caller_cwd)
            if cand.exists() and cand.is_file():
                inputs.append((cand, "oral"))
                continue
        inline_notes.append(n)

    for p in pos_sources:
        inputs.append((resolve_caller_path(p, caller_cwd), None))

    return out_dir, inputs, inline_notes


def main():
    caller_cwd = Path(os.environ.get("DAWANG_CALLER_CWD") or os.getcwd()).resolve()
    out_dir, inputs, inline_notes = parse_cli_args(sys.argv[1:], caller_cwd)
    out_dir.mkdir(parents=True, exist_ok=True)

    # Expand files preserving deterministic order & avoiding duplicate same-path entries
    file_entries: list[tuple[Path, str, str | None]] = []
    seen_paths: set[Path] = set()
    sources_meta = []

    for src_path, forced_role in inputs:
        if not src_path.exists():
            sources_meta.append({"path": str(src_path), "name": src_path.name, "role": forced_role or "material", "missing": True})
            continue
        if src_path.is_file():
            role = infer_role(src_path.name, forced_role)
            sources_meta.append({"path": str(src_path), "name": src_path.name, "role": role, "ext": src_path.suffix.lower()})
            if src_path not in seen_paths:
                seen_paths.add(src_path)
                file_entries.append((src_path, src_path.name, forced_role))
        else:
            sources_meta.append({"path": str(src_path), "name": src_path.name, "role": forced_role or "directory", "isDir": True})
            for f in sorted(src_path.rglob("*")):
                if not f.is_file():
                    continue
                rel_parts = f.relative_to(src_path).parts
                if any(part.startswith(".") for part in rel_parts):
                    continue
                if f not in seen_paths:
                    seen_paths.add(f)
                    file_entries.append((f, str(f.relative_to(src_path)), forced_role))

    docs: list[dict] = []
    images: list[dict] = []
    img_by_sha: dict[str, dict] = {}
    tables: list[dict] = []
    skipped_master: list[dict] = []

    def register_image(
        img_path: Path,
        rel_label: str,
        role: str,
        from_slide: str | None = None,
        slide_title: str | None = None,
        min_dim: int = 0,
    ) -> dict | None:
        try:
            raw_bytes = img_path.read_bytes()
            sha = sha256_bytes(raw_bytes)
            with Image.open(img_path) as im:
                im = ImageOps.exif_transpose(im)
                w, h = im.size
        except Exception:
            return None
        if min_dim and (w < min_dim or h < min_dim):
            return None
        if sha in img_by_sha:
            existing = img_by_sha[sha]
            if role != "history" and existing.get("fromHistory"):
                existing["fromHistory"] = False
                existing["sourceRole"] = role
            existing.setdefault("alsoIn", []).append(rel_label)
            return existing
        ratio = round(w / max(1, h), 2)
        orientation = shape_tag(ratio)
        kind_hint = infer_kind_hint(rel_label, ratio)
        rec = {
            "id": f"IMG-{len(images) + 1:02d}",
            "path": str(img_path),
            "rel": rel_label,
            "width": w,
            "height": h,
            "ratio": ratio,
            "orientation": orientation,
            "kindHint": kind_hint,
            "recommendedFocal": "50% 25%" if ratio < 0.85 else "50% 50%",
            "sourceRole": role,
            "fromHistory": role == "history",
            "sha256": sha[:16],
            **({"fromSlide": from_slide} if from_slide else {}),
            **({"slideTitle": slide_title} if slide_title else {}),
        }
        img_by_sha[sha] = rec
        images.append(rec)
        return rec

    for i, note_txt in enumerate(inline_notes, 1):
        docs.append({
            "id": f"DOC-{len(docs) + 1:02d}",
            "rel": f"口述指令-{i}",
            "role": "oral",
            "content": note_txt.strip(),
        })
        sources_meta.append({"name": f"口述指令-{i}", "role": "oral", "inline": True})

    for f, rel, forced_role in file_entries:
        role = infer_role(rel, forced_role)
        ext = f.suffix.lower()
        if ext in IMG_EXTS:
            rec = register_image(f, rel, role, min_dim=0)
            if rec is None:
                docs.append({
                    "id": f"DOC-{len(docs) + 1:02d}",
                    "rel": rel,
                    "role": role,
                    "content": "(image read error)",
                })
        elif ext in DOC_EXTS:
            try:
                if ext in {".md", ".txt", ".json"}:
                    text = f.read_text(encoding="utf-8", errors="ignore").strip()
                    if len(text) > MAX_DOC_CHARS:
                        text = text[:MAX_DOC_CHARS] + f"\n... (truncated at {MAX_DOC_CHARS} chars)"
                    docs.append({"id": f"DOC-{len(docs) + 1:02d}", "rel": rel, "role": role, "content": text})
                elif ext == ".csv":
                    docs.append({"id": f"DOC-{len(docs) + 1:02d}", "rel": rel, "role": role, "content": read_csv_v2(f, rel, role, tables)})
                elif ext == ".pptx":
                    txt, skipped = read_pptx_v2(f, rel, role, out_dir, tables, register_image)
                    skipped_master.extend(skipped)
                    docs.append({"id": f"DOC-{len(docs) + 1:02d}", "rel": rel, "role": role, "content": txt})
                elif ext == ".docx":
                    docs.append({"id": f"DOC-{len(docs) + 1:02d}", "rel": rel, "role": role, "content": read_docx_v2(f, rel, role, out_dir, tables, register_image)})
                elif ext == ".xlsx":
                    docs.append({"id": f"DOC-{len(docs) + 1:02d}", "rel": rel, "role": role, "content": read_xlsx_v2(f, rel, role, tables)})
                elif ext == ".pdf":
                    docs.append({"id": f"DOC-{len(docs) + 1:02d}", "rel": rel, "role": role, "content": read_pdf_v2(f)})
                elif ext in {".html", ".htm"}:
                    docs.append({"id": f"DOC-{len(docs) + 1:02d}", "rel": rel, "role": role, "content": read_html_v2(f)})
            except Exception as e:
                docs.append({"id": f"DOC-{len(docs) + 1:02d}", "rel": rel, "role": role, "content": f"(parse error: {e})"})

    oral_directives = extract_oral_directives(docs)
    relation_signals = detect_relation_signals(docs, tables, oral_directives)
    contact_sheets = build_contact_sheets(images, out_dir) if images else []
    contact_sheet = contact_sheets[0]["path"] if contact_sheets else None
    sheet_paths = [s["path"] for s in contact_sheets]

    pack = {
        "version": 2,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sources": sources_meta,
        "oralDirectives": oral_directives,
        "relationSignals": relation_signals,
        "contactSheet": contact_sheet,
        "contactSheets": sheet_paths,
        "images": images,
        "tables": tables,
        "docs": [{"id": d["id"], "rel": d["rel"], "role": d["role"], "charCount": len(d["content"])} for d in docs],
        "skippedMasterImages": skipped_master,
    }
    pack_file = out_dir / "material-pack.json"
    pack_file.write_text(json.dumps(pack, ensure_ascii=False, indent=2), encoding="utf-8")

    # Build structured material-brief.md
    src_title = ", ".join(s.get("name", "") for s in sources_meta[:3]) or "多源素材"
    brief_lines = [f"# Material Brief: {src_title}", ""]

    if oral_directives:
        brief_lines.append("## 🎯 口述要求与上屏禁令（最高优先级，务必遵守）")
        for od in oral_directives:
            brief_lines.append(f"- **[{od['source']}]** {od['text']}")
        brief_lines.append("")

    if relation_signals:
        brief_lines.append("## 🧩 自动识别的信息关系信号（写 outline.json 时优先映射到对应语义组件，不锁死几何版式）")
        for sig in relation_signals:
            brief_lines.append(f"- **`{sig['component']}`**: {sig['reason']}（{sig['evidence']}）")
        brief_lines.append("")

    if tables:
        brief_lines.append(f"## 📊 结构化表格资产 ({len(tables)} 张 — outline.json 可直接写 `\"table\": \"TBL-01\"`)")
        for t in tables:
            slide_info = f" · {t['fromSlide']}" if t.get("fromSlide") else ""
            brief_lines.append(f"- **{t['id']}** (`{t['title']}`, {t['dataRowsCount']}行, 来源 `{t['source']}`[{t['sourceRole']}]{slide_info})")
            if t.get("breakdownHint"):
                bh = t["breakdownHint"]
                items_str = ", ".join(f"{it['label']}: {it['value']} ({it['pct']}%)" for it in bh["items"])
                brief_lines.append(f"  - 💡 预计算占比（合计 {bh['total']}）: {items_str}")
        brief_lines.append("")

    if images:
        if len(contact_sheets) <= 1:
            brief_lines.append(f"## 🖼️ 图片资产 ({len(images)} 张 — 只看 1 次拼图: `{contact_sheet}`；outline.json 可直接写 `\"photos\": [\"IMG-01\"]`)")
        else:
            brief_lines.append(f"## 🖼️ 图片资产 ({len(images)} 张 — 自动分 {len(contact_sheets)} 卷拼图；outline.json 可直接写 `\"photos\": [\"IMG-01\"]`)")
            for cs in contact_sheets:
                brief_lines.append(f"- **第 {cs['index']} 卷** (`{cs['firstId']} ~ {cs['lastId']}`，{cs['count']} 张): `{cs['path']}`")
        for img in images:
            hist_tag = " **[历史参考旧图，勿直接当本期现场照]**" if img.get("fromHistory") else ""
            slide_tag = f" · 原{img['fromSlide']}" if img.get("fromSlide") else ""
            brief_lines.append(
                f"- **{img['id']}** (`{img['width']}×{img['height']}`, {img['ratio']}:1 {img['orientation']}, `{img['kindHint']}`{slide_tag}): `{img['path']}`{hist_tag}"
            )
        if skipped_master:
            brief_lines.append(f"- *(已自动过滤 {len(skipped_master)} 处母版重复 Logo / 过小图标)*")
        brief_lines.append("")

    role_order = {"oral": 0, "draft": 1, "material": 2, "history": 3}
    role_badge = {"oral": "口述指令", "draft": "粗版草稿", "material": "本期素材", "history": "历史参考"}
    for d in sorted(docs, key=lambda x: role_order.get(x["role"], 2)):
        badge = role_badge.get(d["role"], d["role"])
        brief_lines.append(f"## [{badge}] {d['id']} `{d['rel']}`")
        brief_lines.append(d["content"])
        brief_lines.append("")

    brief_file = out_dir / "material-brief.md"
    brief_file.write_text("\n".join(brief_lines), encoding="utf-8")

    first_src = str(inputs[0][0]) if inputs else str(out_dir)
    print(json.dumps({
        "ok": True,
        "source": first_src,
        "briefFile": str(brief_file),
        "packFile": str(pack_file),
        "contactSheet": contact_sheet,
        "contactSheets": sheet_paths,
        "docCount": len(docs),
        "tableCount": len(tables),
        "imageCount": len(images),
        "skippedMasterImages": len(skipped_master),
        "oralDirectivesCount": len(oral_directives),
        "relationSignals": [s["component"] for s in relation_signals],
        "images": images,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
