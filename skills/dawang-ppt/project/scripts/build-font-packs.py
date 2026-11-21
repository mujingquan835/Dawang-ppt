#!/usr/bin/env python3
"""
Build lightweight WOFF2 font packs for Dawang-PPT:
  1. Source Han Sans SC (400 Regular, 500 Medium, 700 Bold, 900 Heavy)
     Subset to GB2312 Level-1 (3,755 common Simplified Chinese chars) + ASCII + CJK punctuation + symbols.
  2. YouSheBiaoTiHei (Display / Artistic Title Font)
     Subset to the same character set (or full glyphs compressed to WOFF2).

Both Source Han Sans (SIL OFL 1.1) and YouSheBiaoTiHei (free for commercial use)
permit subsetting and WOFF2 compression.
"""
import argparse
import os
import sys
from pathlib import Path
from fontTools.subset import Subsetter, Options
from fontTools.ttLib import TTFont

DEFAULT_SOURCE_HAN_TTC = "/Users/meimaodawang/Library/Fonts/SourceHanSans.ttc"
DEFAULT_YOUSHE_TTF = "/Users/meimaodawang/Library/Fonts/优设标题黑.ttf"

# Subfont indices verified in SourceHanSans.ttc:
#    7: SourceHanSansSC-Light   (300) — crisp, airy body / captions / labels / units
#   17: SourceHanSansSC-Regular (400) — balanced table keys / subtitles
#   32: SourceHanSansSC-Bold    (700) — section & item headings / emphasis
#   42: SourceHanSansSC-Heavy   (900) — page headline focus & hero KPI figures
SOURCE_HAN_WEIGHTS = [
    (300, "source-han-sans-sc-300.woff2", 7),
    (400, "source-han-sans-sc-400.woff2", 17),
    (700, "source-han-sans-sc-700.woff2", 32),
    (900, "source-han-sans-sc-900.woff2", 42),
]


def build_base_charset(extra_text: str = "") -> str:
    chars = set()
    # Printable ASCII
    for cp in range(0x20, 0x7F):
        chars.add(chr(cp))
    # Common Latin-1 / typography / math / arrows / currency / bullets / CJK punctuation
    extra_ranges = [
        (0x00A0, 0x00FF),  # Latin-1 Supplement (±, ×, ÷, ·, ¥, etc.)
        (0x2010, 0x203B),  # Dashes, quotes, ellipsis, bullets, permille
        (0x2190, 0x2199),  # Arrows ← ↑ → ↓ ↔
        (0x2200, 0x2265),  # Math operators (≈, ≠, ≤, ≥, ∞)
        (0x2460, 0x2473),  # Circled numbers ①-⑳
        (0x25A0, 0x25CF),  # Basic geometric markers (■, ▲, ●)
        (0x3000, 0x303F),  # CJK Symbols and Punctuation (、。〈〉《》「」【】)
        (0xFF01, 0xFF5E),  # Fullwidth ASCII & punctuation (，。：；？！（）)
    ]
    for start, end in extra_ranges:
        for cp in range(start, end + 1):
            chars.add(chr(cp))

    # GB2312 Level-1 Simplified Chinese characters (3,755 chars, covers ~99.9% of business prose)
    for b1 in range(0xB0, 0xD8):
        for b2 in range(0xA1, 0xFF):
            if b1 == 0xD7 and b2 >= 0xFA:
                continue
            try:
                ch = bytes([b1, b2]).decode("gb2312")
                chars.add(ch)
            except UnicodeDecodeError:
                pass

    # Extra high-frequency modern business / tech / real-estate / report chars
    modern_extra = (
        "喆睿鑫昊晟祺珺妍婷玥馨梓轩宇泽铭浩博瀚辰翊"
        "昇曜璟瑄璇怡恬悦恺宸晏昕昱晗晨曦晖曜"
        "圳甬蓉渝杭穗沪京津冀晋辽吉黑苏浙皖闽赣鲁豫鄂湘粤桂琼川贵云藏陕甘青宁新港澳台"
        "啰喽咯嗯哦唉咦哟嗨哇呀呐吧嘛啦呢吗"
        "赋能闭环链路抓手打法透传沉淀对齐拉通复用迭代灰度兜底复盘述职"
        "销冠带看房源客源经纪门店商圈端口线索转化成交履约核销客单留资私域公域"
        "￥€£°℃㎡‰万亿亿元套户单场次率占比同比环比增幅降幅均值中位"
    )
    chars.update(modern_extra)
    chars.update(extra_text)
    return "".join(sorted(chars))


def subset_to_woff2(src_path: str, out_path: Path, text: str, font_number: int = -1):
    options = Options()
    options.flavor = "woff2"
    options.layout_features = ["kern", "liga", "ccmp", "locl", "palt", "tnum", "lnum"]
    options.name_IDs = [1, 2, 4, 6]
    options.drop_tables += ["DSIG"]
    options.desubroutinize = False

    if font_number >= 0:
        font = TTFont(src_path, fontNumber=font_number)
    else:
        font = TTFont(src_path)

    subsetter = Subsetter(options=options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    font.save(str(out_path))
    font.close()
    return out_path.stat().st_size


def main():
    parser = argparse.ArgumentParser(description="Build WOFF2 font packs for Dawang-PPT")
    parser.add_argument(
        "--out-dir",
        default=str(Path(__file__).resolve().parent.parent / "assets" / "fonts"),
        help="Output directory for WOFF2 font files",
    )
    parser.add_argument("--source-han", default=DEFAULT_SOURCE_HAN_TTC)
    parser.add_argument("--youshe", default=DEFAULT_YOUSHE_TTF)
    parser.add_argument("--extra-text", default="", help="Additional characters to guarantee inclusion")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    charset = build_base_charset(args.extra_text)
    print(f"Base charset size: {len(charset)} chars")

    total = 0
    if os.path.exists(args.source_han):
        for weight, filename, idx in SOURCE_HAN_WEIGHTS:
            out_file = out_dir / filename
            sz = subset_to_woff2(args.source_han, out_file, charset, font_number=idx)
            total += sz
            print(f"  Source Han Sans SC {weight}: {out_file.name} -> {sz / 1024:.1f} KB")
    else:
        print(f"WARNING: SourceHanSans not found at {args.source_han}", file=sys.stderr)

    if os.path.exists(args.youshe):
        out_file = out_dir / "youshe-biaotihei.woff2"
        sz = subset_to_woff2(args.youshe, out_file, charset)
        total += sz
        print(f"  YouSheBiaoTiHei: {out_file.name} -> {sz / 1024:.1f} KB")
    else:
        print(f"WARNING: YouSheBiaoTiHei not found at {args.youshe}", file=sys.stderr)

    print(f"Total WOFF2 pack size: {total / (1024 * 1024):.2f} MB")


if __name__ == "__main__":
    main()
