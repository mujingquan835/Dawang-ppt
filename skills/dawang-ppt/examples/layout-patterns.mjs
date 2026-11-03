import fs from 'node:fs';
import { createTheme, createGrid } from '../project/src/fusion/authoring/layout-kit.mjs';
import { pageHeader, tableWithFlows, metricsWithEvidence, listWithPhotos, itemsWithPhotos, tableWithPanel, twoLaneFlow } from '../project/src/fusion/authoring/patterns.mjs';
// Synthetic material showing each page pattern once. Wording and numbers are invented test content. Patterns are
// starting points: adjust parameters, add elements, or design freely. Real images use file paths plus imageSize().
const theme = createTheme({ palette: { bg: '#FFFFFF', ink: '#14213D', accent: '#E8590C' } }), grid = createGrid();
const swatch = (w, h, fill) => ({ src: 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${fill}"/></svg>`).toString('base64'), size: { width: w, height: h } });
const source = '示例材料：合成数据，仅用于展示页型';
const head = (page, title, focus, subtitle) => pageHeader({ theme, grid, eyebrow: '合成示例 · 页型', title, focus, subtitle, page, total: 6, source });

const pages = [
  tableWithFlows({ theme, grid, header: head(1, '甲线重点投入，三线共用流程', '甲线重点投入', '甲线重点、乙线持续、丙线按需，共用一套流程'),
    table: { columns: [{ key: 'line', label: '业务线', width: 260, size: 32, weight: 700 }, { key: 'level', label: '支持定位', width: 260 }, { key: 'focus', label: '工作重点', width: 620 }, { key: 'how', label: '投入方式', width: 588 }],
      rows: [{ line: '甲线', level: '重点支持', focus: '促销、案例传播、资源联动', how: '围绕关键节点集中投入' }, { line: '乙线', level: '持续支持', focus: '项目传播、直播', how: '复用内容模板' }, { line: '丙线', level: '按需支持', focus: '按需配合', how: '依据明确需求安排' }] },
    flows: [{ title: '提效：一份资料，三线复用', steps: [{ title: '资料共用', detail: '活动与案例资料' }, { title: '模板复用', detail: '海报与方案' }, { title: '数据出图', detail: '减少搬运' }] },
      { title: '安排：先排序，再分工', steps: [{ title: '需求汇入', detail: '多线并行' }, { title: '三维排序', detail: '价值 · 节点 · 条件' }, { title: '分工回收', detail: '执行与回收' }] }],
    note: '排序维度：业务价值 → 节点紧迫性 → 执行条件' }),
  metricsWithEvidence({ theme, grid, header: head(2, '活动期辅助新签 24 单、续费 36 单', '新签 24 单、续费 36 单', '客户需要看到使用效果；节点促销需要持续的传播内容'),
    hero: [{ value: '24', unit: '单', label: '辅助新签' }, { value: '36', unit: '单', label: '辅助续费' }],
    secondary: [{ value: '180', unit: '份', label: '收集案例' }, { value: '12', unit: '单', label: '新渠道签约' }, { value: '8', unit: '万元', label: '新签金额' }, { value: '9', unit: '万元', label: '续费金额' }],
    flow: { title: '关键动作', steps: [{ title: '提交凭证', detail: '作为资格依据' }, { title: '组合传播', detail: '形成活动节奏' }, { title: '销售跟进', detail: '承接签约意向' }] },
    notes: ['复盘：案例提供信任依据，权益提供参与入口，跟进承接意向。', '提效：后台批量出图，业务线可自行制作转发。'],
    image: { ...swatch(1600, 1700, '#7FA7D9'), caption: '活动海报（示意色块）' } }),
  listWithPhotos({ theme, grid, header: head(3, '双节点资源组合，维护 80 家门店客情', '80 家门店客情', '门票、大屏、场地组合支持业务'),
    items: [{ title: '展会门票', detail: '春季 800 张、秋季 400 张，用于门店拓客' }, { title: '广告大屏', detail: '商场大屏曝光；新增广告位 1 个' }, { title: '商圈场地', detail: '商场中厅，用于现场咨询' }],
    metrics: [{ value: '800', unit: '张', label: '春季门票' }, { value: '80', unit: '家', label: '门店客情维护' }],
    photos: [{ ...swatch(360, 480, '#C9B79C'), caption: '门票发放' }, { ...swatch(384, 256, '#9BB0C8'), caption: '中厅大屏' }, { ...swatch(384, 256, '#A9C3A0'), caption: '外立面大屏' }],
    note: { text: '围绕客户需求组合资源，明确每项资源的使用场景。' } }),
  tableWithPanel({ theme, grid, header: head(4, '六类合作资源按场景调用', null, '现有积累对应到具体市场场景'),
    table: { columns: [{ key: 'n', label: '序', width: 80, color: '#E8590C', weight: 700 }, { key: 'name', label: '资源项', width: 300, weight: 700 }, { key: 'have', label: '现有积累', width: 340, size: 22 }, { key: 'use', label: '可结合场景', width: 420, size: 22 }],
      rows: [['01', '商场广告大屏', '节点大屏合作', '品牌曝光、联合传播'], ['02', '商场中厅', '拓客场地合作', '咨询、线下活动'], ['03', '展会场地及门票', '门票置换经验', '门店破冰、客户邀约'], ['04', '饮品品牌', '产品／试吃', '节点传播'], ['05', '运动品牌', '课程', '客户触达'], ['06', '汽车品牌', '试驾送礼', '直播、项目传播']].map(([n, name, have, use]) => ({ n, name, have, use })) },
    panel: { title: '两条应用链', chains: [{ label: '链一', steps: ['展会／商圈资源', '门店客情与拓客', '大促准备'] }, { label: '链二', steps: ['品牌礼品资源', '直播与传播', '持续业务支持'] }] } }),
  twoLaneFlow({ theme, grid, header: head(5, '先排序、再分工，结果按节点回收', '先排序、再分工'),
    lanes: [{ title: '需求进入', steps: [{ title: '汇入', detail: '多线需求' }, { title: '排序', detail: '价值 · 节点 · 条件' }, { title: '分工', detail: '明确负责人' }] }, { title: '结果回收', steps: [{ title: '执行', detail: '按节点推进' }, { title: '回收', detail: '数据与案例' }, { title: '复用', detail: '进入资料库' }] }],
    conclusion: '同一套流程承接三条业务线' }),
  itemsWithPhotos({ theme, grid, header: head(6, '三类资源各有对应现场，维护 80 家门店', '维护 80 家门店', '每项资源与它的现场照片放在同一栏'),
    items: [{ title: '展会门票', detail: '春季 800 张、秋季 400 张，用于门店拓客', photo: { ...swatch(360, 480, '#C9B79C'), caption: '门票发放' } },
      { title: '广告大屏', detail: '商场大屏曝光；新增广告位 1 个', photo: { ...swatch(384, 256, '#9BB0C8'), caption: '中厅大屏' } },
      { title: '商圈场地', detail: '商场中厅，用于现场咨询', photo: { ...swatch(384, 256, '#A9C3A0'), caption: '外立面大屏' } }],
    metrics: [{ value: '800', unit: '张', label: '春季门票' }, { value: '80', unit: '家', label: '门店客情维护' }, { value: '置换', unit: '', label: '资源获取方式' }],
    note: '复盘：围绕客户需求组合资源，明确每项资源的使用场景。' })
];

export const authored = {
  requirements: { projectId: 'layout-patterns-example', title: '页型示例', fixedPageCount: pages.length },
  sources: { entries: [{ sourceId: 'synthetic', kind: 'synthetic' }] }, media: { entries: [] },
  contentPlan: { nodes: {}, slides: pages.map((p, i) => ({ slideId: `p${i + 1}`, visualDecision: p.visualDecision })) },
  designChoice: { styleId: 'authored/custom', appearance: { palette: theme.palette } },
  slides: pages.map((p, i) => ({ slideId: `p${i + 1}`, elements: p.elements }))
};
if (process.argv[1] === import.meta.filename) fs.writeFileSync(process.argv[2] || '/tmp/dawang-layout-patterns.json', JSON.stringify(authored, null, 2));
