// Pre-compose normalizer, short-ID asset binder, density linter, and layout-decoupled Markdown plan renderer.
import fs from 'node:fs';
import path from 'node:path';

const asList = (v) => (Array.isArray(v) ? v : []);
const NUM_PREFIX_RE = /^(?:0\d+\s+|\d{1,2}\s*[.、)\]:：]\s*|[一二三四五六七八九十]+\s*[、.．)\]]\s*|[①②③④⑤⑥⑦⑧⑨⑩]\s*)/;
const GEOMETRY_LOCK_RE = /(?:左[一二三两123]右[一二三两123]|画[一两三123]?个?(?:圆环|框|图标|色块)|分两栏放|摆成\d+宫格|左上角放|右下角放|顶部放.*底部放)/;
const KEY_NUMBER_RE = /[+\-]?\d+(?:\.\d+)?\s*(?:%|％|万元|亿元|万|亿|单|个|家|张|份|人次|倍)/g;
const KEY_FOCUS_RE = /[+\-]?\d+(?:\.\d+)?\s*(?:%|％|万元|亿元|万|亿|单|个|家|张|份|人次|倍)/;

function keyLineTextOf(page) {
  if (typeof page?.keyLine === 'string') return page.keyLine;
  return String(page?.keyLine?.text || page?.name || page?.title || '');
}

function parseNum(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw ?? '').replace(/[,，¥￥$\s]/g, '');
  const m = /^([+\-]?\d+(?:\.\d+)?)/.exec(s);
  return m ? Number(m[1]) : null;
}

function largestRemainderPcts(values) {
  const total = values.reduce((a, b) => a + Math.max(0, b), 0);
  if (total <= 0) return values.map(() => 0);
  const raw = values.map((v) => (Math.max(0, v) / total) * 100);
  const floors = raw.map((x) => Math.floor(x));
  const rem = 100 - floors.reduce((a, b) => a + b, 0);
  const order = values
    .map((_, idx) => idx)
    .sort((a, b) => (raw[b] - floors[b]) - (raw[a] - floors[a]));
  for (let i = 0; i < Math.max(0, rem); i++) floors[order[i]] += 1;
  return floors;
}

export function loadMaterialPack({ pack = null, packFile = null, baseDir = process.cwd() } = {}) {
  if (pack && typeof pack === 'object') return { pack, packPath: packFile || null };
  const candidates = [];
  if (packFile) candidates.push(path.resolve(baseDir, packFile));
  candidates.push(path.join(baseDir, 'material-pack.json'));
  for (const cand of candidates) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
      try {
        return { pack: JSON.parse(fs.readFileSync(cand, 'utf8')), packPath: cand };
      } catch {
        return { pack: null, packPath: cand };
      }
    }
  }
  return { pack: null, packPath: null };
}

function resolvePhotoEntry(ph, imgById, pageId, pageNo, warnings, resolvedPhotos) {
  if (typeof ph === 'string') {
    const trimmed = ph.trim();
    const rec = imgById.get(trimmed);
    if (rec) {
      resolvedPhotos.push({ pageId, id: rec.id, path: rec.path });
      if (rec.fromHistory) {
        warnings.push({
          page: pageId,
          code: 'history-image-used',
          message: `第 ${pageNo} 页 (${pageId}) 引用了历史参考 PPT 的旧图 ${rec.id} (${rec.rel})，请确认是否误用历史素材（如确需使用可改对象格式并加 allowHistory: true）`,
        });
      }
      return {
        src: rec.path,
        ...(rec.recommendedFocal && rec.ratio < 0.85 ? { focal: rec.recommendedFocal } : {}),
        ...(rec.kindHint ? { kind: rec.kindHint } : {}),
      };
    }
    if (/^IMG-\d+$/i.test(trimmed)) {
      warnings.push({ page: pageId, code: 'missing-image-id', message: `第 ${pageNo} 页 (${pageId}) 图片短 ID 未找到: ${trimmed}` });
    }
    return { src: trimmed };
  }
  if (!ph || typeof ph !== 'object') return ph;
  const out = { ...ph };
  const refId = String(ph.id || (/^IMG-\d+$/i.test(String(ph.src || '').trim()) ? ph.src.trim() : '')).trim();
  if (refId) {
    const rec = imgById.get(refId);
    if (rec) {
      out.src = rec.path;
      if (!out.focal && !out.crop && rec.recommendedFocal && rec.ratio < 0.85) {
        out.focal = rec.recommendedFocal;
      }
      if (!out.kind && rec.kindHint) out.kind = rec.kindHint;
      resolvedPhotos.push({ pageId, id: rec.id, path: rec.path });
      if (rec.fromHistory && !out.allowHistory) {
        warnings.push({
          page: pageId,
          code: 'history-image-used',
          message: `第 ${pageNo} 页 (${pageId}) 引用了历史参考 PPT 的旧图 ${rec.id} (${rec.rel})，请确认是否误用历史素材`,
        });
      }
    } else {
      warnings.push({ page: pageId, code: 'missing-image-id', message: `第 ${pageNo} 页 (${pageId}) 图片短 ID 未找到: ${refId}` });
    }
    delete out.id;
  }
  delete out.allowHistory;
  return out;
}

function resolveTableEntry(tbl, tblById, pageId, pageNo, warnings, resolvedTables) {
  if (typeof tbl === 'string') {
    const rec = tblById.get(tbl.trim());
    if (!rec) {
      warnings.push({ page: pageId, code: 'missing-table-id', message: `第 ${pageNo} 页 (${pageId}) 表格短 ID 未找到: ${tbl}` });
      return null;
    }
    resolvedTables.push({ pageId, id: rec.id, title: rec.title });
    return { title: rec.title, columns: rec.columns, rows: rec.rows };
  }
  if (!tbl || typeof tbl !== 'object') return tbl;
  const out = { ...tbl };
  if (tbl.id && typeof tbl.id === 'string') {
    const rec = tblById.get(tbl.id.trim());
    if (rec) {
      if (!out.title) out.title = rec.title;
      if (!Array.isArray(out.columns) || !out.columns.length) out.columns = rec.columns;
      if (!Array.isArray(out.rows) || !out.rows.length) out.rows = rec.rows;
      resolvedTables.push({ pageId, id: rec.id, title: out.title });
    } else {
      warnings.push({ page: pageId, code: 'missing-table-id', message: `第 ${pageNo} 页 (${pageId}) 表格短 ID 未找到: ${tbl.id}` });
    }
    delete out.id;
  }
  return out;
}

function evaluatePageHealth(page, pageId) {
  if (page.role === 'cover') {
    return {
      activeZones: ['cover', ...(asList(page.data).length ? ['metrics'] : []), ...(asList(page.photos).length ? ['photos'] : [])],
      loadScore: 45,
      status: 'balanced',
      suggestion: null,
    };
  }
  if (page.role === 'section' || page.role === 'closing') {
    return {
      activeZones: [page.role, ...(asList(page.data).length ? ['metrics'] : []), ...(asList(page.items).length ? ['items'] : []), ...(asList(page.photos).length ? ['photos'] : [])],
      loadScore: 42,
      status: 'balanced',
      suggestion: null,
    };
  }
  const data = asList(page.data);
  const items = asList(page.items);
  const photos = asList(page.photos);
  const periods = asList(page.periods);
  const flows = asList(page.flows);
  const chains = asList(page.chains);
  const statements = asList(page.statements);
  const tables = page.table ? [page.table] : asList(page.tables);

  const activeZones = [];
  if (statements.length) activeZones.push('statements');
  if (data.length) activeZones.push('metrics');
  if (page.breakdown) activeZones.push('breakdown');
  if (page.funnel) activeZones.push('funnel');
  if (page.hub) activeZones.push('hub');
  if (page.compare) activeZones.push('compare');
  if (periods.length) activeZones.push('periods');
  if (tables.length) activeZones.push('table');
  if (flows.length) activeZones.push('flows');
  if (chains.length) activeZones.push('chains');
  if (items.length) activeZones.push('items');
  if (photos.length) activeZones.push('photos');

  let loadScore = 0;
  if (data.length) loadScore += 22 + Math.min(data.length, 6) * 3;
  if (page.breakdown) loadScore += 42;
  if (page.funnel) loadScore += 46;
  if (page.hub) loadScore += 48;
  if (page.compare) {
    const rows = Math.max(asList(page.compare.left).length, asList(page.compare.right).length);
    loadScore += 36 + Math.min(rows, 6) * 4;
  }
  if (periods.length) loadScore += 34 + Math.min(periods.length, 6) * 4;
  for (const t of tables) loadScore += 24 + Math.min(asList(t?.rows).length, 10) * 6;
  loadScore += (flows.length + chains.length) * 34;
  if (items.length) loadScore += 16 + Math.min(items.length, 8) * 7;
  if (photos.length) loadScore += 28 + Math.min(photos.length, 4) * 4;
  loadScore += statements.length * 10;

  const heavyModules = [
    page.breakdown && 'breakdown',
    page.funnel && 'funnel',
    page.hub && 'hub',
    page.compare && 'compare',
    periods.length && 'periods',
    tables.length && 'table',
    (flows.length + chains.length > 0) && 'flows',
    items.length >= 4 && 'items',
    photos.length >= 2 && 'photos',
  ].filter(Boolean);

  const maxTableRows = tables.reduce((m, t) => Math.max(m, asList(t?.rows).length), 0);
  if (loadScore > 105 || heavyModules.length >= 4 || maxTableRows > 8 || items.length > 6) {
    const splitCandidates = heavyModules.slice(1).join(' / ') || '次要模块';
    return {
      activeZones,
      loadScore,
      status: 'overload',
      suggestion: `${pageId} 信息过载（负载 ${loadScore}），建议拆为两页：本页保留核心数据/结论，将 [${splitCandidates}] 拆到下一页`,
    };
  }
  if (loadScore < 25) {
    return {
      activeZones,
      loadScore,
      status: 'sparse',
      suggestion: `${pageId} 内容偏稀疏（负载 ${loadScore}），建议补充量化指标/对照证据，或与相邻页合并`,
    };
  }
  return { activeZones, loadScore, status: 'balanced', suggestion: null };
}

function collectPageNumericBlob(page) {
  const parts = [];
  for (const d of asList(page.data)) parts.push(d.label, d.value, d.unit, d.delta, d.target, d.note, ...(asList(d.trend)));
  for (const it of asList(page.items)) parts.push(it.title, it.detail);
  for (const st of asList(page.statements)) parts.push(st.label, st.text);
  if (page.breakdown) {
    parts.push(page.breakdown.title, page.breakdown.total, page.breakdown.badge);
    for (const bi of asList(page.breakdown.items)) parts.push(bi.label, bi.value, bi.pct != null ? `${bi.pct}%` : '');
  }
  if (page.funnel) {
    parts.push(page.funnel.title);
    for (const fs of asList(page.funnel.steps)) parts.push(fs.label, fs.detail, fs.value, fs.unit, fs.rate, fs.drop);
  }
  if (page.hub) {
    parts.push(page.hub.title, page.hub.center?.title, page.hub.center?.sub);
    for (const hi of asList(page.hub.inputs)) parts.push(hi.title, hi.detail);
    for (const ho of asList(page.hub.outputs)) parts.push(ho.title, ho.detail);
  }
  if (page.compare) {
    for (const x of [...asList(page.compare.left), ...asList(page.compare.right)]) parts.push(x.title, x.detail);
  }
  for (const pd of asList(page.periods)) parts.push(pd.label, pd.title, ...asList(pd.points));
  for (const fl of [...asList(page.flows), ...asList(page.chains)]) {
    parts.push(fl.title);
    for (const s of asList(fl.steps)) parts.push(typeof s === 'string' ? s : `${s.title} ${s.detail || ''}`);
  }
  const tables = [...(page.table ? [page.table] : []), ...asList(page.tables)];
  for (const tbl of tables) {
    parts.push(tbl.title, ...asList(tbl.columns), ...asList(tbl.rows).flat());
  }
  return parts.filter((x) => x != null).join(' ');
}

export function normalizeAndLintOutline(rawOutline, { pack = null, packFile = null, baseDir = process.cwd() } = {}) {
  const outline = structuredClone(rawOutline || {});
  const { pack: resolvedPack, packPath } = loadMaterialPack({ pack, packFile, baseDir });
  const imgById = new Map(asList(resolvedPack?.images).map((img) => [img.id, img]));
  const tblById = new Map(asList(resolvedPack?.tables).map((tbl) => [tbl.id, tbl]));

  const autoFixes = [];
  const warnings = [];
  const resolvedPhotos = [];
  const resolvedTables = [];
  const pagesReport = [];

  if (outline.layouts && typeof outline.layouts === 'object' && Object.keys(outline.layouts).length > 0) {
    warnings.push({
      page: 'deck',
      code: 'layout-lock-detected',
      message: 'outline.layouts 手动锁定了页面排布（建议移除，交由引擎自适应计算并自动提供 4 套切换版式）',
    });
  }

  outline.pages = asList(outline.pages).map((rawPage, idx) => {
    const page = { ...rawPage };
    const pageNo = idx + 1;
    const pid = page.id || `p${pageNo}`;
    page.id = pid;
    const klText = keyLineTextOf(page);
    // 0. Fallback keyLine for structural slides (section / closing) when only name/title/subtitle is given
    if ((page.role === 'section' || page.role === 'closing') && !klText) {
      const fallbackKl = page.subtitle || page.name || page.title || (page.role === 'closing' ? '感谢聆听 · 欢迎指正' : `章节 ${pageNo}`);
      page.keyLine = { text: fallbackKl, source: 'distilled', from: 'outline' };
      autoFixes.push({ page: pid, field: 'keyLine', from: '(empty)', to: fallbackKl });
    }
    const effectiveKl = keyLineTextOf(page);

    if (page.layout) {
      warnings.push({
        page: pid,
        code: 'page-layout-lock',
        message: `第 ${pageNo} 页 (${pid}) 设置了固定 page.layout，建议去掉由引擎自动适配`,
      });
    }

    // 1. Resolve short IMG-XX references
    if (Array.isArray(page.photos)) {
      page.photos = page.photos
        .map((ph) => resolvePhotoEntry(ph, imgById, pid, pageNo, warnings, resolvedPhotos))
        .filter((ph) => ph && ph.src);
    }

    // 2. Resolve short TBL-XX references
    if (page.table != null) {
      const resolved = resolveTableEntry(page.table, tblById, pid, pageNo, warnings, resolvedTables);
      if (resolved) page.table = resolved;
      else delete page.table;
    }
    if (Array.isArray(page.tables)) {
      page.tables = page.tables
        .map((t) => resolveTableEntry(t, tblById, pid, pageNo, warnings, resolvedTables))
        .filter(Boolean);
    }

    // 2.5 Trim cover/section/closing data > 4 items & normalize page.order aliases / missing photos
    if (['cover', 'section', 'closing'].includes(page.role) && Array.isArray(page.data) && page.data.length > 4) {
      autoFixes.push({ page: pid, field: 'data', from: `${page.data.length} items`, to: '4 items' });
      warnings.push({
        page: pid,
        code: `${page.role}-data-trimmed`,
        message: `第 ${pageNo} 页 (${pid}) 最多支持 4 项核心指标，已自动保留前 4 项`,
      });
      page.data = page.data.slice(0, 4);
    }
    if (Array.isArray(page.order) && page.order.length) {
      const mapped = [];
      for (const rawZone of page.order) {
        const z = rawZone === 'data' ? 'metrics' : rawZone === 'photo' ? 'photos' : rawZone;
        if (z !== rawZone) autoFixes.push({ page: pid, field: 'order', from: rawZone, to: z });
        if (!mapped.includes(z)) mapped.push(z);
      }
      if (Array.isArray(page.photos) && page.photos.length && !mapped.includes('photos')) {
        const closeAt = mapped.findIndex((z) => {
          const st = asList(page.statements).find((s, i) => (s?.id || `statement-${i + 1}`) === z);
          return st && (st.tone === 'judgment' || st.place === 'bottom' || /复盘|判断|结论|启示|下一步|建议/.test(String(st.label || '')));
        });
        if (closeAt >= 0) mapped.splice(closeAt, 0, 'photos');
        else mapped.push('photos');
        autoFixes.push({ page: pid, field: 'order', from: '(missing photos)', to: 'appended photos' });
      }
      page.order = mapped;
    }

    // 3. Auto-strip manual numbering prefixes in items[].title
    if (Array.isArray(page.items)) {
      page.items = page.items.map((it) => {
        if (!it || typeof it !== 'object') return it;
        const title = String(it.title ?? '');
        const cleaned = title.replace(NUM_PREFIX_RE, '').trim();
        if (cleaned && cleaned !== title) {
          autoFixes.push({ page: pid, field: 'items[].title', from: title, to: cleaned });
          return { ...it, title: cleaned };
        }
        return it;
      });
    }

    // 4. Normalize flows/chains string steps & strip numbering prefixes
    for (const key of ['flows', 'chains']) {
      if (Array.isArray(page[key])) {
        page[key] = page[key].map((fl) => {
          if (!fl || typeof fl !== 'object') return fl;
          const steps = asList(fl.steps).map((st) => {
            if (typeof st === 'string') {
              const sep = st.search(/[：:]/);
              const rawTitle = sep > 0 ? st.slice(0, sep).trim() : st.trim();
              const detail = sep > 0 ? st.slice(sep + 1).trim() : undefined;
              const cleaned = rawTitle.replace(NUM_PREFIX_RE, '').trim() || rawTitle;
              autoFixes.push({ page: pid, field: `${key}.steps`, from: st, to: cleaned });
              return detail ? { title: cleaned, detail } : { title: cleaned };
            }
            if (st && typeof st === 'object' && typeof st.title === 'string') {
              const cleaned = st.title.replace(NUM_PREFIX_RE, '').trim();
              if (cleaned && cleaned !== st.title) {
                autoFixes.push({ page: pid, field: `${key}.steps[].title`, from: st.title, to: cleaned });
                return { ...st, title: cleaned };
              }
            }
            return st;
          });
          return { ...fl, steps };
        });
      }
    }

    // 5. Normalize plain-string statements
    if (Array.isArray(page.statements)) {
      page.statements = page.statements.map((st, si) => {
        if (typeof st === 'string') {
          autoFixes.push({ page: pid, field: `statements[${si}]`, from: 'string', to: 'object' });
          return { id: si === 0 ? 'intro' : `statement-${si + 1}`, label: si === 0 ? '导语' : '说明', text: st };
        }
        return st;
      });
    }

    // 6. Normalize breakdown pct (string % -> number, or auto-compute from value)
    if (page.breakdown && Array.isArray(page.breakdown.items) && page.breakdown.items.length) {
      const bItems = page.breakdown.items.map((bi) => ({ ...bi }));
      for (const bi of bItems) {
        if (typeof bi.pct === 'string') {
          const n = parseNum(bi.pct);
          if (n != null) {
            autoFixes.push({ page: pid, field: 'breakdown.items[].pct', from: bi.pct, to: Math.round(n) });
            bi.pct = Math.round(n);
          }
        }
      }
      if (bItems.every((bi) => typeof bi.pct !== 'number' || !Number.isFinite(bi.pct))) {
        const nums = bItems.map((bi) => parseNum(bi.value));
        if (nums.every((n) => n != null && n >= 0) && nums.some((n) => n > 0)) {
          const pcts = largestRemainderPcts(nums);
          bItems.forEach((bi, biIdx) => { bi.pct = pcts[biIdx]; });
          autoFixes.push({ page: pid, field: 'breakdown.items[].pct', from: 'missing', to: pcts.join('/') });
        }
      }
      page.breakdown = { ...page.breakdown, items: bItems };
    }

    // 7. Auto-pick focus from keyLine numeric figure when missing
    if (!['cover', 'section', 'closing'].includes(page.role) && effectiveKl && (!page.focus || !effectiveKl.includes(page.focus))) {
      const m = KEY_FOCUS_RE.exec(effectiveKl);
      if (m) {
        page.focus = m[0];
        autoFixes.push({ page: pid, field: 'focus', from: rawPage.focus || '(empty)', to: m[0] });
      }
    }

    // 8. Detect residual geometry wording inside text
    const textSample = [effectiveKl, ...asList(page.statements).map((s) => s?.text || ''), ...asList(page.items).map((i) => `${i?.title || ''} ${i?.detail || ''}`)].join(' ');
    if (GEOMETRY_LOCK_RE.test(textSample)) {
      warnings.push({
        page: pid,
        code: 'geometry-wording-in-text',
        message: `第 ${pageNo} 页 (${pid}) 文案疑似包含具体排版几何指令，请仅描述业务结论与信息关系`,
      });
    }

    // 9. Verify keyLine figures appear in body modules
    if (!['cover', 'section', 'closing'].includes(page.role) && effectiveKl) {
      const klNums = effectiveKl.match(KEY_NUMBER_RE) || [];
      if (klNums.length) {
        const bodyBlob = collectPageNumericBlob(page);
        for (const token of klNums) {
          const coreNum = token.match(/[+\-]?\d+(?:\.\d+)?/)?.[0];
          if (coreNum && !bodyBlob.includes(coreNum)) {
            warnings.push({
              page: pid,
              code: 'unbacked-keyline-figure',
              message: `第 ${pageNo} 页 (${pid}) 标题出现数值 "${token}"，但正文模块中未找到对应数字支撑`,
            });
          }
        }
      }
    }

    const health = evaluatePageHealth(page, pid);
    if (health.suggestion) {
      warnings.push({
        page: pid,
        code: `density-${health.status}`,
        message: health.suggestion,
      });
    }
    pagesReport.push({
      pageNo,
      id: pid,
      role: page.role || 'summary',
      keyLine: effectiveKl,
      ...health,
    });

    return page;
  });

  // Check monotony (>= 3 consecutive content pages with only items or only metrics)
  let streakKind = null;
  let streakStart = 0;
  let streakLen = 0;
  const monotonyRuns = [];
  for (const pr of pagesReport) {
    if (['cover', 'section', 'closing'].includes(pr.role)) { streakKind = null; streakLen = 0; continue; }
    const coreOnly = pr.activeZones.filter((z) => !['statements', 'photos'].includes(z));
    const sig = coreOnly.length === 1 && (coreOnly[0] === 'items' || coreOnly[0] === 'metrics') ? coreOnly[0] : null;
    if (sig && sig === streakKind) {
      streakLen++;
    } else {
      if (streakLen >= 3) monotonyRuns.push({ kind: streakKind, fromPage: streakStart, count: streakLen });
      streakKind = sig;
      streakStart = pr.pageNo;
      streakLen = sig ? 1 : 0;
    }
  }
  if (streakLen >= 3) monotonyRuns.push({ kind: streakKind, fromPage: streakStart, count: streakLen });
  for (const mr of monotonyRuns) {
    warnings.push({
      page: `p${mr.fromPage}+`,
      code: 'layout-monotony',
      message: `第 ${mr.fromPage} 页起连续 ${mr.count} 页仅使用单一 ${mr.kind} 模块，建议按真实关系升级为 breakdown / funnel / compare / periods`,
    });
  }

  const overloadPages = pagesReport.filter((p) => p.status === 'overload').map((p) => p.id);
  const sparsePages = pagesReport.filter((p) => p.status === 'sparse').map((p) => p.id);

  const report = {
    ok: true,
    packFile: packPath,
    totalPages: outline.pages.length,
    resolvedPhotosCount: resolvedPhotos.length,
    resolvedTablesCount: resolvedTables.length,
    resolvedPhotos,
    resolvedTables,
    autoFixes,
    warnings,
    overloadPages,
    sparsePages,
    pages: pagesReport,
  };

  return { outline, report };
}

export function renderOutlinePlanMarkdown(outline, report) {
  const lines = [
    `# 大纲预检与排版映射方案：${outline.title || '工作汇报'}`,
    '',
    `- **周期**：${outline.period || '未指定'} · **默认配色**：\`${outline.palette || 'blue-gold'}\` · **总页数**：${outline.pages.length} 页`,
    `- **短 ID 绑定**：已自动解析图片 ${report.resolvedPhotosCount} 处、表格 ${report.resolvedTablesCount} 张`,
    `- **自动清洗**：${report.autoFixes.length} 项（去双序号 / 补全百分比 / 数值焦点高亮）`,
    '',
    '## 逐页叙事结构与组件映射（版式解耦）',
    '',
    '| 页码 | 角色 | 核心结论（KeyLine） | 信息关系组件 | 负载度 |',
    '|---|---|---|---|---|',
  ];

  const statusBadge = { balanced: '✅ 均衡', overload: '⚠️ 过载建议拆页', sparse: '💡 偏空建议补充' };
  const roleLabel = { cover: '`cover` (封面)', section: '`section` (章节页)', closing: '`closing` (收尾页)' };
  for (const pr of report.pages) {
    const comps = pr.activeZones.join(' + ') || '-';
    const kl = (pr.keyLine || '').replace(/\|/g, '／');
    lines.push(`| P${pr.pageNo} (\`${pr.id}\`) | ${roleLabel[pr.role] || `\`${pr.role}\``} | ${kl} | \`${comps}\` | ${statusBadge[pr.status] || pr.status} (${pr.loadScore}) |`);
  }

  if (report.warnings.length) {
    lines.push('', '## ⚠️ 预检提示与建议');
    for (const w of report.warnings) {
      lines.push(`- **[${w.page}]** (${w.code}): ${w.message}`);
    }
  }

  if (report.autoFixes.length) {
    lines.push('', '## 🔧 已自动规范化项');
    for (const fx of report.autoFixes.slice(0, 12)) {
      lines.push(`- \`${fx.page}.${fx.field}\`: \`${fx.from}\` → \`${fx.to}\``);
    }
    if (report.autoFixes.length > 12) lines.push(`- *(其余 ${report.autoFixes.length - 12} 项略)*`);
  }

  lines.push(
    '',
    '> **版式解耦说明**：以上大纲仅锁定叙事主线、核心结论与数据信息关系，不预设固定死板的几何版式。确认后引擎将自动计算最佳构图、字阶与防裁切裁框，并为每页生成 4 套零丢内容切换版式。',
  );
  return lines.join('\n');
}
