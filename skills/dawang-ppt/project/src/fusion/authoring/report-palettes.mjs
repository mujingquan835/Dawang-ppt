import { lighten } from './layout-kit.mjs';

// Nine report palettes distilled from a 245-page work-report template sold in nine colourways. Every colourway keeps
// the same structure: one deep primary (titles, solid blocks, this period's figures), one soft secondary (the
// comparison side: last period, gaps, plans) and one pop colour used sparingly for the single strongest item, on a
// white page with near-black body text. Hex values are the template's theme slots accent1 / accent2 / accent3.
// Pass one to createTheme({ palette }) as is; accent equals primary, so title focus and highlighted tiles use it.
const NEUTRAL = { bg: '#FFFFFF', ink: '#1F2430', muted: '#5F6672', line: '#DADDE3', inverse: '#FFFFFF' };
const make = (id, name, primary, secondary, pop, fit) => ({ id, name, fit, palette: { ...NEUTRAL, accent: primary, primary, secondary, pop, pale: lighten(primary, 0.94) } });

export const REPORT_PALETTES = [
  make('blue-gold', '蓝金', '#23338B', '#E2B898', '#FA6500', '稳重正式，经营与年度汇报的默认选择'),
  make('blue-cyan', '蓝青', '#3A7EBF', '#3AB4C9', '#EFCC6B', '清爽偏科技，互联网、产品与数据周报'),
  make('business-gold', '商务金', '#2A2936', '#B4A393', '#D2C6BB', '低饱和高级感，管理层与高端客户汇报；强调色弱，重点靠尺度'),
  make('green-red-gold', '绿红金', '#59846C', '#D2423C', '#E1A662', '对比强烈：绿为达成、红为差距，适合问题与改进对照'),
  make('jade-gold', '翡翠金', '#438C80', '#E1BC8B', '#DE8784', '温和自然，人力、行政、服务类述职'),
  make('purple-gold-orange', '紫金橙', '#4A4C81', '#F0C25E', '#ED8300', '沉稳中带活力，市场与品牌复盘'),
  make('red-gold', '红金', '#C72231', '#D45022', '#E3A557', '喜庆热烈，年终总结、表彰与冲刺动员'),
  make('primary-colors', '三原色', '#F65474', '#5E96FA', '#F8CF67', '活泼年轻，团队分享与轻量周报；正式汇报慎用'),
  make('stone-gold', '皓石金', '#2D4F6E', '#F1B871', '#E49882', '深蓝配暖金，财务、项目与年度规划')
];

export const reportPalette = (id) => {
  const hit = REPORT_PALETTES.find((x) => x.id === id || x.name === id);
  if (!hit) throw new Error(`unknown report palette: ${id} (choose ${REPORT_PALETTES.map((x) => x.id).join(' / ')})`);
  return hit.palette;
};
