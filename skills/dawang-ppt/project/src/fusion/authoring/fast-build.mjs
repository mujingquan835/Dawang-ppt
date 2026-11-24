// Fast pure-Node build pipeline: Semantic Outline JSON -> composeReportDeck -> ProjectV2 -> Single-File HTML (+ optional PPTX).
// Zero Chrome launches, zero multi-round LLM contract ceremony, < 1 second end-to-end.
import fs from 'node:fs';
import path from 'node:path';
import { createFastMeasurer } from '../planning/fast-measurer.mjs';
import { composeReportDeck, draftDeckClaims } from './report-deck.mjs';
import { createAuthoredProject } from './create-project.mjs';
import { stageMedia } from './media.mjs';
import { workspacePath } from './workspace.mjs';
import { saveProject, loadProject } from '../project/store.mjs';
import { writePortableDeckHtml } from '../shell/page.jsx';
import { exportProjectPptxHeadless } from '../export/pptx.mjs';
import { reportPalette } from './report-palettes.mjs';
import { renderPreviewGrid } from './preview-grid.mjs';
import { attachLayoutVariants } from './layout-variants.mjs';
import { normalizeAndLintOutline } from './outline-normalizer.mjs';

function slugifyProjectId(title) {
  const ascii = String(title || 'deck')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return (ascii || 'deck') + '-' + Date.now().toString(36);
}

// Convert a minimal semantic outline (even without verbose sources/from/baseline ceremony)
// into a complete scaffold ready for composeReportDeck.
function normalizeSemanticOutline(raw) {
  const title = raw.title || '工作汇报';
  const projectId = raw.projectId || slugifyProjectId(title);
  const period = raw.period || '';
  const scenario = raw.scenario || 'management-report';
  const pages = (raw.pages || []).map((p, idx) => {
    const id = p.id || `p${idx + 1}`;
    const role = p.role || (idx === 0 && p.isCover ? 'cover' : 'summary');
    const fallbackText = p.subtitle || p.name || p.title || (role === 'closing' ? '感谢聆听 · 欢迎指正' : role === 'section' ? `章节 ${idx + 1}` : `第 ${idx + 1} 页`);
    const keyLine = typeof p.keyLine === 'string'
      ? { text: p.keyLine, source: 'quoted', from: 'outline' }
      : (p.keyLine || { text: fallbackText, source: 'quoted', from: 'outline' });
    return {
      ...p,
      id,
      role,
      keyLine,
    };
  });
  return {
    ...raw,
    title,
    projectId,
    period,
    scenario,
    reportType: raw.reportType || 'report',
    scope: raw.scope || 'full',
    pages,
  };
}

function buildLightweightScaffold(outline, paletteId) {
  const palette = typeof paletteId === 'string' ? reportPalette(paletteId) : paletteId;
  const contentNodes = {};
  const slidePlans = outline.pages.map((p, idx) => {
    const slideId = p.id || `p${idx + 1}`;
    const zones = [];
    const regions = [];
    const addZone = (id, role = 'evidence') => {
      if (zones.some((z) => z.id === id)) return;
      zones.push({ id, role, bounds: [96, 146, 1728, 864] });
      regions.push({ zoneId: id, role, bindings: [] });
    };

    if (p.role === 'cover') {
      addZone('cover', 'focus');
      if (p.data?.length) addZone('metrics', 'data');
      if (p.photos?.length) addZone('photos', 'media');
    } else if (p.role === 'section' || p.role === 'closing') {
      addZone(p.role, 'focus');
      if (p.data?.length) addZone('metrics', 'data');
      if (p.items?.length) addZone('items', 'evidence');
      if (p.photos?.length) addZone('photos', 'media');
    } else {
      if (p.data?.length) addZone('metrics', 'data');
      if (p.items?.length) addZone('items', 'evidence');
      if (p.table) addZone('table', 'data');
      if (Array.isArray(p.tables)) p.tables.forEach((_, ti) => addZone(`table-${ti + 1}`, 'data'));
      if (p.compare) addZone('compare', 'evidence');
      if (p.breakdown) addZone('breakdown', 'data');
      if (p.funnel) addZone('funnel', 'data');
      if (p.hub) addZone('hub', 'flow');
      if (p.periods?.length) addZone('periods', 'flow');
      if (Array.isArray(p.flows)) p.flows.forEach((_, fi) => addZone(`flow-${fi + 1}`, 'flow'));
      if (Array.isArray(p.chains)) p.chains.forEach((_, ci) => addZone(`chain-${ci + 1}`, 'flow'));
      if (Array.isArray(p.statements)) {
        p.statements.forEach((st, si) => addZone(st.id || `statement-${si + 1}`, 'note'));
      }
      if (p.photos?.length) addZone('photos', 'media');
    }

    contentNodes[`${slideId}:title`] = { text: p.keyLine.text, kind: 'headline', importance: 'required' };

    return {
      slideId,
      role: p.role,
      readerTask: p.readerTask || `理解${p.keyLine.text}`,
      keyLine: { text: p.keyLine.text, source: p.keyLine.source || 'quoted', from: p.keyLine.from || 'outline' },
      requiredRefs: [],
      visualDecision: {
        pattern: 'free',
        focus: { elementId: 'title', text: p.focus || p.keyLine.text },
        layout: '确定性组版',
        zones,
      },
      regions,
    };
  });

  return {
    requirements: {
      projectId: outline.projectId,
      title: outline.title,
      audience: outline.audience || '管理层与团队',
      goal: outline.goal || outline.title,
      scope: outline.scope || 'full',
      scenario: outline.scenario || 'management-report',
    },
    designChoice: {
      layoutEngine: 'dawang-authored-v1',
      styleId: 'authored/custom',
      appearance: { palette },
    },
    contentPlan: {
      scenario: outline.scenario || 'management-report',
      audience: outline.audience || '管理层与团队',
      purpose: outline.goal || outline.title,
      nodes: contentNodes,
      slides: slidePlans,
      throughLine: outline.throughLine || outline.title,
      ruleChecklist: { scenario: outline.scenario || 'management-report', items: {} },
    },
    media: { entries: [] },
    sources: {
      entries: Array.isArray(outline.sources) && outline.sources.length
        ? outline.sources
        : [{ sourceId: 'outline', kind: 'outline', label: outline.title }],
    },
    slides: [],
  };
}

/**
 * Pure-Node ultra-fast deck builder:
 * Accepts either a lightweight Semantic Outline JSON, an authored.json, or an existing deck-project.json.
 * Outputs a single self-contained offline HTML (with FontFace WOFF2 dual fonts + AssetPool + fast editor)
 * and optionally a native editable PPTX directly from Deck IR.
 */
export async function fastBuildDeck({
  inputFile,
  outFile,
  pptxFile = null,
  previewFile = null,
  packFile = null,
  palette = null,
  header = 'tag',
  footer,
  fontFamily = 'Source Han Sans SC',
  displayFamily = 'YouSheBiaoTiHei',
  workspaceDir,
} = {}) {
  const start = performance.now();
  const phases = {};
  const absInput = path.resolve(inputFile);
  const inputDir = path.dirname(absInput);
  const raw = JSON.parse(fs.readFileSync(absInput, 'utf8'));
  const explicitWsDir = workspaceDir ? path.resolve(workspaceDir) : null;
  const existingWsFile = explicitWsDir ? path.join(explicitWsDir, 'deck-project.json') : null;
  const prevWorkspaceProject = existingWsFile && fs.existsSync(existingWsFile)
    ? (() => { try { return loadProject(existingWsFile); } catch { return null; } })()
    : null;

  let project;
  let composeInfo = null;
  let outlineLintInfo = null;

  const composeStart = performance.now();
  if (Array.isArray(raw.pages)) {
    // Pre-compose normalizer: resolve IMG-XX / TBL-XX short IDs, strip duplicate numberings, auto-fill pct & focus
    const { outline: lintedOutline, report: lintReport } = normalizeAndLintOutline(raw, {
      packFile,
      baseDir: inputDir,
    });
    outlineLintInfo = {
      packFile: lintReport.packFile,
      resolvedPhotos: lintReport.resolvedPhotosCount,
      resolvedTables: lintReport.resolvedTablesCount,
      autoFixes: lintReport.autoFixes.length,
      warnings: lintReport.warnings,
      overloadPages: lintReport.overloadPages,
      sparsePages: lintReport.sparsePages,
    };
    // Lightweight semantic outline -> deterministic whole-deck composer (pure Node)
    const outline = normalizeSemanticOutline({
      ...lintedOutline,
      ...(lintedOutline.projectId ? {} : prevWorkspaceProject?.requirements?.projectId ? { projectId: prevWorkspaceProject.requirements.projectId } : {}),
    });
    const paletteChoice = palette || raw.palette || 'blue-gold';
    const deck = buildLightweightScaffold(outline, paletteChoice);
    const measurer = createFastMeasurer();
    try {
      const composed = await composeReportDeck({
        outline,
        deck,
        palette: paletteChoice,
        measurer,
        footer: footer ?? raw.footer ?? [outline.title, outline.period].filter(Boolean).join(' · '),
        layouts: raw.layouts || {},
        header: raw.header || header,
        baseDir: inputDir,
        fontFamily: raw.fontFamily || fontFamily,
        displayFamily: raw.displayFamily || displayFamily,
      });
      const claims = draftDeckClaims({
        deck,
        outline,
        palette: paletteChoice,
        projectId: outline.projectId,
      });
      if (claims?.throughLine) deck.contentPlan.throughLine = claims.throughLine;
      if (claims?.ruleChecklist) deck.contentPlan.ruleChecklist = claims.ruleChecklist;
      // Attach 4-5 modern Web UI switchable layout variants to every slide for one-click "换版式"
      const resolvedPalette = typeof paletteChoice === 'string' ? reportPalette(paletteChoice) : paletteChoice;
      const effectiveFooter = footer ?? raw.footer ?? [outline.title, outline.period].filter(Boolean).join(' · ');
      attachLayoutVariants({
        deck,
        outline,
        palette: resolvedPalette,
        footer: effectiveFooter,
        baseDir: inputDir,
      });
      composeInfo = {
        scales: composed.scales,
        rearranged: composed.rearranged,
        sparse: composed.sparse,
        loose: composed.loose,
        layoutVariants: deck.slides.map((s) => ({ slideId: s.slideId, count: s.layoutVariants?.length || 1 })),
      };
    } finally {
      await measurer.close();
    }
    project = createAuthoredProject(deck);
  } else if (raw.schemaVersion && Array.isArray(raw.slides)) {
    // Existing ProjectV2 (deck-project.json)
    project = loadProject(absInput);
  } else {
    // Authored JSON
    project = createAuthoredProject(raw);
  }
  phases.composeMs = Math.round(performance.now() - composeStart);

  // Stage into internal workspace so preview:start / patch:project still work seamlessly
  const stageStart = performance.now();
  const wsDir = workspacePath(project.requirements.projectId, workspaceDir);
  const staged = stageMedia(project, inputDir, wsDir);
  const projectFile = path.join(wsDir, 'deck-project.json');
  const existingRev = fs.existsSync(projectFile)
    ? (() => { try { return loadProject(projectFile)?.revision || null; } catch { return null; } })()
    : null;
  const saved = saveProject(projectFile, staged, existingRev);
  if (!saved.ok) throw new Error('Failed to save workspace project: ' + JSON.stringify(saved));
  project = saved.project;
  phases.workspaceMs = Math.round(performance.now() - stageStart);

  // Pure-Node single-file portable HTML generation (zero Chrome!)
  const htmlStart = performance.now();
  const absOut = path.resolve(outFile);
  const htmlResult = writePortableDeckHtml(project, absOut, { baseDir: wsDir });
  phases.htmlMs = Math.round(performance.now() - htmlStart);

  // Optional pure-Node headless IR -> editable PPTX export
  let pptxResult = null;
  if (pptxFile) {
    const pptxStart = performance.now();
    const absPptx = path.resolve(pptxFile);
    const report = await exportProjectPptxHeadless(htmlResult.tokenizedProject, {
      fileName: absPptx,
      baseDir: wsDir,
      assetPool: htmlResult.assetPool,
      title: project.requirements.title,
    });
    phases.pptxMs = Math.round(performance.now() - pptxStart);
    pptxResult = {
      file: absPptx,
      bytes: fs.statSync(absPptx).size,
      texts: report.texts,
      images: report.images,
      shapes: report.shapes,
      lines: report.lines,
      zipOk: report.zipIntegrity?.ok === true,
    };
  }

  // Optional 1-image visual overview grid + real DOM overflow audit
  let previewResult = null;
  if (previewFile) {
    previewResult = await renderPreviewGrid({
      htmlFile: absOut,
      previewFile: path.resolve(previewFile),
    });
    phases.previewMs = previewResult.previewMs;
  }

  return {
    ok: true,
    mode: 'fast-build-node',
    projectId: project.requirements.projectId,
    revision: project.revision,
    slides: project.slides.length,
    workspaceDir: wsDir,
    outFile: absOut,
    htmlBytes: htmlResult.bytes,
    htmlMB: Number((htmlResult.bytes / (1024 * 1024)).toFixed(2)),
    embeddedFonts: htmlResult.fonts,
    pooledAssets: htmlResult.assets,
    ...(pptxResult ? { pptx: pptxResult } : {}),
    ...(previewResult ? { preview: previewResult } : {}),
    ...(composeInfo ? { compose: composeInfo } : {}),
    ...(outlineLintInfo ? { outlineLint: outlineLintInfo } : {}),
    phases,
    durationMs: Math.round(performance.now() - start),
  };
}
