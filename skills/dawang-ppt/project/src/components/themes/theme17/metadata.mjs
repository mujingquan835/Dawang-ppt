// Local fusion: original components informed by open-kimi-ppt's Moon-White design guidance.
const common = { kicker: '月白影像 · 中文演示', title: '让结论、证据与行动形成清晰的阅读顺序', subtitle: '用本次真实材料替换示例；没有依据的目标、数据与责任人不补造。', source: '资料来源与统计口径：待补充' };
const count = (key, label, max, arrays, min = 1) => ({ key, label, type: 'number', min, max, step: 1, countArrays: arrays });
const imageControls = [{ key: 'imageFit', label: '主图适配', type: 'select', options: ['cover', 'contain'], mediaSlots: [{ field: 'images', maxCount: 1, initialSrcSupported: true, canPresetMedia: true, acceptedKinds: ['image'] }] }];
const imageProps = { images: [''], imageFit: 'cover', caption: '图片说明：请填写与本页结论相关的来源和解释。' };
const metrics = Array.from({ length: 4 }, (_, i) => ({ label: `指标 ${i + 1}`, value: '待确认', unit: '', detail: '说明统计口径、比较基准及业务含义。' }));
const points = Array.from({ length: 3 }, (_, i) => ({ title: `证据 ${i + 1}`, detail: '填写支持本页结论的事实与解释，保留必要的因果和比较关系。' }));
const definitions = [
  ['cover-minimal', '封面 · 月白标题', { ...common }, []],
  ['cover-photo', '封面 · 单图叙事', { ...common, ...imageProps }, imageControls],
  ['cover-split', '封面 · 主次分栏', { ...common, ...imageProps }, imageControls],
  ['cover-metric', '封面 · 数字主张', { ...common, metric: '待确认', unit: '', label: '核心数字的统计口径' }, []],
  ['cover-statement', '封面 · 深绿主张', { ...common }, []],
  ['overview-metrics', '总览 · 结论与指标', { ...common, summary: '先给出总体判断，再说明支持判断的关键事实；避免只有标题和数字而缺少解释。', metricCount: 3, metrics }, [count('metricCount', '指标数量', 4, ['metrics'])]],
  ['case-image', '案例 · 单图证据', { ...common, ...imageProps, pointCount: 2, points }, [...imageControls, count('pointCount', '解释数量', 3, ['points'])]],
  ['metrics-chart', '分析 · 横条图与判断', { ...common, chartTitle: '各对象同口径比较', unit: '项', insight: '请根据真实数据填写结论，解释差异及其影响。', barCount: 4, bars: Array.from({ length: 6 }, (_, i) => ({ label: `对象 ${i + 1}`, value: 0 })) }, [count('barCount', '比较对象', 6, ['bars'], 2)]],
  ['process-comparison', '流程 · 前后对比', { ...common, leftTitle: '原有流程', rightTitle: '调整后流程', stepCount: 3, before: Array.from({ length: 4 }, (_, i) => ({ title: `原步骤 ${i + 1}`, detail: '描述原有动作、交接或等待。' })), after: Array.from({ length: 4 }, (_, i) => ({ title: `新步骤 ${i + 1}`, detail: '说明具体改变与保留的控制点。' })), conclusion: '指出减少了什么工作，以及仍需保留的人工判断。' }, [count('stepCount', '流程节点', 4, ['before', 'after'], 2)]],
  ['table-evidence', '表格 · 八项资源明细', { ...common, headers: ['资源 / 对象', '用途 / 事实', '状态 / 依据', '下一步'], rowCount: 8, rows: Array.from({ length: 8 }, (_, i) => ({ name: `资源 ${i + 1}`, detail: '填写用途或核实后的事实', evidence: '填写状态或依据', action: '填写下一步动作' })) }, [count('rowCount', '明细行数', 8, ['rows'])]],
  ['actions-timeline', '行动 · 责任与交付', { ...common, actionCount: 4, actions: Array.from({ length: 4 }, (_, i) => ({ when: `阶段 ${i + 1}`, title: '填写具体行动', detail: '说明可检查的交付结果与依赖条件。', owner: '负责人待确认' })), conclusion: '列出需要确认的事项；没有已确认的日期或收益时不代填。' }, [count('actionCount', '行动数量', 4, ['actions'], 2)]],
];
export const MOON_WHITE_PACKS = [{ key: 'theme17', displayName: '月白影像', label: '月白影像', name: '月白影像', scenario: '案例汇报、项目复盘、图文提案、数据与行动报告', audience: '管理层、业务团队、客户', mode: 'replace', provenance: { source: 'Local original components; design guidance: open-kimi-ppt / moon-white-imagery', note: 'Not an official Kimi template or generation service.' } }];
export const MOON_WHITE_PAGES = definitions.map(([slot, label, defaultProps, controls], i) => ({ key: `theme17_page${String(i + 1).padStart(3, '0')}`, themeKey: 'theme17', pageNumber: i + 1, layout: `THEME17-${String(i + 1).padStart(3, '0')}`, slot, label, defaultProps, controls, bgClass: '' }));
