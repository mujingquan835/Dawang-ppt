import { assertValid } from "./contracts.mjs";
import { resolveStyle } from "./styles.mjs";
export function compile(project) {
  assertValid(project);
  const style = resolveStyle(project.designBrief),
    nodes = new Map(project.sources.nodes.map((n) => [n.id, n])),
    media = new Map(project.media.items.map((m) => [m.id, m]));
  const text = (ref) => {
    const n = nodes.get(ref);
    if (n?.kind !== "text") throw new Error(`Text node required: ${ref}`);
    return n.text;
  };
  const slides = project.contentPlan.slides.map((s) => {
    const elements = [];
    const add = (id, type, box, extra = {}) => {
      const el = { id: `${s.slideId}.${id}`, type, ...box, ...extra };
      elements.push(el);
      return el;
    };
    const T = (id, ref, box, size = style.bodySize, extra = {}) =>
      add(id, "text", box, {
        contentRef: ref,
        text: text(ref),
        fontSize: size,
        fontFace: style.bodyFont,
        color: style.text,
        ...extra,
      });
    const shape = (id, box, color = style.panel) =>
      add(id, "shape", box, { fill: color });
    const line = (id, x, y, w, h, color = style.muted, arrow = false) =>
      add(id, "line", { x, y, w, h }, { color, arrow });
    const m = style.margin,
      w = 960 - 2 * m,
      top = 148,
      bottom = 478,
      h = bottom - top;
    T("title", s.titleRef, { x: m, y: 43, w, h: 90 }, style.titleSize, {
      fontFace: style.titleFont,
      bold: true,
    });
    if (style.rule) line("top-rule", m, 28, w, 0, style.accent);
    const refs = s.bodyRefs || [];
    const list = (prefix, listRefs, x, y, width, height) =>
      listRefs.forEach((ref, i) =>
        T(`${prefix}.${ref}`, ref, {
          x,
          y: y + (i * height) / listRefs.length,
          w: width,
          h: height / listRefs.length - 12,
        }),
      );
    const images = (x, y, width, height) => {
      const items = s.mediaRefs || [];
      items.forEach((ref, i) => {
        const v = media.get(ref);
        add(
          `media.${ref}`,
          "image",
          {
            x,
            y: y + (i * height) / items.length,
            w: width,
            h: height / items.length - 12,
          },
          {
            mediaRef: ref,
            src: v.src,
            fit: v.allowCrop === false ? "contain" : v.fit || "contain",
            alt: v.alt || ref,
          },
        );
      });
    };
    if (s.composition === "evidence" || s.composition === "case") {
      const ratio =
        project.designBrief.styleId === "moon-white-imagery"
          ? style.evidenceRatio
          : s.composition === "case"
            ? 0.38
            : style.evidenceRatio;
      const left = w * ratio - 18,
        rightX = m + w * ratio + 18,
        rightW = w * (1 - ratio) - 18;
      if (s.composition === "case") {
        list("body", refs, m, top, left, h);
        images(rightX, top, rightW, h);
      } else {
        const split = Math.max(1, Math.ceil(refs.length * 0.65));
        list("evidence", refs.slice(0, split), m, top, left, h);
        shape("judgment-panel", {
          x: rightX - 10,
          y: top - 10,
          w: rightW + 20,
          h: h + 12,
        });
        list(
          "judgment",
          refs.slice(split),
          rightX + 10,
          top + 12,
          rightW - 20,
          h - 24,
        );
        if (s.mediaRefs?.length)
          throw new Error("Use case composition for required media");
      }
    } else if (s.composition === "comparison") {
      const d = nodes.get(s.dataRef),
        max = Math.max(
          1,
          ...d.values
            .filter((v) => v.value !== null)
            .map((v) => Math.abs(v.value)),
        );
      const chartW = w * 0.68,
        zero = m + chartW * 0.5,
        rowH = Math.min(52, (h - 35) / d.values.length);
      line("axis", zero, top, 0, rowH * d.values.length);
      d.values.forEach((v, i) => {
        const y = top + i * rowH;
        add(
          `series.label.${i}`,
          "text",
          { x: m, y, w: 125, h: rowH - 5 },
          {
            contentRef: d.id,
            text: v.label,
            fontSize: 18,
            fontFace: style.bodyFont,
            color: style.text,
          },
        );
        const bw =
          v.value === null
            ? 0
            : (Math.abs(v.value) / max) * (chartW * 0.5 - 138);
        if (bw > 0)
          shape(
            `series.bar.${i}`,
            { x: v.value < 0 ? zero - bw : zero, y: y + 8, w: bw, h: 20 },
            v.value < 0 ? style.negative : style.positive,
          );
        add(
          `series.value.${i}`,
          "text",
          { x: zero + (chartW * 0.5 - 125), y, w: 112, h: rowH - 5 },
          {
            contentRef: d.id,
            text: v.value === null ? "缺失" : `${v.value} ${d.unit}`,
            fontSize: 18,
            fontFace: style.bodyFont,
            color: style.text,
          },
        );
      });
      add(
        "series.scope",
        "text",
        { x: m, y: bottom - 18, w: chartW, h: 26 },
        {
          contentRef: d.id,
          text: `${d.period} · ${d.unit} · ${d.basis}`,
          fontSize: 14,
          fontFace: style.bodyFont,
          color: style.muted,
        },
      );
      list("body", refs, m + chartW + 24, top, w - chartW - 24, h);
    } else if (s.composition === "process") {
      const groups = [
          ["before", s.beforeRefs],
          ["after", s.afterRefs],
        ],
        rowHeight = refs.length ? 120 : 145;
      groups.forEach(([name, steps], r) => {
        const y = top + r * (rowHeight + 24);
        add(
          `${name}.label`,
          "text",
          { x: m, y, w: 70, h: 35 },
          {
            text: name === "before" ? "调整前" : "调整后",
            fontSize: 18,
            fontFace: style.bodyFont,
            color: style.accent,
          },
        );
        const gap = 25,
          x = m + 85,
          sw = (w - 85 - gap * (steps.length - 1)) / steps.length;
        steps.forEach((ref, i) => {
          const sx = x + i * (sw + gap);
          shape(
            `${name}.box.${ref}`,
            { x: sx, y, w: sw, h: rowHeight - 20 },
            r ? style.panel : "#F0F1F2",
          );
          T(
            `${name}.${ref}`,
            ref,
            { x: sx + 12, y: y + 15, w: sw - 24, h: rowHeight - 45 },
            18,
          );
          if (i < steps.length - 1)
            line(
              `${name}.connector.${i}`,
              sx + sw + 3,
              y + 40,
              gap - 6,
              0,
              style.accent,
              true,
            );
        });
      });
      if (refs.length) list("body", refs, m, top + 288, w, 48);
    } else if (s.composition === "table") {
      const d = nodes.get(s.dataRef),
        rowH = Math.min(38, h / (d.rows.length + 1)),
        colW = w / d.headers.length;
      add(
        "table",
        "table",
        { x: m, y: top, w, h: rowH * (d.rows.length + 1) },
        {
          contentRef: d.id,
          headers: d.headers,
          rows: d.rows,
          fontSize: 17,
          fontFace: style.bodyFont,
          color: style.text,
          headerFill: style.accent,
        },
      );
      if (refs.length)
        throw new Error(
          "Table bodyRefs require another page; do not silently omit them",
        );
    } else if (s.composition === "action") {
      refs.forEach((ref, i) => {
        const y = top + (i * h) / refs.length;
        line(`action.rule.${i}`, m, y, w, 0, style.panel);
        add(
          `action.number.${i}`,
          "text",
          { x: m, y: y + 15, w: 60, h: 40 },
          {
            text: String(i + 1).padStart(2, "0"),
            fontSize: 30,
            fontFace: style.bodyFont,
            color: style.accent,
          },
        );
        T(`action.${ref}`, ref, {
          x: m + 80,
          y: y + 12,
          w: w - 80,
          h: h / refs.length - 24,
        });
      });
    }
    const renderedRefs = new Set(
      elements.map((e) => e.contentRef).filter(Boolean),
    );
    for (const ref of s.requiredContentRefs || [])
      if (!renderedRefs.has(ref))
        throw new Error(`Required content not rendered: ${ref}`);
    const renderedMedia = new Set(
      elements.map((e) => e.mediaRef).filter(Boolean),
    );
    for (const ref of s.mediaRefs || [])
      if (!renderedMedia.has(ref))
        throw new Error(`Media not rendered: ${ref}`);
    return {
      slideId: s.slideId,
      composition: s.composition,
      readerTask: s.readerTask,
      relation: s.relation,
      elements,
    };
  });
  const elementMap = new Map(
    slides.flatMap((s) => s.elements).map((e) => [e.id, e]),
  );
  for (const [id, override] of Object.entries(
    project.editState?.overrides || {},
  )) {
    const el = elementMap.get(id);
    if (!el) throw new Error(`Stale edit override: ${id}`);
    for (const [key, value] of Object.entries(override)) {
      if (
        !["x", "y", "w", "h", "fontSize"].includes(key) ||
        !Number.isFinite(value)
      )
        throw new Error(`Invalid override: ${id}.${key}`);
      el[key] = value;
    }
  }
  for (const s of slides)
    for (const e of s.elements) {
      if (
        e.x < 0 ||
        e.y < 0 ||
        e.w < 0 ||
        e.h < 0 ||
        e.x + e.w > 960 ||
        e.y + e.h > 540
      )
        throw new Error(`Element outside canvas: ${e.id}`);
      if (e.fontSize && e.fontSize < 14)
        throw new Error(`Unreadable font size: ${e.id}`);
    }
  return { schemaVersion: "1.0", width: 960, height: 540, style, slides };
}
