// Semantic design tokens for 月白影像 (theme17 templates + kimi/work/moon-white-imagery compositions).
// Units are logical px on the 1920x1080 canvas; export maps 144px = 1in, so 2px = 1pt.
const MOON_WHITE_TOKENS = Object.freeze({
  id: "moon-white",
  pxPerPt: 2,
  color: Object.freeze({ bg: "#ffffff", ink: "#002a12", muted: "#53665a", subtle: "#99aaa0", accent: "#1ecf77", accentStrong: "#007e42", neutralBar: "#7d9385", surface: "#f2f4ef", line: "#d6ddd9", negative: "#f3001c", inverseBg: "#002a12", inverseInk: "#ffffff", inverseMuted: "#c5d8cc", scrim: "rgba(0,42,18,.66)" }),
  type: Object.freeze({
    family: Object.freeze({ heading: "OPPO Sans 4.0", body: "OPPO Sans 4.0", mono: "IBM Plex Mono" }),
    display: 112, displayCompact: 86, title: 64, lead: 40, heading: 34, subtitle: 30, body: 30, bodyMin: 28, label: 27, caption: 24, note: 22, metric: 108, metricHero: 156,
    lineHeight: Object.freeze({ tight: 1.18, heading: 1.35, body: 1.5, loose: 1.6 })
  }),
  space: Object.freeze({ xs: 8, sm: 16, md: 24, lg: 38, xl: 64, xxl: 88 }),
  radius: Object.freeze({ none: 0, sm: 8, media: 22, pill: 999 }),
  line: Object.freeze({ hair: 1, rule: 2, strong: 4 }),
  grid: Object.freeze({
    canvas: Object.freeze([1920, 1080]),
    margin: Object.freeze({ x: 88, top: 56, bottom: 40 }),
    gap: 38,
    // Three zones: title (kicker/title/subtitle), content (fills or centers), footer (source/page).
    zones: Object.freeze({ title: Object.freeze({ y: 56, h: 250 }), content: Object.freeze({ y: 320, h: 640 }), footer: Object.freeze({ y: 996, h: 40 }) })
  })
});
const kebab = (s) => s.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
function tokenCssVars(t = MOON_WHITE_TOKENS) {
  const vars = {};
  for (const [k, v] of Object.entries(t.color)) vars[`--mw-${kebab(k)}`] = v;
  for (const [k, v] of Object.entries(t.type)) if (typeof v === "number") vars[`--mw-fs-${kebab(k)}`] = v + "px";
  for (const [k, v] of Object.entries(t.type.lineHeight)) vars[`--mw-lh-${k}`] = String(v);
  vars["--mw-font-heading"] = `'${t.type.family.heading}',sans-serif`;
  vars["--mw-font-body"] = `'${t.type.family.body}',sans-serif`;
  for (const [k, v] of Object.entries(t.space)) vars[`--mw-space-${k}`] = v + "px";
  for (const [k, v] of Object.entries(t.radius)) vars[`--mw-radius-${k}`] = v + "px";
  for (const [k, v] of Object.entries(t.line)) vars[`--mw-line-${k}`] = v + "px";
  vars["--mw-pad-x"] = t.grid.margin.x + "px";
  vars["--mw-pad-top"] = t.grid.margin.top + "px";
  vars["--mw-pad-bottom"] = t.grid.margin.bottom + "px";
  vars["--mw-zone-title-h"] = t.grid.zones.title.h + "px";
  vars["--mw-gap"] = t.grid.gap + "px";
  return vars;
}
export { MOON_WHITE_TOKENS, tokenCssVars };
