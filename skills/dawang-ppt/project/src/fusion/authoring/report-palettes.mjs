import { lighten } from './layout-kit.mjs';

// Nine signature three-tone palettes faithfully calibrated to the reference 9-palette showcase:
//   - primary   (accent1): dominant cool/deep anchor colour (e.g. Royal Blue #23338B in blue-gold)
//   - secondary (accent2): paired warm/complementary partner (e.g. Champagne Gold #E2B898) — actively paired & alternated!
//   - pop       (accent3): high-energy focal accent (e.g. Hermes Orange #FA6500) — spotlighting #1 metrics, key clause & callouts
// Plus two dark flagship themes (midnight-gold, cyber-cyan) for keynote/executive scenarios.

const LIGHT_BASE = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  ink: '#1A202C',
  body: '#3B4252',
  muted: '#64748B',
  line: '#E2E6EE',
  inverse: '#FFFFFF',
  dark: false,
};

const makeLight = (id, name, primary, secondary, pop, fit, extra = {}) => ({
  id,
  name,
  fit,
  ...(extra.limits ? { limits: extra.limits } : {}),
  palette: {
    ...LIGHT_BASE,
    bg: extra.bg || '#FFFFFF',
    surface: '#FFFFFF',
    tile: '#FFFFFF',
    accent: primary,
    primary,
    secondary,
    pop,
    pale: extra.pale || lighten(primary, 0.94),
    band: extra.band || lighten(primary, 0.94),
    softSecondary: extra.softSecondary || lighten(secondary, 0.82),
    highlightBg: extra.highlightBg || lighten(secondary, 0.86),
  },
});

const makeDark = (id, name, primary, secondary, pop, fit, extra = {}) => ({
  id,
  name,
  fit,
  palette: {
    bg: extra.bg || '#0D1526',
    surface: extra.surface || '#152238',
    tile: extra.surface || '#152238',
    ink: '#F8FAFC',
    body: '#CBD5E1',
    muted: '#94A3B8',
    line: extra.line || '#283C5C',
    inverse: extra.onPrimary || '#0D1526',
    accent: primary,
    primary,
    secondary,
    pop,
    pale: extra.pale || '#192945',
    band: extra.band || '#142138',
    softSecondary: '#1E2C47',
    highlightBg: '#24293D',
    dark: true,
    onSolid: extra.onPrimary || '#0D1526',
  },
});

export const REPORT_PALETTES = [
  // === 9 种经典三色协同配色（精确还原参考色卡：冷暖双主色成对交替 + 亮色点睛） ===
  makeLight('blue-gold', '蓝金色', '#23338B', '#E2B898', '#FA6500', '首选推荐：皇家宝蓝与香槟暖金双色交错，活力橙画龙点睛，稳重高级且极富层次感'),
  makeLight('stone-gold', '皓石金', '#2D4F6E', '#F1B871', '#E49882', '深海皓蓝配暖麦金与珊瑚杏，适合产品、财务与项目阶段汇报'),
  makeLight('business-gold', '商务金', '#2A2936', '#B4A393', '#D2C6BB', '黑曜炭灰配温润流沙金，管理层与高端客户提案首选'),
  makeLight('jade-gold', '翡翠金', '#438C80', '#E1BC8B', '#DE8784', '清雅翡翠绿配香槟金与珊瑚粉，适合人力、行政与服务类述职'),
  makeLight('green-red-gold', '绿红金', '#59846C', '#D2423C', '#E1A662', '松柏绿与朱砂红鲜明对撞配暖金，适合达成与差距对照复盘'),
  makeLight('blue-cyan', '蓝青色', '#3A7EBF', '#3AB4C9', '#EFCC6B', '明澈晴空蓝配湖光青与柠檬金，适合互联网、产品与数据周报'),
  makeLight('red-gold', '红金色', '#C72231', '#D45022', '#E3A557', '正统朱红配炽橙暖金，适合年度总结、表彰与冲刺动员', { limits: '问题页控制红色面积' }),
  makeLight('purple-gold-orange', '紫金橙', '#4A4C81', '#F0C25E', '#ED8300', '典雅鸢尾紫配明金与活力橙，适合市场营销与品牌复盘'),
  makeLight('primary-colors', '三原色', '#5E96FA', '#F65474', '#F8CF67', '明快晴蓝、珊瑚玫红与明黄碰撞，适合年轻化团队与创意周报'),

  // === 2 种深色旗舰主题（按需选用） ===
  makeDark('midnight-gold', '星夜曜金', '#F59E0B', '#38BDF8', '#FB7185', '深海夜蓝暗底配高光琥珀金与天青，适合产品发布与高管战略汇报'),
  makeDark('cyber-cyan', '黑曜电青', '#22D3EE', '#818CF8', '#F59E0B', '黑曜石暗底配极光青与电光紫，适合 AI 与科技工具展示', {
    bg: '#0E121B',
    surface: '#171E2E',
    pale: '#1B2538',
    band: '#151D2C',
    line: '#29354D',
    onPrimary: '#0B111A',
  }),
];

// Friendly aliases for previous mood IDs so existing commands never break
const ALIASES = {
  'warm-coral': 'red-gold',
  'amber-gold': 'stone-gold',
  'electric-blue': 'blue-gold',
  'emerald-sun': 'jade-gold',
  'crimson-gold': 'red-gold',
  'coral-rose': 'primary-colors',
};

export const reportPalette = (id) => {
  const key = ALIASES[id] || id;
  const hit = REPORT_PALETTES.find((x) => x.id === key || x.name === key);
  if (!hit) throw new Error(`unknown report palette: ${id} (choose ${REPORT_PALETTES.map((x) => x.id).join(' / ')})`);
  return hit.palette;
};
