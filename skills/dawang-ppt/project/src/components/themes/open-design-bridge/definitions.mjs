const PAGE_KINDS = [
  ['cover-hero', '封面 · 主视觉'],
  ['cover-minimal', '封面 · 极简标题'],
  ['cover-split', '封面 · 左右分栏'],
  ['cover-metric', '封面 · 核心数字'],
  ['cover-statement', '封面 · 结论先行'],
  ['agenda', '目录 · 议题导航'],
  ['metrics', '数据 · 核心指标'],
  ['highlights', '要点 · 卡片矩阵'],
  ['comparison', '对比 · 双栏判断'],
  ['process', '流程 · 分步推进'],
  ['timeline', '计划 · 时间轴'],
  ['risks', '风险 · 问题清单'],
  ['matrix', '决策 · 四象限'],
  ['insight', '洞察 · 证据结论'],
  ['actions', '行动 · 下一步'],
];

export const OPEN_DESIGN_THEME_CONFIGS = [
  {
    key: 'theme13',
    displayName: '钴蓝经营风',
    scenario: '管理层汇报、季度经营回顾、企业战略、咨询提案',
    audience: '管理层、经营团队、咨询顾问、企业客户',
    variant: 'corporate',
    layoutPrefix: 'THEME13',
    palette: { bg: '#fdfae7', ink: '#111111', muted: '#6b6b6b', accent: '#1e2bfa', accent2: '#6d77ff', surface: '#ffffff', line: 'rgba(30,43,250,.20)', good: '#16794c', warn: '#a66700', bad: '#b42318' },
    source: 'Open Design / Blue Professional',
    upstream: 'https://github.com/zarazhangrui/beautiful-html-templates/tree/main/templates/blue-professional',
    license: 'MIT',
  },
  {
    key: 'theme14',
    displayName: '清晰周报风',
    scenario: '数据周报、增长复盘、经营分析、项目进展',
    audience: '增长团队、产品团队、运营团队、业务负责人',
    variant: 'weekly',
    layoutPrefix: 'THEME14',
    palette: { bg: '#fafbfc', ink: '#161e37', muted: '#697188', accent: '#2e63eb', accent2: '#0ea5b5', surface: '#ffffff', line: 'rgba(22,30,55,.12)', good: '#10a875', warn: '#d98b00', bad: '#dc3f4f' },
    source: 'Open Design / HTML PPT Weekly Report',
    upstream: 'https://github.com/lewislulu/html-ppt-skill',
    license: 'MIT',
  },
  {
    key: 'theme15',
    displayName: '产品发布风',
    scenario: '产品发布、营销方案、客户提案、品牌升级',
    audience: '产品团队、市场团队、品牌团队、客户决策人',
    variant: 'launch',
    layoutPrefix: 'THEME15',
    palette: { bg: '#f6f7fb', ink: '#11111b', muted: '#646579', accent: '#6d35f2', accent2: '#00a9c7', surface: '#ffffff', line: 'rgba(109,53,242,.16)', good: '#10956a', warn: '#d58100', bad: '#d43f5e' },
    source: 'Open Design / HTML PPT Product Launch',
    upstream: 'https://github.com/lewislulu/html-ppt-skill',
    license: 'MIT',
  },
  {
    key: 'theme16',
    displayName: '奶油蓝图风',
    scenario: '方法论、流程设计、项目复盘、AI 分享、知识架构',
    audience: '项目团队、技术团队、管理层、内部分享听众',
    variant: 'blueprint',
    layoutPrefix: 'THEME16',
    palette: { bg: '#f0eae0', ink: '#1a1a1a', muted: '#625f59', accent: '#b5392a', accent2: '#765649', surface: '#fffdf8', line: '#cec8be', good: '#397153', warn: '#a06416', bad: '#b5392a' },
    source: 'Open Design / HTML PPT Knowledge Architecture Blueprint',
    upstream: 'https://github.com/lewislulu/html-ppt-skill',
    license: 'MIT',
  },
];

const byKey = new Map(OPEN_DESIGN_THEME_CONFIGS.map((theme) => [theme.key, theme]));

function themeDefaults(theme, kind) {
  const name = theme.displayName;
  const common = {
    kicker: '大师 PPT · OPEN DESIGN BRIDGE',
    title: `${name}演示模板`,
    subtitle: '用真实材料替换本页示例内容，未核实数据请标记“待人工确认”。',
    meta: '2026 · V1',
  };
  const defaults = {
    'cover-hero': common,
    'cover-minimal': { ...common, title: '结论先行的演示', subtitle: '用一句清晰判断建立整份汇报的阅读预期。' },
    'cover-split': { ...common, title: '从现状到行动', subtitle: '左侧陈述问题，右侧给出目标与关键判断。', sideTitle: '本次重点', sideItems: ['背景与目标', '关键发现', '行动建议'] },
    'cover-metric': { ...common, title: '核心指标概览', metric: '待确认', metricLabel: '本次汇报核心指标', insight: '请用真实数据替换，并同步更新读图结论。' },
    'cover-statement': { ...common, title: '先把最重要的判断说清楚', subtitle: '后续页面只负责提供证据、取舍与下一步。' },
    agenda: { kicker: 'AGENDA', title: '本次汇报聚焦四件事', items: [
      { index: '01', title: '目标与背景', detail: '为什么现在需要讨论这件事' },
      { index: '02', title: '关键发现', detail: '事实、数据与主要变化' },
      { index: '03', title: '方案判断', detail: '选项、取舍与推荐路径' },
      { index: '04', title: '行动计划', detail: '责任人、时间与下一步' },
    ] },
    metrics: { kicker: 'KEY METRICS', title: '核心指标', metrics: [
      { label: '指标 A', value: '待确认', delta: '环比待确认', status: 'good' },
      { label: '指标 B', value: '待确认', delta: '目标待确认', status: 'neutral' },
      { label: '指标 C', value: '待确认', delta: '差距待确认', status: 'warn' },
      { label: '指标 D', value: '待确认', delta: '风险待确认', status: 'bad' },
    ], insight: '数据结论：待人工确认。' },
    highlights: { kicker: 'HIGHLIGHTS', title: '四个关键要点', cards: [
      { index: '01', title: '机会', detail: '描述最值得放大的机会与依据。' },
      { index: '02', title: '变化', detail: '描述已经发生的关键变化。' },
      { index: '03', title: '问题', detail: '描述当前最需要解决的问题。' },
      { index: '04', title: '建议', detail: '给出可执行的推荐动作。' },
    ] },
    comparison: { kicker: 'BEFORE / AFTER', title: '两种路径的差异', leftTitle: '当前路径', rightTitle: '推荐路径', leftItems: ['目标不够聚焦', '动作分散', '结果难以验证'], rightItems: ['目标明确', '资源集中', '结果可复盘'], conclusion: '推荐路径及理由：待人工确认。' },
    process: { kicker: 'PROCESS', title: '四步推进路径', steps: [
      { index: '01', title: '明确目标', detail: '确认受众、决策目标和成功标准。' },
      { index: '02', title: '建立事实', detail: '整理真实材料、数据和约束。' },
      { index: '03', title: '形成方案', detail: '比较选项并明确取舍。' },
      { index: '04', title: '落地复盘', detail: '设置责任人、节点和复盘机制。' },
    ] },
    timeline: { kicker: 'ROADMAP', title: '阶段计划', milestones: [
      { time: '阶段 1', title: '准备', detail: '材料与目标确认' },
      { time: '阶段 2', title: '试点', detail: '小范围验证方案' },
      { time: '阶段 3', title: '推广', detail: '扩大执行范围' },
      { time: '阶段 4', title: '复盘', detail: '评估效果并迭代' },
    ] },
    risks: { kicker: 'RISKS', title: '需要提前处理的风险', risks: [
      { level: '高', title: '事实口径不一致', detail: '先确定唯一数据来源和确认人。', owner: '负责人待确认' },
      { level: '中', title: '资源投入不足', detail: '明确优先级与最小可行范围。', owner: '负责人待确认' },
      { level: '中', title: '节点依赖外部', detail: '建立备选方案和提前量。', owner: '负责人待确认' },
    ] },
    matrix: { kicker: 'DECISION MATRIX', title: '决策四象限', axes: { x: '执行难度 →', y: '业务价值 ↑' }, quadrants: [
      { label: '优先推进', detail: '高价值、低难度' },
      { label: '重点攻坚', detail: '高价值、高难度' },
      { label: '快速处理', detail: '低价值、低难度' },
      { label: '暂缓观察', detail: '低价值、高难度' },
    ] },
    insight: { kicker: 'KEY INSIGHT', title: '关键洞察', statement: '真正需要解决的不是“做更多”，而是让目标、证据和动作形成闭环。', evidence: ['证据一：待人工确认', '证据二：待人工确认', '证据三：待人工确认'], source: '资料来源：待人工确认' },
    actions: { kicker: 'NEXT ACTIONS', title: '下一步行动', actions: [
      { when: '现在', title: '确认决策目标', owner: '负责人待确认' },
      { when: '本周', title: '补齐事实材料', owner: '负责人待确认' },
      { when: '下周', title: '完成第一轮试点', owner: '负责人待确认' },
      { when: '节点后', title: '复盘并决定是否推广', owner: '负责人待确认' },
    ], closing: '让下一步清晰、可执行、可验证。' },
  };
  return defaults[kind];
}

export function getOpenDesignThemeConfig(themeKey) {
  return byKey.get(themeKey) || null;
}

export function getOpenDesignThemePageDefinitions(themeKey) {
  const theme = getOpenDesignThemeConfig(themeKey);
  if (!theme) return [];
  return PAGE_KINDS.map(([kind, label], index) => ({
    kind,
    slot: kind,
    label,
    pageNumber: index + 1,
    key: `${themeKey}_page${String(index + 1).padStart(3, '0')}`,
    layout: `${theme.layoutPrefix}-${String(index + 1).padStart(3, '0')}`,
    defaultProps: themeDefaults(theme, kind),
    controls: [],
  }));
}

export const OPEN_DESIGN_THEME_PACKS = OPEN_DESIGN_THEME_CONFIGS.map((theme) => ({
  key: theme.key,
  displayName: theme.displayName,
  label: theme.displayName,
  name: theme.displayName,
  scenario: theme.scenario,
  audience: theme.audience,
  mode: 'replace',
  provenance: { source: theme.source, upstream: theme.upstream, license: theme.license, excluded: ['guizang-ppt'] },
}));

export const OPEN_DESIGN_THEME_PAGES = OPEN_DESIGN_THEME_CONFIGS.flatMap((theme) =>
  getOpenDesignThemePageDefinitions(theme.key).map((page) => ({
    key: page.key,
    themeKey: theme.key,
    pageNumber: page.pageNumber,
    layout: page.layout,
    slot: page.slot,
    label: page.label,
    bgClass: '',
    controls: page.controls,
    defaultProps: page.defaultProps,
  })),
);
