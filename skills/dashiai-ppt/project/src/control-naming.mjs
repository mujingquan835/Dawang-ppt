const TEXT_REPLACEMENTS = [
  ['图片面板', '占比面板'],
  ['数据芯片数量', '指标卡片数量'],
  ['数据芯片数', '指标卡片数'],
  ['数据芯片', '指标卡片'],
  ['持仓行数', '表格行数'],
  ['持仓小卡', '条目小卡'],
  ['持仓气泡', '条目气泡'],
  ['持仓', '条目'],
  ['风险等级', '状态等级'],
  ['风险水位', '状态强度'],
  ['风险链节', '状态链节'],
  ['风险传导链', '状态传导链'],
  ['风险维度', '状态维度'],
  ['风险说明', '状态说明'],
  ['风险解读', '状态解读'],
  ['风险数量', '状态项数量'],
  ['风险卡数量', '状态卡数量'],
  ['风险卡', '状态卡'],
  ['重点风险', '重点项'],
  ['突出风险', '突出项'],
  ['风险', '状态'],
  ['投资人类型占比', '分类占比'],
  ['投资人类型数', '分类数量'],
  ['投资人类型', '分类类型'],
  ['投资人说', '角色说'],
  ['投资人', '角色'],
  ['平均单笔融资金额', '平均指标'],
  ['融资时间轴', '时间轴'],
  ['融资额', '数值'],
  ['融资金额', '数值指标'],
  ['融资规模', '数值规模'],
  ['融资里程碑', '里程碑'],
  ['融资', '数值'],
  ['资本来源', '来源'],
  ['资本占比', '占比'],
  ['资本热度', '关注度'],
  ['长期资本', '长期支撑'],
  ['资本主张', '核心主张'],
  ['资本', '资源'],
  ['估值收入数', '指标数值'],
  ['估值柱条', '指标柱条'],
  ['估值标记', '指标标记'],
  ['估值锚', '参考锚'],
  ['估值兑现', '指标兑现'],
  ['合理估值', '合理指标'],
  ['估值', '指标'],
  ['赛道图例', '分类图例'],
  ['赛道行数', '分类行数'],
  ['赛道条数', '分类条数'],
  ['赛道数量', '分类数量'],
  ['赛道层数', '分类层数'],
  ['赛道组数', '分类组数'],
  ['赛道段数', '分类段数'],
  ['赛道列', '分类列'],
  ['赛道标签', '分类标签'],
  ['赛道副标', '分类副标'],
  ['赛道徽标', '分类徽标'],
  ['赛道瓷砖', '分类块'],
  ['赛道卡片', '分类卡片'],
  ['赛道卡', '分类卡'],
  ['赛道色', '分类色'],
  ['重点赛道', '重点分类'],
  ['赛道', '分类'],
  ['轮次图例', '阶段图例'],
  ['轮次数量', '阶段数量'],
  ['轮次列', '阶段列'],
  ['轮次结构', '阶段结构'],
  ['轮次', '阶段'],
  ['金额标签', '数值标签'],
  ['金额数字', '数值数字'],
  ['金额标注', '数值标注'],
  ['金额分层数', '数值分层数'],
  ['金额区间', '数值区间'],
  ['金额列', '数值列'],
  ['金额', '数值'],
  ['音乐人类型', '对象类型'],
  ['音乐人数量', '条目数量'],
  ['音乐人', '成员'],
  ['曲目清单', '条目清单'],
  ['曲目列表', '条目列表'],
  ['曲目数量', '条目数量'],
  ['曲目表', '条目表'],
  ['曲目标签', '条目标签'],
  ['曲目', '条目'],
  ['播放量条', '数据条'],
  ['播放量', '数值'],
  ['播放游标', '进度游标'],
  ['版税', '指标'],
  ['供应链网络图', '关系网络图'],
  ['供应链节点', '关系节点'],
  ['供应链', '关系链'],
  ['合规交付链', '交付链'],
  ['合规台账', '状态台账'],
  ['合规', '状态'],
  ['行业基准', '参考基准'],
  ['行业标签', '分类标签'],
  ['行业客户', '客户类型'],
  ['行业', '分类'],
  ['站台号', '大号编号'],
  ['看板行数', '列表行数'],
  ['看板', '列表'],
  ['季度列数', '时间列数'],
  ['季度柱数', '时间柱数'],
  ['季度网格', '时间网格'],
  ['季度分区', '时间分区'],
  ['季度面板', '时间面板'],
  ['季度', '时间段'],
  ['主打第几首', '重点序号'],
  ['主打高亮', '重点高亮'],
  ['主打曲目', '重点条目'],
  ['主打', '重点'],
  ['唱片位置', '视觉元素位置'],
  ['唱片同心纹路', '环形纹理'],
  ['唱纹', '环形纹理'],
  ['专辑封面', '封面图'],
  ['创作者印章', '身份印章'],
  ['创始人 / 分类', '角色 / 分类'],
  ['创始人', '角色'],
  ['公司芯片', '公司标签'],
  ['公司标签', '对象标签'],
  ['客户试点', '试点'],
  ['用户行为', '行为'],
  ['健康度', '状态度'],
  ['AI Capital Lab', '研究机构'],
  ['AI Capital', '研究机构'],
];

const KEY_REPLACEMENTS = [
  ['unicornScene', 'dynamicVisual'],
  ['risk', 'status'],
  ['asset', 'category'],
  ['tracklist', 'itemList'],
  ['track', 'guide'],
  ['record', 'visual'],
  ['scene', 'content'],
  ['deal', 'example'],
  ['round', 'stage'],
  ['sector', 'category'],
  ['valuation', 'metric'],
  ['capital', 'resource'],
  ['funding', 'metric'],
  ['holding', 'row'],
  ['portfolio', 'collection'],
  ['artist', 'member'],
  ['music', 'media'],
];

const REPEATED_GENERIC_TEXT_REPLACEMENTS = [
  ['分类分类', '分类'],
  ['数值数值', '数值'],
  ['状态状态', '状态'],
  ['条目条目', '条目'],
  ['指标指标', '指标'],
];

const ENGLISH_OPTION_LABELS = {
  absolute: '绝对值',
  accent: '强调色',
  all: '全部',
  alternate: '交替',
  amount: '数值',
  arabic: '阿拉伯数字',
  area: '面积图',
  arrow: '箭头',
  asc: '升序',
  ascend: '上升',
  auto: '自适应',
  automations: '自动化',
  band: '色带',
  bar: '柱状',
  bars: '条形',
  below: '下方',
  black: '黑色',
  bl: '左下',
  blue: '蓝色',
  bottom: '底部',
  'bottom-left': '左下',
  'bottom-right': '右下',
  both: '两侧',
  box: '方框',
  br: '右下',
  bubble: '气泡',
  bubbles: '气泡',
  bullish: '积极',
  burst: '爆发',
  cards: '卡片',
  category: '分类',
  cautions: '谨慎',
  cautious: '谨慎',
  cells: '格子',
  center: '居中',
  centered: '居中',
  'center-left': '左中',
  change: '变化',
  chart: '图表',
  circle: '圆形',
  cluster: '聚类',
  collage: '拼贴',
  color: '彩色',
  column: '列式',
  columns: '多列',
  constellation: '星群',
  contain: '完整显示',
  cool: '冷色',
  corner: '角标',
  count: '数量',
  cover: '填充裁剪',
  dark: '深色',
  dashed: '虚线',
  data: '数据',
  dawn: '晨光',
  default: '默认',
  delta: '差值',
  desc: '降序',
  descend: '下降',
  dest: '目标',
  diverging: '分歧',
  donut: '环形图',
  dot: '圆点',
  dots: '点阵',
  dumbbell: '哑铃图',
  duotone: '双色',
  dusk: '暮色',
  ember: '暖焰',
  feature: '重点图文',
  figure: '大数字',
  fill: '填充',
  flat: '平铺',
  flow: '流程',
  from: '起点',
  full: '全幅',
  funnel: '漏斗',
  gate: '闸门',
  gauge: '仪表',
  gauges: '仪表组',
  glass: '玻璃',
  gloss: '光泽',
  glow: '发光',
  goey: '流体',
  gradient: '渐变',
  graphite: '石墨',
  green: '绿色',
  grid: '网格',
  group: '分组',
  grouped: '分组',
  hatched: '斜纹',
  heat: '热度',
  heatmap: '热力图',
  hero: '主视觉',
  'hero-left': '主视觉在左',
  'hero-right': '主视觉在右',
  horizontal: '横向',
  image: '图片',
  ink: '墨色',
  justified: '两端对齐',
  ladder: '阶梯',
  landscape: '横图',
  layers: '层级',
  left: '左侧',
  lens: '镜头',
  letter: '字母',
  level: '水平',
  light: '浅色',
  lime: '荧光绿',
  line: '折线',
  linear: '线性',
  lines: '线条',
  list: '列表',
  lollipop: '棒棒糖',
  map: '地图',
  media: '媒体',
  mesh: '网格',
  meters: '仪表',
  midnight: '午夜',
  mirror: '镜像',
  mono: '单色',
  month: '月度',
  monthly: '按月',
  mosaic: '马赛克',
  moving: '动态',
  multi: '多色',
  muted: '柔和',
  nested: '嵌套',
  none: '无',
  norm: '标准化',
  normal: '常规',
  number: '数字',
  orbit: '环绕',
  outline: '描边',
  overlay: '叠加',
  panel: '面板',
  paper: '纸面',
  pie: '饼图',
  pill: '胶囊',
  pincer: '夹击',
  pink: '粉色',
  plain: '纯净',
  portrait: '竖图',
  pressure: '压力',
  primary: '主色',
  pyramid: '金字塔',
  quote: '引语',
  radar: '雷达',
  radial: '放射',
  radius: '半径',
  ratio: '比例',
  right: '右侧',
  ring: '环形',
  roman: '罗马数字',
  rounded: '圆角',
  row: '横排',
  rows: '多行',
  scatter: '散点',
  score: '评分',
  segment: '分段',
  segments: '分段',
  series: '系列',
  side: '侧边',
  solid: '纯色',
  source: '来源',
  spark: '亮点',
  spiral: '螺旋',
  split: '分栏',
  'split-left': '左分栏',
  'split-right': '右分栏',
  slope: '斜率',
  square: '正方形',
  stack: '堆叠',
  stacked: '堆叠',
  step: '阶梯',
  steps: '步骤',
  table: '表格',
  tags: '标签',
  tech: '科技',
  text: '文字',
  ticket: '票卡',
  timeline: '时间轴',
  tl: '左上',
  to: '终点',
  top: '顶部',
  'top-left': '左上',
  total: '总计',
  tr: '右上',
  treemap: '矩形树图',
  underline: '下划线',
  unicorn: '动态视觉',
  vapor: '雾化',
  vertical: '纵向',
  violet: '紫色',
  vs: '对比',
  waterfall: '瀑布',
  warm: '暖色',
  white: '白色',
  year: '年度',
  yearly: '按年',
  yellow: '黄色',
  zigzag: '折线',
};

// 导入期清洗:把外部设计源的历史词汇替换为规范文案。只在 themes:import / metadata:update
// 的生成链路调用;生成产物(generated-metadata.js)里的文本已是清洗结果,运行时无需重复。
export function sanitizeImportedControlText(value) {
  if (typeof value !== 'string') return value;
  let next = value;
  for (const [from, to] of TEXT_REPLACEMENTS) {
    next = next.replaceAll(from, to);
  }
  for (const [from, to] of REPEATED_GENERIC_TEXT_REPLACEMENTS) {
    next = next.replaceAll(from, to);
  }
  return next.replace(/\s+/g, ' ').trim();
}

// 深度清洗 controls 的 UI 文案(string 叶子)。value/image/default 是数据而非文案:
// default 与 defaultProps 同源,清洗它会造成两个 default surface 漂移(contract-risk-audit 会报 mismatch)。
export function sanitizeImportedControls(value) {
  if (typeof value === 'string') return sanitizeImportedControlText(value);
  if (Array.isArray(value)) return value.map(sanitizeImportedControls);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    key === 'value' || key === 'image' || key === 'default' ? item : sanitizeImportedControls(item),
  ]));
}

// 运行时归一化:数据在生成期已清洗(130 条导入替换在全量 controls 上实测零命中),只保留空白归一化。
export function normalizeControlText(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeControlValue(value) {
  if (typeof value === 'string') return normalizeControlText(value);
  if (Array.isArray(value)) return value.map(normalizeControlValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    key === 'value' || key === 'image' ? item : normalizeControlValue(item),
  ]));
}

export function normalizeControlOptions(options) {
  if (!Array.isArray(options)) return normalizeControlValue(options);
  return options.map((option, index) => normalizeControlOption(option, index));
}

function normalizeControlOption(option, index = 0) {
  if (Array.isArray(option)) {
    if (isPaletteOption(option)) {
      return {
        value: option.map(item => item),
        label: `配色 ${index + 1}`,
        color: paletteSwatchBackground(option),
      };
    }
    return {
      value: option[0],
      label: normalizeOptionLabel(option[1] ?? option[0], option[0], index),
      image: option[2] || '',
      color: option[3] || '',
    };
  }
  if (option && typeof option === 'object' && 'value' in option) {
    return {
      ...normalizeControlValue(option),
      value: option.value,
      label: normalizeOptionLabel(option.label ?? option.value, option.value, index),
    };
  }
  return {
    value: option,
    label: normalizeOptionLabel(option, option, index),
  };
}

export function normalizeOptionLabel(label, value = label, index = 0) {
  if (value == null || label == null) return '隐藏';
  if (isHexColor(value) && (label === value || String(label).trim() === String(value).trim())) {
    return `颜色 ${index + 1}`;
  }
  const normalized = normalizeControlText(String(label));
  const direct = optionLabelForValue(normalized);
  if (direct) return direct;
  const byValue = optionLabelForValue(value);
  if (byValue && (normalized === String(value) || /^[A-Za-z0-9_./ -]+$/.test(normalized))) return byValue;
  return normalized
    .replace(/\bYES\b/g, '是')
    .replace(/\bNO\b/g, '否')
    .replace(/\b8-bit\b/gi, '像素');
}

function optionLabelForValue(value) {
  if (value == null) return '隐藏';
  const key = String(value).trim().toLowerCase();
  return ENGLISH_OPTION_LABELS[key] || null;
}

function isHexColor(value) {
  return /^#[0-9a-f]{3,8}$/i.test(String(value || ''));
}

function isPaletteOption(item) {
  return item.length > 1 && item.every(value => isHexColor(value));
}

function paletteSwatchBackground(colors) {
  const count = Math.max(1, colors.length);
  if (count === 1) return colors[0];
  const stops = colors.map((color, index) => {
    const from = index / count * 100;
    const to = (index + 1) / count * 100;
    return `${color} ${from}% ${to}%`;
  });
  return `linear-gradient(135deg, ${stops.join(', ')})`;
}

export function normalizePublicControls(controls, context = {}) {
  const seen = new Map();
  return (controls || []).map((control, index) => {
    const normalized = normalizePublicControl(control, { ...context, index });
    const basePublicKey = normalized.publicKey || normalized.key;
    const count = seen.get(basePublicKey) || 0;
    seen.set(basePublicKey, count + 1);
    if (!count) return normalized;
    return {
      ...normalized,
      publicKey: `${basePublicKey}${count + 1}`,
    };
  });
}

export function normalizePublicControl(control, context = {}) {
  const key = control.key || control.prop;
  const label = normalizeControlText(control.label || key);
  const desc = normalizeControlText(control.desc || control.description || control.describe);
  const publicKey = normalizePublicKey(key, { ...control, label, desc }, context);
  // description/describe/publicLabel 是源 metadata 的别名字段,归一化为 label/desc 后不再重复输出。
  const { description, describe, publicLabel, ...rest } = control;
  return {
    ...rest,
    key,
    publicKey,
    label,
    desc,
    options: normalizeControlOptions(control.options),
  };
}

export function normalizePublicKey(key, control = {}) {
  if (!key) return key;
  const exact = exactPublicKey(key);
  if (exact) return exact;

  let next = key;
  for (const [from, to] of KEY_REPLACEMENTS) {
    next = replaceKeyToken(next, from, to);
  }

  if (next !== key) return lowerFirst(next);

  const text = `${control.label || ''} ${control.desc || control.description || ''}`;
  if (/状态等级|状态强度/.test(text)) return key.startsWith('show') ? 'showStatusRating' : 'statusLevel';
  if (/分类/.test(text) && key.endsWith('Count')) return 'categoryCount';
  if (/条目/.test(text) && key.endsWith('Count')) return 'itemCount';
  if (/数值/.test(text) && /^show/i.test(key)) return 'showValueLabels';
  return key;
}

export function resolvePublicPropAliases(props = {}, controls = []) {
  const aliasToKey = new Map();
  const rawKeys = new Set();
  for (const control of controls || []) {
    if (!control?.key) continue;
    rawKeys.add(control.key);
    if (control.publicKey && control.publicKey !== control.key) aliasToKey.set(control.publicKey, control.key);
  }

  const next = {};
  const appliedAliases = {};
  for (const [key, value] of Object.entries(props || {})) {
    const rawKey = aliasToKey.get(key);
    if (rawKey && !Object.hasOwn(props, rawKey)) {
      next[rawKey] = value;
      appliedAliases[key] = rawKey;
    } else {
      next[key] = value;
    }
  }
  return { props: next, appliedAliases, rawKeys, aliasToKey };
}

export function toPublicProps(props = {}, controls = []) {
  const keyToAlias = new Map();
  for (const control of controls || []) {
    if (control?.key) keyToAlias.set(control.key, control.publicKey || control.key);
  }
  return Object.fromEntries(Object.entries(props || {}).map(([key, value]) => [
    keyToAlias.get(key) || key,
    value,
  ]));
}

function exactPublicKey(key) {
  const exact = {
    dealCount: 'exampleCount',
    showDeals: 'showExamples',
    riskCount: 'statusItemCount',
    showRisk: 'showStatus',
    showRating: 'showStatusRating',
    showLevel: 'showStatusLevel',
    showValuation: 'showMetricMarker',
    showTracklist: 'showItemList',
    trackCount: 'itemCount',
    recordSide: 'visualSide',
    sceneCount: 'contentItemCount',
    showScenes: 'showItemTags',
    quarterCount: 'timeColumnCount',
    assetCount: 'categoryCount',
    flowStageCount: 'stepCount',
    segmentCount: 'segmentCount',
    tagCount: 'tagCount',
    showShareBar: 'showShareBar',
  };
  return exact[key] || null;
}

function replaceKeyToken(value, from, to) {
  const lowerPattern = new RegExp(`(^|[_-])${from}(?=$|[_-])`, 'ig');
  const upperPattern = new RegExp(`${upperFirst(from)}(?=$|[A-Z])`, 'g');
  return value
    .replace(lowerPattern, (match, prefix) => `${prefix}${to}`)
    .replace(upperPattern, upperFirst(to));
}

function lowerFirst(value) {
  return value ? `${value[0].toLowerCase()}${value.slice(1)}` : value;
}

function upperFirst(value) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}
