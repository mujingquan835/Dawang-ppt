import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { materializeElements } from '../scene/model.mjs';

// Wireframe preview: each page's zones as labelled colour blocks with element outlines on top, so the division of
// the page can be judged before (or without) styling. Text is drawn as grey bars; nothing is rendered for real.
const COLORS = { focus: '#E8590C', evidence: '#2B7A78', support: '#3D5A80', flow: '#7B2CBF', data: '#B08900', note: '#6C757D', media: '#C9184A' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function wireframeSvg(project, slide) {
  const decision = project.contentPlan?.slides?.find((s) => s.slideId === slide.slideId)?.visualDecision || {};
  const zones = Array.isArray(decision.zones) ? decision.zones : [];
  const parts = ['<rect width="1920" height="1080" fill="#FFFFFF"/>'];
  for (const z of zones) {
    const [x, y, w, h] = z.bounds || [0, 0, 0, 0], c = COLORS[z.role] || '#999999';
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" fill-opacity="0.12" stroke="${c}" stroke-width="4" stroke-dasharray="16 10"/>`);
    parts.push(`<text x="${x + 14}" y="${y + 40}" font-family="PingFang SC, sans-serif" font-size="30" font-weight="700" fill="${c}">${esc(z.id)} · ${esc(z.role)}</text>`);
  }
  for (const e of materializeElements(slide, project)) {
    if (!Array.isArray(e.bounds)) continue;
    const [x, y, w, h] = e.bounds;
    if (e.type === 'text') parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#5C6B7A" fill-opacity="${(e.style?.fontSize || 24) >= 48 ? 0.55 : 0.25}"/>`);
    else if (e.type === 'image') parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#14213D" stroke-width="3"/><line x1="${x}" y1="${y}" x2="${x + w}" y2="${y + h}" stroke="#14213D" stroke-width="2"/><line x1="${x + w}" y1="${y}" x2="${x}" y2="${y + h}" stroke="#14213D" stroke-width="2"/>`);
    else parts.push(`<rect x="${x}" y="${y}" width="${Math.max(w, 2)}" height="${Math.max(h, 2)}" fill="none" stroke="#9AA5B1" stroke-width="2"/>`);
  }
  if (!zones.length) parts.push('<text x="60" y="1050" font-family="PingFang SC, sans-serif" font-size="28" fill="#C9184A">未记录 zones</text>');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">${parts.join('')}</svg>`;
}

export async function writeWireframes(project, outDir, { chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', png = true } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const files = project.slides.map((slide, i) => {
    const file = path.join(outDir, String(i + 1).padStart(2, '0') + '.svg');
    fs.writeFileSync(file, wireframeSvg(project, slide));
    return file;
  });
  if (!png) return files;
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    for (const file of files) { await page.setContent(fs.readFileSync(file, 'utf8')); await page.screenshot({ path: file.replace(/\.svg$/, '.png') }); }
  } finally { await browser.close(); }
  return files.map((f) => f.replace(/\.svg$/, '.png'));
}
