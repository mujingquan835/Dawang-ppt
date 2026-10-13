export const compositions = [
  "evidence",
  "case",
  "comparison",
  "process",
  "table",
  "action",
];
const base = {
  width: 960,
  height: 540,
  background: "#FFFFFF",
  text: "#202124",
  muted: "#58636B",
  accent: "#2151FF",
  panel: "#E5E6E5",
  titleFont: "Songti SC",
  bodyFont: "PingFang SC",
  titleSize: 32,
  bodySize: 21,
  margin: 40,
  evidenceRatio: 0.68,
  rule: true,
  negative: "#B7354D",
  positive: "#2151FF",
};
export const styles = {
  "indigo-due-diligence": { ...base, name: "靛蓝尽调", evidenceRatio: 0.68 },
  "moon-white-imagery": {
    ...base,
    name: "月白影像",
    text: "#002A12",
    muted: "#52675B",
    accent: "#1ECF77",
    panel: "#F2F4EF",
    titleFont: "PingFang SC",
    titleSize: 38,
    evidenceRatio: 0.42,
    rule: false,
    positive: "#16854D",
  },
  "blue-line-courseware": {
    ...base,
    name: "蓝线课件",
    accent: "#4285F4",
    panel: "#ADCCFA",
    titleFont: "PingFang SC",
    titleSize: 34,
    evidenceRatio: 0.6,
    rule: true,
    positive: "#34A853",
    negative: "#202124",
  },
};
export function resolveStyle(brief) {
  const preset = styles[brief.styleId];
  if (!preset && brief.styleId !== "custom")
    throw new Error(`Unknown style: ${brief.styleId}`);
  const style = { ...(preset || base), ...brief.tokens };
  if (style.width !== 960 || style.height !== 540)
    throw new Error("Only 960×540 / 16:9 is implemented");
  if (
    !Number.isFinite(style.evidenceRatio) ||
    style.evidenceRatio < 0.35 ||
    style.evidenceRatio > 0.75
  )
    throw new Error("evidenceRatio must be 0.35–0.75");
  for (const key of [
    "background",
    "text",
    "muted",
    "accent",
    "panel",
    "negative",
    "positive",
  ])
    if (!/^#[0-9a-f]{6}$/i.test(style[key]))
      throw new Error(`Invalid color: ${key}`);
  for (const key of ["titleSize", "bodySize", "margin"])
    if (!Number.isFinite(style[key]) || style[key] < 16 || style[key] > 64)
      throw new Error(`Invalid style size: ${key}`);
  return style;
}
