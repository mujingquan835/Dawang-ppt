import path from 'node:path';
import { createContentBaseline } from './content-baseline.mjs';
import { validateContentModel } from './content-model.mjs';
import { keyLineFigureIssues } from './wording.mjs';

// The bridge from an outline to the deck contracts. The agent reads the material and records where each fact came from
// (`from`) and any relation the structure does not show (`relations`); this code only moves that into the independent
// baseline. It never infers facts or relations from wording, and never reads laid-out pages.
//
// Added to the outline:
//   sources: [{ sourceId, kind, path?, title? }]
//   from: { sourceId?, locator, excerpt }   on data[], items[], flows[], chains[], compare, periods[], table, tables[]
//   relations: [{ id, kind, members: [nodeId], edges?, rows?, from, page? }]   relations the agent identified
//   statements: [{ id, label, text, from }]   on a page: labelled sentences, one module each
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
    const pageId = page.id || `p${pageIndex + 1}`, refs = [], zones = [], planned = page.role === 'plan';
    const addNode = (suffix, type, text, item, from, extra = {}) => {
      const id = `${pageId}:${suffix}`, where = { page: pageId, item: id }, location = located(from, where);
      if (!location) return id;
      nodes[id] = { type, text, status: item?.status || (planned ? 'planned' : 'confirmed'), importance: item?.importance || 'required', ...location, ...extra };
      refs.push(id);
      return id;
    };
    const addRelation = (suffix, kind, members, from, structure) => {
      if (members.length < 2) return null;
      const id = `${pageId}:${suffix}`, location = located(from, { page: pageId, item: id });
      if (!location) return null;
      relations.push({ id, kind, members, importance: 'required', ...location, ...structure });
      refs.push(id);
      return id;
    };
    const addZone = (zoneId, module, role, members, relationId) => zones.push({ zoneId, module, role, members: members.filter((m) => nodes[m]), relationId });
    const sequence = (members) => ({ edges: members.slice(1).map((to, i) => ({ id: `e${i + 1}`, from: members[i], to })) });
    const stepsOf = (groups, label) => asList(groups).forEach((group, g) => {
      const members = asList(group.steps).map((step, s) => addNode(`${label}-${g + 1}-${s + 1}`, 'stage', typeof step === 'string' ? step : step.title, group, group.from));
      addZone(`${label}-${g + 1}`, 'capacityFlow', 'flow', members, addRelation(`${label}-${g + 1}`, 'sequence', members, group.from, sequence(members)));
    });

    const dataRefs = asList(page.data).map((_, i) => `${pageId}:data-${i + 1}`), itemRefs = asList(page.items).map((_, i) => `${pageId}:item-${i + 1}`);
    asList(page.data).forEach((d, i) => {
      const unit = d.unit || (hasPercent(d.value) ? '%' : '');
      if (!unit) issues.push({ kind: 'outline-metric-unit-missing', page: pageId, item: `${pageId}:data-${i + 1}`, need: `「${d.label}」的单位` });
      const display = d.display || (hasPercent(d.value) ? String(d.value) : `${d.value} ${unit}`);
      const facts = { label: d.label, value: d.value, unit, display, role: d.role || (planned ? 'planned' : 'actual'), ...(d.target != null ? { target: d.target } : {}), ...(d.period ? { period: d.period } : {}) };
      addNode(`data-${i + 1}`, 'metric', `${d.label} ${display}`, d, d.from, { facts });
    });
    asList(page.items).forEach((it, i) => addNode(`item-${i + 1}`, 'statement', it.detail ? `${it.title}｜${it.detail}` : it.title, it, it.from));
    // A labelled sentence (业务问题、复盘判断、AI 提效) gets its own zone, so it can be its own module on the page.
    asList(page.statements).forEach((st, i) => {
      const key = st.id || `statement-${i + 1}`;
      addZone(key, 'labelBand', 'support', [addNode(key, 'statement', st.text, st, st.from)]);
    });
    if (page.role === 'cover') addZone('cover', 'coverPanel', 'focus', [addNode('status', 'statement', page.keyLine.text, page, { locator: page.keyLine.from || '封面状态句', excerpt: page.keyLine.text })]);
    if (dataRefs.length) addZone('metrics', 'metricTiles', 'data', dataRefs);
    if (itemRefs.length) addZone('items', 'numberedList', 'support', itemRefs);
    stepsOf(page.flows, 'flow');
    stepsOf(page.chains, 'chain');
    if (page.compare) {
      const pair = (side, label) => asList(page.compare[side]).map((it, i) => addNode(`compare-${label}${i + 1}`, 'statement', it.detail ? `${it.title}｜${it.detail}` : it.title, it, it.from || page.compare.from));
      const left = pair('left', 'l'), right = pair('right', 'r');
      const rows = left.flatMap((l, i) => (right[i] ? [{ id: `row-${i + 1}`, members: [l, right[i]] }] : []));
      addZone('compare', 'comparePair', 'evidence', [...left, ...right], addRelation('compare', 'comparison', [...left, ...right], page.compare.from, { rows }));
    }
    if (asList(page.periods).length) {
      const members = page.periods.map((p, i) => addNode(`period-${i + 1}`, 'statement', `${p.label}｜${[p.title, ...asList(p.points)].filter(Boolean).join('：')}`, p, p.from));
      addZone('periods', 'periodColumns', 'flow', members, addRelation('periods', 'sequence', members, page.periods[0]?.from, sequence(members)));
    }
    asList(page.tables).forEach((table, n) => {
      const zone = `table-${n + 1}`, members = asList(table.rows).map((row, i) => addNode(`${zone}-row-${i + 1}`, 'statement', row.join('｜'), table, table.from && { ...table.from, locator: `${table.from.locator} · 第 ${i + 1} 行` }));
      addZone(zone, 'capacityTable', 'evidence', members, addRelation(zone, 'classification', members, table.from, { rows: members.map((m, i) => ({ id: `row-${i + 1}`, members: [m] })) }));
    });
    if (page.table) {
      const members = asList(page.table.rows).map((row, i) => addNode(`row-${i + 1}`, 'statement', row.join('｜'), page.table, page.table.from && { ...page.table.from, locator: `${page.table.from.locator} · 第 ${i + 1} 行` }));
      addZone('table', 'capacityTable', 'evidence', members, addRelation('table', 'classification', members, page.table.from, { rows: members.map((m, i) => ({ id: `row-${i + 1}`, members: [m] })) }));
    }
    asList(page.photos).forEach((photo, i) => {
      const mediaId = `${pageId}-photo-${i + 1}`, caption = photo.caption || photo.src;
      media.push({ mediaId, src: path.resolve(baseDir, photo.src || ''), alt: caption });
      addNode(`photo-${i + 1}`, 'media', caption, photo, photo.from || { locator: `附件：${photo.src}`, excerpt: caption }, { mediaRef: mediaId });
    });
    if (asList(page.photos).length) addZone('photos', 'imageFrames', 'media', asList(page.photos).map((_, i) => `${pageId}:photo-${i + 1}`));
    pages.push({ slideId: pageId, requiredRefs: refs, zones, readerTask: page.readerTask || '', keyLineSource: page.keyLine?.source || 'distilled' });
  });

  for (const relation of asList(outline.relations)) {
    const { from, page, ...rest } = relation, location = located(from, { item: relation.id });
    if (!location) continue;
    relations.push({ importance: 'required', ...rest, ...location });
    const target = pages.find((p) => p.slideId === page);
    if (!target) continue;
    target.requiredRefs.push(relation.id);
    // A relation is bound inside one region, so it joins the region already holding all its members or gets its own.
    const holder = target.zones.find((z) => relation.members?.every((m) => z.members.includes(m)));
    if (holder && !holder.relationId) holder.relationId = relation.id;
    else target.zones.push({ zoneId: `relation-${target.zones.length + 1}`, module: 'custom', role: 'evidence', members: asList(relation.members), relationId: relation.id });
  }
  // A title states what its page shows: a figure in it that the page never puts on screen is the agent's to fix.
  if (['report', 'review'].includes(kind)) issues.push(...keyLineFigureIssues(outline));
  const brief = { purpose: outline.purpose || outline.title, audience: outline.audience, scenario: kind, scope };
  return { kind, scope, sources, nodes, relations, pages, media, brief, issues };
}

// The page-design half of the scaffold: every region, its content and an empty binding for each fact, edge and row.
// The designer fills bounds, element ids and the reasons; nothing here chooses a layout.
const PRIMARY_ORDER = ['metrics', 'table', 'flow', 'chain', 'compare', 'periods', 'items', 'photos', 'relation'];
function pagePlan({ slideId, requiredRefs, zones, readerTask, keyLineSource }, relations) {
  const rank = (z) => { const i = PRIMARY_ORDER.findIndex((p) => z.zoneId.startsWith(p)); return i < 0 ? 99 : i; };
  const primary = [...zones].sort((a, b) => rank(a) - rank(b))[0]?.zoneId;
  const relationBindings = (id) => {
    const relation = relations.find((r) => r.id === id);
    return [...asList(relation?.edges).map((e) => ({ ref: id, edgeId: e.id, elementIds: [] })), ...asList(relation?.rows).map((r) => ({ ref: id, rowId: r.id, elementIds: [] }))];
  };
  return {
    slideId, requiredRefs, readerTask,
    keyLine: { elementId: 'title', source: keyLineSource, support: [] },
    visualDecision: { pattern: '', focus: { elementId: 'title' }, layout: '', zones: zones.map((z) => ({ id: z.zoneId, role: z.role, bounds: [] })) },
    composition: { alignments: [], gaps: [] },
    regions: zones.map((z) => ({
      zoneId: z.zoneId,
      hierarchy: z.zoneId === primary ? 'primary' : z.module === 'imageFrames' ? 'support' : 'secondary',
      padding: 16,
      frameElementId: '',
      module: { name: z.module, variant: '' },
      typography: { title: 30, body: 24 },
      designReference: { source: '原创', principle: '' },
      representation: '',
      reason: '',
      contentRefs: z.members,
      relationRefs: z.relationId ? [z.relationId] : [],
      bindings: [...z.members.map((ref) => ({ ref, elementIds: [] })), ...(z.relationId ? relationBindings(z.relationId) : [])]
    }))
  };
}

// What the agent wrote on the user's say-so, per page: the delivery reply lists these so the user knows what to check.
export { DRAFT_LOCATOR, EXPAND_LOCATOR, draftedContent } from './drafted.mjs';

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
    contentPlan: { ...structuredClone(baseline.snapshot), baseline, slides: pages.map((page) => pagePlan(page, relations)) },
    slides: []
  };
  const modelIssues = validateContentModel({ version: 2, requirements, sources: scaffold.sources, contentPlan: scaffold.contentPlan });
  return modelIssues.length ? { ok: false, issues: modelIssues } : { ok: true, issues: [], baseline, scaffold };
}
