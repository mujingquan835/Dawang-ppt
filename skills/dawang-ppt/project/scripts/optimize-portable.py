#!/usr/bin/env python3
"""
Fast parallel portable asset optimizer for Dawang-PPT:
  - Dynamically subsets WOFF2 fonts to (all deck characters + top ~650 common Chinese work-report chars + ASCII/punctuation)
  - Compresses oversized opaque images to high-quality JPEG (q=86, max 2200px, 100% PPTX compatible) while preserving alpha PNGs
  - Runs all font subsets & image optimizations in parallel threads (~0.5s total), shrinking portable HTML from ~15MB to ~3MB.
"""
import base64
import io
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

BASE_ASCII = "".join(chr(c) for c in range(0x20, 0x7F))
CJK_PUNCT = "，。、；：？！“”‘’（）【】《》—…·－＋×÷％℃￥→←↑↓•●◆■▪①②③④⑤⑥⑦⑧⑨⑩"
COMMON_ZH = (
    "的一是在不了有和人这中大为上个国我以要他时来用们生到作地于出就分对成会可主发年动同工也能下过子说产种面而方后多定行学法所民得经十三之进着等部度家电力里如水化高自二理起小物现实加量都两体制机当使点从业本去把性好应开它合还因由其些然前外天政四日那社义事平形相全表间样与关各重新线内数正心反你明看原又么利比或但质气第向道命此变条只没结解问意建月公无系军很情者最立代想已通并提直题党程展五果料象员革位入常文总次品式活设及管特件长求老头基资边流路级少图山统接知较将组见计别她手角期根论运农指几九区强放决西被干做必战先回则任取据处队南给色光门即保治北造百规热领七海口东导器压志世金增争济阶油思术极交受联什认六共权收证改清己美再采转更单风切打白教速花带安场身车例真务具万每目至达走积示议声报斗完类八离华名确才科张信马节话米整空元况今集温传土许步群广石记需段研界拉林律叫且究观越织装影算低持音众书布复容儿须际商非验连断深难近矿千周委素技备半办青省列习响约支般史感劳便团往酸历市克何除消构府称太准精值号率族维划选标写存候毛亲快效斯院查江型眼王按格养易置派层片始却专状育厂京识适属圆包火住调满县局照参红细引听该铁价严"
    "项推优提增降稳效验馈析划策落执闭环复盘汇报总结季度月度目标实际完成同比环比增长下降提升优化升级改造落地交付进展风险问题原因措施计划里程碑阶段核心关键重点指标数据趋势结构占比分布客户用户产品业务团队运营营销活动渠道转化留存活跃成交收入利润成本预算投入产出效率质量体验流程指引反馈功能版本架构引擎案例示例虚构展示说明结论判断方向"
)


def subset_one_font(spec: dict) -> dict:
    from fontTools.subset import Options, Subsetter
    from fontTools.ttLib import TTFont

    file_path = spec["file"]
    is_display = "youshe" in spec.get("family", "").lower()
    chars = set(BASE_ASCII + CJK_PUNCT + spec.get("text", ""))
    if not is_display:
        chars.update(COMMON_ZH)

    font = TTFont(file_path)
    opts = Options()
    opts.flavor = spec.get("format", "woff2")
    opts.layout_features = ["kern", "liga"]
    opts.desubroutinize = False
    sub = Subsetter(opts)
    sub.populate(text="".join(chars))
    sub.subset(font)
    buf = io.BytesIO()
    font.save(buf)
    return {
        "family": spec["family"],
        "weight": spec["weight"],
        "style": spec.get("style", "normal"),
        "format": spec.get("format", "woff2"),
        "data": base64.b64encode(buf.getvalue()).decode("ascii"),
    }


def optimize_one_image(spec: dict) -> dict:
    from PIL import Image, ImageOps

    key = spec["key"]
    max_dim = int(spec.get("maxDim", 2200))
    quality = int(spec.get("quality", 86))

    if spec.get("path"):
        raw = Path(spec["path"]).read_bytes()
    else:
        b64 = spec["dataUrl"].split(",", 1)[1]
        raw = base64.b64decode(b64)

    # Keep small images (< 90 KB) or SVGs/GIFs untouched
    if len(raw) < 90_000:
        mime = spec.get("mime", "image/jpeg")
        return {"key": key, "dataUrl": f"data:{mime};base64,{base64.b64encode(raw).decode('ascii')}"}

    im = Image.open(io.BytesIO(raw))
    if im.format in ("GIF",):
        return {"key": key, "dataUrl": f"data:image/gif;base64,{base64.b64encode(raw).decode('ascii')}"}

    im = ImageOps.exif_transpose(im)
    has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    if has_alpha:
        extrema = im.convert("RGBA").getchannel("A").getextrema()
        has_alpha = extrema[0] < 250

    w, h = im.size
    if max(w, h) > max_dim:
        scale = max_dim / max(w, h)
        im = im.resize((max(1, int(round(w * scale))), max(1, int(round(h * scale)))), Image.LANCZOS)

    out = io.BytesIO()
    if has_alpha:
        im.save(out, format="PNG", optimize=True)
        mime = "image/png"
    else:
        im.convert("RGB").save(out, format="JPEG", quality=quality, optimize=True)
        mime = "image/jpeg"

    optimized = out.getvalue()
    # Only replace if actually smaller (or resized)
    if len(optimized) < len(raw) or max(w, h) > max_dim:
        return {"key": key, "dataUrl": f"data:{mime};base64,{base64.b64encode(optimized).decode('ascii')}"}
    orig_mime = spec.get("mime", "image/png")
    return {"key": key, "dataUrl": f"data:{orig_mime};base64,{base64.b64encode(raw).decode('ascii')}"}


def main():
    payload = json.loads(sys.stdin.read())
    fonts_in = payload.get("fonts", [])
    images_in = payload.get("images", [])

    fonts_out = []
    images_out = {}

    with ThreadPoolExecutor(max_workers=6) as ex:
        font_futs = [ex.submit(subset_one_font, f) for f in fonts_in]
        img_futs = [ex.submit(optimize_one_image, im) for im in images_in]
        for fut in font_futs:
            fonts_out.append(fut.result())
        for fut in img_futs:
            res = fut.result()
            images_out[res["key"]] = res["dataUrl"]

    sys.stdout.write(json.dumps({"ok": True, "fonts": fonts_out, "images": images_out}))


if __name__ == "__main__":
    main()
