import { materializeElements } from "../scene/model.mjs";
import { draftedShownBy } from "../authoring/drafted.mjs";
import { REPORT_PALETTES } from "./palette-switch.mjs";

const inspectorSections = new Map();
const FOCUSABLE = "input,select,button,summary";
let pendingFocus = null;
const focusables = (root) => [...root.querySelectorAll(FOCUSABLE)].filter((el) => !el.disabled && el.offsetParent !== null);

const ICONS = {
  dup: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="5.2" y="5.2" width="8.3" height="8.3" rx="1.6"/><path d="M10.8 5.2V3.6A1.6 1.6 0 0 0 9.2 2H3.6A1.6 1.6 0 0 0 2 3.6v5.6a1.6 1.6 0 0 0 1.6 1.6h1.6"/></svg>',
  front: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5v9M4.5 6 8 2.5 11.5 6"/><path d="M3 13.5h10"/></svg>',
  back: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13.5v-9M4.5 10 8 13.5 11.5 10"/><path d="M3 2.5h10"/></svg>',
  del: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.8 4.2h10.4M6 4.2V2.8h4v1.4M4.3 4.2l.6 8.8a1 1 0 0 0 1 .9h4.2a1 1 0 0 0 1-.9l.6-8.8"/></svg>',
  alL: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 2.5v11"/><rect x="5" y="4" width="8" height="3" rx=".8" fill="currentColor" stroke="none"/><rect x="5" y="9" width="5.5" height="3" rx=".8" fill="currentColor" stroke="none"/></svg>',
  alC: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 2.2v11.6"/><rect x="3.5" y="4" width="9" height="3" rx=".8" fill="currentColor" stroke="none"/><rect x="5" y="9" width="6" height="3" rx=".8" fill="currentColor" stroke="none"/></svg>',
  alR: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M13.5 2.5v11"/><rect x="3" y="4" width="8" height="3" rx=".8" fill="currentColor" stroke="none"/><rect x="5.5" y="9" width="5.5" height="3" rx=".8" fill="currentColor" stroke="none"/></svg>',
  alT: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 2.5h11"/><rect x="4" y="5" width="3" height="8" rx=".8" fill="currentColor" stroke="none"/><rect x="9" y="5" width="3" height="5.5" rx=".8" fill="currentColor" stroke="none"/></svg>',
  alM: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.2 8h11.6"/><rect x="4" y="3.5" width="3" height="9" rx=".8" fill="currentColor" stroke="none"/><rect x="9" y="5" width="3" height="6" rx=".8" fill="currentColor" stroke="none"/></svg>',
  alB: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 13.5h11"/><rect x="4" y="3" width="3" height="8" rx=".8" fill="currentColor" stroke="none"/><rect x="9" y="5.5" width="3" height="5.5" rx=".8" fill="currentColor" stroke="none"/></svg>',
  txtL: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2.5 4h11M2.5 8h7.5M2.5 12h9.5"/></svg>',
  txtC: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2.5 4h11M4.2 8h7.6M3.2 12h9.6"/></svg>',
  txtR: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2.5 4h11M6 8h7.5M4 12h9.5"/></svg>',
};

const TYPE_LABELS = { text: "文本", shape: "形状", image: "图片", line: "线条", vector: "矢量" };

function themeSwatches(project) {
  const pal = project?.designChoice?.appearance?.palette || {};
  const raw = [
    pal.primary || pal.accent || "#23338B",
    pal.secondary || "#E2B898",
    pal.pop || "#FA6500",
    pal.ink || "#14213D",
    pal.muted || "#64748B",
    pal.pale || "#F3F6FC",
    "#FFFFFF",
    "#0F172A",
  ];
  const seen = new Set();
  return raw.filter((c) => {
    const k = String(c || "").trim().toLowerCase();
    if (!/^#[0-9a-f]{6}$/i.test(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function makeColorPicker(label, value, swatches, onChange, { allowTransparent = false } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "deck-prop-row";
  if (label) {
    const cap = document.createElement("span");
    cap.textContent = label;
    wrap.append(cap);
  }
  const row = document.createElement("div");
  row.className = "fi-swatches";
  const rawCur = String(value || "").trim().toLowerCase();
  const cur = /^#[0-9a-f]{3}$/.test(rawCur)
    ? "#" + rawCur[1] + rawCur[1] + rawCur[2] + rawCur[2] + rawCur[3] + rawCur[3]
    : rawCur;
  if (allowTransparent) {
    const noneBtn = document.createElement("button");
    noneBtn.type = "button";
    noneBtn.className = "fi-swatch fi-swatch-none" + (!cur || cur === "none" || cur === "transparent" ? " is-active" : "");
    noneBtn.title = "无填充 / 透明";
    noneBtn.onclick = () => onChange("transparent");
    row.append(noneBtn);
  }
  for (const hex of swatches) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fi-swatch" + (cur === hex.toLowerCase() ? " is-active" : "");
    btn.style.background = hex;
    btn.title = hex.toUpperCase();
    btn.onclick = () => onChange(hex);
    row.append(btn);
  }
  const custom = document.createElement("label");
  custom.className = "fi-color-wrap";
  custom.title = "自定义颜色";
  const input = document.createElement("input");
  input.type = "color";
  if (label) input.setAttribute("aria-label", label);
  input.value = /^#[0-9a-f]{6}$/i.test(cur) ? cur : "#23338b";
  input.oninput = () => {
    hexText.textContent = input.value.toUpperCase();
  };
  input.onchange = () => onChange(input.value);
  const hexText = document.createElement("span");
  hexText.textContent = /^#[0-9a-f]{6}$/i.test(cur) ? cur.toUpperCase() : "透明";
  custom.append(input, hexText);
  row.append(custom);
  wrap.append(row);
  return wrap;
}

export function mountDeckPanel(container, api) {
  if (!container) return;
  container.replaceChildren();
  const project = api.getProject();
  const slideId = api.activeSlideId?.();
  const slides = project.slides || [];
  const slideIdx = Math.max(0, slides.findIndex((s) => s.slideId === slideId));
  const slide = slides[slideIdx];
  const swatches = themeSwatches(project);

  // Card 1: Current Slide quick controls
  const pageSec = document.createElement("div");
  pageSec.className = "deck-panel-section";
  const pageTitle = document.createElement("div");
  pageTitle.className = "deck-panel-sec-title";
  pageTitle.innerHTML = `<span>当前页面</span><span>第 ${slideIdx + 1} / ${slides.length} 页 · 16:9</span>`;
  pageSec.append(pageTitle);

  const bgEl = slide?.elements?.find((x) => x.type === "shape" && Array.isArray(x.bounds) && x.bounds[0] <= 2 && x.bounds[1] <= 2 && x.bounds[2] >= 1916 && x.bounds[3] >= 1076);
  const currentBg = bgEl?.style?.fill || project.designChoice?.appearance?.palette?.bg || "#FFFFFF";
  pageSec.append(
    makeColorPicker("页面背景色", currentBg, swatches, (fill) => {
      if (slide) api.apply({ slideId: slide.slideId, type: "slide-bg", fill });
    })
  );

  const pageBtns = document.createElement("div");
  pageBtns.className = "fi-grid-2";
  const mkBtn = (label, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "deck-prop-choice";
    b.textContent = label;
    b.onclick = fn;
    return b;
  };
  pageBtns.append(
    mkBtn("+ 新建空白页", () => api.addSlide?.()),
    mkBtn("复制当前页", () => slide && api.duplicateSlide?.(slide.slideId))
  );
  pageSec.append(pageBtns);
  container.append(pageSec);

  const curPal = project.designChoice?.appearance?.palette || {};
  const priCol = curPal.primary || curPal.accent || "#23338B";
  const popCol = curPal.pop || "#FA6500";
  const secCol = curPal.secondary || "#E2B898";

  // Card 1.5: One-Click Per-Slide Layout Switcher (when slide carries layoutVariants)
  const variants = Array.isArray(slide?.layoutVariants) ? slide.layoutVariants : [];
  if (variants.length > 1) {
    const laySec = document.createElement("div");
    laySec.className = "deck-panel-section";
    const layTitle = document.createElement("div");
    layTitle.className = "deck-panel-sec-title";
    layTitle.innerHTML = `<span>当前页版式</span><span>一键切换 (${variants.length})</span>`;
    laySec.append(layTitle);

    const thumbSvg = (kind) => {
      if (kind === "bento") {
        return `<svg viewBox="0 0 80 45" fill="none"><rect x="4" y="4" width="26" height="37" rx="3" fill="${priCol}"/><rect x="33" y="4" width="43" height="16" rx="3" fill="${secCol}" opacity=".45"/><rect x="33" y="23" width="20" height="18" rx="3" fill="#CBD5E1"/><rect x="56" y="23" width="20" height="18" rx="3" fill="${popCol}" opacity=".35"/></svg>`;
      }
      if (kind === "split") {
        return `<svg viewBox="0 0 80 45" fill="none"><rect x="0" y="0" width="26" height="45" fill="#1E293B"/><rect x="0" y="0" width="3" height="45" fill="${popCol}"/><rect x="5" y="10" width="16" height="4" rx="1.5" fill="#fff"/><rect x="31" y="6" width="43" height="13" rx="3" fill="${priCol}" opacity=".22"/><rect x="31" y="23" width="43" height="7" rx="2" fill="#CBD5E1"/><rect x="31" y="33" width="43" height="7" rx="2" fill="#CBD5E1"/></svg>`;
      }
      if (kind === "modern") {
        return `<svg viewBox="0 0 80 45" fill="none"><rect x="5" y="4" width="22" height="4" rx="2" fill="${popCol}"/><rect x="5" y="11" width="22" height="12" rx="2.5" fill="#fff" stroke="${priCol}" stroke-width="1"/><rect x="29" y="11" width="22" height="12" rx="2.5" fill="#fff" stroke="${secCol}" stroke-width="1"/><rect x="53" y="11" width="22" height="12" rx="2.5" fill="#fff" stroke="#CBD5E1" stroke-width="1"/><rect x="5" y="26" width="22" height="14" rx="2.5" fill="#E2E8F0"/><rect x="29" y="26" width="22" height="14" rx="2.5" fill="#E2E8F0"/><rect x="53" y="26" width="22" height="14" rx="2.5" fill="${priCol}"/></svg>`;
      }
      if (kind === "bars") {
        return `<svg viewBox="0 0 80 45" fill="none"><rect x="5" y="5" width="28" height="4" rx="1.5" fill="${priCol}"/><rect x="5" y="13" width="64" height="5" rx="2.5" fill="${priCol}"/><rect x="5" y="21" width="48" height="5" rx="2.5" fill="${secCol}"/><rect x="5" y="29" width="34" height="5" rx="2.5" fill="${popCol}"/><rect x="5" y="37" width="22" height="5" rx="2.5" fill="#94A3B8"/></svg>`;
      }
      if (kind === "cards") {
        return `<svg viewBox="0 0 80 45" fill="none"><rect x="4" y="8" width="16" height="29" rx="2.5" fill="#fff" stroke="${priCol}" stroke-width="1"/><rect x="23" y="8" width="16" height="29" rx="2.5" fill="#fff" stroke="${secCol}" stroke-width="1"/><rect x="42" y="8" width="16" height="29" rx="2.5" fill="#fff" stroke="${priCol}" stroke-width="1"/><rect x="61" y="8" width="15" height="29" rx="2.5" fill="${priCol}"/><rect x="61" y="8" width="15" height="4" rx="1.5" fill="${popCol}"/></svg>`;
      }
      if (kind === "layered") {
        return `<svg viewBox="0 0 80 45" fill="none"><rect x="5" y="4" width="21" height="10" rx="2" fill="#CBD5E1"/><rect x="29.5" y="4" width="21" height="10" rx="2" fill="#CBD5E1"/><rect x="54" y="4" width="21" height="10" rx="2" fill="#CBD5E1"/><rect x="5" y="18" width="70" height="9" rx="3" fill="${priCol}"/><rect x="5" y="31" width="21" height="10" rx="2" fill="${secCol}" opacity=".65"/><rect x="29.5" y="31" width="21" height="10" rx="2" fill="${secCol}" opacity=".65"/><rect x="54" y="31" width="21" height="10" rx="2" fill="${popCol}" opacity=".55"/></svg>`;
      }
      if (kind === "vertical") {
        return `<svg viewBox="0 0 80 45" fill="none"><rect x="22" y="6" width="2" height="33" rx="1" fill="#CBD5E1"/><circle cx="23" cy="10" r="3" fill="${priCol}"/><circle cx="23" cy="22.5" r="3" fill="${popCol}"/><circle cx="23" cy="35" r="3" fill="#94A3B8"/><rect x="5" y="8" width="13" height="4" rx="2" fill="${priCol}" opacity=".3"/><rect x="5" y="20.5" width="13" height="4" rx="2" fill="${popCol}" opacity=".5"/><rect x="5" y="33" width="13" height="4" rx="2" fill="#CBD5E1"/><rect x="29" y="6" width="46" height="8" rx="2" fill="#E2E8F0"/><rect x="29" y="18.5" width="46" height="8" rx="2" fill="#fff" stroke="${popCol}" stroke-width="1"/><rect x="29" y="31" width="46" height="8" rx="2" fill="#E2E8F0"/></svg>`;
      }
      if (kind === "exec") {
        return `<svg viewBox="0 0 80 45" fill="none"><rect x="5" y="4" width="70" height="5" rx="2" fill="#E2E8F0"/><rect x="7" y="5" width="16" height="3" rx="1.5" fill="${priCol}"/><rect x="5" y="13" width="33" height="10" rx="2.5" fill="${priCol}" opacity=".2"/><rect x="42" y="13" width="33" height="10" rx="2.5" fill="${popCol}" opacity=".25"/><rect x="5" y="26" width="70" height="14" rx="2.5" fill="#fff" stroke="${priCol}" stroke-width="1"/></svg>`;
      }
      return `<svg viewBox="0 0 80 45" fill="none"><rect x="5" y="5" width="34" height="4" rx="1.5" fill="${priCol}"/><rect x="5" y="13" width="70" height="10" rx="2" fill="${priCol}" opacity=".18"/><rect x="5" y="26" width="33" height="14" rx="2" fill="#CBD5E1"/><rect x="42" y="26" width="33" height="14" rx="2" fill="#CBD5E1"/></svg>`;
    };

    const activeLayoutId = slide.activeLayoutId || variants[0]?.id;
    const layGrid = document.createElement("div");
    layGrid.className = "fi-layout-grid";
    for (const v of variants) {
      const isAct = v.id === activeLayoutId;
      const card = document.createElement("button");
      card.type = "button";
      card.className = "fi-layout-card" + (isAct ? " is-active" : "");
      card.dataset.layoutId = v.id;
      card.title = `一键切换为「${v.name}」版式`;
      card.innerHTML = `<span class="fi-layout-thumb">${thumbSvg(v.preview)}</span><span class="fi-layout-meta"><span class="fi-layout-name">${v.name}</span><span class="fi-layout-tag">${isAct ? "当前" : (v.tag || "切换")}</span></span>`;
      card.onclick = () => api.switchLayout?.(v.id);
      layGrid.append(card);
    }
    laySec.append(layGrid);
    container.append(laySec);
  }

  // Card 2: One-Click Whole-Deck Palette Switcher (all 9+2 official 3-tone palettes)
  const palSec = document.createElement("div");
  palSec.className = "deck-panel-section";
  const palTitle = document.createElement("div");
  palTitle.className = "deck-panel-sec-title";
  palTitle.innerHTML = "<span>全稿主题配色</span><span>一键换肤</span>";
  palSec.append(palTitle);

  const curPalId = project.designChoice?.appearance?.paletteId;
  const curPri = String(curPal.primary || curPal.accent || "").toLowerCase();
  const palGrid = document.createElement("div");
  palGrid.className = "fi-palette-grid";
  for (const entry of REPORT_PALETTES) {
    const p = entry.palette;
    const isActive = curPalId ? curPalId === entry.id : curPri === String(p.primary).toLowerCase() && Boolean(curPal.dark) === Boolean(p.dark);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fi-pal-card" + (p.dark ? " is-dark" : "") + (isActive ? " is-active" : "");
    btn.dataset.paletteId = entry.id;
    btn.title = `${entry.name}：${entry.fit}`;
    btn.innerHTML = `<span class="fi-pal-dots"><i style="background:${p.primary}"></i><i style="background:${p.secondary}"></i><i style="background:${p.pop}"></i></span><span class="fi-pal-name">${entry.name}</span>`;
    btn.onclick = () => api.switchPalette?.(entry.id);
    palGrid.append(btn);
  }
  palSec.append(palGrid);
  container.append(palSec);

  // Card 3: Shortcuts Cheat-Sheet
  const scSec = document.createElement("div");
  scSec.className = "deck-panel-section";
  const scTitle = document.createElement("div");
  scTitle.className = "deck-panel-sec-title";
  scTitle.innerHTML = "<span>快捷操作</span><span>画布</span>";
  scSec.append(scTitle);
  const scList = document.createElement("div");
  scList.className = "fi-shortcuts";
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const mod = isMac ? "⌘" : "Ctrl+";
  const items = [
    ["拉框 / ⇧点击", "多选元素"],
    ["双击文本", "直接改字"],
    ["方向键 / ⇧方向", "1px / 10px 微调"],
    ["⇧ + 拖拽", "水平/垂直锁定"],
    [`${mod}D`, "快速复制元素"],
    [`${mod}C / ${mod}V`, "跨页复制粘贴"],
    ["Delete", "删除选中对象"],
    [`${mod}Z / ⇧${mod}Z`, "撤销 / 重做"],
    [`${mod}S / ${mod}0`, "保存 / 适应窗口"],
  ];
  for (const [k, desc] of items) {
    const row = document.createElement("div");
    row.className = "fi-sc-row";
    row.innerHTML = `<span>${desc}</span><kbd>${k}</kbd>`;
    scList.append(row);
  }
  scSec.append(scList);
  container.append(scSec);
}

function mountInspector(panel, selection, api) {
  const previous = panel.querySelector("#fusion-inspector");
  const sameTarget = previous?.dataset.selection === selection.slideId + "/" + selection.elementId;
  const scrollHost = panel.closest("#deck-panel");
  const prevScrollTop = sameTarget && scrollHost ? scrollHost.scrollTop : 0;
  const active = previous?.contains(document.activeElement) ? focusables(previous).indexOf(document.activeElement) : -1;
  const shouldScrollToFocus = pendingFocus !== null;
  const restoreFocus = sameTarget ? (pendingFocus ?? (active >= 0 ? active : null)) : null;
  pendingFocus = null;
  const expanded = new Map([...panel.querySelectorAll("#fusion-inspector details")].map((el) => [el.id, el.open]));
  for (const [id, open] of expanded) inspectorSections.set(id, open);
  panel.querySelector("#fusion-inspector")?.remove();

  const box = document.createElement("div");
  box.id = "fusion-inspector";
  box.dataset.selection = selection.slideId + "/" + selection.elementId;
  const restoreScroll = () => {
    if (sameTarget && scrollHost) scrollHost.scrollTop = prevScrollTop;
  };
  queueMicrotask(() => {
    if (!box.isConnected) return;
    if (restoreFocus !== null) {
      focusables(box)[restoreFocus]?.focus(shouldScrollToFocus ? undefined : { preventScroll: true });
    }
    if (!shouldScrollToFocus) restoreScroll();
  });
  box.style.cssText = "display:grid;gap:12px;font:500 12.5px/1.4 var(--ui-font);color:var(--ui-fg)";
  panel.append(box);

  if (!document.getElementById("fusion-inspector-css")) {
    const css = document.createElement("style");
    css.id = "fusion-inspector-css";
    css.textContent = [
      "#fusion-inspector summary{cursor:pointer;font-size:11.5px;font-weight:650;color:var(--ui-muted);user-select:none}",
      "#fusion-inspector details{background:var(--ui-surface-2);border:1px solid var(--ui-border);border-radius:10px;padding:10px 12px}",
      "#fusion-inspector .fusion-action{width:100%;justify-content:center;min-height:32px;padding:6px 10px;font:550 12px/1.3 var(--ui-font);border:1px solid var(--ui-border);border-radius:7px;background:var(--ui-surface);color:var(--ui-fg);cursor:pointer;transition:all .12s}",
      "#fusion-inspector .fusion-action:hover{background:var(--ui-accent-soft);border-color:var(--ui-accent);color:var(--ui-accent)}",
      "#fusion-inspector .fusion-input,#fusion-inspector select{height:30px;border:1px solid var(--ui-border);border-radius:7px;background:var(--ui-surface);color:var(--ui-fg);padding:0 8px;font:500 12px/1.3 var(--ui-font);width:100%;min-width:0}",
      "#fusion-inspector .fusion-input:focus,#fusion-inspector select:focus{outline:none;border-color:var(--ui-accent);box-shadow:0 0 0 2px var(--ui-accent-soft)}",
    ].join("");
    document.head.append(css);
  }

  const project = api.getProject();
  const slide = project.slides.find((s) => s.slideId === selection.slideId);
  if (!slide) return;
  const elements = materializeElements(slide, project);
  const e = elements.find((e2) => e2.id === selection.elementId);
  const o = slide.objects?.find((o2) => o2.objectId === e?.parentId);
  if (!e) return;

  const swatches = themeSwatches(project);
  const apply = (cmd) => api.apply({ ...selection, ...cmd });
  const latestElement = () => {
    const p = api.getProject();
    return materializeElements(p.slides.find((s) => s.slideId === selection.slideId), p).find((x) => x.id === selection.elementId);
  };
  const current = () => api.getProject().slides.find((s) => s.slideId === selection.slideId).objects.find((x) => x.objectId === o.objectId);
  const semantic = (data, relationships) => apply({ type: "semantic", objectId: o.objectId, data, relationships });

  // Drafted callout if present
  const drafted = draftedShownBy(project, selection.slideId, e.id);
  if (drafted.length) {
    const note = document.createElement("div");
    note.id = "fusion-drafted-note";
    note.style.cssText = "padding:9px 11px;border-radius:8px;border-left:3px solid #D97706;background:rgba(245,158,11,.10);font:500 11.5px/1.5 var(--ui-font);color:var(--ui-fg)";
    const kinds = new Set(drafted.map((d) => d.kind));
    note.textContent = (kinds.has("drafted") ? "模型补写" : "制作时展开") + "，请核对：" + drafted.map((d) => d.text).join("；") + (drafted.some((d) => d.placeholder) ? "（XX 处填实际数字）" : "") + "。";
    box.append(note);
  }

  // 1. Clean Element Header + Quick Icon Actions (Duplicate / Front / Back / Delete)
  const header = document.createElement("div");
  header.className = "fi-header";
  const badge = document.createElement("div");
  badge.className = "fi-badge";
  const tagText = o ? `组合 · ${o.kind}` : TYPE_LABELS[e.type] || e.type;
  badge.innerHTML = `<span class="fi-badge-tag">${tagText}</span>`;
  header.append(badge);

  const quick = document.createElement("div");
  quick.className = "fi-quick-bar";
  const qBtn = (svg, title, fn, danger = false) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "fi-icon-btn" + (danger ? " is-danger" : "");
    b.innerHTML = svg;
    b.title = title;
    b.setAttribute("aria-label", title);
    b.onclick = fn;
    quick.append(b);
  };
  qBtn(ICONS.dup, "复制元素（⌘D）", () => apply({ type: "duplicate-element" }));
  qBtn(ICONS.front, "置于顶层", () => apply({ type: "layer", direction: "front", objectId: o?.objectId }));
  qBtn(ICONS.back, "置于底层", () => apply({ type: "layer", direction: "back", objectId: o?.objectId }));
  qBtn(ICONS.del, "删除对象（Delete）", () => apply({ type: "delete-element", objectId: api.selectionMode() === "group" ? o?.objectId : undefined }), true);
  header.append(quick);
  box.append(header);

  // Only show Group / Element toggle when inside a real composite object
  if (o) {
    const seg = document.createElement("div");
    seg.className = "fi-seg";
    for (const [val, txt] of [["group", "整组操作"], ["element", "仅选子元素"]]) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = txt;
      if (api.selectionMode() === val) b.classList.add("is-active");
      b.onclick = () => { api.selectionMode(val); api.refreshSelection(); };
      seg.append(b);
    }
    box.append(seg);
  }

  // Helper factories
  let container = box;
  const card = (title, rightHint = "") => {
    const sec = document.createElement("div");
    sec.className = "deck-panel-section";
    if (title) {
      const h = document.createElement("div");
      h.className = "deck-panel-sec-title";
      h.innerHTML = `<span>${title}</span>${rightHint ? `<span>${rightHint}</span>` : ""}`;
      sec.append(h);
    }
    box.append(sec);
    return sec;
  };
  const section = (id, title, open = false) => {
    const details = document.createElement("details");
    details.id = id;
    details.open = expanded.get(id) ?? inspectorSections.get(id) ?? open;
    details.addEventListener("toggle", () => inspectorSections.set(id, details.open));
    const summary = document.createElement("summary");
    summary.textContent = title;
    details.append(summary);
    box.append(details);
    const content = document.createElement("div");
    content.style.cssText = "display:grid;gap:10px;padding-top:10px";
    details.append(content);
    return content;
  };
  const button = (label, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "deck-prop-choice fusion-action";
    b.textContent = label;
    b.onclick = fn;
    container.append(b);
    return b;
  };
  const field = (label, value, fn, type = "text") => {
    const row = document.createElement("label");
    row.className = "deck-prop-row";
    if (label) {
      const caption = document.createElement("span");
      caption.textContent = label;
      row.append(caption);
    }
    const input = document.createElement("input");
    input.type = type;
    input.setAttribute("aria-label", label || type);
    input.value = value ?? "";
    input.className = "fusion-input";
    const commit = () => {
      if (type === "number" && (input.value === "" || !input.validity.valid)) return;
      fn(type === "number" ? Number(input.value) : input.value);
    };
    input.onchange = commit;
    input.onkeydown = (event) => {
      if (event.key === "Enter") { event.preventDefault(); input.blur(); }
      if (event.key === "Tab" && type !== "file") {
        const list = focusables(box), next = list.indexOf(input) + (event.shiftKey ? -1 : 1);
        if (next < 0 || next >= list.length) { event.stopPropagation(); return; }
        event.preventDefault();
        pendingFocus = next;
        input.blur();
        if (box.isConnected) { const target = focusables(box)[pendingFocus]; pendingFocus = null; target?.focus(); }
      }
      event.stopPropagation();
    };
    row.append(input);
    container.append(row);
    return input;
  };
  const select = (label, value, options, fn) => {
    const row = document.createElement("label");
    row.className = "deck-prop-row";
    if (label) {
      const caption = document.createElement("span");
      caption.textContent = label;
      row.append(caption);
    }
    const input = document.createElement("select");
    input.setAttribute("aria-label", label || "选择");
    for (const option of options) {
      const v = Array.isArray(option) ? option[0] : option, t = Array.isArray(option) ? option[1] : option;
      input.add(new Option(t, v));
    }
    input.value = value;
    input.onchange = () => fn(input.value);
    row.append(input);
    container.append(row);
    return input;
  };

  // 2. Position, Size & Canvas Alignment Card
  const grouped = api.selectionMode() === "group" && !!o;
  const activeBounds = grouped ? o.bounds : e.bounds;
  const setBounds = (next) => apply({
    type: grouped ? "object-geometry" : "geometry",
    objectId: grouped ? o.objectId : undefined,
    bounds: next.map((v) => Math.round(v)),
  });
  const posCard = card("位置与对齐", "1920×1080");
  const alignBar = document.createElement("div");
  alignBar.className = "fi-grid-6";
  const aligns = [
    [ICONS.alL, "左对齐画布", () => setBounds([96, activeBounds[1], activeBounds[2], activeBounds[3]])],
    [ICONS.alC, "水平居中", () => setBounds([(1920 - activeBounds[2]) / 2, activeBounds[1], activeBounds[2], activeBounds[3]])],
    [ICONS.alR, "右对齐画布", () => setBounds([1920 - 96 - activeBounds[2], activeBounds[1], activeBounds[2], activeBounds[3]])],
    [ICONS.alT, "顶对齐画布", () => setBounds([activeBounds[0], 72, activeBounds[2], activeBounds[3]])],
    [ICONS.alM, "垂直居中", () => setBounds([activeBounds[0], (1080 - activeBounds[3]) / 2, activeBounds[2], activeBounds[3]])],
    [ICONS.alB, "底对齐画布", () => setBounds([activeBounds[0], 1080 - 72 - activeBounds[3], activeBounds[2], activeBounds[3]])],
  ];
  for (const [svg, tip, fn] of aligns) {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = svg;
    b.title = tip;
    b.onclick = fn;
    alignBar.append(b);
  }
  posCard.append(alignBar);

  const xyGrid = document.createElement("div");
  xyGrid.className = "fi-grid-2";
  for (const [idx, lbl] of [[0, "X"], [1, "Y"], [2, "W"], [3, "H"]]) {
    const cell = document.createElement("label");
    cell.className = "fi-xy-field";
    const sp = document.createElement("span");
    sp.textContent = lbl;
    const inp = document.createElement("input");
    inp.type = "number";
    inp.value = String(Math.round(activeBounds[idx]));
    inp.onchange = () => {
      const v = Number(inp.value);
      if (!Number.isFinite(v) || (idx >= 2 && v < 8)) return;
      const next = [...activeBounds];
      next[idx] = v;
      setBounds(next);
    };
    inp.onkeydown = (ev) => { if (ev.key === "Enter") { ev.preventDefault(); inp.blur(); } ev.stopPropagation(); };
    cell.append(sp, inp);
    xyGrid.append(cell);
  }
  posCard.append(xyGrid);

  // 3. Type-Specific Property Cards
  if (e.type === "text") {
    container = card("文字排版");
    const textStyle = (style) => apply({ type: "style", style, textScope: "all-runs" });
    const families = [
      ["Source Han Sans SC", "思源黑体（正文 / 多字重）"],
      ["YouSheBiaoTiHei", "优设标题黑（艺术标题）"],
      ["OPPO Sans 4.0", "OPPO Sans 4.0"],
      ["PingFang SC", "苹方 PingFang SC"],
      ["Microsoft YaHei", "微软雅黑"],
      ["Songti SC", "宋体 Songti SC"],
      ["KaiTi", "楷体 KaiTi"],
      ["Arial", "Arial"],
    ];
    const currentFont = e.manualStyle?.fontFamily || e.style?.fontFamily || "";
    const fontOpts = [["", "跟随全稿字体"], ...families];
    if (currentFont && !families.some(([f]) => f === currentFont)) fontOpts.push([currentFont, currentFont]);
    select("字体", currentFont, fontOpts, (fontFamily) => textStyle({ fontFamily }));

    // Row: Font Size Stepper + Font Weight
    const sizeWeightRow = document.createElement("div");
    sizeWeightRow.className = "fi-grid-2";

    const effectiveSize = e.runs?.[0]?.style?.fontSize ?? e.style?.fontSize ?? 34;
    const ptVal = Math.round((effectiveSize / 2) * 10) / 10;
    const sizeWrap = document.createElement("div");
    sizeWrap.className = "deck-prop-row";
    sizeWrap.innerHTML = "<span>字号 (pt)</span>";
    const stepper = document.createElement("div");
    stepper.className = "fi-stepper";
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    minus.onclick = () => textStyle({ fontSize: Math.max(8, effectiveSize - 2) });
    const sizeInp = document.createElement("input");
    sizeInp.type = "number";
    sizeInp.min = "4";
    sizeInp.step = "0.5";
    sizeInp.value = String(ptVal);
    sizeInp.onchange = () => { const v = Number(sizeInp.value); if (v > 0) textStyle({ fontSize: v * 2 }); };
    sizeInp.onkeydown = (ev) => { if (ev.key === "Enter") { ev.preventDefault(); sizeInp.blur(); } ev.stopPropagation(); };
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.onclick = () => textStyle({ fontSize: Math.min(260, effectiveSize + 2) });
    stepper.append(minus, sizeInp, plus);
    sizeWrap.append(stepper);
    sizeWeightRow.append(sizeWrap);

    const weightOptions = [["300", "300 细体"], ["400", "400 常规"], ["700", "700 粗体"], ["900", "900 特粗"]];
    const rawWeight = Number(e.runs?.[0]?.style?.fontWeight ?? e.style?.fontWeight ?? 400);
    const mappedWeight = rawWeight >= 800 ? "900" : rawWeight >= 551 ? "700" : rawWeight <= 350 ? "300" : "400";
    const weightWrap = document.createElement("label");
    weightWrap.className = "deck-prop-row";
    weightWrap.innerHTML = "<span>字重</span>";
    const weightSel = document.createElement("select");
    for (const [v, t] of weightOptions) weightSel.add(new Option(t, v));
    weightSel.value = mappedWeight;
    weightSel.onchange = () => textStyle({ fontWeight: Number(weightSel.value) });
    weightWrap.append(weightSel);
    sizeWeightRow.append(weightWrap);
    container.append(sizeWeightRow);

    // Row: Text Align Segmented + Line Height
    const alignLhRow = document.createElement("div");
    alignLhRow.className = "fi-grid-2";
    const alignWrap = document.createElement("div");
    alignWrap.className = "deck-prop-row";
    alignWrap.innerHTML = "<span>水平对齐</span>";
    const alignSeg = document.createElement("div");
    alignSeg.className = "fi-seg";
    const curAlign = e.style?.textAlign || "left";
    for (const [val, svg, tip] of [["left", ICONS.txtL, "左对齐"], ["center", ICONS.txtC, "居中"], ["right", ICONS.txtR, "右对齐"]]) {
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML = svg;
      b.title = tip;
      if (curAlign === val) b.classList.add("is-active");
      b.onclick = () => textStyle({ textAlign: val });
      alignSeg.append(b);
    }
    alignWrap.append(alignSeg);
    alignLhRow.append(alignWrap);

    const lhWrap = document.createElement("label");
    lhWrap.className = "deck-prop-row";
    lhWrap.innerHTML = "<span>行高</span>";
    const lhSel = document.createElement("select");
    const curLh = Number(e.style?.lineHeight || 1.35);
    const lhOpts = [1.0, 1.15, 1.25, 1.35, 1.45, 1.6, 1.8];
    if (!lhOpts.some((v) => Math.abs(v - curLh) < 0.02)) lhOpts.push(Math.round(curLh * 100) / 100);
    lhOpts.sort((a, b) => a - b);
    for (const v of lhOpts) lhSel.add(new Option(String(v), String(v)));
    lhSel.value = String(lhOpts.find((v) => Math.abs(v - curLh) < 0.02) || 1.35);
    lhSel.onchange = () => textStyle({ lineHeight: Number(lhSel.value) });
    lhWrap.append(lhSel);
    alignLhRow.append(lhWrap);
    container.append(alignLhRow);

    // Theme Swatches + Custom Color Picker
    const colorValue = e.runs?.[0]?.style?.color || e.style?.color || "#14213D";
    container.append(makeColorPicker("文字颜色", colorValue, swatches, (color) => textStyle({ color })));

    if (e.runs) {
      container = section("fusion-text-runs", `分段样式（${e.runs.length} 段）`, false);
      e.runs.forEach((run, index) => {
        const update = (patch) => {
          const runs = structuredClone(latestElement().runs);
          runs[index] = { ...runs[index], ...patch };
          apply({ type: "text-runs", runs });
        };
        const input = field(`文字段 ${index + 1}`, run.text, (text) => update({ text }));
        input.dataset.runIndex = String(index);
        container.append(
          makeColorPicker(`段 ${index + 1} 颜色`, run.style?.color || e.style?.color || "#14213D", swatches, (color) =>
            update({ style: { ...latestElement().runs[index].style, color } })
          )
        );
        select(`段 ${index + 1} 字重`, String(run.style?.fontWeight || 400), weightOptions, (value) =>
          update({ style: { ...latestElement().runs[index].style, fontWeight: Number(value) } })
        );
      });
      button("转为纯文本（清除句内样式）", () => apply({ type: "text", text: latestElement().text, resetRuns: true }));
    } else {
      field("文本内容", e.text, (text) => apply({ type: "text", text }));
    }
    container = box;
  }

  if (e.type === "shape") {
    container = card("形状外观");
    container.append(
      makeColorPicker("填充颜色", e.style?.fill || "#FFFFFF", swatches, (fill) => apply({ type: "style", style: { fill } }), { allowTransparent: true })
    );
    container.append(
      makeColorPicker("边框颜色", e.style?.stroke || "transparent", swatches, (stroke) => apply({ type: "style", style: { stroke, strokeWidth: stroke === "transparent" ? 0 : Math.max(1, e.style?.strokeWidth || 1) } }), { allowTransparent: true })
    );
    const swRad = document.createElement("div");
    swRad.className = "fi-grid-2";
    const mkNum = (lbl, val, min, max, onVal) => {
      const w = document.createElement("label");
      w.className = "deck-prop-row";
      w.innerHTML = `<span>${lbl}</span>`;
      const inp = document.createElement("input");
      inp.type = "number";
      inp.className = "fusion-input";
      inp.min = String(min);
      inp.max = String(max);
      inp.value = String(val ?? 0);
      inp.onchange = () => { const n = Number(inp.value); if (Number.isFinite(n)) onVal(Math.max(min, Math.min(max, n))); };
      inp.onkeydown = (ev) => { if (ev.key === "Enter") { ev.preventDefault(); inp.blur(); } ev.stopPropagation(); };
      w.append(inp);
      return w;
    };
    swRad.append(
      mkNum("边框宽 (px)", e.style?.strokeWidth ?? 0, 0, 24, (strokeWidth) => apply({ type: "style", style: { strokeWidth } })),
      mkNum("圆角 (px)", e.style?.radius ?? 0, 0, 200, (radius) => apply({ type: "style", style: { radius } }))
    );
    container.append(swRad);

    // Opacity slider
    const opWrap = document.createElement("div");
    opWrap.className = "deck-prop-row";
    opWrap.innerHTML = "<span>不透明度</span>";
    const opRow = document.createElement("div");
    opRow.className = "fi-range-row";
    const opPct = Math.round((e.style?.opacity ?? 1) * 100);
    const rng = document.createElement("input");
    rng.type = "range"; rng.min = "5"; rng.max = "100"; rng.value = String(opPct);
    const valSpan = document.createElement("span");
    valSpan.className = "fi-range-val";
    valSpan.textContent = opPct + "%";
    rng.oninput = () => { valSpan.textContent = rng.value + "%"; };
    rng.onchange = () => apply({ type: "style", style: { opacity: Number(rng.value) / 100 } });
    opRow.append(rng, valSpan);
    opWrap.append(opRow);
    container.append(opWrap);
    container = box;
  }

  if (e.type === "line" || e.type === "vector") {
    container = card("线条外观");
    container.append(makeColorPicker("线条颜色", e.style?.stroke || "#23338B", swatches, (stroke) => apply({ type: "style", style: { stroke } })));
    field("线条宽度 (px)", e.style?.strokeWidth || 3, (strokeWidth) => apply({ type: "style", style: { strokeWidth } }), "number");
    container = box;
  }

  if (e.type === "image") {
    container = card("图片设置");
    // Styled replace image button (hides ugly native file input)
    const hiddenFile = document.createElement("input");
    hiddenFile.type = "file";
    hiddenFile.id = "fusion-image-input";
    hiddenFile.accept = "image/*";
    hiddenFile.style.display = "none";
    hiddenFile.onchange = async () => {
      const image = hiddenFile.files[0];
      if (!image) return;
      const src = await new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.readAsDataURL(image);
      });
      apply({ type: "image", src });
    };
    container.append(hiddenFile);
    button("替换本地图片…", () => hiddenFile.click());

    const fitWrap = document.createElement("div");
    fitWrap.className = "deck-prop-row";
    fitWrap.innerHTML = "<span>画面填充模式</span>";
    const fitSeg = document.createElement("div");
    fitSeg.className = "fi-seg";
    const curFit = e.crop ? "crop" : e.fit || "contain";
    for (const [val, txt] of [["contain", "完整展示"], ["cover", "填满画框"], ["crop", "手动裁切"]]) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = txt;
      if (curFit === val) b.classList.add("is-active");
      b.onclick = () => {
        if (val === "crop") api.beginCrop(selection);
        else apply({ type: "image", src: latestElement().src, fit: val, crop: null });
      };
      fitSeg.append(b);
    }
    fitWrap.append(fitSeg);
    container.append(fitWrap);

    const radOp = document.createElement("div");
    radOp.className = "fi-grid-2";
    const radWrap = document.createElement("label");
    radWrap.className = "deck-prop-row";
    radWrap.innerHTML = "<span>圆角 (px)</span>";
    const radInp = document.createElement("input");
    radInp.type = "number"; radInp.className = "fusion-input"; radInp.min = "0"; radInp.max = "200";
    radInp.value = String(e.style?.radius ?? 0);
    radInp.onchange = () => apply({ type: "style", style: { radius: Math.max(0, Number(radInp.value) || 0) } });
    radWrap.append(radInp);
    radOp.append(radWrap);

    const opWrap = document.createElement("label");
    opWrap.className = "deck-prop-row";
    opWrap.innerHTML = "<span>不透明度 (%)</span>";
    const opInp = document.createElement("input");
    opInp.type = "number"; opInp.className = "fusion-input"; opInp.min = "10"; opInp.max = "100";
    opInp.value = String(Math.round((e.style?.opacity ?? 1) * 100));
    opInp.onchange = () => apply({ type: "style", style: { opacity: Math.max(0.1, Math.min(1, (Number(opInp.value) || 100) / 100)) } });
    opWrap.append(opInp);
    radOp.append(opWrap);
    container.append(radOp);
    container = box;
  }

  // 4. Composite semantic object editors (collapsible, kept clean)
  if (!o) {
    restoreScroll();
    return;
  }
  container = section("fusion-semantic-props", "组合数据结构", false);
  const editItem = (key, id, idField, fieldName, value) => {
    const data = structuredClone(current().data), item = data[key].find((n) => n[idField] === id);
    item[fieldName] = value;
    if (fieldName === "label") delete item.contentRef;
    semantic(data);
  };
  if (o.kind === "matrix") {
    field("矩阵列数", o.data.columns || 2, (columns) => semantic({ ...current().data, columns }), "number");
    field("矩阵行数", o.data.rows || Math.ceil(o.data.nodes.length / (o.data.columns || 2)), (rows) => semantic({ ...current().data, rows }), "number");
    for (let i = 0; i < (o.data.columns || 2); i++) field("列标 " + (i + 1), o.data.columnLabels?.[i] || "", (value) => {
      const data = structuredClone(current().data);
      data.columnLabels = data.columnLabels || [];
      data.columnLabels[i] = value;
      semantic(data);
    });
    for (let i = 0; i < (o.data.rows || 2); i++) field("行标 " + (i + 1), o.data.rowLabels?.[i] || "", (value) => {
      const data = structuredClone(current().data);
      data.rowLabels = data.rowLabels || [];
      data.rowLabels[i] = value;
      semantic(data);
    });
  }
  if (o.data.nodes) {
    if (o.kind === "timeline") {
      select("方向", o.data.direction || "horizontal", [["horizontal", "横向"], ["vertical", "纵向"], ["alternating", "上下交替"]], (direction) => semantic({ ...current().data, direction }));
      select("分布", o.data.distribution || "sequence", [["sequence", "顺序均布"], ["date", "按日期比例"]], (distribution) => semantic({ ...current().data, distribution }));
    }
    o.data.nodes.forEach((node, i) => {
      field(`节点 ${i + 1}`, node.label, (v) => editItem("nodes", node.nodeId, "nodeId", "label", v));
      field(`节点 ${i + 1} 说明`, node.detail, (v) => editItem("nodes", node.nodeId, "nodeId", "detail", v));
      if (o.kind === "timeline") field(`节点 ${i + 1} 日期`, node.date, (v) => editItem("nodes", node.nodeId, "nodeId", "date", v));
      button("上移节点 " + (i + 1), () => {
        const data = structuredClone(current().data), index = data.nodes.findIndex((n) => n.nodeId === node.nodeId);
        if (index > 0) [data.nodes[index], data.nodes[index - 1]] = [data.nodes[index - 1], data.nodes[index]];
        semantic(data);
      });
      button("删除节点 " + (i + 1), () => {
        const object = current(), data = structuredClone(object.data);
        data.nodes = data.nodes.filter((n) => n.nodeId !== node.nodeId);
        semantic(data, (object.relationships || []).filter((r) => r.from !== node.nodeId && r.to !== node.nodeId));
      });
    });
    button("添加节点", () => {
      const data = structuredClone(current().data);
      data.nodes.push({ nodeId: crypto.randomUUID(), label: "新节点", date: "", detail: "" });
      semantic(data);
    });
  }
  if (o.kind === "table") {
    const cols = o.data.columns;
    const rowName = (index) => `第 ${index + 1} 行`;
    cols.forEach((col, colIndex) => {
      field(`第 ${colIndex + 1} 列 · 列名`, col.label, (v) => editItem("columns", col.columnId, "columnId", "label", v));
    });
    o.data.rows.forEach((row, rowIndex) => {
      for (const col of cols) field(rowName(rowIndex) + " · " + (col.label || "未命名列"), row.cells[col.columnId], (value) => {
        const data = structuredClone(current().data);
        data.rows.find((r) => r.rowId === row.rowId).cells[col.columnId] = value;
        semantic(data);
      });
    });
    button("添加行", () => {
      const data = structuredClone(current().data);
      data.rows.push({ rowId: crypto.randomUUID(), cells: Object.fromEntries(data.columns.map((c) => [c.columnId, ""])) });
      semantic(data);
    });
    button("添加列", () => {
      const data = structuredClone(current().data);
      data.columns.push({ columnId: crypto.randomUUID(), label: "新列", width: 1 });
      semantic(data);
    });
  }
  if (["bar", "line"].includes(o.kind)) {
    field("单位", o.data.unit, (value) => semantic({ ...current().data, unit: value }));
    field("时期", o.data.period, (value) => semantic({ ...current().data, period: value }));
    for (const point of o.data.series) {
      field(point.label, point.value, (value) => editItem("series", point.nodeId, "nodeId", "value", value), "number");
    }
  }
  if (o.kind === "images") {
    select("图片组合", o.data.arrangement || "single", [["single", "单图"], ["text-photo", "图文并排"], ["primary-secondary", "主图＋副图"], ["grid", "网格"], ["full-bleed", "满版出血"]], (arrangement) => semantic({ ...current().data, arrangement }));
  }
  restoreScroll();
}

export function mountMultiInspector(panel, selectedList, api) {
  const previous = panel.querySelector("#fusion-inspector");
  const selKey = "multi:" + selectedList.map((s) => s.slideId + "/" + s.elementId).join(",");
  const sameTarget = previous?.dataset.selection === selKey;
  const scrollHost = panel.closest("#deck-panel");
  const prevScrollTop = sameTarget && scrollHost ? scrollHost.scrollTop : 0;
  panel.querySelector("#fusion-inspector")?.remove();
  const box = document.createElement("div");
  box.id = "fusion-inspector";
  box.dataset.selection = selKey;
  box.style.cssText = "display:grid;gap:12px;font:500 12.5px/1.4 var(--ui-font);color:var(--ui-fg)";
  panel.append(box);

  const slideId = selectedList[0]?.slideId;
  const project = api.getProject();
  const slide = project.slides.find((s) => s.slideId === slideId);
  if (!slide) return;
  const all = materializeElements(slide, project);
  const ids = selectedList.map((s) => s.elementId);
  const items = ids.map((id) => all.find((e) => e.id === id)).filter(Boolean);
  if (items.length < 2) return;

  const minX = Math.min(...items.map((e) => e.bounds[0]));
  const minY = Math.min(...items.map((e) => e.bounds[1]));
  const maxX = Math.max(...items.map((e) => e.bounds[0] + e.bounds[2]));
  const maxY = Math.max(...items.map((e) => e.bounds[1] + e.bounds[3]));
  const groupW = maxX - minX, groupH = maxY - minY;

  // Header
  const header = document.createElement("div");
  header.className = "fi-header";
  header.innerHTML = `<div class="fi-badge"><span class="fi-badge-tag">已选 ${items.length} 个对象</span></div>`;
  const quick = document.createElement("div");
  quick.className = "fi-quick-bar";
  const qBtn = (svg, title, fn, danger = false) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "fi-icon-btn" + (danger ? " is-danger" : "");
    b.innerHTML = svg;
    b.title = title;
    b.onclick = fn;
    quick.append(b);
  };
  qBtn(ICONS.dup, "批量复制（⌘D）", () => api.apply({ slideId, type: "batch-duplicate", elementIds: ids }));
  qBtn(ICONS.del, "批量删除（Delete）", () => api.apply({ slideId, type: "batch-delete", elementIds: ids }), true);
  header.append(quick);
  box.append(header);

  const commitBatch = (updates) => api.apply({ slideId, type: "batch-geometry", updates });

  // Relative Align Card
  const alSec = document.createElement("div");
  alSec.className = "deck-panel-section";
  alSec.innerHTML = '<div class="deck-panel-sec-title"><span>互相对齐</span><span>相对选区</span></div>';
  const alignBar = document.createElement("div");
  alignBar.className = "fi-grid-6";
  const aligns = [
    [ICONS.alL, "左对齐", () => commitBatch(items.map((e) => ({ elementId: e.id, bounds: [minX, e.bounds[1], e.bounds[2], e.bounds[3]] })))],
    [ICONS.alC, "水平居中对齐", () => commitBatch(items.map((e) => ({ elementId: e.id, bounds: [Math.round(minX + (groupW - e.bounds[2]) / 2), e.bounds[1], e.bounds[2], e.bounds[3]] })))],
    [ICONS.alR, "右对齐", () => commitBatch(items.map((e) => ({ elementId: e.id, bounds: [maxX - e.bounds[2], e.bounds[1], e.bounds[2], e.bounds[3]] })))],
    [ICONS.alT, "顶对齐", () => commitBatch(items.map((e) => ({ elementId: e.id, bounds: [e.bounds[0], minY, e.bounds[2], e.bounds[3]] })))],
    [ICONS.alM, "垂直居中对齐", () => commitBatch(items.map((e) => ({ elementId: e.id, bounds: [e.bounds[0], Math.round(minY + (groupH - e.bounds[3]) / 2), e.bounds[2], e.bounds[3]] })))],
    [ICONS.alB, "底对齐", () => commitBatch(items.map((e) => ({ elementId: e.id, bounds: [e.bounds[0], maxY - e.bounds[3], e.bounds[2], e.bounds[3]] })))],
  ];
  for (const [svg, tip, fn] of aligns) {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = svg;
    b.title = tip;
    b.onclick = fn;
    alignBar.append(b);
  }
  alSec.append(alignBar);

  // Equal Distribute Row (horizontal / vertical)
  const distRow = document.createElement("div");
  distRow.className = "fi-grid-2";
  const distBtn = (label, axis) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "deck-prop-choice";
    b.textContent = label;
    b.disabled = items.length < 3;
    b.title = items.length < 3 ? "需至少选中 3 个对象" : label;
    b.onclick = () => {
      const idx = axis === "x" ? 0 : 1, dim = axis === "x" ? 2 : 3;
      const sorted = [...items].sort((a, c) => a.bounds[idx] - c.bounds[idx]);
      const first = sorted[0].bounds[idx];
      const lastEnd = sorted.at(-1).bounds[idx] + sorted.at(-1).bounds[dim];
      const totalDim = sorted.reduce((acc, el) => acc + el.bounds[dim], 0);
      const gap = (lastEnd - first - totalDim) / (sorted.length - 1);
      let cursor = first;
      const updates = sorted.map((el) => {
        const next = [...el.bounds];
        next[idx] = Math.round(cursor);
        cursor += el.bounds[dim] + gap;
        return { elementId: el.id, bounds: next };
      });
      commitBatch(updates);
    };
    return b;
  };
  distRow.append(distBtn("水平等距分布", "x"), distBtn("垂直等距分布", "y"));
  alSec.append(distRow);
  box.append(alSec);

  // Group Bounds Readout
  const boxSec = document.createElement("div");
  boxSec.className = "deck-panel-section";
  boxSec.innerHTML = `<div class="deck-panel-sec-title"><span>组合选区边界</span><span>${Math.round(groupW)} × ${Math.round(groupH)}</span></div>`;
  const hint = document.createElement("p");
  hint.className = "deck-panel-hint";
  hint.textContent = "可直接拖拽任意选中对象成组移动，或使用方向键（Shift 10px）批量微调。";
  boxSec.append(hint);
  box.append(boxSec);
  if (sameTarget && scrollHost) scrollHost.scrollTop = prevScrollTop;
}

export { mountInspector };
