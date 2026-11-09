import path from 'node:path';
import { createContentBaseline } from './content-baseline.mjs';
import { validateContentModel } from './content-model.mjs';

// The bridge from an outline to the deck contracts. The agent reads the material and records where each fact came from
// (`from`) and any relation the structure does not show (`relations`); this code only moves that into the independent
// baseline. It never infers facts or relations from wording, and never reads laid-out pages.
//
// Added to the outline:
//   sources: [{ sourceId, kind, path?, title? }]
//   from: { sourceId?, locator, excerpt }   on data[], items[], flows[], chains[], compare, periods[], table
//   relations: [{ id, kind, members: [nodeId], edges?, rows?, from, page? }]   relations the agent identified
//   gaps, dispositions                      passed through to the baseline as written
// Node ids: <page>:data-1, :item-1, :flow-1-1, :chain-1-1, :compare-l1, :compare-r1, :period-1, :row-1, :photo-1.
export const NEW_DECK_CONTRACTS = {
  semanticContract: 'content-relations-v1',
  pageDesignContract: 'page-design-v1',
  contentBaselineContract: 'source-baseline-v1',
  compositionContract: 'regional-composition-v1'
};

export const missingContracts = (project) => Object.entries(NEW_DECK_CONTRACTS).filter(([key, value]) => project?.requirements?.[key] !== value).map(([key]) => key);

const filled = (value) => typeof value === 'string' && value.trim().length > 0;
const asList = (value) => (Array.isArray(value) ? value : []);
const hasPercent = (value) => /[%％]\s*$/.test(String(value));

function collect(outline, baseDir) {
  const kind = ['proposal', 'report', 'review', 'training', 'other'].includes(outline.kind) ? outline.kind : 'report';
  const scope = outline.scope === 'full' ? 'full' : 'part';
  const sources = asList(outline.sources), primary = sources[0]?.sourceId, known = new Set(sources.map((s) => s?.sourceId));
  const issues = [], nodes = {}, relations = [], pages = [], media = [];
  if (!sources.length) issues.push({ kind: 'outline-sources-missing', need: 'sources：至少登记一份原始材料 {sourceId,kind,path 或 title}' });
  if (!filled(outline.audience)) issues.push({ kind: 'outline-audience-missing', need: 'audience：这份稿子给谁看' });

  // Returns the node's source fields; a missing locator or excerpt is the agent's to fix, not a question for the user.
  const located = (from, where) => {
    const sourceId = from?.sourceId || primary;
    if (!filled(from?.locator) || !filled(from?.excerpt)) {
      issues.push({ kind: 'outline-source-location-missing', ...where, need: 'from：{locator: 原文位置, excerpt: 原文摘录}' });
      return null;
    }
    if (!known.has(sourceId)) {
      issues.push({ kind: 'outline-source-unknown', ...where, sourceId });
      return null;
    }
    return { sourceRefs: [sourceId], sourceLocations: [{ sourceId, locator: from.locator, excerpt: from.excerpt }] };
  };

  asList(outline.pages).forEach((page, pageIndex) => {
    const pageId = page.id || `p${pageIndex + 1}`, refs = [], planned = page.role === 'plan';
    const addNode = (suffix, type, text, item, from, extra = {}) => {
      const id = `${pageId}:${suffix}`, where = { page: pageId, item: id }, location = located(from, where);
      if (!location) return id;
      nodes[id] = { type, text, status: item?.status || (planned ? 'planned' : 'confirmed'), importance: item?.importance || 'required', ...location, ...extra };
      refs.push(id);
      return id;
    };
    const addRelation = (suffix, kind, members, from, structure) => {
      if (members.length < 2) return;
      const id = `${pageId}:${suffix}`, location = located(from, { page: pageId, item: id });
      if (!location) return;
      relations.push({ id, kind, members, importance: 'required', ...location, ...structure });
      refs.push(id);
    };
    const sequence = (members) => ({ edges: members.slice(1).map((to, i) => ({ id: `e${i + 1}`, from: members[i], to })) });
    const stepsOf = (groups, label) => asList(groups).forEach((group, g) => {
      const members = asList(group.steps).map((step, s) => addNode(`${label}-${g + 1}-${s + 1}`, 'stage', typeof step === 'string' ? step : step.title, group, group.from));
      addRelation(`${label}-${g + 1}`, 'sequence', members, group.from, sequence(members));
    });

    asList(page.data).forEach((d, i) => {
      const unit = d.unit || (hasPercent(d.value) ? '%' : '');
      if (!unit) issues.push({ kind: 'outline-metric-unit-missing', page: pageId, item: `${pageId}:data-${i + 1}`, need: `「${d.label}」的单位` });
      const display = d.display || (hasPercent(d.value) ? String(d.value) : `${d.value} ${unit}`);
      const facts = { label: d.label, value: d.value, unit, display, role: d.role || (planned ? 'planned' : 'actual'), ...(d.target != null ? { target: d.target } : {}), ...(d.period ? { period: d.period } : {}) };
      addNode(`data-${i + 1}`, 'metric', `${d.label} ${display}`, d, d.from, { facts });
    });
    asList(page.items).forEach((it, i) => addNode(`item-${i + 1}`, 'statement', it.detail ? `${it.title}｜${it.detail}` : it.title, it, it.from));
    stepsOf(page.flows, 'flow');
    stepsOf(page.chains, 'chain');
    if (page.compare) {
      const pair = (side, label) => asList(page.compare[side]).map((it, i) => addNode(`compare-${label}${i + 1}`, 'statement', it.detail ? `${it.title}｜${it.detail}` : it.title, it, it.from || page.compare.from));
      const left = pair('left', 'l'), right = pair('right', 'r');
      const rows = left.flatMap((l, i) => (right[i] ? [{ id: `row-${i + 1}`, members: [l, right[i]] }] : []));
      addRelation('compare', 'comparison', [...left, ...right], page.compare.from, { rows });
    }
    if (asList(page.periods).length) {
      const members = page.periods.map((p, i) => addNode(`period-${i + 1}`, 'statement', `${p.label}｜${[p.title, ...asList(p.points)].filter(Boolean).join('：')}`, p, p.from));
      addRelation('periods', 'sequence', members, page.periods[0]?.from, sequence(members));
    }
    if (page.table) {
      const members = asList(page.table.rows).map((row, i) => addNode(`row-${i + 1}`, 'statement', row.join('｜'), page.table, page.table.from && { ...page.table.from, locator: `${page.table.from.locator} · 第 ${i + 1} 行` }));
      addRelation('table', 'classification', members, page.table.from, { rows: members.map((m, i) => ({ id: `row-${i + 1}`, members: [m] })) });
    }
    asList(page.photos).forEach((photo, i) => {
      const mediaId = `${pageId}-photo-${i + 1}`, caption = photo.caption || photo.src;
      media.push({ mediaId, src: path.resolve(baseDir, photo.src || ''), alt: caption });
      addNode(`photo-${i + 1}`, 'media', caption, photo, photo.from || { locator: `附件：${photo.src}`, excerpt: caption }, { mediaRef: mediaId });
    });
    pages.push({ slideId: pageId, requiredRefs: refs });
  });

  for (const relation of asList(outline.relations)) {
    const { from, page, ...rest } = relation, location = located(from, { item: relation.id });
    if (!location) continue;
    relations.push({ importance: 'required', ...rest, ...location });
    pages.find((p) => p.slideId === page)?.requiredRefs.push(relation.id);
  }
  const brief = { purpose: outline.purpose || outline.title, audience: outline.audience, scenario: kind, scope };
  return { kind, scope, sources, nodes, relations, pages, media, brief, issues };
}

// What still stops outline:baseline. Separate from outline:check's gaps: these are the agent's to fix.
export const outlineBaselineIssues = (outline, { baseDir = process.cwd() } = {}) => collect(outline, baseDir).issues;

export function buildOutlineBaseline(outline, { baseDir = process.cwd() } = {}) {
  const { scope, sources, nodes, relations, pages, media, brief, issues } = collect(outline, baseDir);
  if (issues.length) return { ok: false, issues };
  const content = { brief, nodes, relations, gaps: asList(outline.gaps), dispositions: asList(outline.dispositions) };
  const baseline = createContentBaseline({ id: outline.id || `${outline.title || 'outline'}-baseline`, ...content });
  const requirements = { ...(outline.title ? { title: outline.title } : {}), scope, ...NEW_DECK_CONTRACTS };
  const scaffold = {
    requirements,
    sources: { entries: sources },
    media: { entries: media },
    designChoice: { styleId: 'authored/custom' },
    contentPlan: { ...structuredClone(baseline.snapshot), baseline, slides: pages },
    slides: []
  };
  const modelIssues = validateContentModel({ version: 2, requirements, sources: scaffold.sources, contentPlan: scaffold.contentPlan });
  return modelIssues.length ? { ok: false, issues: modelIssues } : { ok: true, issues: [], baseline, scaffold };
}
