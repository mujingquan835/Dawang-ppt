import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const S = new URL('../../../skills/dawang-ppt/project/src/fusion/', import.meta.url).href;
const { buildOutlineBaseline } = await import(S + 'authoring/outline-baseline.mjs');
const { composeReportDeck } = await import(S + 'authoring/report-deck.mjs');
const { createLayoutMeasurer } = await import(S + 'planning/measure-layout.mjs');

// Builds a deck whose pages differ in every way that matters: role, density, photos, tables, flows, comparison, periods.
const [dir, palette = 'blue-gold'] = process.argv.slice(2);
fs.mkdirSync(dir, { recursive: true });
function png(file, width, height, [r, g, b]) {
  const crc = (buf) => { let c, n = 0xffffffff; for (const byte of buf) { c = (n ^ byte) & 255; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; n = c ^ (n >>> 8); } return (n ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const h = Buffer.from(t), l = Buffer.alloc(4), s = Buffer.alloc(4); l.writeUInt32BE(d.length); s.writeUInt32BE(crc(Buffer.concat([h, d]))); return Buffer.concat([l, h, d, s]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3).map((_, i) => [r, g, b][i % 3])]);
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(Array(height).fill(row)))), chunk('IEND', Buffer.alloc(0))]));
}
png(path.join(dir, 'tall.png'), 600, 900, [90, 130, 200]); png(path.join(dir, 'wide.png'), 900, 600, [200, 140, 90]);
const from = { locator: '合成材料', excerpt: '合成' }, st = (id, label, text, extra) => ({ id, label, text, from, ...extra }), it = (title, detail) => ({ title, detail, from }), d = (label, value, unit) => ({ label, value, unit, from });
const long = '这是一段较长的说明文字，用来检验模块在内容变多时能否自动增高、换行之后仍然对齐并且不伸进页脚。';
const photo = (f, caption) => ({ src: path.join(dir, f), caption });
const pages = [
  { role: 'summary', keyLine: { text: '整体判断：三季度签约 48 单，完成目标的 96%', source: 'quoted' }, statements: [st('a', '整体判断', '三季度目标基本达成，差距集中在新客转化。')], data: [d('签约', '48', '单'), d('完成率', '96', '%')] },
  { role: 'results', keyLine: { text: '六项指标全部增长，续费贡献最大', source: 'quoted' }, statements: [st('q', '业务问题', long), st('v', '复盘判断', long), st('t', 'AI 提效', '后台批量出图。')], items: [it('动作一', long), it('动作二', '短句'), it('动作三', '短句')], data: ['甲', '乙', '丙', '丁', '戊', '己'].map((x, i) => d(x, String(i * 11 + 3), '单')), photos: [photo('tall.png', '竖图')] },
  { role: 'resources', keyLine: { text: '三类资源支持业务', source: 'quoted' }, statements: [st('m', '获取方式', '置换合作', { asMetric: true }), st('v', '复盘判断', '组合使用更好。')], items: [it('甲', '一句话'), it('乙', '一句话'), it('丙', '一句话')], data: [d('门票', '1000', '张')], photos: [photo('tall.png', '门票'), photo('wide.png', '大屏'), { ...photo('wide.png', '外立面') }] },
  { role: 'other', keyLine: { text: '八类资源逐项对应场景', source: 'quoted' }, table: { columns: ['序', '资源项', '内容', '场景'], rows: Array.from({ length: 8 }, (_, i) => [String(i + 1), `资源 ${i + 1}`, '节点大屏资源合作', '品牌曝光、项目外宣、联合传播']), highlight: [0, 1], from }, chains: [{ title: '链一', steps: ['甲', '乙', '丙'], from }, { title: '链二', steps: ['甲', '乙', '丙'], from }] },
  { role: 'issues', keyLine: { text: '问题集中在跟进时效', source: 'quoted' }, compare: { leftLabel: '问题', rightLabel: '改进', left: [it('转化低', '回访慢'), it('跟进慢', '无提醒')], right: [it('建台账', '48 小时回访'), it('设提醒', '逾期升级')], from }, statements: [st('v', '复盘判断', '先解决时效。')] },
  { role: 'plan', keyLine: { text: '四季度按三个阶段推进', source: 'quoted' }, periods: [{ label: '10 月', title: '建机制', points: ['回访台账'], from }, { label: '11 月', title: '跑试点', points: ['两家门店'], from }, { label: '12 月', title: '全量', points: ['复盘'], from }] },
  { role: 'duties', keyLine: { text: '负责天津市场支持', source: 'quoted' }, statements: [st('a', '岗位定位', '服务 100 家门店。')] },
  { role: 'actions', keyLine: { text: '三个动作', source: 'quoted' }, items: [it('甲', ''), it('乙', ''), it('丙', '')], flows: [{ title: '流程一', steps: [{ title: '甲', detail: long }, { title: '乙' }, { title: '丙' }], from }, { title: '流程二', steps: ['甲', '乙'], from }, { title: '流程三', steps: ['甲', '乙', '丙', '丁'], from }] },
  { role: 'results', keyLine: { text: '两张横图证明现场', source: 'quoted' }, photos: [photo('wide.png', '现场一'), photo('wide.png', '现场二')], items: [it('甲', '一句话')] },
  // p10 pins tiles (figureStyle), so it keeps testing the tight tile row whatever the page before it drew.
  { role: 'results', figureStyle: 'tiles', keyLine: { text: '这是一个较长的标题用来检验放不下一行时能否自动缩小字号并保持结构完整', source: 'quoted' }, data: [d('甲', '12', '万元'), d('乙', '34', '万元'), d('丙', '56', '万元'), d('丁', '78', '万元')] },
  { role: 'results', keyLine: { text: '留资量超过全年目标', source: 'quoted' }, data: [{ label: '留资量', value: '41,280', unit: '条', target: '36,000', from }, { label: '到店', value: '3,156', unit: '台', from }, { label: '线索成本', value: '142', unit: '元', from }] },
  { role: 'results', keyLine: { text: '带动销量和转化都有目标口径', source: 'quoted' }, data: [{ label: '带动销量', value: '3,156', unit: '台', target: '2,800', from }, { label: '门店直播', value: '572', unit: '场', from, icon: 'coin' }, { label: '转化率', value: '25.6', unit: '%', target: '22%', from }] },
  { role: 'actions', keyLine: { text: '答谢晚宴到场转化为成交', source: 'quoted' }, statements: [st('w', '晚宴内容', '颁奖、预告和权益发布。')], flows: [{ title: '从到场到成交', from, steps: [{ title: '到场 682 组', detail: '五城各一场' }, { title: '锁定意向 214 组', detail: '发布双向补贴' }, { title: '新成交 96 台', detail: '占当月 18.7%' }] }], data: [{ label: '新成交', value: '96', unit: '台', from }, { label: '晒图', value: '530', unit: '条', from }, { label: '曝光', value: '600', unit: '万', from }] },
  { role: 'plan', keyLine: { text: '双项目分四步推进', source: 'quoted' }, periods: [['8月', '内容筹备', '甲项目'], ['8月', '促销准备', '乙项目'], ['9月', '专访发布', '甲项目'], ['9月全月', '执行冲刺', '乙项目']].map(([label, title, lane]) => ({ label, title, lane, points: ['确定计划并推进执行', '同步节点和负责人'], from })) },
  { role: 'results', keyLine: { text: '单项指标配三张现场照片', source: 'quoted' }, statements: [st('r', '串联资源', '清凉礼品、门店服务和品牌物料串联业务。')], data: [{ label: '预计参与', value: '700', unit: '人', from }], photos: [photo('tall.png', '一'), photo('tall.png', '二'), photo('tall.png', '三')], order: ['metrics', 'r'] },
  { role: 'plan', keyLine: { text: '两个项目交替推进', source: 'quoted' }, periods: [['8月上旬', '内容筹备', '甲项目'], ['8月中下旬', '促销准备', '乙项目'], ['9月上旬', '专访发布', '甲项目'], ['9月全月', '执行冲刺', '乙项目']].map(([label, title, lane]) => ({ label, title, lane, points: ['同步节点'], from })) },
  { role: 'summary', keyLine: { text: '亮点集中在直播，待改进集中在门店执行', source: 'quoted' }, compare: { leftLabel: '亮点', rightLabel: '待改进', left: [it('直播留资', '下半年翻了三倍'), it('老带新', '转介绍率超过目标'), it('联名活动', '三场都带来到店')], right: [it('门店差距', '最高和最低相差七倍'), it('主播流动', '培训成本反复支付')], from } },
  { role: 'results', keyLine: { text: '线索成本从 260 元降到 96 元', source: 'quoted' }, compare: { leftLabel: '2026 上半年', rightLabel: '2026 下半年', left: [it('场均观看', '1,240 人'), it('直播留资', '4,200 条'), it('线索成本', '260 元')], right: [it('场均观看', '3,860 人'), it('直播留资', '13,800 条'), it('线索成本', '96 元')], from }, statements: [st('k', '关键动作', '统一话术脚本，销售顾问与主播双人出镜。')] },
  // p19: two short figures under long labels hug their content as wide tiles, which start at the left margin.
  { role: 'results', keyLine: { text: '两项口碑指标都在提升', source: 'quoted' }, data: [d('老车主转介绍带来的新增成交占比', '15', '%'), d('车主社群月度活跃用户占比', '62', '%')] },
  // p20: four figures, the title names one, right after p19's tiles: the deck draws them as an anchored strip.
  { role: 'results', keyLine: { text: '全年留资 52,000 条，四项目标同步推进', source: 'quoted' }, data: [d('区域留资量', '52,000', '条'), d('营销带动销量', '3,800', '台'), d('直播留资占比', '55', '%'), d('老车主转介绍率', '15', '%')] },
  // p21: four items of about one length, each with a sentence, on their own line: equal cards.
  { role: 'issues', keyLine: { text: '直播仍有四个短板', source: 'quoted' }, itemsHeading: '现存问题', items: [it('水平不均', '门店间水平差异大，最高与最低差七倍'), it('主播流失', '主播流动性高，培训成本被反复支付'), it('切片不足', '短视频切片产出不足，长尾流量没接住'), it('邀约偏低', '答谢晚宴邀约率仅 58%，需提前分层邀约')] },
].map((p, i) => ({ id: `p${i + 1}`, readerTask: '合成验证', ...p }));
const outline = { kind: 'report', scope: 'part', title: '矩阵', audience: '管理层', sources: [{ sourceId: 'x', kind: 'synthetic', title: '合成' }], pages };
const built = buildOutlineBaseline(outline, { baseDir: dir });
if (!built.ok) throw new Error(JSON.stringify(built.issues));
const { baseline, scaffold: deck } = built, measurer = await createLayoutMeasurer();
let r;
try { r = await composeReportDeck({ outline, deck, palette, measurer, footer: '合成材料' }); } finally { await measurer.close(); }
deck.requirements.projectId = `matrix-${palette}-${Date.now().toString(36)}`;
deck.contentPlan.throughLine = { placements: [{ slideId: 'p1', elementId: 'title' }], source: 'quoted', from: '合成' };
const ok = { status: 'applied', how: '合成验证', evidence: [{ slideId: 'p1', elementIds: ['title'] }] };
deck.contentPlan.ruleChecklist = { scenario: 'management-report', items: Object.fromEntries(['general#Requirements', 'scenario#Clear and direct content; no empty talk', 'scenario#Visualize information with structural diagrams', 'scenario#Key Requirements', 'scenario#Visual References', 'scenario#Color Palette Reference'].map((k) => [k, ok])) };
fs.writeFileSync(path.join(dir, 'content-baseline.json'), JSON.stringify(baseline, null, 2));
fs.writeFileSync(path.join(dir, 'authored.json'), JSON.stringify(deck, null, 2));
console.log(JSON.stringify({ scales: r.scales, sparse: r.sparse, loose: r.loose, forms: r.forms }));
