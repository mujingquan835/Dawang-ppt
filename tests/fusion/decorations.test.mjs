import test from "node:test";
import assert from "node:assert/strict";
import { cssDecoration } from "../../skills/dawang-ppt/project/src/fusion/export/css-paint.mjs";
test("approved CSS decoration preserves focal geometry, alpha mask and grid repetition in vector SVG", () => {
  const p = { id: "grid", type: "css-paint", bounds: [0, 0, 1920, 1080], image: "linear-gradient(color(srgb 0.101961 0.101961 0.101961 / 0.07) 1px, rgba(0, 0, 0, 0) 1px)", size: "48px 48px", position: "0% 0%", mask: "radial-gradient(rgb(0, 0, 0) 35%, rgba(0, 0, 0, 0) 86%)", opacity: 0.32 };
  const d = cssDecoration(p);
  assert.equal(d.type, "decoration");
  assert.equal(d.classification, "background-decoration");
  assert(d.svg.includes('patternUnits="userSpaceOnUse"'));
  assert(d.svg.includes('width="48" height="48"'));
  assert(d.svg.includes("<mask "));
  assert(!d.svg.includes("<text"));
  assert(!d.svg.includes("<image"));
  assert.throws(() => cssDecoration({ ...p, image: 'url("unknown.png")' }), /Unsupported/);
});
test("legacy stripes, ring patterns and inline SVG paper textures remain present", () => {
  for (const image of ["repeating-linear-gradient(135deg, rgba(22, 21, 19, 0.07) 0px, rgba(22, 21, 19, 0.07) 2px, rgba(0, 0, 0, 0) 2px, rgba(0, 0, 0, 0) 11px)", "repeating-radial-gradient(circle, rgba(255, 255, 255, 0.1) 0px, rgba(255, 255, 255, 0.1) 1px, rgba(0, 0, 0, 0) 1px, rgba(0, 0, 0, 0) 22px)"]) {
    const d2 = cssDecoration({ id: "pattern", bounds: [0, 0, 400, 400], image });
    assert(d2.svg.includes('spreadMethod="repeat"'));
  }
  const texture = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence baseFrequency="0.9"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>');
  const d = cssDecoration({ id: "paper", bounds: [0, 0, 1920, 1080], image: `url("data:image/svg+xml,${texture}")` });
  assert(d.svg.includes('width="160" height="160"'));
  assert(d.svg.includes("<image "));
  assert.doesNotThrow(() => cssDecoration({ id: "layers", bounds: [0, 0, 1920, 1080], image: "radial-gradient(rgb(20, 40, 80), rgba(0, 0, 0, 0)), none" }));
});
